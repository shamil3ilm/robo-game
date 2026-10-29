// Run: node tests/turf.test.js  (the football turf game in src/js/turf.js: kicking, rolling, bouncing, goals; the drawing is in explore_manjeri.js)
const fs = require('fs'), path = require('path'), assert = require('assert');
const win = {}; new Function('window', fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'turf.js'), 'utf8'))(win);
const T = win.RoboTurf;
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok  ' + name); };
const R = T.rect(0, 0, 26, 28), ball = (o) => Object.assign({ x: 0, z: 0, vx: 0, vz: 0, hop: 0, last: -9 }, o);

t('walking into the ball sends it the way you walk, a little faster than you', () => {
  const k = T.kick(ball({ x: 0.5, z: 0 }), { x: 0, z: 0, vx: 3, vz: 0 }, 1);
  assert.ok(k.vx > 3 && Math.abs(k.vz) < 1e-9, 'runs ahead of the player: ' + k.vx);
  assert.ok(k.hop > 0, 'a small hop');
});

t('a ball out of reach is not touched, and nothing is kicked twice in a quarter of a second', () => {
  const far = ball({ x: 3, z: 0 }); assert.equal(T.kick(far, { x: 0, z: 0, vx: 3, vz: 0 }, 1), far);
  const k = T.kick(ball({ x: 0.5 }), { x: 0, z: 0, vx: 3, vz: 0 }, 1), again = T.kick(k, { x: 0, z: 0, vx: 3, vz: 0 }, 1.1);
  assert.equal(again, k); assert.notEqual(T.kick(k, { x: 0, z: 0, vx: 3, vz: 0 }, 1.3), k);
});

t('standing next to the ball only nudges it away from you', () => {
  const k = T.kick(ball({ x: 0, z: 0.5 }), { x: 0, z: 0, vx: 0, vz: 0 }, 1);
  assert.ok(k.vz > 0 && k.vz < 3 && Math.abs(k.vx) < 1e-9);
});

t('the ball rolls on and slows: most of its speed is gone in a second', () => {
  let b = ball({ vx: 10 }); for (let i = 0; i < 10; i++) b = T.step(b, 0.1, R);
  assert.ok(b.vx > 1 && b.vx < 3, 'speed after 1 s: ' + b.vx); assert.ok(b.x > 3 && b.x < 6, 'distance: ' + b.x);
});

t('the fence keeps the ball in: it bounces back, softer', () => {
  let b = ball({ x: 12, vx: 8 }); for (let i = 0; i < 20; i++) b = T.step(b, 0.1, R);
  assert.ok(b.x <= 13 - 0.3 + 1e-9, 'inside the fence: ' + b.x); assert.ok(b.vx < 0 || b.x < 12.7, 'turned back');
  let c = ball({ z: -13, vz: -9 }); c = T.step(c, 0.2, R); assert.ok(c.z >= -13.7 && c.vz > 0, 'bounced off the north fence');
});

t('a ball over the goal line between the posts is a goal, outside the posts or short of the line it is not', () => {
  assert.equal(T.goal(ball({ x: 1, z: -12.8 }), R), 'north'); assert.equal(T.goal(ball({ x: -2.9, z: 12.8 }), R), 'south');
  assert.equal(T.goal(ball({ x: 3.5, z: -12.8 }), R), null, 'wide of the post'); assert.equal(T.goal(ball({ x: 0, z: -12 }), R), null, 'short of the line'); assert.equal(T.goal(ball(), R), null, 'the centre circle');
});

t('a dribble and a shot score: walk the ball up the pitch, then a hard kick at the north goal', () => {
  let b = ball({ z: 6 }), p = { x: 0, z: 7, vx: 0, vz: -4 }, now = 0, scored = null;
  for (let i = 0; i < 200 && !scored; i++) { now += 0.05; p = { x: 0, z: p.z + p.vz * 0.05, vx: 0, vz: -4 }; b = T.kick(b, p, now); b = T.step(b, 0.05, R); scored = T.goal(b, R); }
  assert.equal(scored, 'north', 'ball ended at z ' + b.z.toFixed(1));
});

