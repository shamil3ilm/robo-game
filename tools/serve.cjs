/* Robo Run: a small web server for trying the game the way a visitor would get it. `node tools/serve.cjs` serves src/ (never cached, so edits show at once);
   `node tools/serve.cjs --dist` serves the built dist/ folder with the headers a real host should send. Options: --port <n> (default 8080), --host <address> (default 127.0.0.1).
   To open it on a phone on the same Wi-Fi use --host 0.0.0.0 and the address it prints (the page works there; install and offline need https, which a real host gives). */
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.glb': 'model/gltf-binary', '.txt': 'text/plain; charset=utf-8' };

function createServer(root, { dev }) {
  return http.createServer((req, res) => {
    let name;
    try { name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch (e) { res.writeHead(400).end('Bad request'); return; }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }).end(); return; }
    const file = path.resolve(root, '.' + (name.endsWith('/') ? name + 'index.html' : name));
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403).end('Forbidden'); return; }
    fs.readFile(file, (error, data) => {
      if (error) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found'); return; }
      const ext = path.extname(file), base = path.basename(file);
      // the page, the worker and the manifest are always checked for updates; the rest may be kept for an hour on a real host
      const cache = dev || /^(index\.html|sw\.js|manifest\.webmanifest|build\.json)$/.test(base) ? 'no-cache' : 'public, max-age=3600';
      res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': dev ? 'no-store' : cache, 'X-Content-Type-Options': 'nosniff', ...(base === 'sw.js' ? { 'Service-Worker-Allowed': '/' } : {}) });
      res.end(req.method === 'HEAD' ? undefined : data);
    });
  });
}

module.exports = { createServer, TYPES };

if (require.main === module) {
  const arg = (name, dflt) => { const i = process.argv.indexOf('--' + name); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt; };
  const dist = process.argv.includes('--dist'), root = path.resolve(__dirname, '..', dist ? 'dist' : 'src');
  if (!fs.existsSync(path.join(root, 'index.html'))) { console.error('No index.html in ' + root + (dist ? '. Run: node tools/build.cjs' : '')); process.exit(1); }
  const port = Number(arg('port', 8080)), host = arg('host', '127.0.0.1');
  createServer(root, { dev: !dist }).listen(port, host, () => {
    console.log('Robo Run (' + (dist ? 'dist' : 'src') + ') is at http://' + (host === '0.0.0.0' ? 'localhost' : host) + ':' + port + '/');
    if (host === '0.0.0.0') for (const list of Object.values(os.networkInterfaces())) for (const a of list || []) if (a.family === 'IPv4' && !a.internal) console.log('On your phone (same Wi-Fi): http://' + a.address + ':' + port + '/');
  });
}
