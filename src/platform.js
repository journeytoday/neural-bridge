/** Local sandbox contracts. No live medical, cloud or emergency service is implied. */
const copy = value => JSON.parse(JSON.stringify(value));
function requireValue(ok, message) { if (!ok) throw new Error(message); }
function preferencesOnly(value = {}) {
  const allowed = ['language', 'voice', 'theme', 'phrases', 'layout'];
  return Object.fromEntries(Object.entries(copy(value)).filter(([key]) => allowed.includes(key)));
}

export class ProfileService {
  constructor() { this.profiles = new Map(); }
  create(id, preferences = {}) {
    requireValue(typeof id === 'string' && id && !this.profiles.has(id), 'Profile already exists or invalid id');
    const profile = { id, version: 1, preferences: preferencesOnly(preferences), revoked: false };
    this.profiles.set(id, profile); return copy(profile);
  }
  get(id) {
    const profile = this.profiles.get(id);
    requireValue(profile && !profile.revoked, 'Profile unavailable or revoked'); return copy(profile);
  }
  update(id, preferences, expectedVersion) {
    const profile = this.get(id);
    requireValue(profile.version === expectedVersion, 'Profile version conflict');
    profile.preferences = preferencesOnly(preferences); profile.version++;
    this.profiles.set(id, profile); return copy(profile);
  }
  export(id) { return JSON.stringify({ schemaVersion: 1, profile: this.get(id) }); }
  import(json) {
    const data = JSON.parse(json);
    requireValue(data.schemaVersion === 1 && data.profile && !data.profile.revoked, 'Invalid profile package');
    // Imports are a new local revision; remote revision numbers cannot bypass conflicts.
    return this.create(data.profile.id, data.profile.preferences);
  }
  revoke(id) {
    const profile = this.get(id); profile.revoked = true; profile.version++;
    this.profiles.set(id, profile); return copy(profile);
  }
  connectHost(hostId) {
    const cache = new Map(); const service = this;
    return {
      hostId,
      sync(id) {
        try {
          const profile = service.get(id); const old = cache.get(id);
          const entry = { profile, validated: old?.profile.version === profile.version && old.validated === true,
            calibration: old?.profile.version === profile.version ? old.calibration : null, offline: false };
          cache.set(id, entry); return copy(entry);
        } catch (error) { cache.delete(id); throw error; }
      },
      validateLocally(id, calibration) {
        requireValue(cache.has(id), 'Sync profile before local validation');
        requireValue(calibration?.hostId === hostId && calibration?.passed === true, 'Local validation failed');
        const entry = cache.get(id); entry.calibration = copy(calibration); entry.validated = true;
        return copy(entry);
      },
      read(id) { requireValue(cache.has(id), 'No cached profile'); return copy(cache.get(id)); },
      offline(id) {
        requireValue(cache.has(id), 'No cached profile');
        // Offline cache is inspectable only: authorization cannot be refreshed offline.
        return { ...copy(cache.get(id)), offline: true, validated: false, authorization: 'unknown' };
      }
    };
  }
}

export class SandboxSink {
  constructor({ timeoutMs = 5000 } = {}) { this.timeoutMs = timeoutMs; this.requests = new Map(); }
  request({ id, action, recipient = 'sandbox-caregiver' }, now = Date.now()) {
    requireValue(typeof id === 'string' && id && ['help', 'light-on', 'light-off'].includes(action), 'Unsupported sandbox request');
    if (this.requests.has(id)) {
      const existing = this.requests.get(id);
      requireValue(existing.action === action && existing.recipient === recipient, 'Duplicate id payload conflict');
      return { ...copy(existing), duplicate: true };
    }
    const result = { id, action, recipient, sandbox: true, status: 'delivered', deliveredAt: now,
      acknowledgedAt: null, completedAt: null, deadline: now + this.timeoutMs };
    this.requests.set(id, result); return copy(result);
  }
  acknowledge(id, now = Date.now()) {
    this.tick(now); const entry = this.requests.get(id);
    requireValue(entry && ['delivered', 'acknowledged'].includes(entry.status), 'Request cannot be acknowledged');
    entry.status = 'acknowledged'; entry.acknowledgedAt ??= now; return copy(entry);
  }
  complete(id, now = Date.now()) {
    this.tick(now); const entry = this.requests.get(id);
    requireValue(entry?.status === 'acknowledged', 'Recipient acknowledgement required before completion');
    entry.status = 'completed'; entry.completedAt = now; return copy(entry);
  }
  tick(now = Date.now()) {
    for (const entry of this.requests.values()) {
      if (entry.status === 'delivered' && now >= entry.deadline) entry.status = 'timed-out';
    }
    return this.list();
  }
  list() { return [...this.requests.values()].map(copy); }
}