t('it never produces NaN, whatever the touches', () => {
  let b = ball(); for (let i = 0; i < 500; i++) { b = T.kick(b, { x: b.x + (i % 3 - 1) * 0.5, z: b.z, vx: (i % 7) - 3, vz: (i % 5) - 2 }, i * 0.1); b = T.step(b, 0.016, R); assert.ok([b.x, b.z, b.vx, b.vz, b.hop].every(Number.isFinite)); }
});
const team = () => [{ x: -6, z: -5, team: 'home', hx: -6, hz: -5 }, { x: 6, z: 5, team: 'home', hx: 6, hz: 5 }, { x: -5, z: 6, team: 'away', hx: -5, hz: 6 }, { x: 5, z: -6, team: 'away', hx: 5, hz: -6 }];

t('your shot goes the way you face, hard, only when the ball is at your feet', () => {
  const s = T.shoot(ball({ x: 0, z: -0.6 }), { x: 0, z: 0 }, 0, -1, 2);
  assert.ok(s.vz < -9 && Math.abs(s.vx) < 1e-9, 'north at 11 m/s: ' + s.vz); const far = ball({ x: 0, z: -4 }); assert.equal(T.shoot(far, { x: 0, z: 0 }, 0, -1, 2), far);
});

t('the nearest player of a team runs at the ball, the others hold their places', () => {
  const list = team(), b = ball({ x: 6, z: 4 }), r = T.ai(list, b, R, 0.5, 1, null);
  const away = r.players[2], before = list[2]; assert.ok(Math.hypot(away.x - 6, away.z - 4) < Math.hypot(before.x - 6, before.z - 4), 'the nearer away player closes in');
  assert.ok(away.moving, 'and walks while doing it');
});

t('a home player stays back when you are closer to the ball than any of them', () => {
  const b = ball({ x: 0, z: 0 }), list = team(), me = { x: 0.5, z: 0 }, r = T.ai(list, b, R, 0.5, 1, me), h = r.players[0];
  assert.ok(Math.hypot(h.x - list[0].x, h.z - list[0].z) <= 3.0 * 0.7 * 0.5 + 1e-9, 'home players move at hold speed only');
});

t('a player at the ball pushes it towards the goal he attacks, and not twice in 0.45 s', () => {
  const list = [{ x: 0, z: 1, team: 'away', hx: 0, hz: 1 }], r = T.ai(list, ball({ x: 0, z: 0.4 }), R, 0.016, 1, null);
  assert.ok(r.ball.vz > 0, 'away attacks south (z up): ' + r.ball.vz);
  const r2 = T.ai(r.players, r.ball, R, 0.016, 1.2, null); assert.equal(r2.ball, r.ball);
  const h = T.ai([{ x: 0, z: -1, team: 'home', hx: 0, hz: -1 }], ball({ x: 0, z: -0.4 }), R, 0.016, 1, null); assert.ok(h.ball.vz < 0, 'home attacks north');
});

t('two teams left alone for a few minutes keep the ball on the pitch, never produce NaN, and score now and then', () => {
  let b = ball(), list = team(), now = 0, goals = 0;
  for (let i = 0; i < 6000; i++) { now += 0.05; const r = T.ai(list, b, R, 0.05, now, null); list = r.players; b = T.step(r.ball, 0.05, R); if (T.goal(b, R)) { goals++; b = ball({ last: now }); }
    assert.ok([b.x, b.z].every(Number.isFinite) && list.every((p) => Number.isFinite(p.x) && Number.isFinite(p.z))); assert.ok(Math.abs(b.x) <= 13 && Math.abs(b.z) <= 14); }
  assert.ok(goals >= 1, 'goals in 5 minutes: ' + goals);
});
console.log('\n' + n + ' tests passed');
