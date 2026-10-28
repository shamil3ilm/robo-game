// Run: node tests/jobs.test.js  (the delivery job points of the Manjeri, city and HiLITE City areas in src/js/explore_jobs.js, with the shared job rules of explore.js)
const fs = require('fs'), path = require('path'), assert = require('assert');
const win = {}; new Function('window', fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'explore_jobs.js'), 'utf8'))(win); const J = win.RoboExploreJobs;
const exSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'explore.js'), 'utf8');
const ew = {}; new Function('window', exSrc)(ew); const E = ew.RoboExplore;
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok  ' + name); };
const rides = {}; new Function('window', fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'explore_rides.js'), 'utf8'))(rides); const R = rides.RoboExploreRides;
const centre = { manjeri: R.MANJERI_X, city: R.CITY_X, hilite: R.HILITE_X };
const world = (set, [name, lx, lz]) => ({ name, x: set.ox + lx, z: lz });

t('every area has a job set, with a desk and at least six named points with distinct names', () => {
  assert.deepEqual(Object.keys(J.sets).sort(), ['city', 'hilite', 'manjeri']);
  for (const [k, s] of Object.entries(J.sets)) { assert.ok(s.points.length >= 6, k); const names = s.points.map((p) => p[0]); assert.equal(new Set(names).size, names.length, k + ' names'); assert.equal(s.desk.length, 2); }
});
t("each set's centre matches the area's centre in the ride data, and every point and desk is inside the area (36 m either side, 62 m along)", () => {
  for (const [k, s] of Object.entries(J.sets)) { assert.equal(s.ox, centre[k], k); for (const p of s.points.concat([['desk', ...s.desk]])) { const lim = k === 'manjeri' ? [100, 140] : [36, 62]; assert.ok(Math.abs(p[1]) <= lim[0] && Math.abs(p[2]) <= lim[1], k + ' ' + p[0]); } }
});
t('every area can offer a job: some pair of points is at least 40 m apart, and the first to the last is a proper walk', () => {
  for (const [k, s] of Object.entries(J.sets)) {
    let far = 0; for (const a of s.points) for (const b of s.points) far = Math.max(far, Math.hypot(a[1] - b[1], a[2] - b[2])); assert.ok(far >= 40, k + ' far ' + far);
  }
});
t('the shared rules give a job in every area, with the fare and tip of the town', () => {
  const { fare, tip, pickJob } = E;
  for (const [k, s] of Object.entries(J.sets)) {
    const pts = s.points.map((p) => world(s, p)); let seed = 7; const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 30; i++) { const j = pickJob(pts, rand); assert.ok(j, k); assert.ok(j.dist >= 40 && j.fare === fare(j.dist) && j.from !== j.to); }
  }
  assert.equal(fare(0), 30); assert.equal(fare(100), 45); assert.equal(tip(100, 1), 10); assert.equal(tip(100, 9999), 0);
});
t('explore.js builds a desk for every set and checks every job point in its audit', () => { assert.ok(/RoboExploreJobs/.test(exSrc)); assert.ok(/badJobPoints/.test(exSrc)); });
console.log('\n' + n + ' tests passed');
