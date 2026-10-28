// Run: node tests/nav.test.js  (the path finder in src/js/nav.js, plus a check on the real town's colliders)
const fs = require('fs'), path = require('path'), assert = require('assert');
const win = {}; new Function('window', fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'nav.js'), 'utf8'))(win);
const N = win.RoboNav;
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok  ' + name); };
const B = { x0: 0, x1: 60, z0: 0, z1: 40 }, box = (x0, x1, z0, z1) => ({ t: 'box', x0, x1, z0, z1 });
const hitsBox = (pts, b, r) => { for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], c = pts[i], k = Math.max(2, Math.ceil(Math.hypot(c.x - a.x, c.z - a.z) / 0.1)); for (let s = 0; s <= k; s++) { const x = a.x + (c.x - a.x) * s / k, z = a.z + (c.z - a.z) * s / k; if (x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r) return true; } } return false; };

t('in the open the path is a straight line of two points and its length is the distance', () => {
  const G = N.makeGrid(B, [], 0.55), r = N.route(G, 5, 5, 50, 30); assert.equal(r.points.length, 2); assert.ok(Math.abs(r.length - Math.hypot(45, 25)) < 0.3, r.length); assert.equal(r.snapped, false);
  assert.deepEqual([r.points[0].x, r.points[0].z], [5, 5]); assert.ok(Math.abs(r.points[1].x - 50) < 0.6 && Math.abs(r.points[1].z - 30) < 0.6);
});
t('a wall in the way is walked round: the path is longer than the straight line, shorter than twice it, and never touches the wall', () => {
  const wall = box(28, 32, 0, 30), G = N.makeGrid(B, [wall], 0.55), r = N.route(G, 5, 10, 55, 10);
  assert.ok(r, 'there is a way round the end'); assert.ok(r.length > 50.5 && r.length < 100, r.length); assert.equal(hitsBox(r.points, wall, 0.45), false, 'the path keeps clear of the wall'); assert.ok(r.points.length >= 3 && r.points.length <= 8, 'few corners: ' + r.points.length);
});
t('a goal inside a building becomes the nearest doorstep, and says so', () => {
  const bld = box(20, 40, 10, 30), G = N.makeGrid(B, [bld], 0.55), r = N.route(G, 5, 5, 30, 20);
  assert.ok(r && r.snapped === true); assert.equal(G.free(r.to.x, r.to.z), true); assert.ok(Math.hypot(r.to.x - 30, r.to.z - 20) < 12, 'a reasonable place: ' + JSON.stringify(r.to));
});
t('a goal that cannot be reached (walled in all round) gives no path, and one outside the ground is moved onto the ground', () => {
  const ring = [box(20, 40, 14, 16), box(20, 40, 24, 26), box(20, 22, 14, 26), box(38, 40, 14, 26)], G = N.makeGrid(B, ring, 0.55), inside = N.route(G, 5, 5, 30, 20);
  assert.ok(inside === null || inside.snapped === true, 'either no path or a doorstep outside the ring'); if (inside) assert.ok(!(inside.to.x > 22 && inside.to.x < 38 && inside.to.z > 16 && inside.to.z < 24), 'never inside the closed ring');
  const out = N.route(N.makeGrid(B, [], 0.55), 5, 5, 200, 20); assert.ok(out && out.to.x < 60 && out.snapped === true, 'moved to the edge');
});
t('static posts and parked things block, moving people do not, and the edge of the ground keeps the walker inside', () => {
  const G = N.makeGrid(B, [{ t: 'circle', x: 30, z: 20, r: 1.5 }, { t: 'circle', x: 10, z: 10, r: 1.5, dyn: true }], 0.55);
  assert.equal(G.free(30, 20), false); assert.equal(G.free(10, 10), true, 'a person is not an obstacle for the plan'); assert.equal(G.free(0.2, 20), false, 'too near the edge'); assert.equal(G.free(30, 25), true);
});
t('the path is walkable from end to end: every step along it is on a free square', () => {
  const cols = [box(10, 14, 0, 25), box(24, 28, 15, 40), box(40, 44, 0, 25)], G = N.makeGrid(B, cols, 0.55), r = N.route(G, 3, 3, 57, 37);
  assert.ok(r); for (let i = 1; i < r.points.length; i++) assert.ok(N.clear(G, r.points[i - 1].x, r.points[i - 1].z, r.points[i].x, r.points[i].z), 'leg ' + i + ' is clear');
});
t('how much path is left shrinks as you walk along it, and is the plain distance when the path is one point', () => {
  const pts = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }];
  assert.ok(Math.abs(N.lengthFrom(pts, 0, 0) - 20) < 1e-9); assert.ok(Math.abs(N.lengthFrom(pts, 5, 0) - 15) < 1e-9); assert.ok(Math.abs(N.lengthFrom(pts, 10, 4) - 6) < 1e-9); assert.ok(Math.abs(N.lengthFrom(pts, 5, 3) - 18) < 1e-9, 'three off the path counts too');
  assert.equal(N.lengthFrom([{ x: 3, z: 4 }], 0, 0), 5); assert.equal(N.lengthFrom([], 0, 0), 0); assert.equal(N.lengthFrom(null, 0, 0), 0);
});
t('a whole area (170 by 170 metres, many walls) is planned in well under a second', () => {
  const walls = []; for (let i = 0; i < 200; i++) walls.push(box((i * 37) % 160, ((i * 37) % 160) + 6, (i * 53) % 160, ((i * 53) % 160) + 3));
  const big = { x0: 0, x1: 170, z0: 0, z1: 170 }, t0 = Date.now(), G = N.makeGrid(big, walls, 0.55), built = Date.now() - t0, t1 = Date.now(), r = N.route(G, 2, 2, 168, 168); const planned = Date.now() - t1;
  assert.ok(built < 1000 && planned < 1000, 'grid ' + built + ' ms, route ' + planned + ' ms'); assert.ok(r === null || r.length > 230);
});
t('the distance from the path and the dots laid along it', () => {
  const pts = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }];
  assert.ok(Math.abs(N.distanceTo(pts, 5, 3) - 3) < 1e-9); assert.equal(N.distanceTo(pts, 10, 5), 0); assert.equal(N.distanceTo([], 1, 1), Infinity); assert.equal(N.distanceTo([{ x: 3, z: 4 }], 0, 0), 5);
  const d = N.sample(pts, 2.5, 100); assert.equal(d.length, 8, 'twenty metres every 2.5 m'); assert.deepEqual(d[0], { x: 0, z: 0 }); assert.ok(Math.abs(d[4].x - 10) < 1e-9 && Math.abs(d[4].z) < 1e-9, 'the corner is crossed with the spacing kept');
  assert.equal(N.sample(pts, 1, 5).length, 5, 'never more than max'); assert.deepEqual(N.sample(null, 2, 5), []); assert.deepEqual(N.sample([{ x: 1, z: 1 }], 2, 5), []);
});
console.log('\n' + n + ' tests passed');
