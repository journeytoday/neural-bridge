import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { startServer } from '../server.js';
import { createClient } from '../src/transport.js';
async function fixture(t, options = {}) {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'neuralbridge-'));
  let server = await startServer({ port: 0, dataDir, ...options });
  const base = () => `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await rm(dataDir, { recursive: true, force: true }); });
  return { base, client: () => createClient(base()), restart: async () => { await new Promise(resolve => server.close(resolve)); server = await startServer({ port: 0, dataDir, ...options }); } };
}
test('HTTP sandbox deduplicates, requires acknowledgement and times out by wall time', async t => {
  const f = await fixture(t, { timeoutMs: 40 }); const c = f.client();
  const request = { id: 'help-1', action: 'help' };
  assert.equal((await c.request(request)).status, 'delivered');
  assert.equal((await c.request(request)).duplicate, true);
  await assert.rejects(c.request({ ...request, action: 'light-on' }), /conflict/);
  await assert.rejects(c.complete(request.id), /acknowledgement/);
  await new Promise(resolve => setTimeout(resolve, 60));
  assert.equal((await c.listRequests())[0].status, 'timed-out');
  await assert.rejects(c.acknowledge(request.id));
  await c.request({ id: 'ok', action: 'light-on' }); await c.acknowledge('ok'); assert.equal((await c.complete('ok')).status, 'completed');
  await c.request({ id: 'synthetic', action: 'help' }); assert.equal((await c.simulateTimeout('synthetic')).synthetic, true);
  assert.equal((await c.routeMI({ intent: 'help', confidence: 1, quality: 1, connected: true, timestamp: Date.now() - 2000 })).status, 'rejected');
  assert.equal((await c.routeMI({ id: 'mi', intent: 'help', confidence: 1, quality: 1, connected: true, timestamp: Date.now() })).status, 'delivered');
});
test('profiles persist revisions, reject conflicts/import overwrite, and retain revocation after restart', async t => {
  const f = await fixture(t); let c = f.client();
  const created = await c.createProfile('alice', { theme: 'dark', calibration: { passed: true } });
  assert.deepEqual(created.preferences, { theme: 'dark' });
  await c.updateProfile('alice', { language: 'de' }, 1);
  await assert.rejects(c.updateProfile('alice', { theme: 'light' }, 1), /conflict/);
  const pkg = await c.exportProfile('alice'); await assert.rejects(c.importProfile(pkg), /already exists/);
  await f.restart(); c = f.client(); assert.equal((await c.getProfile('alice')).version, 2);
  await assert.rejects(c.revokeProfile('alice', 1), /conflict/); await c.revokeProfile('alice', 2);
  await f.restart(); c = f.client(); await assert.rejects(c.getProfile('alice'), /revoked/); await assert.rejects(c.importProfile(pkg), /already exists/);
  pkg.profile.id = 'bob'; assert.equal((await c.importProfile(pkg)).version, 1);
});
test('HTTP guards reject bad methods, origins, JSON and oversized bodies', async t => {
  const f = await fixture(t); const url = f.base() + '/api/requests';
  assert.equal((await fetch(url, { method: 'DELETE' })).status, 405);
  assert.equal((await fetch(url, { method: 'POST', headers: { origin: 'https://example.com', 'content-type': 'application/json' }, body: '{}' })).status, 403);
  assert.equal((await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' })).status, 400);
  assert.equal((await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: 'a'.repeat(70000) }) })).status, 413);
});
