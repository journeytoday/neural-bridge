import test from 'node:test';
import assert from 'node:assert/strict';
import { ProfileService, SandboxSink, MedicationTimeline, signTestOrder, validateOrder, enforceDwell, routeMICandidate } from '../src/platform.js';

test('profiles sync preferences, never device calibration; revisions, offline and revocation fail closed', () => {
  const service = new ProfileService(); service.create('user', { theme: 'dark', calibration: { unsafe: true } });
  const a = service.connectHost('a'), b = service.connectHost('b');
  a.sync('user'); a.validateLocally('user', { hostId: 'a', passed: true, dwell: 700 });
  assert.equal(b.sync('user').validated, false);
  assert.equal(b.read('user').calibration, null);
  assert.throws(() => b.validateLocally('user', { hostId: 'a', passed: true }));
  assert.equal(a.offline('user').validated, false);
  assert.equal(service.export('user').includes('calibration'), false);
  const imported = new ProfileService(); assert.equal(imported.import(service.export('user')).version, 1);
  service.update('user', { theme: 'light' }, 1);
  assert.throws(() => service.update('user', {}, 1), /conflict/);
  assert.equal(a.sync('user').validated, false);
  service.revoke('user'); assert.throws(() => a.sync('user'), /revoked/);
  assert.throws(() => a.read('user'), /cached/);
});

test('sandbox distinguishes delivery, acknowledgement, completion, timeout and duplicate conflict', () => {
  const sink = new SandboxSink({ timeoutMs: 100 });
  assert.equal(sink.request({ id: '1', action: 'help' }, 0).status, 'delivered');
  assert.throws(() => sink.complete('1', 10), /acknowledgement/);
  assert.equal(sink.request({ id: '1', action: 'help' }, 20).duplicate, true);
  assert.throws(() => sink.request({ id: '1', action: 'light-on' }, 20), /conflict/);
  sink.acknowledge('1', 30); assert.equal(sink.complete('1', 40).status, 'completed');
  sink.request({ id: '2', action: 'help' }, 0); sink.tick(100);
  assert.equal(sink.list()[1].status, 'timed-out'); assert.throws(() => sink.acknowledge('2', 101));
  assert.equal(sink.list().length, 2);
});

test('reminder acknowledgement never establishes medication administration', () => {
  const timeline = new MedicationTimeline();
  assert.equal(timeline.acknowledge('fictional-1').administration, 'unknown');
  assert.equal(timeline.report('fictional-1', 'reported-taken', 100).administration, 'reported-taken');
  assert.equal(timeline.list()[0].fictional, true);
  assert.throws(() => timeline.report('fictional-1', 'inferred-taken'));
});

test('test orders enforce integrity, author, scope, version, expiry and dwell bound', () => {
  const order = signTestOrder({ author: 'demo-clinician', subject: 'demo-user', purpose: 'interaction', version: 1,
    effectiveAt: '2026-09-01', expiresAt: '2026-10-01', permissions: ['interaction:dwell'], minDwellMs: 800 });
  const context = { now: Date.parse('2026-09-09') };
  assert.equal(enforceDwell(300, order, context), 800);
  assert.equal(enforceDwell(1000, order, context), 1000);
  assert.equal(validateOrder({ ...order, minDwellMs: 200 }, context).valid, false);
  for (const extra of [{ subject: 'other' }, { authorizedAuthors: [] }, { expectedVersion: 2 }, { now: Date.parse('2026-10-01') }])
    assert.equal(validateOrder(order, { ...context, ...extra }).valid, false);
});

test('MI rejects no intent, low quality, artifact and stale candidates; accepted route reaches sink', () => {
  const sink = new SandboxSink();
  const candidate = { id: 'mi-1', intent: 'help', confidence: 0.98, quality: 0.9, connected: true, timestamp: 1000 };
  for (const extra of [{ noIntent: true }, { quality: 0.1 }, { artifact: true }, { timestamp: -1 }, { connected: false }, { confidence: NaN }])
    assert.equal(routeMICandidate({ ...candidate, ...extra }, sink, 1000).status, 'rejected');
  assert.equal(sink.list().length, 0);
  assert.equal(routeMICandidate(candidate, sink, 1000).status, 'delivered');
  assert.equal(sink.list()[0].action, 'help');
});
