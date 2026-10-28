// Run: node tests/battery.test.js  (the battery in src/js/battery.js, with a stubbed localStorage)
const fs = require('fs'), path = require('path'), assert = require('assert');
const load = (seed) => {
  const store = new Map(); if (seed !== undefined) store.set('runaway.battery', typeof seed === 'string' ? seed : JSON.stringify(seed));
  const win = {}; new Function('window', 'localStorage', fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'battery.js'), 'utf8'))(win, { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v) });
  return { B: win.RoboBattery, store };
};
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok  ' + name); };

t('a new robot has a full battery', () => { const { B } = load(); assert.equal(B.pct(), 100); assert.equal(B.room(), 0); });
t('walking uses 1% for every 15 m, running half as much again', () => {
  const { B } = load(); B.drain(150, false); assert.equal(B.pct(), 90); B.drain(100, true); assert.equal(B.pct(), 80);   // 100 m running is 10% (100 * 1.5 / 15)
  B.drain(0, false); B.drain(-5, false); assert.equal(B.pct(), 80, 'no distance, no use');
});
t('draining reports the warning level just crossed, once, and never goes below zero', () => {
  const { B } = load({ level: 21 }); assert.equal(B.drain(15, false), 20); assert.equal(B.drain(3, false), null);
  assert.equal(B.drain(15 * 10, false), 10); assert.equal(B.drain(15 * 20, false), 0); assert.equal(B.pct(), 0); assert.equal(B.drain(100, false), null); assert.equal(B.pct(), 0);
});
t('you slow down below 20% and crawl at 60% speed when empty', () => {
  assert.equal(load({ level: 100 }).B.speedMul(), 1); assert.equal(load({ level: 20 }).B.speedMul(), 1);
  assert.ok(Math.abs(load({ level: 10 }).B.speedMul() - 0.8) < 1e-9); assert.ok(Math.abs(load({ level: 0 }).B.speedMul() - 0.6) < 1e-9);
});
t('a nearly full battery gives a short sprint at the start of a run', () => { assert.equal(load({ level: 100 }).B.runBoost(), 5); assert.equal(load({ level: 90 }).B.runBoost(), 5); assert.equal(load({ level: 89 }).B.runBoost(), 0); });
t('charging adds percent but never past 100, and says how much it added', () => {
  const { B } = load({ level: 35 }); assert.equal(B.charge(30), 30); assert.equal(B.pct(), 65); assert.equal(B.room(), 35); assert.equal(B.charge(80), 35); assert.equal(B.pct(), 100); assert.equal(B.charge(10), 0);
  assert.equal(B.charge(-5), 0); assert.equal(B.charge('x'), 0);
});
t('a block costs the tariff rate for 0.3 unit, rounded up to the rupee, and takes the time of its kind', () => {
  const { B } = load(); const day = { ac: 8.5, dc: 16.5 }, night = { ac: 14.23, dc: 23.23 };
  assert.deepEqual(B.blockCost('ac', day), { price: 3, rate: 8.5, units: 0.3, minutes: 40 }); assert.deepEqual(B.blockCost('dc', day), { price: 5, rate: 16.5, units: 0.3, minutes: 10 });
  assert.equal(B.blockCost('ac', night).price, 5); assert.equal(B.blockCost('dc', night).price, 7); assert.equal(B.blockCost('petrol', day), null); assert.equal(B.blockCost('ac', {}), null);
});
t('fast charging costs more than slow at every hour, and a full charge from empty is ten blocks', () => {
  const { B } = load(); for (const tf of [{ ac: 8.5, dc: 16.5 }, { ac: 14.23, dc: 23.23 }]) assert.ok(B.blockCost('dc', tf).price > B.blockCost('ac', tf).price);
  assert.equal(10 * B.BLOCK, 100);
});
t('the level is remembered, and a corrupt or hostile save means a full battery or a clamped level', () => {
  const a = load(); a.B.drain(300, false); const saved = a.store.get('runaway.battery'); assert.equal(load(saved).B.pct(), 80);
  assert.equal(load('not json').B.pct(), 100); assert.equal(load({ level: 'lots' }).B.pct(), 100); assert.equal(load({ level: 9999 }).B.pct(), 100); assert.equal(load({ level: -5 }).B.pct(), 0);
});
console.log('\n' + n + ' tests passed');
