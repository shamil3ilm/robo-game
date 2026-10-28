/* Robo Run: make the website build. `node tools/build.cjs` copies src/ into dist/, stamps the service worker with a version (a hash of every file, so it changes exactly when the game does)
   and the list of files to keep on the device, and writes dist/build.json. dist/ is a plain static folder: upload it to any web host (or open it with `node tools/serve.cjs --dist`).
   Options: --src <folder> (default src), --out <folder> (default dist). Nothing is minified, so a deployed build can be read and debugged like the source. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const SKIP_DIR = new Set(['backups', 'node_modules', '.git']);
const SKIP_FILE = /(\.bak$|\.tmp$|~$|^\.DS_Store$|^Thumbs\.db$)/i;

const listFiles = (dir, base = dir) => {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIR.has(e.name)) out.push(...listFiles(path.join(dir, e.name), base)); }
    else if (!SKIP_FILE.test(e.name)) out.push(path.relative(base, path.join(dir, e.name)).split(path.sep).join('/'));
  }
  return out.sort();
};

function build({ src, out }) {
  if (!fs.existsSync(path.join(src, 'index.html'))) throw new Error('No index.html in ' + src + '. Is --src right?');
  if (path.resolve(out) === path.resolve(src) || path.resolve(src).startsWith(path.resolve(out) + path.sep)) throw new Error('The output folder must not be the source folder or contain it.');
  fs.rmSync(out, { recursive: true, force: true });
  const files = listFiles(src);
  for (const f of files) { fs.mkdirSync(path.dirname(path.join(out, f)), { recursive: true }); fs.copyFileSync(path.join(src, f), path.join(out, f)); }
  // the version is a hash of every file except the worker itself (which is rewritten below), so the same files always give the same version
  const h = crypto.createHash('sha1');
  for (const f of files) if (f !== 'sw.js') { h.update(f + '\0'); h.update(fs.readFileSync(path.join(src, f))); }
  const id = h.digest('hex').slice(0, 10);
  const keep = ['./', ...files.filter((f) => f !== 'sw.js').map((f) => './' + f)];
  const sw = fs.readFileSync(path.join(src, 'sw.js'), 'utf8');
  if (!sw.includes("'__BUILD_ID__'") || !sw.includes('/*__FILES__*/')) throw new Error('src/sw.js lost its __BUILD_ID__ or __FILES__ marker.');
  fs.writeFileSync(path.join(out, 'sw.js'), sw.replace("'__BUILD_ID__'", JSON.stringify(id)).replace('/*__FILES__*/', keep.map((f) => JSON.stringify(f)).join(', ')));
  const bytes = files.reduce((n, f) => n + fs.statSync(path.join(src, f)).size, 0);
  fs.writeFileSync(path.join(out, 'build.json'), JSON.stringify({ id, files: files.length, bytes }, null, 2) + '\n');
  return { id, files: files.length, bytes, keep };
}

module.exports = { build, listFiles };

if (require.main === module) {
  const arg = (name, dflt) => { const i = process.argv.indexOf('--' + name); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : dflt; };
  const root = path.resolve(__dirname, '..');
  try {
    const r = build({ src: path.resolve(root, arg('src', 'src')), out: path.resolve(root, arg('out', 'dist')) });
    console.log('Built ' + r.files + ' files (' + (r.bytes / 1048576).toFixed(2) + ' MB), version ' + r.id + ' -> ' + path.resolve(root, arg('out', 'dist')));
  } catch (e) { console.error('Build failed: ' + e.message); process.exit(1); }
}
