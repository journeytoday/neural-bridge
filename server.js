import http from 'node:http';
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ProfileService, SandboxSink, routeMICandidate } from './src/platform.js';
const root = path.dirname(fileURLToPath(import.meta.url));
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.md':'text/plain; charset=utf-8','.webm':'video/webm'};
function fail(status, message) { throw Object.assign(new Error(message), { status }); }
async function body(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) fail(415, 'JSON content type required');
  let data = ''; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > 65536) fail(413, 'Request too large'); data += chunk; }
  try { const value = JSON.parse(data); if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(); return value; } catch { fail(400, 'Invalid JSON object'); }
}
export async function createServer({ dataDir = path.join(root, '.neuralbridge-data'), timeoutMs = 5000 } = {}) {
  const profiles = new ProfileService(); const sink = new SandboxSink({ timeoutMs });
  const profileFile = path.join(dataDir, 'profiles.json');
  try {
    const saved = JSON.parse(await readFile(profileFile, 'utf8'));
    if (saved.schemaVersion !== 1 || !Array.isArray(saved.profiles)) throw Error('Invalid profile store');
    for (const p of saved.profiles) {
      if (!p || typeof p.id !== 'string' || !Number.isInteger(p.version) || p.version < 1 || typeof p.revoked !== 'boolean') throw Error('Invalid stored profile');
      profiles.create(p.id, p.preferences); profiles.profiles.set(p.id, { ...profiles.get(p.id), version: p.version, revoked: p.revoked });
    }
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  async function persist() { await mkdir(dataDir, { recursive: true }); await writeFile(profileFile + '.tmp', JSON.stringify({ schemaVersion: 1, profiles: [...profiles.profiles.values()] })); await rename(profileFile + '.tmp', profileFile); }
  let queue = Promise.resolve();
  function mutate(fn) {
    const next = queue.then(async () => { const before = structuredClone(profiles.profiles); try { const result = fn(); await persist(); return result; } catch (e) { profiles.profiles = before; throw e; } });
    queue = next.catch(() => {}); return next;
  }
  const server = http.createServer(async (req, res) => {
    function json(status, value) { res.writeHead(status, { 'Content-Type':'application/json', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' }); res.end(JSON.stringify(value)); }
    try {
      const authority = new URL(`http://${req.headers.host}`);
      if (!['127.0.0.1', 'localhost', '[::1]'].includes(authority.hostname)) fail(403, 'Loopback host required');
      const url = new URL(req.url, authority);
      if (!['GET', 'POST'].includes(req.method)) fail(405, 'Method not allowed');
      if (req.method === 'POST' && req.headers.origin && req.headers.origin !== authority.origin) fail(403, 'Same loopback origin required');
      if (req.method === 'POST' && req.headers['sec-fetch-site'] === 'cross-site') fail(403, 'Cross-site writes forbidden');
      if (url.pathname.startsWith('/api/')) {
        const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
        const [, resource, id, operation] = parts;
        const input = req.method === 'POST' ? await body(req) : null;
        let result;
        if (resource === 'requests') {
          sink.tick();
          if (parts.length === 2 && req.method === 'GET') result = sink.list();
          else if (parts.length === 2 && req.method === 'POST') result = sink.request(input);
          else if (parts.length === 4 && req.method === 'POST' && operation === 'ack') result = sink.acknowledge(id);
          else if (parts.length === 4 && req.method === 'POST' && operation === 'complete') result = sink.complete(id);
          else if (parts.length === 4 && req.method === 'POST' && operation === 'timeout') {
            const entry = sink.requests.get(id); if (!entry || entry.status !== 'delivered') fail(409, 'Only delivered requests can simulate timeout');
            entry.deadline = Date.now(); sink.tick(); result = { ...entry, synthetic: true };
          } else fail(405, 'Unsupported request route or method');
        } else if (resource === 'mi' && parts.length === 2 && req.method === 'POST') result = routeMICandidate(input, sink);
        else if (resource === 'profiles') {
          if(id && id !== 'import' && !profiles.profiles.has(id)) fail(404, 'Profile not found');
          if (parts.length === 2 && req.method === 'POST') result = await mutate(() => profiles.create(input.id, input.preferences));
          else if (parts.length === 3 && id === 'import' && req.method === 'POST') result = await mutate(() => profiles.import(JSON.stringify(input)));
          else if (parts.length === 3 && req.method === 'GET') { await queue; result = profiles.get(id); }
          else if (parts.length === 4 && operation === 'export' && req.method === 'GET') { await queue; result = JSON.parse(profiles.export(id)); }
          else if (parts.length === 4 && operation === 'update' && req.method === 'POST') result = await mutate(() => profiles.update(id, input.preferences, input.expectedVersion));
          else if (parts.length === 4 && operation === 'revoke' && req.method === 'POST') result = await mutate(() => { if (profiles.get(id).version !== input.expectedVersion) fail(409, 'Profile version conflict'); return profiles.revoke(id); });
          else fail(405, 'Unsupported profile route or method');
        } else fail(404, 'Unknown API route');
        return json(200, result);
      }
      if (req.method !== 'GET') fail(405, 'Method not allowed');
      const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
      const filename = path.resolve(root, '.' + relative);
      if (!filename.startsWith(root + path.sep) || relative.split('/').some(p => p.startsWith('.')) || !types[path.extname(filename)]) fail(403, 'Forbidden');
      const content = await readFile(filename);
      if(types[path.extname(filename)].startsWith('video/')) {
        const range=req.headers.range;
        if(range) {
          const match=/^bytes=(\d+)-(\d*)$/.exec(range);
          if(!match)fail(416,'Unsupported range');
          const start=Number(match[1]),end=Math.min(match[2]?Number(match[2]):content.length-1,content.length-1);
          if(start>end || start>=content.length)fail(416,'Range outside file');
          res.writeHead(206,{'Content-Type':types[path.extname(filename)],'Accept-Ranges':'bytes','Content-Range':`bytes ${start}-${end}/${content.length}`,'Content-Length':end-start+1});
          return res.end(content.subarray(start,end+1));
        }
        res.writeHead(200,{'Content-Type':types[path.extname(filename)],'Accept-Ranges':'bytes','Content-Length':content.length});return res.end(content);
      }
      res.writeHead(200, {'Content-Type': types[path.extname(filename)], 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', 'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"}); res.end(content);
    } catch (error) { json(error.status || (error.code === 'ENOENT' ? 404 : /conflict|already exists|revoked|cannot be|acknowledgement required/i.test(error.message) ? 409 : 400), { error: error.message }); }
  });
  return server;
}
export async function startServer({ port = Number(process.env.PORT || 4173), ...options } = {}) {
  const server = await createServer(options); await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); }); return server;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = await startServer(); console.log(`NeuralBridge ready at http://127.0.0.1:${server.address().port}`);
}
