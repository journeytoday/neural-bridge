import {validateOrder} from './platform.js';
/** NeuralBridge 0.1: deterministic simulator policy, not a calibrated ability estimator. */
export function createEngine({ now = () => Date.now() } = {}) {
  let sequence = 0;
  let prior = null;
  let activeProposal = null;
  let orderRule = null;
  let orderVersion = 0;
  const sessionId = `session-${now()}`;
  const refused = new Set();
  const state = {
    config: { targetScale: 1, dwellMs: 800, confirmation: 'direct', modality: 'pointer' },
    draft: '', selected: null, history: [], observations: [], proposal: null,
    availability: { pointer: true, keyboard: true, gaze: false, switch: false, blink: false, eeg: false },
    reliability: {}, recovery: null,
  };
  const record = (type, details = {}) => state.history.push({ id: ++sequence, timestamp: now(), sessionId, type, ...details });
  const usable = config => state.availability[config.modality] === true &&
    (!['switch', 'blink'].includes(config.confirmation) || state.availability[config.confirmation] === true);
  const publishProposal = proposal => {
    activeProposal = Object.freeze({ ...proposal, patch: Object.freeze({ ...proposal.patch }), before: Object.freeze({ ...proposal.before }) });
    state.proposal = structuredClone(activeProposal);
    record('proposed', { proposal: structuredClone(activeProposal) });
    return state.proposal;
  };
  const clearProposal = () => { activeProposal = null; state.proposal = null; };
  const obeysOrder = config => !orderRule || (validateOrder(orderRule, {now:now()}).valid && config.dwellMs >= orderRule.minDwellMs);
  function installOrder(order) {
    const check = validateOrder(order,{now:now()});
    if(!check.valid || order.minDwellMs > 1400) return {ok:false,reason:'Order invalid or incompatible with runtime bounds.'};
    if(order.version <= orderVersion) return {ok:false,reason:'Order revision must increase.'};
    orderRule=structuredClone(order);orderVersion=order.version;clearProposal();
    record('order-installed',{version:order.version,author:order.author,assurance:check.assurance});
    return {ok:true};
  }
  function reviewExpiredOrder() {
    if(!orderRule || now()<Date.parse(orderRule.expiresAt)) return {ok:false,reason:'No expired test order to review.'};
    record('expired-order-reviewed',{version:orderRule.version,authority:'explicit-demo-user-review'});
    orderRule=null; clearProposal(); state.recovery=null;
    return {ok:true};
  }
  function reportOutcome(feedback) {
    if(!['helpful','unhelpful','unknown'].includes(feedback))return {ok:false,reason:'Invalid feedback'};
    record('user-feedback',{feedback,config:{...state.config},communicationOutcome:'unknown'});
    if(feedback==='unhelpful' && prior) refused.add(JSON.stringify(Object.fromEntries(Object.entries(state.config).filter(([key,value])=>value!==prior[key]))));
    return {ok:true};
  }
  function exportMemory() {
    return {schemaVersion:1,events:state.history.slice(-300).map(({timestamp,type,sessionId,feedback,config})=>({timestamp,type,sessionId,feedback,config})),refused:[...refused],order:orderRule,orderVersion};
  }
  function importMemory(memory) {
    if(memory?.schemaVersion!==1||!Array.isArray(memory.events)||memory.events.length>300) return {ok:false,reason:'Invalid memory package'};
    const allowed=new Set(['observed','applied','reversed','rejected','proposed','no-change','user-feedback','order-installed','expired-order-reviewed','recovery','recovery-reviewed','confirmed','selected']);
    for(const event of memory.events) if(allowed.has(event.type)&&Number.isFinite(event.timestamp)&&event.timestamp<=now()) {
      state.history.push({id:++sequence,timestamp:event.timestamp,type:event.type,sessionId:String(event.sessionId||'previous'),historical:true,
        ...(['helpful','unhelpful','unknown'].includes(event.feedback)?{feedback:event.feedback}:{} )});
    }
    // Historical sensor data never becomes current evidence or transfers calibration.
    if(memory.order && validateOrder(memory.order,{now:Date.parse(memory.order.effectiveAt)}).valid && memory.order.minDwellMs<=1400) orderRule=structuredClone(memory.order);
    orderVersion=Number.isInteger(memory.orderVersion)?Math.max(0,memory.orderVersion):0;
    for(const entry of (Array.isArray(memory.refused)?memory.refused:[]).slice(0,100)) {
      try {const patch=JSON.parse(entry);if(patch && typeof patch==='object' && Object.keys(patch).every(k=>['targetScale','dwellMs','confirmation','modality'].includes(k)))refused.add(JSON.stringify(patch));}catch{}
    }
    return {ok:true};
  }
  function voiceContribution(text) {
    const evidence=state.reliability.voice;
    if(!evidence || evidence.status!=='qualified'||now()-evidence.timestamp>60000||evidence.coverage<.6||evidence.errorRate>=.3) {
      record('voice-abstained',{reason:'Voice evidence insufficient, stale or unreliable; correction route retained.'});
      return {ok:false,reason:'Voice is unreliable or untested. Correct the transcript, then explicitly approve the corrected text.'};
    }
    state.draft=String(text);record('voice-draft',{communicationOutcome:'unknown'});return {ok:true};
  }
  function requestConfiguration(patch) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch) || !Object.keys(patch).length || Object.keys(patch).some(key => !['targetScale', 'dwellMs', 'confirmation', 'modality'].includes(key))) {
      record('request-refused', { reason: 'Unsupported configuration fields.' }); return null;
    }
    return publishProposal({ id: `proposal-${++sequence}`, patch, before: { ...state.config }, reason: 'User requested a configuration trial.',
      createdAt: now(), expiresAt: now() + 60000, authority: 'explicit-user-approval', scope: 'current-session',
      expectedBenefit: 'Try the requested access configuration.', burden: 'Outcome unknown until evaluated.', reviewCondition: 'Review usability; undo or request recovery.' });
  }
  function observe(event) {
    const item = { timestamp: now(), task: 'quick-chat', context: 'synthetic-demo', device: 'simulator',
      configVersion: state.history.filter(x => x.type === 'applied').length, quality: 0, missing: false,
      provenance: 'synthetic', ...event };
    if (!item.modality || !Number.isFinite(item.timestamp) || item.timestamp > now()) throw new Error('Observation requires modality and a nonfuture timestamp');
    if(item.available === false) { clearProposal(); state.selected = null; }
    if(item.modality === 'physiology') {
      state.contextEvidence={status:!item.missing && !item.artifact && item.quality>=.6?'observed':'unknown',timestamp:item.timestamp,provenance:item.provenance};
    }
    if (typeof item.available === 'boolean') state.availability[item.modality] = item.available;
    state.observations.push(item);
    const window = state.observations.filter(x => x.modality === item.modality && x.task === item.task &&
      x.context === item.context && x.configVersion === item.configVersion && now() - x.timestamp <= 60000).slice(-20);
    const valid = window.filter(x => !x.missing && !x.artifact && Number.isFinite(x.quality) && x.quality >= 0.6 && x.quality <= 1 && x.available !== false);
    const measured = valid.filter(x => typeof x.error === 'boolean');
    state.reliability[item.modality] = { status: valid.length >= 3 ? 'qualified' : 'insufficient',
      sampleCount: window.length, validCount: valid.length, coverage: valid.length / window.length,
      missingness: window.filter(x => x.missing).length / window.length,
      errorRate: measured.length ? measured.filter(x => x.error).length / measured.length : null,
      latencyMs: valid.some(x => Number.isFinite(x.latencyMs)) ? valid.filter(x => Number.isFinite(x.latencyMs)).reduce((s, x) => s + x.latencyMs, 0) / valid.filter(x => Number.isFinite(x.latencyMs)).length : null,
      task: item.task, context: item.context, configVersion: item.configVersion, timestamp: item.timestamp, provenance: [...new Set(window.map(x => x.provenance))],
      contextConfidence:state.contextEvidence?.status==='observed'?'qualified-context':'interaction-only',
      limitations: 'Synthetic task evidence; no diagnosis, inferred consent, or calibrated probability.' };
    record('observed', { observation: item });
    return state.reliability[item.modality];
  }
  function propose() {
    if (state.recovery) { record('no-change', { reason: 'Recovery requires a usable route and explicit review.' }); return null; }
    if (activeProposal && activeProposal.expiresAt > now()) { state.proposal = structuredClone(activeProposal); return state.proposal; }
    let patch, reason;
    const reliability = state.reliability[state.config.modality];
    if (!usable(state.config)) {
      const fallback = ['keyboard', 'pointer'].find(x => state.availability[x] === true);
      if (fallback) { patch = { modality: fallback, confirmation: 'direct' }; reason = 'Current route unavailable; locally enabled fallback preserves the draft.'; }
      else { state.recovery = { reason: 'No available fallback. Request assistance.', timestamp: now() }; record('recovery', state.recovery); return null; }
    } else if (reliability?.status === 'qualified' && reliability.configVersion === state.history.filter(x => x.type === 'applied').length && now() - reliability.timestamp <= 60000) {
      const context=state.contextEvidence;
      if(context && (context.status==='unknown'||now()-context.timestamp>60000) && reliability.validCount<5) {
        record('no-change',{reason:'Context uncertain; collect more direct interaction evidence before support.'});clearProposal();return null;
      }
      if (reliability.errorRate >= 0.3 && state.config.targetScale < 1.5) {
        patch = { targetScale: Math.min(1.5, state.config.targetScale + 0.25) }; reason = 'Qualified trial errors: offer a bounded target enlargement.';
      } else if (reliability.latencyMs > 1500 && state.config.dwellMs < 1400) {
        patch = { dwellMs: Math.min(1400, state.config.dwellMs + 200), confirmation: 'dwell' }; reason = 'Longer trial selections: offer additional dwell time.';
      } else if (reliability.errorRate >= 0.3 && state.availability.switch && state.config.confirmation !== 'switch') {
        patch = { confirmation: 'switch' }; reason = 'Target support exhausted; offer locally enabled switch confirmation.';
      }
    }
    if (!patch || refused.has(JSON.stringify(patch))) { record('no-change', { reason: 'Stable, insufficient evidence, or previously refused support.' }); clearProposal(); return null; }
    return publishProposal({ id: `proposal-${++sequence}`, patch, reason, createdAt: now(), expiresAt: now() + 60000,
      authority: 'explicit-user-approval', scope: 'current-session', expectedBenefit: 'Try reducing observed selection difficulty',
      burden: 'Interaction behavior changes; outcome unknown until evaluated.', reviewCondition: 'Evaluate after trial; undo immediately on refusal.',
      before: { ...state.config } });
  }
  function apply(id) {
    const proposal = activeProposal;
    if (!proposal || proposal.id !== id) return { ok: false, reason: 'No matching active proposal.' };
    if (proposal.expiresAt <= now()) { clearProposal(); record('expired', { proposalId: id }); return { ok: false, reason: 'Proposal expired; re-evaluate.' }; }
    const next = { ...state.config, ...proposal.patch };
    if (state.recovery || !obeysOrder(next) || !usable(next) || !Number.isFinite(next.targetScale) || !Number.isFinite(next.dwellMs) || !['pointer', 'keyboard', 'gaze', 'switch', 'blink', 'eeg'].includes(next.modality) || next.targetScale < 1 || next.targetScale > 1.5 || next.dwellMs < 600 || next.dwellMs > 1400 ||
      !['direct', 'dwell', 'switch', 'blink'].includes(next.confirmation)) return { ok: false, reason: 'Authority guard: unavailable route or bounds violation.' };
    prior = { ...state.config };
    state.config = next; state.selected = null;
    clearProposal();
    record('applied', { proposalId: id, reason: proposal.reason, authority: 'explicit-user-approval', before: prior, after: { ...next }, outcome: 'unknown' });
    return { ok: true };
  }
  function reject(id) {
    if (!activeProposal || activeProposal.id !== id) return { ok: false, reason: 'No matching proposal.' };
    refused.add(JSON.stringify(activeProposal.patch));
    record('rejected', { proposalId: id }); clearProposal();
    return { ok: true };
  }
  function undo() {
    if (!prior) return { ok: false, reason: 'No applied change to undo.' };
    if (!usable(prior) || !obeysOrder(prior)) { state.recovery = { reason: 'Previous route unavailable or restricted by order; draft preserved. Review recovery before further changes.', timestamp: now() }; record('recovery', state.recovery); return { ok: false, reason: state.recovery.reason }; }
    state.config = { ...prior }; prior = null; state.recovery = null; clearProposal();
    record('reversed', { config: { ...state.config }, outcome: 'unknown' }); return { ok: true };
  }
  function select(target) {
    if (!usable(state.config)) return { ok: false, reason: 'Current route unavailable.' };
    state.selected = { text: String(target), timestamp: now() };
    record('selected', { text: String(target) }); return { ok: true };
  }
  function confirm(method = 'direct') {
    if (!state.selected || !usable(state.config) || (method==='dwell' && !obeysOrder(state.config)) || method !== state.config.confirmation) return { ok: false, reason: 'Select a target using the active, available confirmation method; check any active order.' };
    if (method === 'dwell' && now() - state.selected.timestamp < state.config.dwellMs) return { ok: false, reason: 'Dwell interval incomplete.' };
    state.draft = [state.draft, state.selected.text].filter(Boolean).join(' ');
    record('confirmed', { method, text: state.selected.text, communicationOutcome: 'unknown' }); state.selected = null; return { ok: true };
  }
  function reviewRecovery() {
    if (!usable(state.config)) return { ok: false, reason: 'Current route is still unavailable.' };
    state.recovery = null; clearProposal(); record('recovery-reviewed', { authority: 'explicit-user-review', config: { ...state.config } });
    return { ok: true };
  }
  return { state, observe, propose, apply, reject, undo, select, confirm, requestConfiguration, reviewRecovery, installOrder, reviewExpiredOrder, reportOutcome, exportMemory, importMemory, voiceContribution,
    getOrderStatus(){return orderRule?{version:orderRule.version,expiresAt:orderRule.expiresAt,expired:now()>=Date.parse(orderRule.expiresAt)}:null;},
    setDraft(text) { state.draft = String(text); return state.draft; } };
}

