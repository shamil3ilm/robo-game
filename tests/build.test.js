// Run: node tests/build.test.js  (the website build: tools/build.cjs, the manifest, the service worker and the dev server, without needing a browser)
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
const { build, listFiles } = require('../tools/build.cjs');
const { createServer } = require('../tools/serve.cjs');
const SRC = path.resolve(__dirname, '..', 'src');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'robo-build-'));
let n = 0; const queue = []; const t = (name, fn) => queue.push([name, fn]);
const png = (f) => { const d = fs.readFileSync(f); assert.equal(d.slice(1, 4).toString(), 'PNG', f); return [d.readUInt32BE(16), d.readUInt32BE(20)]; };

const out = tmp(), r = build({ src: SRC, out });
const read = (f) => fs.readFileSync(path.join(out, f), 'utf8');

t('the build makes a dist folder with the page, the worker, the manifest and a version file', () => {
  for (const f of ['index.html', 'sw.js', 'manifest.webmanifest', 'build.json']) assert.ok(fs.existsSync(path.join(out, f)), f);
  const bj = JSON.parse(read('build.json')); assert.equal(bj.id, r.id); assert.ok(/^[0-9a-f]{10}$/.test(bj.id)); assert.ok(bj.files > 30 && bj.bytes > 500000, JSON.stringify(bj));
});
t('every file the page points at exists in the build: scripts, links, icons and font urls (a missing one would be a console error for every visitor)', () => {
  const html = read('index.html'), refs = new Set(), ok = (u) => u && !/^(https?:|data:|#|\{\{|mailto:)/.test(u) && !u.includes('{{');
  for (const m of html.matchAll(/\b(?:src|href)="([^"]+)"/g)) if (ok(m[1])) refs.add(m[1].split(/[?#]/)[0]);
  for (const m of html.matchAll(/url\("?([^")]+)"?\)/g)) if (ok(m[1])) refs.add(m[1].split(/[?#]/)[0]);
  assert.ok(refs.size > 40, 'found ' + refs.size + ' references');
  for (const f of refs) assert.ok(fs.existsSync(path.join(out, f)), 'missing: ' + f);
  assert.ok(refs.has('manifest.webmanifest') && refs.has('img/apple-touch-icon.png'));
});
t('the manifest is installable: name, start page, standalone, a 192 and a 512 icon and a maskable one, each the size it says', () => {
  const m = JSON.parse(read('manifest.webmanifest'));
  assert.ok(m.name && m.short_name && m.short_name.length <= 12); assert.equal(m.display, 'standalone'); assert.ok(fs.existsSync(path.join(out, m.start_url))); assert.ok(/^#[0-9a-f]{6}$/i.test(m.theme_color) && /^#[0-9a-f]{6}$/i.test(m.background_color));
  const sizes = m.icons.map((i) => i.sizes); assert.ok(sizes.includes('192x192') && sizes.includes('512x512')); assert.ok(m.icons.some((i) => i.purpose === 'maskable'));
  for (const i of m.icons) { const [w, h] = png(path.join(out, i.src)); assert.equal(i.sizes, w + 'x' + h, i.src); assert.equal(i.type, 'image/png'); }
});
t('the service worker is stamped: no markers left, the version matches, and every file of the build (but not itself) is kept for offline use', () => {
  const sw = read('sw.js'); assert.ok(!sw.includes('__BUILD_ID__') && !sw.includes('__FILES__'));
  const id = (sw.match(/const VERSION = "([0-9a-f]{10})"/) || [])[1]; assert.equal(id, r.id);
  const list = JSON.parse('[' + (sw.match(/const FILES = \[([^\]]*)\]/) || [])[1] + ']');
  assert.ok(list.includes('./') && list.includes('./index.html') && list.includes('./manifest.webmanifest') && list.includes('./img/icon-192.png'));
  for (const f of listFiles(out)) { if (f === 'sw.js' || f === 'build.json') continue; assert.ok(list.includes('./' + f), 'not kept offline: ' + f); }
  assert.ok(!list.includes('./sw.js'));
  assert.ok(/addEventListener\('fetch'/.test(sw), 'it has a fetch handler (needed to be installable)');
});
t('the same files always give the same version, and any change to the game changes it', () => {
  const again = build({ src: SRC, out: tmp() }); assert.equal(again.id, r.id);
  const copy = tmp(); fs.cpSync(SRC, copy, { recursive: true }); fs.appendFileSync(path.join(copy, 'js', 'battery.js'), '\n// changed\n');
  assert.notEqual(build({ src: copy, out: tmp() }).id, r.id);
  const sw = fs.readFileSync(path.join(copy, 'sw.js'), 'utf8'); fs.writeFileSync(path.join(copy, 'sw.js'), sw + '\n// a comment in the worker only\n');
  const only = build({ src: copy, out: tmp() }), copy2 = tmp(); fs.cpSync(SRC, copy2, { recursive: true }); fs.appendFileSync(path.join(copy2, 'js', 'battery.js'), '\n// changed\n'); fs.writeFileSync(path.join(copy2, 'sw.js'), sw);
  assert.equal(only.id, build({ src: copy2, out: tmp() }).id, 'the worker file itself is not part of the version');
});
t('backup folders, temp files and editor leftovers are never published', () => {
  const copy = tmp(); fs.cpSync(SRC, copy, { recursive: true }); fs.mkdirSync(path.join(copy, 'backups')); fs.writeFileSync(path.join(copy, 'backups', 'old.js'), 'x'); fs.writeFileSync(path.join(copy, 'js', 'engine.js.bak'), 'x'); fs.writeFileSync(path.join(copy, 'js', 'x.tmp'), 'x'); fs.writeFileSync(path.join(copy, 'Thumbs.db'), 'x');
  const o = tmp(); build({ src: copy, out: o }); const files = listFiles(o); assert.ok(!files.some((f) => /backups|\.bak|\.tmp|Thumbs/.test(f)), files.filter((f) => /backups|\.bak|\.tmp|Thumbs/.test(f)).join());
});
t('a bad request fails with a clear message and touches nothing: no index.html, or an output folder that would eat the source', () => {
  assert.throws(() => build({ src: tmp(), out: tmp() }), /No index\.html/);
  const copy = tmp(); fs.cpSync(SRC, copy, { recursive: true }); assert.throws(() => build({ src: copy, out: copy }), /must not be/); assert.throws(() => build({ src: path.join(copy, 'js'), out: copy }), /No index\.html|must not be/);
  assert.ok(fs.existsSync(path.join(copy, 'index.html')), 'the source is still there');
  const noMarker = tmp(); fs.cpSync(SRC, noMarker, { recursive: true }); fs.writeFileSync(path.join(noMarker, 'sw.js'), '// no markers'); assert.throws(() => build({ src: noMarker, out: tmp() }), /marker/);
});
t('the page only registers the worker on a real host (or on localhost when asked with ?sw), so local work never serves stale code', () => {
  const html = read('index.html'); assert.ok(html.includes("window.isSecureContext") && /localhost\|127/.test(html) && html.includes('[?&]sw\\b'), 'the guard is in the page'); assert.ok(!html.includes('\x08'), 'no stray control characters');
});
t('the server gives the right types and headers and refuses to leave its folder', async () => {
  const server = createServer(out, { dev: false }); await new Promise((r2) => server.listen(0, '127.0.0.1', r2)); const base = 'http://127.0.0.1:' + server.address().port;
  try {
    let res = await fetch(base + '/'); assert.equal(res.status, 200); assert.ok(/text\/html/.test(res.headers.get('content-type'))); assert.equal(res.headers.get('cache-control'), 'no-cache');
    res = await fetch(base + '/manifest.webmanifest'); assert.ok(/application\/manifest\+json/.test(res.headers.get('content-type')));
    res = await fetch(base + '/sw.js'); assert.equal(res.headers.get('cache-control'), 'no-cache'); assert.ok(/javascript/.test(res.headers.get('content-type')));
    res = await fetch(base + '/js/engine.js'); assert.ok(/max-age=3600/.test(res.headers.get('cache-control'))); res = await fetch(base + '/img/icon-192.png'); assert.equal(res.headers.get('content-type'), 'image/png');
    res = await fetch(base + '/fonts/' + fs.readdirSync(path.join(out, 'fonts')).find((f) => f.endsWith('.woff2'))); assert.equal(res.headers.get('content-type'), 'font/woff2');
    assert.equal((await fetch(base + '/nope.js')).status, 404); assert.ok([403, 404].includes((await fetch(base + '/%2e%2e/%2e%2e/etc/passwd')).status)); assert.equal((await fetch(base + '/', { method: 'POST' })).status, 405);
  } finally { server.close(); }
});
(async () => { for (const [name, fn] of queue) { await fn(); n++; console.log('ok  ' + name); } console.log('\n' + n + ' tests passed'); })().catch((e) => { console.error(e); process.exit(1); });
