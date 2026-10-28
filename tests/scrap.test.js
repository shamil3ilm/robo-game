// Run: node tests/scrap.test.js  (the scrap bag in src/js/scrap.js and the shoes in src/js/gear.js, with a stubbed localStorage)
const fs = require('fs'), path = require('path'), assert = require('assert');
const load = (file, name, seed, key) => {
  const store = new Map(); if (seed !== undefined) store.set(key, typeof seed === 'string' ? seed : JSON.stringify(seed));
  const win = {}; new Function('window', 'localStorage', fs.readFileSync(path.join(__dirname, '..', 'src', 'js', file), 'utf8'))(win, { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v) });
  return { M: win[name], store };
};
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok  ' + name); };

t('scrap is picked up one piece at a time and counted by kind', () => { const { M } = load('scrap.js', 'RoboScrap', undefined, 'runaway.scrap'); assert.ok(M.add('paper')); assert.ok(M.add('paper')); assert.ok(M.add('can')); assert.equal(M.have('paper'), 2); assert.equal(M.have('can'), 1); assert.equal(M.have('glass'), 0); assert.equal(M.total(), 3); });
t('an unknown kind is refused, and the bag holds 30 pieces then says no', () => { const { M } = load('scrap.js', 'RoboScrap', undefined, 'runaway.scrap'); assert.equal(M.add('gold'), false); for (let i = 0; i < 30; i++) assert.ok(M.add('plastic'), 'piece ' + i); assert.equal(M.add('paper'), false); assert.equal(M.total(), 30); });
t('selling takes pieces out, never more than you hold', () => { const { M } = load('scrap.js', 'RoboScrap', { paper: 3 }, 'runaway.scrap'); assert.equal(M.take('paper', 4), false); assert.equal(M.have('paper'), 3); assert.ok(M.take('paper', 2)); assert.equal(M.have('paper'), 1); assert.equal(M.take('paper', 0), false); assert.equal(M.take('paper', -1), false); });
t('every kind has a weight, a posted rate per kg and a payout that is that weight times that rate, at least one rupee', () => { const { M } = load('scrap.js', 'RoboScrap', undefined, 'runaway.scrap'); for (const id of Object.keys(M.TYPES)) { const x = M.TYPES[id]; assert.ok(x.kg > 0 && x.rate > 0 && x.name && x.emoji, id); assert.equal(M.pay(id), Math.max(1, Math.round(x.kg * x.rate)), id); } assert.ok(M.pay('iron') > M.pay('paper') && M.pay('paper') > M.pay('glass'), 'metal pays most, glass least'); });
t('the bag is remembered, and a corrupt or hostile save is cleaned', () => { const a = load('scrap.js', 'RoboScrap', undefined, 'runaway.scrap'); a.M.add('can'); const again = load('scrap.js', 'RoboScrap', JSON.parse(a.store.get('runaway.scrap')), 'runaway.scrap'); assert.equal(again.M.have('can'), 1); assert.equal(load('scrap.js', 'RoboScrap', '{bad', 'runaway.scrap').M.total(), 0); const h = load('scrap.js', 'RoboScrap', { paper: 1e9, ghost: 5, can: -3 }, 'runaway.scrap').M; assert.ok(h.total() <= 30); assert.equal(h.have('can'), 0); assert.equal(h.have('ghost'), 0); });
t('shoes: none, then chappals, then sports shoes; the best owned pair is worn', () => {
  const { M } = load('gear.js', 'RoboGear', undefined, 'runaway.gear'); assert.equal(M.walkMul(), 1); assert.equal(M.runBoost(), 0); assert.equal(M.has('chappal'), false);
  assert.ok(M.equip('chappal')); assert.equal(M.has('chappal'), true); assert.equal(M.walkMul(), 1.08); assert.equal(M.runBoost(), 0);
  assert.ok(M.equip('sports')); assert.equal(M.walkMul(), 1.15); assert.equal(M.runBoost(), 12); assert.equal(M.best(), 'sports');
  assert.equal(M.equip('wings'), false);
});
t('shoes are remembered and a bad save means barefoot, not a crash', () => { const a = load('gear.js', 'RoboGear', undefined, 'runaway.gear'); a.M.equip('sports'); const again = load('gear.js', 'RoboGear', JSON.parse(a.store.get('runaway.gear')), 'runaway.gear'); assert.equal(again.M.walkMul(), 1.15); assert.equal(load('gear.js', 'RoboGear', '{bad', 'runaway.gear').M.walkMul(), 1); assert.equal(load('gear.js', 'RoboGear', { owned: { wings: true } }, 'runaway.gear').M.walkMul(), 1); });
console.log('\n' + n + ' tests passed');
