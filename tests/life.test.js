// Run: node tests/life.test.js  (the movement rules of the town's life in src/js/explore_life.js; the models and the drawing are checked in the browser)
const fs = require('fs'), path = require('path'), assert = require('assert');
const win = {}; new Function('window', fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'explore_life.js'), 'utf8'))(win);
const P = win.RoboExploreLife.pure;
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok  ' + name); };
const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };   // a repeatable "random"

t('a vehicle drives along its street at its speed, in its direction, and starts again at the other end', () => {
  const v = { x: 0, pos: 0, dir: 1, speed: 6, cur: 6, lo: -50, hi: 50 };
  for (let i = 0; i < 100; i++) P.stepVehicle(v, 0.1, Infinity); assert.ok(Math.abs(v.pos - 60 + 100) < 1 || v.pos < 50, 'wrapped or still on the street'); assert.ok(v.pos >= -50 && v.pos <= 50);
  const w = { x: 0, pos: 49.5, dir: 1, speed: 6, cur: 6, lo: -50, hi: 50 }; P.stepVehicle(w, 0.5, Infinity); assert.equal(w.pos, -50, 'wraps from the south end to the north');
  const u = { x: 0, pos: -49.5, dir: -1, speed: 6, cur: 6, lo: -50, hi: 50 }; P.stepVehicle(u, 0.5, Infinity); assert.equal(u.pos, 50, 'and the other way');
});
t('a vehicle brakes for anything close ahead, stops before it, and goes again when the road is clear', () => {
  const v = { x: 0, pos: 0, dir: 1, speed: 6, cur: 6, lo: -90, hi: 90 };
  for (let i = 0; i < 60; i++) P.stepVehicle(v, 0.1, 2); assert.equal(v.cur, 0, 'stopped for something 2 m ahead'); const stopped = v.pos; P.stepVehicle(v, 0.1, 2); assert.equal(v.pos, stopped, 'and does not creep');
  for (let i = 0; i < 80; i++) P.stepVehicle(v, 0.1, Infinity); assert.ok(v.cur > 5.5 && v.pos > stopped + 10, 'drives off when it is clear');
  const w = { x: 0, pos: 0, dir: 1, speed: 6, cur: 6, lo: -90, hi: 90 }; P.stepVehicle(w, 0.1, 6.5); assert.ok(w.cur < 6 && w.cur > 0, 'slows down gradually, not at once');
});
t('what is ahead means in the same lane and in front: a person in the lane counts, one beside the road or behind does not', () => {
  const v = { x: 1.35, pos: 0, dir: 1 };
  assert.ok(P.freeAhead(v, [{ x: 1.4, z: 8, r: 0.4 }]) < 8, 'a person ahead in the lane'); assert.equal(P.freeAhead(v, [{ x: 4.5, z: 8, r: 0.4 }]), Infinity, 'a person on the pavement');
  assert.equal(P.freeAhead(v, [{ x: 1.4, z: -12, r: 0.4 }]), Infinity, 'a person behind'); assert.equal(P.freeAhead(v, []), Infinity);
  const north = { x: -1.35, pos: 0, dir: -1 }; assert.ok(P.freeAhead(north, [{ x: -1.3, z: -6, r: 0.4 }]) < 6, 'going north, ahead is smaller z'); assert.equal(P.freeAhead(north, [{ x: -1.3, z: 6, r: 0.4 }]), Infinity);
});
t('an animal walks to a spot near its home, waits a while, and chooses another; it never leaves its range', () => {
  const a = { x: 10, z: 10, home: { x: 10, z: 10 }, range: { x: 4, z: 6 }, speed: 1, wait: 0 }; const r = seq(0.9, 0.9, 0.5, 0.1, 0.2, 0.8, 0.3, 0.7);
  let walked = 0, waited = 0; for (let i = 0; i < 4000; i++) { const w = P.stepAnimal(a, 0.1, r); if (w) walked++; else waited++; assert.ok(Math.abs(a.x - 10) <= 4.01 && Math.abs(a.z - 10) <= 6.01, 'stayed within range'); }
  assert.ok(walked > 200 && waited > 100, 'it both walks and waits'); assert.ok(Math.abs(a.yaw) <= Math.PI + 1e-9);
});
t('an animal that has to move faster (shying away) really moves faster', () => {
  const slow = { x: 0, z: 0, home: { x: 0, z: 0 }, range: { x: 9, z: 9 }, speed: 1, wait: 0, tx: 8, tz: 0 }, fast = { x: 0, z: 0, home: { x: 0, z: 0 }, range: { x: 9, z: 9 }, speed: 2.4, wait: 0, tx: 8, tz: 0 };
  P.stepAnimal(slow, 1, () => 0.5); P.stepAnimal(fast, 1, () => 0.5); assert.ok(Math.abs(fast.x - 2.4) < 1e-9 && Math.abs(slow.x - 1) < 1e-9);
});
t('the aeroplane waits, crosses the sky in its time, then waits again and comes back the other way', () => {
  const p = { wait: 2, u: 0, dir: 1, dur: 20 }, r = () => 0.5;
  P.stepPlane(p, 1, r); assert.equal(p.u, 0, 'still waiting'); P.stepPlane(p, 1.5, r); P.stepPlane(p, 0.1, r); assert.ok(p.u > 0, 'takes off after the wait');
  let steps = 0; while (p.u > 0 && steps < 1000) { P.stepPlane(p, 0.5, r); steps++; } assert.ok(steps >= 38 && steps <= 42, 'about 20 s of crossing: ' + steps); assert.equal(p.dir, -1); assert.ok(p.wait >= 30 && p.wait <= 70, 'waits 30 to 70 s: ' + p.wait);
});
t('the train stays parked, pulls out, is gone for a while, rolls in and brakes to a stop exactly at the platform', () => {
  const tr = { state: 'parked', x: 0, v: 0, wait: 3 }; const log = [];
  for (let i = 0; i < 20000 && log.length < 5; i++) { const before = tr.state; P.stepTrain(tr, 0.05); if (tr.state !== before) log.push(tr.state); }
  assert.deepEqual(log, ['leaving', 'away', 'arriving', 'parked', 'leaving']);
  const t2 = { state: 'parked', x: 0, v: 0, wait: 0 }; P.stepTrain(t2, 0.05); let max = 0; while (t2.state === 'leaving') { P.stepTrain(t2, 0.05); max = Math.max(max, t2.v); } assert.ok(max <= 14 + 1e-9 && max > 10, 'speeds up to 14 m/s, no more: ' + max); assert.ok(t2.x > 110);
  while (t2.state !== 'arriving') P.stepTrain(t2, 0.05); assert.equal(t2.x, -110); let prev = Infinity; while (t2.state === 'arriving') { P.stepTrain(t2, 0.05); assert.ok(t2.x <= 0 + 1e-9, 'never overshoots the platform'); } assert.equal(t2.x, 0); assert.equal(t2.v, 0); assert.equal(t2.state, 'parked');
});
t('birds circle their centre at their radius, and the model code never touches the network, storage or eval', () => {
  const q = P.circle(100, 50, 20, 0.5, 0, 0); assert.ok(Math.abs(q.x - 120) < 1e-9 && Math.abs(q.z - 50) < 1e-9);
  const q2 = P.circle(100, 50, 20, 0.5, Math.PI, 0); assert.ok(Math.abs(Math.hypot(q2.x - 100, q2.z - 50) - 20) < 1e-9);
  const file = fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'explore_life.js'), 'utf8'); for (const bad of ['eval(', 'new Function', 'fetch(', 'XMLHttpRequest', 'localStorage', 'innerHTML']) assert.ok(!file.includes(bad), 'life.js contains ' + bad);
});
console.log('\n' + n + ' tests passed');
