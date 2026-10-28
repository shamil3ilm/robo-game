// Run: node tests/weather.test.js  (the rain rules in src/js/weather.js)
const fs = require('fs'), path = require('path'), assert = require('assert');
const win = {}; new Function('window', fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'weather.js'), 'utf8'))(win); const W = win.RoboWeather;
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok  ' + name); };
const fixed = (v) => () => v;   // a "random" that always returns v, so the schedule is exact

t('it starts dry, and the first shower comes after the first dry spell', () => {
  const w = W.create({ rand: fixed(0) }); assert.equal(w.raining(), false); assert.equal(w.intensity(), 0);
  let ev = null, secs = 0; while (!ev && secs < 1000) { ev = w.tick(1); secs++; } assert.equal(ev, 'start'); assert.equal(secs, 120, 'a first dry spell of 120 s with the lowest roll'); assert.equal(w.raining(), true);
});
t('the rain fades in over about 8 seconds and out again after the shower', () => {
  const w = W.create({ rand: fixed(0) }); w.set(true); for (let i = 0; i < 4; i++) w.tick(1); assert.ok(Math.abs(w.intensity() - 0.5) < 1e-9); for (let i = 0; i < 4; i++) w.tick(1); assert.equal(w.intensity(), 1);
  w.set(false); for (let i = 0; i < 4; i++) w.tick(1); assert.ok(Math.abs(w.intensity() - 0.5) < 1e-9); for (let i = 0; i < 10; i++) w.tick(1); assert.equal(w.intensity(), 0);
});
t('a shower ends by itself, and dry and wet spells stay inside their ranges whatever the dice say', () => {
  for (const r of [0, 0.5, 0.999]) {
    const w = W.create({ rand: fixed(r) }); const spells = []; let last = null, len = 0;
    for (let s = 0; s < 6000; s++) { const ev = w.tick(1); len++; if (ev) { spells.push([ev, len]); len = 0; } }
    assert.ok(spells.length >= 4, 'it keeps cycling at ' + r); const wets = spells.filter((x) => x[0] === 'stop').map((x) => x[1]), dries = spells.filter((x) => x[0] === 'start').slice(1).map((x) => x[1]);
    wets.forEach((x) => assert.ok(x >= 90 && x <= 211, 'a shower of ' + x + ' s')); dries.forEach((x) => assert.ok(x >= 240 && x <= 541, 'a dry spell of ' + x + ' s'));
  }
});
t('the tick reports start and stop exactly once each time', () => { const w = W.create({ rand: fixed(0.3) }); const evs = []; for (let s = 0; s < 3000; s++) { const e = w.tick(1); if (e) evs.push(e); } assert.deepEqual(evs.slice(0, 4), ['start', 'stop', 'start', 'stop']); });
t('rain cools the town by up to 3 degrees and slows you by 8% unless you own an umbrella', () => {
  assert.equal(W.tempDrop(0), 0); assert.equal(W.tempDrop(1), 3); assert.equal(W.tempDrop(0.5), 2); assert.equal(W.tempDrop(5), 3); assert.equal(W.tempDrop(-1), 0);
  assert.equal(W.walkMul(0, false), 1); assert.ok(Math.abs(W.walkMul(1, false) - 0.92) < 1e-9); assert.equal(W.walkMul(1, true), 1); assert.ok(W.walkMul(0.5, false) > W.walkMul(1, false));
});
t('forcing it on or off works, and a huge time step cannot break the intensity', () => { const w = W.create({ rand: fixed(0) }); w.set(true); w.tick(5000); assert.ok(w.intensity() >= 0 && w.intensity() <= 1); w.set(false); w.tick(3); w.tick(9999); assert.ok(w.intensity() >= 0 && w.intensity() <= 1); });
console.log('\n' + n + ' tests passed');
