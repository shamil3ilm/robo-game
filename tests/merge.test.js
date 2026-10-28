// Run: node tests/merge.test.js  (the pure join in src/js/merge.js: pieces in, one piece out; the three.js part is checked in the browser by the draw-call count)
const fs = require('fs'), path = require('path'), assert = require('assert');
const win = {}; new Function('window', fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'merge.js'), 'utf8'))(win);
const M = win.RoboMerge;
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok  ' + name); };

const tri = (x) => ({ position: new Float32Array([x, 0, 0, x + 1, 0, 0, x, 1, 0]), normal: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]), uv: new Float32Array([0, 0, 1, 0, 0, 1]), index: [0, 1, 2] });
const quad = () => ({ position: new Float32Array(12), normal: new Float32Array(12), uv: new Float32Array(8), index: [0, 1, 2, 0, 2, 3] });

t('two pieces become one: vertices add up and the second piece\'s indices are shifted past the first', () => {
  const c = M.concat([tri(0), quad()]); assert.equal(c.vertices, 7); assert.deepEqual([...c.index], [0, 1, 2, 3, 4, 5, 3, 5, 6]);
  assert.equal(c.position.length, 21); assert.equal(c.uv.length, 14); assert.equal(c.position[3], 1, 'positions are copied in order');
});
t('a piece without an index is a plain triangle list and gets one', () => {
  const p = { position: new Float32Array(9), normal: null, uv: null, index: null }; const c = M.concat([quad(), p]); assert.deepEqual([...c.index].slice(6), [4, 5, 6]);
  assert.equal(c.normal.length, 21, 'a missing normal or uv is left as zeros, not an error');
});
t('a big join switches to 32-bit indices so nothing wraps', () => {
  const big = { position: new Float32Array(3 * 70000), normal: null, uv: null, index: null }; const c = M.concat([big]); assert.ok(c.index instanceof Uint32Array); assert.equal(c.index[69999], 69999);
  const small = M.concat([tri(0)]); assert.ok(small.index instanceof Uint16Array);
});
t('materials that look the same share a key, and a change in colour, texture or transparency changes it', () => {
  const col = (h) => ({ getHex: () => h }), base = { type: 'MeshStandardMaterial', color: col(0xff0000), roughness: 0.9, metalness: 0, flatShading: false, map: null, side: 0, emissive: col(0), emissiveIntensity: 1, opacity: 1, transparent: false, depthWrite: true, alphaTest: 0 };
  assert.equal(M.matKey(base), M.matKey(Object.assign({}, base))); assert.notEqual(M.matKey(base), M.matKey(Object.assign({}, base, { color: col(0x00ff00) })));
  assert.notEqual(M.matKey(base), M.matKey(Object.assign({}, base, { map: { uuid: 'a' } }))); assert.notEqual(M.matKey(base), M.matKey(Object.assign({}, base, { transparent: true })));
});
t('pieces with colours keep them, and pieces without colour get white, in one joined piece', () => {
  const a = Object.assign(tri(0), { color: new Float32Array([1, 0, 0, 1, 0, 0, 1, 0, 0]) }), b = tri(5), c = M.concat([a, b]);
  assert.equal(c.color.length, 18); assert.deepEqual([...c.color.slice(0, 3)], [1, 0, 0]); assert.deepEqual([...c.color.slice(9, 12)], [1, 1, 1]); assert.equal(M.concat([tri(0)]).color, null, 'no colour at all, none made');
});
t('plain-colour materials share a key whatever their colour, and textured or glowing ones do not', () => {
  const col = (h) => ({ getHex: () => h }), base = { type: 'MeshStandardMaterial', color: col(0xff0000), roughness: 0.9, metalness: 0, flatShading: false, map: null, side: 0, emissive: col(0), opacity: 1, transparent: false, depthWrite: true, alphaTest: 0 };
  assert.equal(M.plainKey(base), M.plainKey(Object.assign({}, base, { color: col(0x00ff00) }))); assert.notEqual(M.plainKey(base), M.plainKey(Object.assign({}, base, { roughness: 0.4 })));
  assert.equal(M.plainKey(Object.assign({}, base, { map: { uuid: 'a' } })), null); assert.equal(M.plainKey(Object.assign({}, base, { emissive: col(0x112233) })), null); assert.equal(M.plainKey(Object.assign({}, base, { type: 'MeshBasicMaterial' })), null);
});
console.log(n + ' tests passed');
