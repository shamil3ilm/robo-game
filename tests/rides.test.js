// Run: node tests/rides.test.js  (route, fare and meter rules for autos and buses in src/js/explore_rides.js)
const fs = require('fs'), path = require('path'), assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'explore_rides.js'), 'utf8');
const win = {}; new Function('window', src)(win); const R = win.RoboExploreRides;
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok  ' + name); };
// a street with a side lane: a(0,0) - b(0,40) - c(0,80), and a lane b - d(30,40); e is not connected
const G = { nodes: { a: [0, 0], b: [0, 40], c: [0, 80], d: [30, 40], e: [100, 100] }, edges: [['a', 'b'], ['b', 'c'], ['b', 'd']] };

t('the shortest route goes through the junction and its length is the sum of the legs', () => { const r = R.route(G, 'a', 'd'); assert.deepEqual(r.ids, ['a', 'b', 'd']); assert.equal(Math.round(r.dist), 70); });
t('a route back is the same length, and a trip to the same place is empty', () => { assert.equal(Math.round(R.route(G, 'd', 'a').dist), 70); const r = R.route(G, 'b', 'b'); assert.deepEqual(r.ids, ['b']); assert.equal(r.dist, 0); });
t('unconnected or unknown places give no route', () => { assert.equal(R.route(G, 'a', 'e'), null); assert.equal(R.route(G, 'a', 'zzz'), null); });
t('it picks the shorter of two roads', () => { const H = { nodes: { a: [0, 0], b: [100, 0], c: [50, 5] }, edges: [['a', 'b'], ['a', 'c'], ['c', 'b']] }; assert.deepEqual(R.route(H, 'a', 'b').ids, ['a', 'b']); const J = { nodes: { a: [0, 0], b: [100, 0], c: [50, 5], w: [50, 60] }, edges: [['a', 'w'], ['w', 'b'], ['a', 'c'], ['c', 'b']] }; assert.deepEqual(R.route(J, 'a', 'b').ids, ['a', 'c', 'b']); });
t('the fare is a base of 30 plus 15 per 100 m, and the meter ticks up to it and no further', () => {
  assert.equal(R.fareFor(0), 30); assert.equal(R.fareFor(100), 45); assert.equal(R.fareFor(70), 41);
  assert.equal(R.meterAt(70, 0), 30); assert.ok(R.meterAt(70, 35) > 30 && R.meterAt(70, 35) <= 41); assert.equal(R.meterAt(70, 500), 41);
  let last = 0; for (let s = 0; s <= 70; s += 5) { const m = R.meterAt(70, s); assert.ok(m >= last); last = m; }
});
t('position along the route: start, a corner, the middle of a leg and the end', () => {
  const pts = R.route(G, 'a', 'd').points; let p = R.pathAt(pts, 0); assert.equal(p.x, 0); assert.equal(p.z, 0); assert.equal(p.dz, 1);
  p = R.pathAt(pts, 40); assert.ok(Math.abs(p.z - 40) < 1e-6); p = R.pathAt(pts, 55); assert.ok(Math.abs(p.x - 15) < 1e-6 && Math.abs(p.z - 40) < 1e-6 && p.dx === 1 && p.dz === 0);
  p = R.pathAt(pts, 999); assert.ok(Math.abs(p.x - 30) < 1e-6 && p.done === true);
});
t('the trip takes distance over speed, rounded up', () => { assert.equal(R.ETA(85), 10); assert.equal(R.ETA(0), 0); });
/* ---- the stops, trips and lanes ---- */
t('every town has auto stands joined by a road, and the fare from A to B equals the fare from B to A', () => {
  const ids = Object.keys(R.STOPS); assert.equal(ids.length, 13);
  for (const a of ids) for (const tr of R.tripsFrom(a)) { assert.ok(tr.fare >= 30 && tr.dist > 0 && tr.secs > 0, a + '>' + tr.to); const back = R.tripsFrom(tr.to).find((x) => x.to === a); assert.equal(back.fare, tr.fare); assert.equal(R.STOPS[tr.to].area, R.STOPS[a].area, 'a ride stays in its town'); }
  assert.equal(R.tripsFrom('kz_beach').length, 2); assert.equal(R.tripsFrom('nowhere').length, 0);
});
t('the beach to the north end is the long ride, the middle is nearer than either end, and the fare grows with the distance', () => {
  const t1 = R.tripsFrom('kz_beach'), mid = t1.find((x) => x.to === 'kz_mid'), far = t1.find((x) => x.to === 'kz_north'); assert.ok(far.dist > mid.dist && far.fare > mid.fare); assert.equal(Math.round(far.dist), 104); assert.equal(far.fare, R.fareFor(far.dist));
});
t('the lane is on the left of the direction of travel: west going north, east going south', () => {
  const up = R.laneOffset([[0, 50], [0, -50]], 1), down = R.laneOffset([[0, -50], [0, 50]], 1); assert.deepEqual(up.map((p) => p.map(Math.round)), [[-1, 50], [-1, -50]]); assert.deepEqual(down.map((p) => p.map(Math.round)), [[1, -50], [1, 50]]);
  const bent = R.laneOffset([[0, 0], [0, -10], [10, -10]], 1); assert.equal(Math.round(bent[2][1]), -11, 'going east, left is north (smaller z)');
});
t('the five areas are joined by KSRTC counters: every stop reaches all the others, in a different area, with a fare, a time and an arrival point', () => {
  const k = R.BUS_STOPS, ids = Object.keys(k); assert.equal(ids.length, 6);
  for (const id of ids) { assert.ok(Array.isArray(k[id].arrive) && k[id].arrive.length === 2); const to = R.busFrom(id); assert.equal(to.length, 5, id); for (const l of to) { assert.notEqual(k[l.to].area, k[id].area); assert.ok(l.fare > 0 && l.hours > 0); const back = R.busFrom(l.to).find((x) => x.to === id); assert.equal(back.fare, l.fare); assert.equal(back.hours, l.hours); } }
  assert.equal(new Set(ids.map((i) => k[i].area)).size, 6, 'one counter in each area');
});
t('the beach to the city stand is the short hop and Manjeri is the long haul', () => { const f = R.busFrom('kz_ksrtc'), city = f.find((l) => l.to === 'cy_ksrtc'), mj = f.find((l) => l.to === 'mj_ksrtc'); assert.ok(city.fare < mj.fare && city.hours < mj.hours); });
t("the city's x in the ride data matches explore.js, and every stop stands in its own area's bounds", () => {
  assert.ok(/MANJERI_X = 600, CITY_X = 200, HILITE_X = 400;/.test(fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'explore.js'), 'utf8'))); assert.equal(R.CITY_X, 200); assert.equal(R.HILITE_X, 400);
  const mid = { kozhikode: 0, manjeri: R.MANJERI_X, city: R.CITY_X, hilite: R.HILITE_X, wayanad: -300, malappuram: 900 }; for (const id of Object.keys(R.STOPS)) { const s = R.STOPS[id]; assert.ok(Math.abs(s.x - mid[s.area]) < 5 && Math.abs(s.z) < (s.area === 'manjeri' ? 140 : 62), id); }
  for (const id of Object.keys(R.BUS_STOPS)) { const s = R.BUS_STOPS[id]; assert.ok(Math.abs(s.x - mid[s.area]) < 36 && Math.abs(s.z) < 70, id); }
});
t("Manjeri's x in the ride data matches explore.js", () => { assert.ok(/MANJERI_X = 600, CITY_X = 200, HILITE_X = 400;/.test(fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'explore.js'), 'utf8'))); assert.equal(R.MANJERI_X, 600); });
console.log('\n' + n + ' tests passed');