/** Synthetic same-target evidence only. Agreement is not verified intent. */
export function fuseEvidence({ gaze, eeg, maxSkewMs = 150, now = Date.now(), maxAgeMs = 1000 }) {
  const valid = x => x && !x.missing && !x.artifact && x.available !== false && Number.isFinite(x.quality) && x.quality >= 0.6 && x.quality <= 1 && Number.isFinite(x.timestamp) && x.timestamp<=now && now-x.timestamp<=maxAgeMs;
  const channels = [gaze, eeg].filter(valid);
  if (!channels.length) return { target: null, status: 'insufficient', coverage: 0 };
  if (channels.length === 1) return { target: channels[0].target, status: 'single-channel', coverage: 0.5 };
  if (Math.abs(gaze.timestamp - eeg.timestamp) > maxSkewMs) return { target: null, status: 'unsynchronized', coverage: 1 };
  if (gaze.target !== eeg.target) return { target: null, status: 'conflict', coverage: 1 };
  return { target: gaze.target, status: 'agreement', coverage: 1, score: Math.min(gaze.quality, eeg.quality), limitation: 'Conservative synthetic score; correlated error and intent remain unvalidated.' };
}

/** Synthetic openness samples, not camera processing or deliberate-blink validation. */
export function detectBlinkCandidate(frames) {
  if (!Array.isArray(frames) || frames.length < 3 || frames.some((f, i) => !Number.isFinite(f.timestamp) || !Number.isFinite(f.openness) || f.quality < 0.6 || !Number.isFinite(f.quality) || (i && (f.timestamp <= frames[i - 1].timestamp || f.timestamp - frames[i - 1].timestamp > 100)))) return { candidate: false, reason: 'Insufficient temporal or visibility quality.' };
  const start = frames.findIndex((f, i) => i > 0 && frames[i - 1].openness >= 0.7 && f.openness <= 0.25);
  const end = start < 0 ? -1 : frames.findIndex((f, i) => i > start && f.openness >= 0.7);
  const durationMs = end < 0 ? 0 : frames[end].timestamp - frames[start].timestamp;
  return { candidate: durationMs >= 100 && durationMs <= 600, durationMs, reason: 'Synthetic closure/reopening candidate only; natural blink ambiguity remains. Never automatic consent.' };
}
