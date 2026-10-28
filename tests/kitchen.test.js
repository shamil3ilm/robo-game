// Run: node tests/kitchen.test.js  (tests src/js/kitchen.js with stubbed window and localStorage)
const fs = require('fs'), assert = require('assert');
const src = fs.readFileSync(require('path').join(__dirname, '..', 'src', 'js', 'kitchen.js'), 'utf8');
function fresh(seed, wallet) {
  const store = new Map(); if (seed) store.set('runaway.kitchen', JSON.stringify(seed));
  let w = wallet == null ? 0 : wallet;
  const win = { RoboProgress: { spend: (n) => (n > 0 && w >= n ? ((w -= n), true) : false) } };
  new Function('window', 'localStorage', src)(win, { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v) });
  return { K: win.RoboKitchen, store, wallet: () => w };
}
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok  ' + name); };

t('collect + endRun adds to backpack', () => { const { K } = fresh(); K.beginRun(); K.collect('coconut'); K.collect('coconut'); K.collect('rice'); const r = K.endRun(); assert.equal(r.added.length, 2); assert.equal(r.lost.length, 0); const s = K.snapshot(); assert.equal(s.used, 2); assert.equal(s.ingredients.find((i) => i.id === 'coconut').n, 2); });
t('unknown ingredient ignored', () => { const { K } = fresh(); K.beginRun(); assert.equal(K.collect('nope'), 0); assert.equal(K.endRun().has, false); });
t('stack cap 9 loses overflow', () => { const { K } = fresh({ items: { coconut: 8 } }); K.beginRun(); K.collect('coconut'); K.collect('coconut'); K.collect('coconut'); const r = K.endRun(); assert.equal(r.added[0].n, 1); assert.equal(r.lost[0].n, 2); assert.equal(K.snapshot().ingredients[0].n, 9); });
t('full backpack: new type lost, existing type still stacks', () => {
  const items = { coconut: 1, banana: 1, jaggery: 1, rice: 1, ghee: 1, spice: 1, tea: 1 }; // 7 of 8, then fill the 8th with a dish
  const { K } = fresh({ items, dishes: { halwa: 1 } }); assert.equal(K.snapshot().used, 8);
  K.beginRun(); K.collect('coconut'); const r = K.endRun(); assert.equal(r.added.length, 1);
  const { K: K2 } = fresh({ cap: 8, items: { coconut: 1, banana: 1, jaggery: 1, rice: 1, ghee: 1, spice: 1 }, dishes: { halwa: 1, biryani: 1 } }); assert.equal(K2.snapshot().used, 8);
  K2.beginRun(); K2.collect('tea'); const r2 = K2.endRun(); assert.equal(r2.added.length, 0); assert.equal(r2.lost[0].n, 1);
});
t('cook consumes ingredients, gives a serving, unlocks umbrella once', () => {
  const { K } = fresh({ items: { tea: 2, spice: 2, jaggery: 2 } });
  const a = K.cook('sulaimani'); assert.ok(a.ok); assert.ok(/umbrella/.test(a.msg));
  const b = K.cook('sulaimani'); assert.ok(b.ok); assert.ok(!/umbrella/.test(b.msg));
  const s = K.snapshot(); assert.equal(s.meals[0].n, 2); assert.equal(s.ingredients.length, 0); assert.ok(K.hasUmbrella());
});
t('Wayanad dishes cook from the new ingredients and carry their buff kinds', () => {
  const { K } = fresh({ items: { coffee: 2, cardamom: 2, jaggery: 1, rice: 2, ghee: 1, pepper: 2 } });
  assert.ok(K.cook('wcoffee').ok); assert.ok(K.cook('pepperrice').ok);
  K.pack('wcoffee'); assert.equal(K.takeMeal().buff.type, 'forage');
  K.pack('pepperrice'); const m = K.takeMeal(); assert.equal(m.buff.type, 'sprint'); assert.equal(m.buff.secs, 30); assert.ok(m.desc.length > 0);
  assert.equal(K.snapshot().ingredients.length, 1); // only the spare cardamom is left
});
t('every dish needs only ingredients that exist, and has a known buff kind', () => {
  const { K } = fresh(); const ids = new Set(K.INGREDIENTS.map((i) => i.id)); const kinds = new Set(['magnet', 'mult', 'shield', 'weapon', 'forage', 'sprint']);
  K.DISHES.forEach((d) => { Object.keys(d.need).forEach((k) => assert.ok(ids.has(k), d.id + ' needs unknown ' + k)); assert.ok(kinds.has(d.buff.type), d.id + ' has unknown buff ' + d.buff.type); });
});
t('Chef unlocks after the third dish is cooked, not before', () => {
  const { K } = fresh({ items: { tea: 3, spice: 3, jaggery: 3 } });
  assert.deepEqual(K.unlocks(), []); K.cook('sulaimani'); K.cook('sulaimani'); assert.deepEqual(K.unlocks(), []);
  K.cook('sulaimani'); assert.deepEqual(K.unlocks(), ['chef']);
});
t('Forest guide unlocks at 25 ingredients found, counting what did not fit', () => {
  const { K } = fresh({ items: { coconut: 9 } });
  K.beginRun(); for (let i = 0; i < 24; i++) K.collect('coconut'); K.endRun(); assert.deepEqual(K.unlocks(), []);   // 24 found, most of them lost to the full stack
  K.beginRun(); K.collect('rice'); K.endRun(); assert.deepEqual(K.unlocks(), ['guide']);
});
t('found count survives a reload', () => {
  const { K, store } = fresh(); K.beginRun(); for (let i = 0; i < 25; i++) K.collect('rice'); K.endRun();
  const win = { RoboProgress: { spend: () => false } }; new Function('window', 'localStorage', src)(win, { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v) });
  assert.deepEqual(win.RoboKitchen.unlocks(), ['guide']);
});
t('cook fails without ingredients and for unknown recipe', () => { const { K } = fresh({ items: { tea: 1 } }); assert.equal(K.cook('sulaimani').ok, false); assert.equal(K.cook('x').ok, false); assert.equal(K.snapshot().ingredients[0].n, 1); });
t('cook refuses a 4th serving', () => { const { K } = fresh({ items: { tea: 1, spice: 1, jaggery: 1 }, dishes: { sulaimani: 3 } }); const r = K.cook('sulaimani'); assert.equal(r.ok, false); assert.equal(K.snapshot().ingredients.length, 3); });
t('cook succeeds when cooking frees a slot for the new dish', () => {
  const { K } = fresh({ cap: 8, items: { coconut: 1, banana: 1, jaggery: 3, rice: 1, ghee: 1, spice: 1, tea: 1 }, dishes: { biryani: 1 } }); // 7 + 1 = 8 used
  assert.ok(K.cook('halwa').ok); // uses up ghee and rice, freeing two slots
});
t('cook refuses when no slot is free for the new dish, and keeps the ingredients', () => {
  const { K } = fresh({ cap: 8, items: { coconut: 1, banana: 1, jaggery: 3, rice: 2, ghee: 2, spice: 1, tea: 1 }, dishes: { biryani: 1 } }); // 8 used, halwa leaves every stack non-empty
  const r = K.cook('halwa'); assert.equal(r.ok, false); assert.ok(/full/i.test(r.msg));
  const s = K.snapshot(); assert.equal(s.ingredients.find((i) => i.id === 'ghee').n, 2); assert.equal(s.meals.length, 1);
});
t('pack toggles and takeMeal consumes one serving', () => {
  const { K } = fresh({ dishes: { halwa: 2 } }); K.pack('halwa'); assert.equal(K.snapshot().meal, 'halwa'); K.pack('halwa'); assert.equal(K.snapshot().meal, null); K.pack('halwa');
  const m = K.takeMeal(); assert.equal(m.buff.type, 'mult'); assert.equal(K.snapshot().meals[0].n, 1); assert.equal(K.snapshot().meal, 'halwa');
  K.takeMeal(); assert.equal(K.snapshot().meals.length, 0); assert.equal(K.takeMeal(), null);
});
t('pack ignores a dish you do not have', () => { const { K } = fresh(); K.pack('halwa'); assert.equal(K.snapshot().meal, null); assert.equal(K.takeMeal(), null); });
t('upgrade costs scale, spends wallet, caps at 24', () => {
  const { K, wallet } = fresh(null, 1000); assert.equal(K.snapshot().upgrade.cost, 100); assert.ok(K.upgrade().ok); assert.equal(K.snapshot().cap, 12); assert.equal(wallet(), 900);
  assert.equal(K.snapshot().upgrade.cost, 200); K.upgrade(); K.upgrade(); K.upgrade(); K.upgrade(); assert.equal(K.snapshot().cap, 24); assert.equal(K.snapshot().upgrade, null); assert.equal(K.upgrade().ok, false);
});
t('upgrade refused when wallet short', () => { const { K, wallet } = fresh(null, 50); const r = K.upgrade(); assert.equal(r.ok, false); assert.equal(wallet(), 50); assert.equal(K.snapshot().cap, 8); });
t('corrupt save falls back to a clean state', () => { const store = new Map([['runaway.kitchen', '{bad json']]); const win = { RoboProgress: { spend: () => false } }; new Function('window', 'localStorage', src)(win, { getItem: (k) => store.get(k) || null, setItem() {} }); assert.equal(win.RoboKitchen.snapshot().cap, 8); });
t('hostile save values are clamped', () => { const { K } = fresh({ cap: 9999, items: null, dishes: 'x' }); assert.equal(K.snapshot().cap, 24); assert.equal(K.snapshot().used, 0); });
t('have counts the backpack and what was picked up this visit; take removes from this visit first, then the backpack', () => {
  const { K, store } = fresh({ items: { rice: 2 } }); K.beginRun(); K.collect('rice'); K.collect('coconut');
  assert.equal(K.have('rice'), 3); assert.equal(K.have('coconut'), 1); assert.equal(K.have('ghee'), 0); assert.equal(K.have('nope'), 0);
  assert.ok(K.take('rice', 2)); assert.equal(K.have('rice'), 1); assert.equal(JSON.parse(store.get('runaway.kitchen')).items.rice, 1, 'one from the visit, one from the backpack, and the backpack is saved');
  assert.ok(K.take('coconut', 1)); assert.equal(K.have('coconut'), 0); const r = K.endRun(); assert.ok(!r.added.some((a) => a.id === 'coconut'), 'a bartered coconut is not added later');
});
t('take refuses when there is not enough and then takes nothing; bad counts are refused', () => {
  const { K } = fresh({ items: { rice: 2 } }); assert.equal(K.take('rice', 3), false); assert.equal(K.have('rice'), 2); assert.equal(K.take('rice', 0), false); assert.equal(K.take('rice', -1), false); assert.equal(K.take('nope', 1), false);
  assert.ok(K.take('rice', 2)); assert.equal(K.snapshot().ingredients.length, 0, 'an empty stack frees its slot');
});
console.log('\n' + n + ' tests passed');
