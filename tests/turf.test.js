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
console.log('\n' + n + ' tests passed');
