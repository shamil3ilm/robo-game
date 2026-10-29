// Run: node tests/explore.test.js  (tests the pure movement and collision rules in src/js/explore.js; the town itself needs three.js and is checked in the browser)
const fs = require('fs'), path = require('path'), assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'explore.js'), 'utf8');
const win = {}; new Function('window', src)(win); const E = win.RoboExplore;

let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok  ' + name); };
const wall = { t: 'box', x0: 4, x1: 12, z0: -10, z1: 10 };
const B = { x0: -30, x1: 30, z0: -70, z1: 99 };

t('free movement goes where it is pushed', () => { const p = E.move({ x: 0, z: 0 }, 2, 0, 1, 0.45, [wall], B); assert.ok(Math.abs(p.x - 2) < 1e-9 && p.z === 0); });
t('a wall stops the walker at its own radius', () => { const p = E.move({ x: 3, z: 0 }, 5, 0, 1, 0.45, [wall], B); assert.ok(Math.abs(p.x - (4 - 0.45)) < 1e-6, 'x=' + p.x); });
t('walking diagonally into a wall slides along it', () => { const p = E.move({ x: 3.4, z: 0 }, 3, 3, 1, 0.45, [wall], B); assert.ok(p.x <= 4 - 0.45 + 1e-6); assert.ok(p.z > 2.5, 'z=' + p.z); });
t('a fast frame cannot tunnel through a thin wall', () => { const thin = { t: 'box', x0: 4, x1: 4.2, z0: -5, z1: 5 }; const p = E.move({ x: 3, z: 0 }, 60, 0, 1, 0.45, [thin], B); assert.ok(p.x < 4, 'x=' + p.x); });
t('standing inside a box is pushed out the nearest side', () => { const p = E.move({ x: 4.5, z: 0 }, 0, 0, 0.016, 0.45, [wall], B); assert.ok(p.x <= 4 - 0.45 + 1e-6 || p.x >= 12 + 0.45 - 1e-6); });
t('a circle (a person, a pole) pushes the walker around it', () => { const c = { t: 'circle', x: 0, z: -2, r: 0.5 }; const p = E.move({ x: 0, z: 0 }, 0, -3, 1, 0.45, [c], B); assert.ok(Math.hypot(p.x, p.z + 2) >= 0.95 - 1e-6); });
t('the town edge keeps the walker in', () => { const p = E.move({ x: 29, z: 0 }, 9, 0, 1, 0.45, [], B); assert.ok(p.x <= 30 - 0.45 + 1e-9); const q = E.move({ x: 0, z: -69 }, 0, -9, 1, 0.45, [], B); assert.ok(q.z >= -70 + 0.45 - 1e-9); });
t('two walls in a corner both hold', () => { const w2 = { t: 'box', x0: -10, x1: 10, z0: 6, z1: 12 }; const p = E.move({ x: 3, z: 5 }, 6, 6, 1, 0.45, [{ t: 'box', x0: 4, x1: 12, z0: -10, z1: 20 }, w2], B); assert.ok(p.x <= 3.55 + 1e-6 && p.z <= 5.55 + 1e-6, JSON.stringify(p)); });
t('nearest interaction spot wins and respects its radius', () => {
  const spots = [{ x: 0, z: 0, r: 2, kind: 'shop', arg: 'snacks' }, { x: 3, z: 0, r: 2, kind: 'gate' }];
  assert.equal(E.nearest({ x: 0.5, z: 0 }, spots).kind, 'shop'); assert.equal(E.nearest({ x: 2.6, z: 0 }, spots).kind, 'gate');
  assert.equal(E.nearest({ x: 10, z: 10 }, spots), null);
});
t('stick input maps through the camera: forward is away from the camera', () => {
  const f = E.stick(0, 1, 0), r = E.stick(1, 0, 0); assert.ok(Math.abs(f.x) < 1e-9 && Math.abs(f.z + 1) < 1e-9); assert.ok(Math.abs(r.x - 1) < 1e-9 && Math.abs(r.z) < 1e-9);
  const q = E.stick(0, 1, Math.PI / 2); assert.ok(Math.abs(q.x + 1) < 1e-9, JSON.stringify(q));   // camera moved to the east side, so forward is west
  const d = E.stick(1, 1, 0); assert.ok(Math.abs(Math.hypot(d.x, d.z) - 1) < 1e-9, 'diagonal is not faster');
});
t('Manjeri has its own place names, a KSRTC ride joins the two areas, and both areas have a minimap', () => {
  const L = E.layout; assert.equal(E.placeName(L.manjeriX, 0), 'Manjeri Junction'); assert.equal(E.placeName(L.manjeriX + 40, 15), 'KSRTC station'); assert.equal(E.placeName(L.manjeriX - 20, 45), 'Football turf'); assert.equal(E.placeName(L.manjeriX + 25, 38), 'Medical college'); assert.equal(E.placeName(L.manjeriX + 60, 0), 'Manjeri-Pandikkad Road'); assert.equal(E.placeName(L.manjeriX - 50, 0), 'Bypass road'); assert.equal(E.placeName(L.manjeriX, -126), 'Kozhikkattu Kunnu'); assert.equal(E.placeName(L.manjeriX, -40), 'Kozhikode-Manjeri Road'); assert.equal(E.placeName(L.manjeriX, 60), 'Kozhikode-Malappuram Bypass'); assert.equal(E.placeName(L.manjeriX + 40, -90), 'Cherani Cross Road'); assert.equal(E.placeName(L.manjeriX + 20, -100), 'Happy Road');
  assert.ok(E.AREAS.kozhikode && E.AREAS.manjeri); assert.ok(E.AREAS.manjeri.spawn[0] > 100); assert.ok(L.maps.kozhikode.rects.length && L.maps.manjeri.rects.length);
  const B2 = E.AREAS.manjeri.bounds; const p = E.move({ x: B2.x1 - 2, z: 0 }, 9, 0, 1, 0.45, [], B2); assert.ok(p.x <= B2.x1 - 0.45 + 1e-9, 'stays inside Manjeri');
});
t('the place label follows the walker through the town', () => {
  assert.equal(E.placeName(0, 0), 'Mittai Theruvu'); assert.equal(E.placeName(10, -26), 'Temple lane'); assert.equal(E.placeName(24, -26), 'Temple courtyard');
  assert.equal(E.placeName(-10, -26), 'Market lane'); assert.equal(E.placeName(-24, -30), 'Mosque courtyard'); assert.equal(E.placeName(27, 64), 'Church square');
  assert.equal(E.placeName(0, 66), 'Beach promenade'); assert.equal(E.placeName(0, 90), 'Kozhikode Beach'); assert.equal(E.placeName(10, -12), 'Mittai Theruvu');
});
t('a lane between two shopfronts is walkable end to end while the walls hold', () => {
  const left = { t: 'box', x0: 4.6, x1: 13, z0: -70, z1: -30 }, right = { t: 'box', x0: 4.6, x1: 13, z0: -22, z1: 20 };
  let p = { x: 0, z: -26 }; for (let i = 0; i < 100; i++) p = E.move(p, 4, 0, 0.05, 0.45, [left, right], B);
  assert.ok(p.x > 12, 'x=' + p.x); assert.ok(p.z > -29.6 && p.z < -22.4, 'z=' + p.z);
  let q = { x: 8, z: -26 }; for (let i = 0; i < 100; i++) q = E.move(q, 0, 4, 0.05, 0.45, [left, right], B);   // pushing north or south into the walls
  assert.ok(q.z <= -22.45 && q.z >= -29.55, 'z=' + q.z);
});
t('an awning is detected between the camera and the walker, and not beside them', () => {
  assert.ok(E.segHitsRect(0, 7, 0, 0, -1.3, 1.3, 2, 3)); assert.equal(E.segHitsRect(0, 7, 0, 0, 3, 5, 2, 3), false);
  assert.ok(E.segHitsRect(-5, 5, 5, -5, -1, 1, -1, 1)); assert.equal(E.segHitsRect(0, 0, 1, 1, 5, 6, 5, 6), false);
});
t('the camera follows the walking direction in the street and lanes only', () => {
  assert.equal(E.followYaw(0, 0, 0, -4), 0); assert.equal(E.followYaw(0, 0, 0, 4), Math.PI);
  assert.equal(E.followYaw(10, -26, 4, 0), -Math.PI / 2); assert.equal(E.followYaw(-10, -26, -4, 0), Math.PI / 2);
  assert.equal(E.followYaw(0, 0, 0.5, 0.5), null, 'standing still keeps the camera'); assert.equal(E.followYaw(0, 80, 0, -4), null, 'the beach is free');
});
t('the camera follows the way you go in every street of the open towns, not only on the beach street (else it ends up inside the shop fronts)', () => {
  const L = E.layout, mx = L.manjeriX;
  for (const [x, z] of [[mx, 0], [mx, -100], [mx + 60, 0], [mx - 60, 0], [mx + 40, -80], [mx + 20, -100], [900, 20], [900 + 50, 0], [900 - 40, 0]]) assert.ok(E.inFollowZone(x, z), x + ',' + z);
  for (const [x, z] of [[mx + 20, 50], [mx - 30, 45], [mx + 70, 40], [900 + 40, 40]]) assert.equal(E.inFollowZone(x, z), false, 'open ground is free: ' + x + ',' + z);
  assert.equal(E.followYaw(mx + 50, 0, 4, 0), -Math.PI / 2, 'heading east on the east road: the camera looks east'); assert.equal(E.followYaw(mx, 30, 0, 4), Math.PI, 'heading south on the highway'); assert.equal(E.followYaw(mx + 20, 50, 4, 0), null, 'the football turf is free');
});
t('a vehicle parked sideways at the kerb is turned along the street when you get in', () => {
  const L = E.layout, mx = L.manjeriX, PI = Math.PI;
  assert.equal(E.streetYaw(mx + 3.9, -30, -PI / 2), 0, 'on the highway, facing east at the shop fronts: turned north (the nearer way is north or south by heading)');
  assert.equal(E.streetYaw(mx + 3.9, -30, PI / 2) === 0 || E.streetYaw(mx + 3.9, -30, PI / 2) === PI, true, 'always along the highway');
  assert.equal(E.streetYaw(mx + 3.9, -30, 0.2), 0, 'already facing along it: kept');
  assert.equal(E.streetYaw(mx + 3.9, -30, 3.0), PI, 'facing south: kept south');
  assert.equal(E.streetYaw(mx + 50, 3.0, 0.4) === -PI / 2 || E.streetYaw(mx + 50, 3.0, 0.4) === PI / 2, true, 'on the east road: along the road (east or west)');
  assert.equal(E.streetYaw(mx + 20, 50, 1.1), 1.1, 'open ground: the heading is kept');
});
t('a delivery pays a base fare plus a distance fare, and a quick run earns a tip', () => {
  assert.equal(E.fare(0), 30); assert.equal(E.fare(100), 45); assert.equal(E.fare(150), 53);
  assert.equal(E.tip(72, 5), 10, 'well inside the par time'); assert.equal(E.tip(72, 36), 5, 'a bit slow'); assert.equal(E.tip(72, 90), 0, 'far too slow');
});
t('a job picks two different places that are far enough apart', () => {
  const pts = [{ name: 'a', x: 0, z: 0 }, { name: 'b', x: 3, z: 0 }, { name: 'c', x: 100, z: 0 }]; let k = 0; const rand = () => [0, 0.34, 0.9, 0.5, 0.1][k++ % 5];
  const j = E.pickJob(pts, rand, 40); assert.ok(j && j.from !== j.to && j.dist >= 40 && j.fare === E.fare(j.dist));
  assert.equal(E.pickJob([{ x: 0, z: 0 }, { x: 1, z: 1 }], Math.random, 40), null, 'nothing far enough: no job');
});
t('every note has a title, a body and a named source, and no placeholder text', () => {
  const nsrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'explore_notes.js'), 'utf8'), nw = {}; new Function('window', nsrc)(nw);
  const N = nw.RoboExploreNotes.NOTES, keys = Object.keys(N); assert.ok(keys.length >= 7);
  for (const k of keys) { const x = N[k]; assert.ok(x.title && x.body && x.src && x.emoji, k); assert.ok(!/lorem|todo|tbd/i.test(x.body), k); assert.ok(x.body.length > 40 && x.body.length < 420, k + ' length ' + x.body.length); }
  ['smstreet', 'renovation', 'pottekkatt', 'swamy', 'bombay', 'foodtrail', 'literature', 'zilmoney', 'zilsite', 'zilcubator', 'zilwhat', 'farsa', 'oottupura', 'zindagi', 'vanitha', 'kuzhimandi', 'budget', 'malappuram', 'manjeri', 'payyanad', 'mcmanjeri', 'ksrtc'].forEach((k) => assert.ok(N[k], 'missing ' + k));
});
t('hitting something reports what was hit and how hard; sliding along a wall and free walking report nothing hard', () => {
  const w2 = { t: 'box', x0: 4, x1: 12, z0: -10, z1: 10, tag: 'wall' }, c2 = { t: 'circle', x: 0, z: -3, r: 0.5, tag: 'person' };
  let p = E.move({ x: 3.3, z: 0 }, 4, 0, 0.1, 0.45, [w2], B); assert.equal(p.hit, w2); assert.ok(Math.abs(p.impact - 4) < 0.2, 'head-on impact ' + p.impact);
  p = E.move({ x: 3.54, z: 0 }, 0.4, 4, 0.1, 0.45, [w2], B); assert.ok(p.impact < 0.6, 'a glancing slide is gentle: ' + p.impact);
  p = E.move({ x: 0, z: 0 }, 2, 0, 0.1, 0.45, [w2], B); assert.equal(p.hit, null); assert.equal(p.impact, 0);
  p = E.move({ x: 0, z: -1.8 }, 0, -3, 0.1, 0.45, [c2], B); assert.equal(p.hit, c2); assert.ok(p.impact > 2, 'walking into a person: ' + p.impact);
});
t('a bump fires once when you hit something, not again while you keep pressing against it, and again after you step away', () => {
  const g = E.bumpGate(); const hard = { impact: 3, hit: { tag: 'wall' } }, none = { impact: 0, hit: null };
  assert.ok(g.step(0.016, hard)); assert.equal(g.step(0.016, hard), null); assert.equal(g.step(0.5, hard), null, 'still pressing');
  assert.equal(g.step(0.5, none), null); assert.ok(g.step(0.016, hard), 'fires again after being free');
  assert.equal(E.bumpGate().step(0.016, { impact: 0.5, hit: { tag: 'wall' } }), null, 'too soft to count');
});
t('a stick pointing almost straight along a street is made exactly straight, a real turn is left alone, and the speed does not change', () => {
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  let r = E.snapAxis(0.12, -1, 14); assert.ok(near(r.x, 0) && near(r.z, -Math.hypot(0.12, 1)), 'a thumb a little right of forward goes straight north: ' + JSON.stringify(r));
  r = E.snapAxis(-0.2, -0.97, 14); assert.ok(near(r.x, 0), 'a little left too');
  r = E.snapAxis(1, 0.1, 14); assert.ok(near(r.z, 0) && r.x > 0, 'east');
  r = E.snapAxis(0.7, -0.7, 14); assert.ok(near(r.x, 0.7) && near(r.z, -0.7), 'a real diagonal is not touched');
  r = E.snapAxis(0.5, -1, 14); assert.ok(near(r.x, 0.5), 'about 27 degrees off is a real turn');
  assert.ok(near(Math.hypot(E.snapAxis(0.12, -1, 14).x, E.snapAxis(0.12, -1, 14).z), Math.hypot(0.12, 1)), 'same speed'); assert.deepEqual(E.snapAxis(0, 0, 14), { x: 0, z: 0 });
  assert.equal(E.snapYaw(0.3), 0); assert.ok(near(E.snapYaw(1.3), Math.PI / 2)); assert.ok(near(E.snapYaw(-1.5), -Math.PI / 2)); assert.ok(near(E.snapYaw(3), Math.PI));
});
console.log('\n' + n + ' tests passed');
t('the delivery bike: stick up speeds it up slowly to its top speed, brakes faster than it accelerates, reverses slowly, and cannot turn on the spot', () => {
  let v = 0; for (let i = 0; i < 60; i++) v = E.bikeDrive(v, 1, 0, 1 / 60, 9.5).v; assert.ok(v > 4 && v < 7, 'after a second it is part way: ' + v);
  for (let i = 0; i < 400; i++) v = E.bikeDrive(v, 1, 0, 1 / 60, 9.5).v; assert.ok(Math.abs(v - 9.5) < 1e-6, 'top speed');
  let b = v, ticks = 0; while (b > 0.01 && ticks < 600) { b = E.bikeDrive(b, 0, 0, 1 / 60, 9.5).v; ticks++; } let a = 0, t2 = 0; while (a < 9.4 && t2 < 600) { a = E.bikeDrive(a, 1, 0, 1 / 60, 9.5).v; t2++; } assert.ok(ticks < t2, 'it stops quicker than it starts');
  let r = 0; for (let i = 0; i < 300; i++) r = E.bikeDrive(r, -1, 0, 1 / 60, 9.5).v; assert.ok(r < 0 && r >= -2.5 - 1e-9, 'reverse is slow: ' + r);
  assert.equal(E.bikeDrive(0, 0, 1, 1 / 60, 9.5).turn, 0, 'no turning while standing');
  const slow = E.bikeDrive(1, 1, 1, 1 / 60, 9.5).turn, fast = E.bikeDrive(9, 1, 1, 1 / 60, 9.5).turn; assert.ok(slow < 0 && fast < slow, 'stick right turns right (negative = clockwise) and sharper when fast: ' + slow + ', ' + fast);
  assert.ok(E.bikeDrive(9, 1, -1, 1 / 60, 9.5).turn > 0, 'stick left turns left');
  assert.ok(E.bikeDrive(-2, -1, 1, 1 / 60, 9.5).turn > 0, 'in reverse the steering is mirrored');
});
t('a heavier vehicle (the auto) picks up speed and turns more slowly than the bike', () => {
  const bike = E.bikeDrive(0, 1, 0, 0.5, 9.5, 1).v, auto = E.bikeDrive(0, 1, 0, 0.5, 9.5, 0.7).v; assert.ok(auto < bike);
  assert.ok(Math.abs(E.bikeDrive(8, 1, 1, 1 / 60, 9.5, 0.7).turn) < Math.abs(E.bikeDrive(8, 1, 1, 1 / 60, 9.5, 1).turn));
});
t('a named job goes between two named places and is priced by the distance; unknown or equal names give nothing', () => {
  const pts = [{ name: 'Tea stall', x: 0, z: 0 }, { name: 'Hotel Farsa', x: 60, z: 80 }, { name: 'Zilla Money', x: 0, z: 200 }];
  const j = E.namedJob(pts, 'Tea stall', 'Hotel Farsa'); assert.equal(j.from, pts[0]); assert.equal(j.to, pts[1]); assert.equal(j.dist, 100); assert.equal(j.fare, E.fare(100));
  assert.equal(E.namedJob(pts, 'Tea stall', 'Nowhere'), null); assert.equal(E.namedJob(pts, 'Tea stall', 'Tea stall'), null);
});
