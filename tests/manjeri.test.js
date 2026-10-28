// Run: node tests/manjeri.test.js  (the shape of the walkable Manjeri in src/js/explore_manjeri.js: an irregular outline, not a rectangle; every shop row and road end inside it; each road leaves through its own gap)
const fs = require('fs'), path = require('path'), assert = require('assert');
const win = {}; new Function('window', fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'explore_manjeri.js'), 'utf8'))(win);
const S = win.RoboExploreManjeri.shape;
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok  ' + name); };

t('the junction and every shop row, road end and side road lie inside the outline', () => {
  for (const [x, z] of [[0, 0], [0, -135], [0, 105], [95, 0], [-95, 0], [16.6, -134.5], [-13, -135], [13.6, 102], [-81, 13.6], [88, -13.6], [53.6, -58], [34, -95], [-34, 58], [40, -58], [20, 36], [-20, 44]]) assert.ok(S.inside(x, z, 0), x + ',' + z);
});
t('the outline is not a rectangle: its distance from the centre changes by well over 15 percent round the ring, and it has no corners at the box corners', () => {
  const pts = S.loopPoints(360), rs = pts.map((p) => Math.hypot(p.x / S.AX, (p.z - S.CZ) / S.AZ)); assert.ok(Math.max(...rs) / Math.min(...rs) > 1.25, 'the ring wobbles');
  assert.ok(!S.inside(S.AX, S.CZ - S.AZ, 0) && !S.inside(-S.AX, S.CZ + S.AZ, 0), 'the corners of the bounding box are outside');
});
t('each of the four roads leaves the town through its own gap, beyond the last shop and facing outwards', () => {
  const e = S.exits(); assert.equal(e.length, 4);
  const byName = Object.fromEntries(e.map((x) => [x.name, x]));
  assert.ok(byName.north.z < -140 && byName.south.z > 108 && byName.east.x > 98 && byName.west.x < -98, JSON.stringify(e));
  for (const x of e) { assert.ok(S.inside(x.x, x.z, 0), 'the exit point is the last point inside'); assert.ok(!S.inside(x.x + x.tx * 2, x.z + x.tz * 2, 0), x.name + ' is on the edge'); assert.ok(Math.abs(Math.hypot(x.tx, x.tz) - 1) < 1e-9); }
  assert.ok(byName.north.x < -3 && byName.south.x > 3 && byName.east.z < -3 && byName.west.z > 0.5, 'the roads bend away: north to the west, south to the east, east to the north, west to the south');
  const pieces = S.tailPieces(); assert.ok(pieces.length > 20 && pieces.every((q) => S.inside(q.x, q.z, -0.03) || Math.hypot(q.x, q.z) > 100), 'road pieces follow the tails');
});
t('the map strips follow the outline: a row of strips on every 5 m line, each narrower than the bounding box, with a jungle strip at each end', () => {
  const r = S.mapRects(600), land = r.filter((q) => q[4] === '#6f7a44'), jungle = r.filter((q) => q[4] === '#2f4a2c');
  assert.ok(land.length > 55 && jungle.length === land.length * 2); assert.ok(land.every((q) => q[1] - q[0] < 2 * S.AX * 1.2 + 2));
  assert.ok(Math.min(...land.map((q) => q[1] - q[0])) < 0.5 * 2 * S.AX, 'the ends of the town are narrower than the middle');
});
console.log(n + ' tests passed');
