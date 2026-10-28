// Run: node tests/water.test.js  (the rules of the water in src/js/explore_water.js: how wet the town is, where puddles may go, how a ring grows; the drawing is checked in the browser)
const fs = require('fs'), path = require('path'), assert = require('assert');
const win = {}; new Function('window', fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'explore_water.js'), 'utf8'))(win);
const W = win.RoboExploreWater.pure;
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok  ' + name); };
const seeded = (s) => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };

t('the town soaks in about ten seconds of steady rain, and dries over about two minutes once it stops', () => {
  let w = 0; for (let i = 0; i < 100; i++) w = W.wetStep(w, 1, 0.1); assert.ok(Math.abs(w - 1) < 1e-9, 'wet after 10 s: ' + w);
  let d = 1; for (let i = 0; i < 1200; i++) d = W.wetStep(d, 0, 0.1); assert.equal(d, 0); let h = 1; for (let i = 0; i < 600; i++) h = W.wetStep(h, 0, 0.1); assert.ok(h > 0.45 && h < 0.55, 'half dry after a minute: ' + h);
  assert.ok(W.wetStep(0, 0.05, 1) > 0, 'a light drizzle still wets');
});
t('puddles go inside the road rectangles, never where something blocks them, and never touch each other', () => {
  const rects = [[-3, 3, 0, 100]], blocked = (x, z, r) => x > 1 && z > 40 && z < 60, ps = W.placePuddles(rects, 20, seeded(5), blocked);
  assert.ok(ps.length >= 15, 'enough puddles: ' + ps.length);
  for (const p of ps) { assert.ok(p.x - p.r >= -3 - 1e-9 && p.x + p.r <= 3 + 1e-9 && p.z >= 0 && p.z <= 100, 'inside the road'); assert.ok(!blocked(p.x, p.z, p.r)); assert.ok(p.r >= 0.7 && p.r <= 1.8); }
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) assert.ok(Math.hypot(ps[i].x - ps[j].x, ps[i].z - ps[j].z) > ps[i].r + ps[j].r, 'no overlap');
  assert.equal(W.placePuddles(rects, 5, seeded(1), () => true).length, 0, 'nothing fits when everything is blocked');
});
t('standing in a puddle is found, with a margin round its edge', () => {
  const ps = [{ x: 10, z: 10, r: 1 }]; assert.equal(W.inPuddle(ps, 10.5, 10, 0), ps[0]); assert.equal(W.inPuddle(ps, 11.3, 10, 0), null); assert.equal(W.inPuddle(ps, 11.3, 10, 0.4), ps[0]);
});
t('a ring grows from a tenth to full size and fades out; a drop from an awning 2.95 m up lands in under 0.8 s', () => {
  assert.equal(W.ring(0).scale, 0.1); assert.equal(W.ring(1).scale, 1); assert.equal(W.ring(1).fade, 0); assert.ok(W.ring(0).fade === 1 && W.ring(0.5).fade < W.ring(0.25).fade);
  assert.ok(W.fallTime(2.95) > 0.7 && W.fallTime(2.95) < 0.8, '' + W.fallTime(2.95)); assert.equal(W.fallTime(0), 0);
});
t('wet roads: dry is unchanged, soaked is darker and glossier, and in between is in between', () => {
  const dry = W.wetLook(0, 0.95), soaked = W.wetLook(1, 0.95), half = W.wetLook(0.5, 0.95);
  assert.equal(dry.bright, 1); assert.equal(dry.rough, 0.95); assert.ok(soaked.bright < 0.65 && soaked.rough < 0.7 && soaked.rough > 0.4); assert.ok(half.bright < dry.bright && half.bright > soaked.bright && half.rough < dry.rough && half.rough > soaked.rough);
  assert.equal(W.wetLook(7, 0.95).bright, soaked.bright, 'wetness is held between 0 and 1');
});
console.log(n + ' tests passed');
