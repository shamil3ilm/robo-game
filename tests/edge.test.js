// Run: node tests/edge.test.js  (the town-edge helper in src/js/explore_edge.js, through Malappuram: an irregular outline, roads that bend away to their own exits, map strips that follow the outline)
const fs = require('fs'), path = require('path'), assert = require('assert');
const win = {}; for (const f of ['explore_edge.js', 'explore_malappuram.js']) new Function('window', fs.readFileSync(path.join(__dirname, '..', 'src', 'js', f), 'utf8'))(win);
const S = win.RoboExploreMalappuram.shape;
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok  ' + name); };

t('the junction, the end of every shop row and the bus yard lie inside the outline', () => {
  for (const [x, z] of [[0, 0], [0, -95], [0, 85], [95, 0], [-80, 0], [13.6, -95], [-13.6, 85], [-52, -30], [-22, -6], [94, 13.6], [94, -13.6], [-80, 13.6]]) assert.ok(S.inside(x, z, 0), x + ',' + z);
});
t('the outline is not a rectangle', () => {
  const rs = S.loopPoints(360).map((p) => Math.hypot(p.x / S.AX, (p.z - S.CZ) / S.AZ)); assert.ok(Math.max(...rs) / Math.min(...rs) > 1.25);
  assert.ok(!S.inside(S.AX, S.CZ - S.AZ, 0) && !S.inside(-S.AX, S.CZ + S.AZ, 0), 'the corners of the bounding box are outside');
});
t('four roads leave through their own gaps, beyond the last shop, bending away and facing outwards', () => {
  const e = S.exits(), by = Object.fromEntries(e.map((x) => [x.name, x])); assert.equal(e.length, 4);
  assert.ok(by.north.z < -100 && by.south.z > 90 && by.east.x > 98 && by.west.x < -85, JSON.stringify(e.map((x) => [x.name, x.x, x.z])));
  for (const x of e) { assert.ok(S.inside(x.x, x.z, 0)); assert.ok(!S.inside(x.x + x.tx * 2, x.z + x.tz * 2, 0), x.name); }
  assert.ok(by.north.x > 3 && by.south.x < -3 && by.east.z < -3, 'bends: north to the east, south to the west, east to the north');
});
t('the map has a strip of land on every 5 m line, a jungle band at each end and the bent roads', () => {
  const r = win.RoboExploreMalappuram.mapRects(900); assert.ok(r.length > 120); assert.ok(r.some((q) => q[4] === '#2f4a2c') && r.some((q) => q[4] === '#6f7a44') && r.some((q) => q[4] === '#9a968e'));
  assert.ok(r.every((q) => q[0] < q[1] && q[2] < q[3]));
});
console.log(n + ' tests passed');
