import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(fileURLToPath(new URL('.', import.meta.url)));
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.md':'text/plain; charset=utf-8','.webm':'video/webm'};
const server = http.createServer(async (req,res) => {
  try {
    if(req.method !== 'GET') {res.writeHead(405); return res.end('Method not allowed');}
    const url = new URL(req.url,'http://localhost');
    const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const filename = path.resolve(root,'.'+relative);
    if(!filename.startsWith(root+path.sep) || relative.split('/').some(p=>p.startsWith('.')) || !types[path.extname(filename)]) {res.writeHead(403); return res.end('Forbidden');}
    const body = await readFile(filename);
    res.writeHead(200, {'Content-Type':types[path.extname(filename)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});
    res.end(body);
  } catch {res.writeHead(404);res.end('Not found');}
});
server.listen(Number(process.env.PORT || 4173),'127.0.0.1',()=>console.log('NeuralBridge ready at http://127.0.0.1:'+(process.env.PORT || 4173)));