export class MedicationTimeline {
  constructor(schedule = [{ id: 'fictional-1', name: 'Fictional medicine A', scheduledAt: '09:00' }]) {
    requireValue(new Set(schedule.map(item => item.id)).size === schedule.length, 'Duplicate reminder id');
    this.events = schedule.map(item => ({ ...copy(item), fictional: true, acknowledged: false,
      administration: 'unknown', reportedAt: null }));
  }
  find(id) { const item = this.events.find(event => event.id === id); requireValue(item, 'Unknown reminder'); return item; }
  acknowledge(id) { const item = this.find(id); item.acknowledged = true; return copy(item); }
  report(id, status, now = Date.now()) {
    requireValue(['reported-taken', 'reported-not-taken', 'unknown'].includes(status), 'Invalid reported status');
    const item = this.find(id); item.administration = status; item.reportedAt = now; return copy(item);
  }
  list() { return copy(this.events); }
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
// Deliberately a test checksum, NOT cryptographic authentication or a clinician signature.
export function signTestOrder(order, key = 'demo-only') {
  const { integrity, ...body } = order; let hash = 2166136261;
  for (const char of `${key}:${canonical(body)}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return { ...copy(body), integrity: `TEST-ONLY-${hash.toString(16)}` };
}
export function validateOrder(order, { key = 'demo-only', authorizedAuthors = ['demo-clinician'], subject = 'demo-user', purpose = 'interaction', now = Date.now(), expectedVersion } = {}) {
  const errors = [];
  if (order?.integrity !== signTestOrder(order || {}, key).integrity) errors.push('integrity');
  if (!authorizedAuthors.includes(order?.author)) errors.push('author');
  if (order?.subject !== subject || order?.purpose !== purpose) errors.push('scope');
  if (!Number.isInteger(order?.version) || order.version < 1 || (expectedVersion !== undefined && order.version !== expectedVersion)) errors.push('version');
  const start = Date.parse(order?.effectiveAt); const end = Date.parse(order?.expiresAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || now < start || now >= end) errors.push('effective-period');
  if (!order?.permissions?.includes('interaction:dwell') || !Number.isFinite(order?.minDwellMs) || order.minDwellMs < 200 || order.minDwellMs > 10000) errors.push('rule');
  return { valid: errors.length === 0, errors, assurance: 'local test checksum; no verified clinical identity' };
}
export function enforceDwell(requested, order, context) {
  requireValue(Number.isFinite(requested) && requested >= 0, 'Invalid requested dwell');
  const validation = validateOrder(order, context); requireValue(validation.valid, `Order rejected: ${validation.errors.join(', ')}`);
  return Math.max(requested, order.minDwellMs);
}

export function routeMICandidate(candidate, sink, now = Date.now()) {
  if (candidate?.intent !== 'help' || candidate?.noIntent === true || candidate?.artifact === true ||
      candidate?.connected !== true || !Number.isFinite(candidate?.confidence) || candidate.confidence < 0.95 ||
      !Number.isFinite(candidate?.quality) || candidate.quality < 0.8 ||
      !Number.isFinite(candidate?.timestamp) || now - candidate.timestamp > 1000 || candidate.timestamp > now) {
    return { status: 'rejected', reason: 'MI alert-specific policy failed', sandbox: true };
  }
  return sink.request({ id: candidate.id, action: 'help', recipient: 'sandbox-caregiver' }, now);
}
