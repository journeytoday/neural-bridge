import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, fuseEvidence, detectBlinkCandidate } from '../src/engine.js';
const errors = e => { for (let i = 0; i < 4; i++) e.observe({ modality: e.state.config.modality, quality: 0.9, error: true }); };
test('user proposals reject unsupported fields, resist external mutation and reject stale ids', () => {
  const e = createEngine(); assert.equal(e.requestConfiguration({ draft: 'injected' }), null);
  const p = e.requestConfiguration({ targetScale: 1.25 }); p.patch.targetScale = 999; p.patch.draft = 'injected';
  e.state.proposal = { id: p.id, patch: { targetScale: 999 } };
  assert.equal(e.apply(p.id).ok, true); assert.equal(e.state.config.targetScale, 1.25); assert.equal(e.state.draft, '');
  const old = e.requestConfiguration({ confirmation: 'switch' });
  const next = e.requestConfiguration({ dwellMs: NaN });
  assert.equal(e.apply(old.id).ok, false); assert.equal(e.apply(next.id).ok, false);
  const switchProposal = e.requestConfiguration({ confirmation: 'switch' });
  assert.equal(e.apply(switchProposal.id).ok, false);
  e.observe({ modality: 'switch', available: true }); assert.equal(e.apply(switchProposal.id).ok, true);
  e.select('Hello'); assert.equal(e.confirm('switch').ok, true);
});
test('explicit recovery review requires an available current route', () => {
  const e = createEngine(); e.observe({ modality: 'pointer', available: false });
  e.apply(e.propose().id); e.undo(); assert.ok(e.state.recovery);
  e.observe({ modality: 'keyboard', available: false }); assert.equal(e.reviewRecovery().ok, false);
  e.observe({ modality: 'keyboard', available: true }); assert.equal(e.reviewRecovery().ok, true); assert.equal(e.state.recovery, null);
});
test('qualified evidence proposes a bounded change; approval and undo preserve draft', () => {
  const e = createEngine(); e.setDraft('My words'); errors(e);
  const p = e.propose(); assert.equal(e.state.config.targetScale, 1);
  assert.equal(e.apply(p.id).ok, true); assert.equal(e.state.config.targetScale, 1.25);
  assert.equal(e.undo().ok, true); assert.equal(e.state.draft, 'My words');
});
test('missing evidence never proves difficulty and refusal prevents repeated prompting', () => {
  const e = createEngine(); for (let i = 0; i < 4; i++) e.observe({ modality: 'pointer', missing: true, quality: 1, error: true });
  assert.equal(e.propose(), null); assert.equal(e.state.reliability.pointer.missingness, 1);
  errors(e); const p = e.propose(); e.reject(p.id); assert.equal(e.propose(), null);
});
test('expired approval and unavailable rollback are guarded', () => {
  let time = 0; const e = createEngine({ now: () => time }); errors(e); const p = e.propose();
  time = 61000; assert.equal(e.apply(p.id).ok, false);
  e.observe({ modality: 'pointer', available: false }); const fallback = e.propose();
  assert.equal(e.apply(fallback.id).ok, true); assert.equal(e.state.config.modality, 'keyboard');
  e.setDraft('preserved'); assert.equal(e.undo().ok, false); assert.ok(e.state.recovery); assert.equal(e.state.draft, 'preserved');
});
test('dwell requires elapsed interval and correct confirmation route', () => {
  let time = 0; const e = createEngine({ now: () => time });
  for (let i = 0; i < 3; i++) e.observe({ modality: 'pointer', quality: 0.9, latencyMs: 2000 });
  e.apply(e.propose().id); e.select('Hello'); assert.equal(e.confirm('direct').ok, false);
  assert.equal(e.confirm('dwell').ok, false); time = 1000; assert.equal(e.confirm('dwell').ok, true); assert.equal(e.state.draft, 'Hello');
});
test('fusion abstains on conflict and asynchronous samples; invalid channels lower coverage', () => {
  const gaze = { target: 'A', quality: 0.9, timestamp: 0 };
  assert.equal(fuseEvidence({ gaze, eeg: { ...gaze, target: 'B' } }).status, 'conflict');
  assert.equal(fuseEvidence({ gaze, eeg: { ...gaze, timestamp: 500 } }).target, null);
  assert.equal(fuseEvidence({ gaze, eeg: { ...gaze, missing: true } }).coverage, 0.5);
});
test('blink detection labels only a synthetic candidate and rejects low frame coverage', () => {
  const frames = [1, 0.1, 0.1, 1].map((openness, i) => ({ openness, timestamp: i * 50, quality: 1 }));
  assert.equal(detectBlinkCandidate(frames).candidate, true);
  assert.equal(detectBlinkCandidate(frames.map(f => ({ ...f, timestamp: f.timestamp * 10 }))).candidate, false);
});
