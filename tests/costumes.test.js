// Run: node tests/costumes.test.js  (the costume list in src/js/progress.js against the Textiles shop in src/js/shop.js)
const fs = require('fs'), path = require('path'), assert = require('assert');
const load = (file, win, ls) => new Function('window', 'localStorage', fs.readFileSync(path.join(__dirname, '..', 'src', 'js', file), 'utf8'))(win, ls || { getItem: () => null, setItem() {} });
const win = {}; load('progress.js', win); load('shop.js', win); const SKINS = win.RoboProgress.SKINS, clothes = win.RoboShop.SHOPS.clothes;
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok  ' + name); };

t('every costume the Textiles shop sells is a human skin in the character list, and is cheaper in the shop than on the Characters screen', () => {
  assert.equal(clothes.items.length, 6);
  for (const it of clothes.items) { const sk = SKINS.find((s) => s.id === it.fx.id); assert.ok(sk && sk.human, it.id + ' needs a human skin'); assert.ok(it.price > 0 && it.price < sk.price, it.id + ' shop price ' + it.price + ' vs ' + sk.price); }
});
t('skin ids are unique, and every human skin has the fields the body builder reads', () => {
  const ids = SKINS.map((s) => s.id); assert.equal(new Set(ids).size, ids.length);
  for (const s of SKINS.filter((x) => x.human)) {
    const h = s.human; for (const k of ['skin', 'hair', 'top', 'bottomColor']) assert.ok(Number.isInteger(h[k]), s.id + '.' + k);
    assert.ok(['short', 'long'].includes(h.sleeve), s.id + ' sleeve'); assert.ok(['trousers', 'mundu', 'shorts'].includes(h.bottom), s.id + ' bottom'); assert.ok(['none', 'cap', 'hat', 'chef', 'band'].includes(h.head), s.id + ' head'); assert.ok(['slim', 'regular', 'sturdy'].includes(h.build), s.id + ' build');
    if (h.bottom === 'mundu') assert.ok(Number.isInteger(h.trim), s.id + ' a mundu has a border colour');
  }
});
t('the three town clothes are there: mundu and shirt, the khaki of the auto drivers, and the Onam kasavu', () => {
  const by = (id) => SKINS.find((s) => s.id === id); assert.equal(by('mundushirt').human.bottom, 'mundu'); assert.equal(by('khaki').human.bottom, 'trousers'); assert.equal(by('kasavu').human.trim, 0xd4a93a);
});
console.log('\n' + n + ' tests passed');
