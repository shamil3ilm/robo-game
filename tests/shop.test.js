// Run: node tests/shop.test.js  (tests src/js/shop.js with stubbed game, kitchen and progress)
const fs = require('fs'), path = require('path'), assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'shop.js'), 'utf8');
const win = {}; ['scrap.js', 'battery.js', 'clock.js', 'explore_rides.js'].forEach((f) => new Function('window', fs.readFileSync(path.join(__dirname, '..', 'src', 'js', f), 'utf8'))(win)); new Function('window', src)(win); const S = win.RoboShop;

function ctx(coins, o) {
  o = o || {}; let c = coins; const applied = [], granted = [];
  const skins = [{ id: 'fisher', name: 'Fisher', owned: !!o.fisher }, { id: 'farmer', name: 'Estate farmer', owned: false }, { id: 'footballer', name: 'Footballer', owned: false }];
  let umbrella = !!o.umbrella;
  return { applied, granted, coins: () => c,
    pool: () => c, spend: (n) => (c >= n ? ((c -= n), true) : false), apply: (fx) => applied.push(fx),
    kitchen: { hasUmbrella: () => umbrella, grantUmbrella: () => (umbrella = true) }, progress: { snapshot: () => ({ skins }), grant: (id) => { granted.push(id); skins.find((s) => s.id === id).owned = true; } }, onUmbrella: () => applied.push({ type: 'umbrella-sync' }) };
}
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok  ' + name); };

t('four shops with real Kerala shop names', () => { ['clothes', 'pharmacy', 'snacks', 'tools'].forEach((k) => assert.ok(S.kinds.includes(k), k)); assert.ok(S.SHOPS.snacks.local.length > 0 && S.SHOPS.pharmacy.local.length > 0); });
t('a snack costs coins and applies its buff', () => { const c = ctx(20); const r = S.buy('snacks', 'chips', c); assert.ok(r.ok); assert.equal(c.coins(), 8); assert.deepEqual(c.applied, [{ type: 'magnet', secs: 15 }]); });
t('cannot buy without enough coins, and nothing is spent or applied', () => { const c = ctx(5); const r = S.buy('snacks', 'chips', c); assert.equal(r.ok, false); assert.ok(/7 more coins/.test(r.msg)); assert.equal(c.coins(), 5); assert.equal(c.applied.length, 0); });
t('medicine heals', () => { const c = ctx(40); assert.ok(S.buy('pharmacy', 'kashayam', c).ok); assert.deepEqual(c.applied, [{ type: 'heal' }]); assert.equal(c.coins(), 10); });
t('tools set run flags', () => { const c = ctx(100); S.buy('tools', 'boots', c); S.buy('tools', 'sickle', c); assert.deepEqual(c.applied.map((f) => f.type), ['boots', 'sickle']); assert.equal(c.coins(), 25); });
t('umbrella is bought once, then sold out', () => {
  const c = ctx(300); assert.ok(S.buy('tools', 'umbrella', c).ok); assert.equal(c.coins(), 180); assert.ok(c.kitchen.hasUmbrella()); assert.ok(c.applied.some((f) => f.type === 'umbrella-sync'));
  const again = S.buy('tools', 'umbrella', c); assert.equal(again.ok, false); assert.equal(c.coins(), 180);
  assert.ok(S.stock('tools', c).items.find((i) => i.id === 'umbrella').soldOut);
});
t('clothes shop sells unowned costumes with names from the character list', () => {
  const c = ctx(400, { fisher: true }); const st = S.stock('clothes', c);
  assert.equal(st.items.find((i) => i.id === 'fisher').soldOut, true); assert.equal(st.items.find((i) => i.id === 'farmer').name, 'Estate farmer');
  assert.ok(S.buy('clothes', 'farmer', c).ok); assert.deepEqual(c.granted, ['farmer']); assert.equal(c.coins(), 150);
  assert.equal(S.buy('clothes', 'fisher', c).ok, false);
});
t('unknown shop or item is refused safely', () => { const c = ctx(100); assert.equal(S.buy('nope', 'x', c).ok, false); assert.equal(S.buy('snacks', 'nope', c).ok, false); assert.equal(S.stock('nope', c), null); assert.equal(c.coins(), 100); });
t('a failed payment applies nothing', () => { const c = ctx(100); c.spend = () => false; assert.equal(S.buy('snacks', 'chips', c).ok, false); assert.equal(c.applied.length, 0); });
t('building counters sell with real names and game prices; ingredients go to the backpack through the game side', () => {
  ['farsa', 'bombay', 'swamy', 'supermarket'].forEach((k) => { assert.ok(S.SHOPS[k], k); assert.ok(S.SHOPS[k].local.length > 0, k); assert.ok(/Game prices/.test(S.SHOPS[k].blurb), k + ' says its prices are the game\'s'); });
  assert.equal(S.SHOPS.farsa.name, 'Hotel Farsa'); assert.equal(S.SHOPS.bombay.name, 'Bombay Hotel'); assert.equal(S.SHOPS.swamy.name, 'Swamy & Sons');
  const c = ctx(100); const got = []; c.ingredient = (id) => got.push(id);
  assert.ok(S.buy('supermarket', 'rice', c).ok); assert.deepEqual(got, ['rice']); assert.equal(c.coins(), 88); assert.deepEqual(c.applied, [], 'an ingredient is not a run effect');
  assert.ok(S.buy('farsa', 'biryani', ctx(100)).ok); const poor = ctx(5); assert.equal(S.buy('swamy', 'beans', poor).ok, false); assert.equal(poor.coins(), 5);
  assert.equal(S.stock('supermarket', ctx(0)).items.length, 9);
});
/* ---- carts, bills, GPay and barter ---- */
function bctx(cash, o) {
  o = o || {}; let c = cash, upi = o.upi || 0, txns = 0; const held = Object.assign({}, o.held || {}), applied = [], got = [], taken = [], skins = o.skins || [];
  return { applied, got, taken, held, cash: () => c, upiBal: () => upi,
    pool: () => c, spend: (k) => (c >= k ? ((c -= k), true) : false), apply: (fx) => applied.push(fx), ingredient: (id) => got.push(id),
    have: (id) => held[id] || 0, take: (id, k) => ((held[id] || 0) >= k ? ((held[id] -= k), taken.push([id, k]), true) : false),
    wallet: { upi: () => upi, pay: (k, to) => (upi >= k ? ((upi -= k), { ok: true, txn: 'UPI' + (100000000000 + ++txns), to }) : { ok: false, msg: 'low' }) },
    kitchen: { hasUmbrella: () => false, grantUmbrella() {} }, progress: { snapshot: () => ({ skins }), grant(id) { skins.find((s) => s.id === id).owned = true; } }, onUmbrella() {} };
}
t('a quote lists the lines, the total and what is due', () => { const q = S.quote('snacks', { chips: 2, pazham: 1 }, {}, bctx(100)); assert.ok(q.ok); assert.equal(q.lines.length, 2); assert.equal(q.subtotal, 42); assert.equal(q.credit, 0); assert.equal(q.due, 42); assert.deepEqual(q.lines.find((l) => l.id === 'chips'), { id: 'chips', name: 'Banana chips', qty: 2, rate: 12, amount: 24 }); });
t('barter credit is 80% of the value of what the shop uses, and the rest is due in whole rupees', () => { const q = S.quote('snacks', { chips: 2, pazham: 1 }, { banana: 3 }, bctx(100, { held: { banana: 5 } })); assert.ok(q.ok); assert.equal(q.creditLines[0].each, 4.8); assert.equal(q.credit, 14.4); assert.equal(q.due, 28); });
t('a shop only takes goods it would use: the tea stall takes banana but not pepper, hardware takes no goods at all', () => {
  assert.equal(S.quote('snacks', { chips: 1 }, { pepper: 1 }, bctx(100, { held: { pepper: 2 } })).ok, false);
  assert.equal(S.quote('tools', { boots: 1 }, { rice: 1 }, bctx(100, { held: { rice: 2 } })).ok, false);
  assert.ok(S.quote('pharmacy', { balm: 1 }, { pepper: 1 }, bctx(100, { held: { pepper: 2 } })).ok);
});
t('the supermarket takes everything, but only at 60%, so buying and selling back never makes money', () => { const q = S.quote('supermarket', { rice: 1 }, { rice: 1 }, bctx(100, { held: { rice: 1 } })); assert.ok(q.ok); assert.equal(q.credit, 7.2); assert.ok(q.credit < 12); assert.equal(q.due, 5); });
t('you cannot offer goods you do not have, nor far more than the bill', () => {
  assert.equal(S.quote('snacks', { chips: 1 }, { banana: 3 }, bctx(100, { held: { banana: 1 } })).ok, false);
  assert.equal(S.quote('snacks', { karikku: 1 }, { jaggery: 5 }, bctx(100, { held: { jaggery: 5 } })).ok, false);
  const near = S.quote('snacks', { karikku: 1 }, { coconut: 2 }, bctx(100, { held: { coconut: 2 } })); assert.ok(near.ok); assert.equal(near.due, 0); assert.ok(near.noChange > 0, 'a little over is allowed, with no change given');
});
t('an empty cart, an unknown item, two of a one-off, or an owned costume are all refused with a reason', () => {
  assert.equal(S.quote('snacks', {}, {}, bctx(10)).ok, false); assert.equal(S.quote('snacks', { nope: 1 }, {}, bctx(10)).ok, false);
  const skins = [{ id: 'fisher', name: 'Fisher', owned: false }, { id: 'farmer', name: 'Estate farmer', owned: true }, { id: 'footballer', name: 'Footballer', owned: false }];
  assert.equal(S.quote('clothes', { fisher: 2 }, {}, bctx(999, { skins })).ok, false); assert.equal(S.quote('clothes', { farmer: 1 }, {}, bctx(999, { skins })).ok, false); assert.ok(S.quote('clothes', { fisher: 1 }, {}, bctx(999, { skins })).ok);
});
t('paying cash takes exactly what is due, applies each unit bought, and writes a numbered bill', () => {
  const c = bctx(100); const r = S.checkout('snacks', { chips: 2, pazham: 1 }, { method: 'cash' }, c);
  assert.ok(r.ok, r.msg); assert.equal(c.cash(), 58); assert.equal(c.applied.length, 3); assert.deepEqual(c.applied.map((f) => f.type).sort(), ['magnet', 'magnet', 'mult']);
  const b = r.receipt; assert.ok(/^CK-\d{4}$/.test(b.no), b.no); assert.equal(b.shop, 'Chaya Kada'); assert.equal(b.subtotal, 42); assert.equal(b.due, 42); assert.equal(b.method, 'cash'); assert.equal(b.lines.length, 2); assert.ok(!isNaN(Date.parse(b.date)));
});
t('paying by GPay leaves the cash alone, records a transaction id, and is refused when the balance is short', () => {
  const c = bctx(100, { upi: 50 }); const r = S.checkout('farsa', { biryani: 1 }, { method: 'upi' }, c); assert.ok(r.ok, r.msg); assert.equal(c.cash(), 100); assert.equal(c.upiBal(), 5); assert.equal(r.receipt.method, 'upi'); assert.ok(/^UPI\d{12}$/.test(r.receipt.txn));
  const poor = bctx(100, { upi: 10 }); const f = S.checkout('farsa', { biryani: 1 }, { method: 'upi' }, poor); assert.equal(f.ok, false); assert.equal(poor.upiBal(), 10); assert.equal(poor.applied.length, 0);
});
t('mixing barter and cash: goods are handed over, the rest paid, and the bill shows both', () => {
  const c = bctx(100, { held: { banana: 2 } }); const r = S.checkout('snacks', { pazham: 1 }, { method: 'cash', offer: { banana: 2 } }, c);
  assert.ok(r.ok, r.msg); assert.deepEqual(c.taken, [['banana', 2]]); assert.equal(c.cash(), 91); assert.equal(r.receipt.method, 'mixed'); assert.equal(r.receipt.credit, 9.6); assert.equal(r.receipt.due, 9); assert.equal(r.receipt.creditLines[0].qty, 2);
});
t('a pure barter pays no cash at all and says so', () => { const c = bctx(0, { held: { coconut: 2 } }); const r = S.checkout('snacks', { karikku: 1 }, { method: 'cash', offer: { coconut: 2 } }, c); assert.ok(r.ok, r.msg); assert.equal(c.cash(), 0); assert.equal(r.receipt.method, 'barter'); assert.equal(r.receipt.due, 0); assert.deepEqual(c.taken, [['coconut', 2]]); });
t('not enough cash: nothing is taken, applied or recorded', () => { const c = bctx(5, { held: { banana: 1 } }); const before = S.bills().length; const r = S.checkout('snacks', { pazham: 2 }, { method: 'cash', offer: { banana: 1 } }, c); assert.equal(r.ok, false); assert.equal(c.cash(), 5); assert.deepEqual(c.taken, []); assert.equal(c.applied.length, 0); assert.equal(S.bills().length, before); });
t('a shop that takes only cash refuses GPay', () => { S.SHOPS.cashonly = { name: 'Cash Stall', local: '', emoji: '', blurb: '', accepts: ['cash'], items: [{ id: 'x', name: 'X', local: '', emoji: '', price: 5, desc: '', fx: { type: 'magnet', secs: 1 } }] }; const c = bctx(50, { upi: 50 }); assert.equal(S.checkout('cashonly', { x: 1 }, { method: 'upi' }, c).ok, false); assert.equal(c.upiBal(), 50); assert.ok(S.checkout('cashonly', { x: 1 }, { method: 'cash' }, c).ok); delete S.SHOPS.cashonly; });
t('ingredients bought go to the backpack once per unit; costumes and the umbrella are granted once', () => {
  const c = bctx(100); assert.ok(S.checkout('supermarket', { rice: 3, ghee: 1 }, { method: 'cash' }, c).ok); assert.deepEqual(c.got.sort(), ['ghee', 'rice', 'rice', 'rice']); assert.equal(c.cash(), 100 - 36 - 25);
  const skins = [{ id: 'fisher', name: 'Fisher', owned: false }, { id: 'farmer', name: 'Estate farmer', owned: false }, { id: 'footballer', name: 'Footballer', owned: false }]; const d = bctx(500, { skins }); assert.ok(S.checkout('clothes', { fisher: 1 }, { method: 'cash' }, d).ok); assert.equal(skins[0].owned, true); assert.equal(d.cash(), 350);
});
t('bills are kept newest first, numbered per shop, and the list holds the last 30', () => {
  const c = bctx(100000); const n0 = S.bills().length; for (let i = 0; i < 35; i++) S.checkout('swamy', { filter: 1 }, { method: 'cash' }, c);
  const list = S.bills(); assert.equal(list.length, 30); assert.ok(list[0].no > list[1].no, 'newest first: ' + list[0].no + ' vs ' + list[1].no); assert.ok(/^SS-\d{4}$/.test(list[0].no)); assert.equal(list[0].shop, 'Swamy & Sons');
});
/* ---- shoes and the scrap dealer ---- */
function sctx(cash, o) {
  o = o || {}; const base = bctx(cash, o), bag = Object.assign({}, o.bag || {}), shoes = Object.assign({}, o.shoes || {}), earned = [], sold = [], equipped = [];
  return Object.assign(base, { bag, earned, sold, equipped, scrapHave: (id) => bag[id] || 0, scrapTake: (id, k) => ((bag[id] || 0) >= k ? ((bag[id] -= k), sold.push([id, k]), true) : false), earn: (k) => { earned.push(k); base.addCash && base.addCash(k); },
    gear: { has: (id) => !!shoes[id], equip: (id) => { shoes[id] = true; equipped.push(id); return true; } } });
}
t('a footwear shop sells two pairs, one of each, and a pair you own is sold out', () => {
  assert.ok(S.SHOPS.footwear && S.SHOPS.footwear.local.length > 0); assert.deepEqual(S.SHOPS.footwear.items.map((i) => i.id), ['chappal', 'sports']);
  const c = sctx(300); const q = S.quote('footwear', { sports: 2 }, {}, c); assert.equal(q.ok, false, 'only one pair'); assert.ok(S.quote('footwear', { sports: 1 }, {}, c).ok);
  const r = S.checkout('footwear', { sports: 1 }, { method: 'cash' }, c); assert.ok(r.ok, r.msg); assert.deepEqual(c.equipped, ['sports']); assert.equal(c.cash(), 120); assert.ok(/^FW-\d{4}$/.test(r.receipt.no));
  assert.equal(S.quote('footwear', { sports: 1 }, {}, c).ok, false, 'owned now'); assert.equal(S.stock('footwear', c).items.find((i) => i.id === 'sports').soldOut, true);
});
t('the scrap dealer lists what the scrap bag can hold, at the weight-times-rate payout, and buys only', () => {
  const sh = S.SHOPS.scrap; assert.ok(sh && sh.buys && sh.local.length > 0); assert.equal(sh.items.length, Object.keys(win.RoboScrap.TYPES).length);
  for (const it of sh.items) { assert.equal(it.price, win.RoboScrap.pay(it.id), it.id); assert.ok(/kg/.test(it.desc) && /\/kg/.test(it.desc), it.desc); }
  assert.deepEqual(S.accepts('scrap'), ['cash']);
});
t('selling scrap: you cannot sell what you do not hold, and a sale takes the pieces and pays out in cash', () => {
  const c = sctx(10, { bag: { paper: 3, can: 2 } }); assert.equal(S.quote('scrap', { paper: 4 }, {}, c).ok, false);
  const q = S.quote('scrap', { paper: 2, can: 1 }, {}, c); assert.ok(q.ok); assert.equal(q.payout, 2 * win.RoboScrap.pay('paper') + win.RoboScrap.pay('can')); assert.equal(q.due, 0);
  const r = S.checkout('scrap', { paper: 2, can: 1 }, { method: 'cash' }, c); assert.ok(r.ok, r.msg); assert.deepEqual(c.sold, [['paper', 2], ['can', 1]]); assert.deepEqual(c.earned, [q.payout]); assert.equal(c.bag.paper, 1);
  assert.equal(r.receipt.method, 'sold'); assert.equal(r.receipt.payout, q.payout); assert.ok(/^AK-\d{4}$/.test(r.receipt.no)); assert.equal(c.cash(), 10, 'nothing was spent');
});
t('a failed or empty sale changes nothing; barter does not apply to a dealer', () => {
  const c = sctx(10, { bag: { paper: 1 } }); assert.equal(S.checkout('scrap', {}, { method: 'cash' }, c).ok, false); assert.equal(S.checkout('scrap', { paper: 2 }, { method: 'cash' }, c).ok, false); assert.deepEqual(c.sold, []); assert.deepEqual(c.earned, []);
  assert.equal(S.quote('scrap', { paper: 1 }, { rice: 1 }, Object.assign(c, { held: { rice: 1 } })).creditLines.length, 0);
});
/* ---- the KSEB charging bay ---- */
function kctx(upi, room, o) { const base = bctx(0, Object.assign({ upi }, o || {})), charged = []; return Object.assign(base, { charged, batteryRoom: () => room, charge: (k, b) => charged.push([k, b]) }); }
t('a charging bay sells blocks of 10% at the tariff of the hour, and the price follows the clock', () => {
  S.tariffHours = () => 12; const day = S.SHOPS.kseb.items; S.tariffHours = () => 22; const night = S.SHOPS.kseb.items; S.tariffHours = () => 16.5;
  assert.deepEqual(day.map((i) => [i.id, i.price]), [['ac', 3], ['dc', 5]]); assert.deepEqual(night.map((i) => [i.id, i.price]), [['ac', 5], ['dc', 7]]);
  assert.ok(day[0].desc.indexOf('8.5/unit') > 0 && day[0].desc.indexOf('40 min') > 0, day[0].desc); assert.ok(night[1].desc.indexOf('23.23/unit') > 0, night[1].desc);
  assert.ok(S.SHOPS.kseb.local.length > 0); assert.deepEqual(S.accepts('kseb'), ['upi']);
});
t('charging is paid by GPay only, takes the blocks, and gives a KS bill', () => {
  S.tariffHours = () => 12; const c = kctx(50, 60);
  assert.equal(S.checkout('kseb', { ac: 2 }, { method: 'cash' }, c).ok, false, 'no cash at the chargers');
  const r = S.checkout('kseb', { ac: 2, dc: 1 }, { method: 'upi' }, c); assert.ok(r.ok, r.msg); assert.deepEqual(c.charged, [['ac', 2], ['dc', 1]]); assert.equal(c.upiBal(), 50 - (2 * 3 + 5)); assert.ok(/^KS-\d{4}$/.test(r.receipt.no)); assert.equal(r.receipt.method, 'upi');
  S.tariffHours = () => 16.5;
});
t('you cannot buy more charge than the battery has room for, and a full battery buys none', () => {
  S.tariffHours = () => 12; let c = kctx(100, 25); let q = S.quote('kseb', { ac: 3 }, {}, c); assert.equal(q.ok, false); assert.ok(/only 25%/.test(q.problems[0]), q.problems[0]); assert.ok(S.quote('kseb', { ac: 2 }, {}, c).ok);
  c = kctx(100, 0); q = S.quote('kseb', { ac: 1 }, {}, c); assert.equal(q.ok, false); assert.ok(/already full/.test(q.problems[0]));
  c = kctx(100, 25); S.checkout('kseb', { ac: 3 }, { method: 'upi' }, c); assert.deepEqual(c.charged, [], 'a failed bill charges nothing'); assert.equal(c.upiBal(), 100);
  S.tariffHours = () => 16.5;
});
t('a charging bay does not take goods in barter', () => { assert.equal(S.barterList('kseb').length, 0); });
/* ---- auto stands and KSRTC counters ---- */
function rctx(cash, upi) { const base = bctx(cash, { upi }), trips = []; return Object.assign(base, { trips, ride: (fx) => trips.push(fx) }); }
t('every stop has its own counter: an auto stand lists the other stops of its town, a KSRTC counter the other town', () => {
  assert.deepEqual(S.SHOPS.auto_kz_beach.items.map((i) => i.id), ['kz_mid', 'kz_north']); assert.deepEqual(S.SHOPS.auto_mj_town.items.map((i) => i.id), ['mj_zil', 'mj_college', 'mj_budget']);
  
  for (const k of S.kinds.filter((k) => /^(auto|bus)_/.test(k))) { assert.ok(S.SHOPS[k].local.length > 0, k); assert.deepEqual(S.accepts(k), ['cash', 'upi']); }
});
t('an auto fare is prepaid in cash or GPay, gives an AU bill and hands the page one trip', () => {
  const far = S.SHOPS.auto_kz_beach.items.find((i) => i.id === 'kz_north'); assert.equal(far.price, win.RoboExploreRides.fareFor(104.0));
  const c = rctx(100, 0), r = S.checkout('auto_kz_beach', { kz_north: 1 }, { method: 'cash' }, c); assert.ok(r.ok, r.msg); assert.deepEqual(c.trips, [far.fx]); assert.equal(c.cash(), 100 - far.price); assert.ok(/^AU-\d{4}$/.test(r.receipt.no), r.receipt.no);
  const g = rctx(0, 80), r2 = S.checkout('auto_kz_beach', { kz_mid: 1 }, { method: 'upi' }, g); assert.ok(r2.ok, r2.msg); assert.equal(g.trips.length, 1);
});
t('one trip at a time, and a ride you cannot afford takes nothing and goes nowhere', () => {
  const c = rctx(500, 0); const q = S.quote('auto_kz_beach', { kz_mid: 1, kz_north: 1 }, {}, c); assert.equal(q.ok, false); assert.ok(/One trip/.test(q.problems[0]));
  assert.equal(S.quote('auto_kz_beach', { kz_mid: 2 }, {}, c).ok, false);
  const poor = rctx(10, 0); assert.equal(S.checkout('auto_kz_beach', { kz_north: 1 }, { method: 'cash' }, poor).ok, false); assert.deepEqual(poor.trips, []); assert.equal(poor.cash(), 10);
});
t('a bus ticket costs the game fare of its link, gives a KT bill and one trip that carries its time', () => {
  const c = rctx(100, 0), r = S.checkout('bus_kz_ksrtc', { mj_ksrtc: 1 }, { method: 'cash' }, c); assert.ok(r.ok, r.msg); assert.equal(c.cash(), 100 - 45); assert.deepEqual(c.trips.map((x) => [x.mode, x.from, x.to, x.hours]), [['bus', 'kz_ksrtc', 'mj_ksrtc', 1.5]]); assert.ok(/^KT-\d{4}$/.test(r.receipt.no));
  const d = rctx(100, 0); S.checkout('bus_kz_ksrtc', { cy_ksrtc: 1 }, { method: 'cash' }, d); assert.equal(d.cash(), 85); assert.equal(d.trips[0].hours, 0.4);
});
t('every bus counter lists the two other stops, and the city has its own auto stands', () => {
  assert.deepEqual(S.SHOPS.bus_kz_ksrtc.items.map((i) => i.id), ['cy_ksrtc', 'mj_ksrtc', 'hl_ksrtc', 'wy_ksrtc', 'mp_ksrtc']); assert.deepEqual(S.SHOPS.bus_cy_ksrtc.items.map((i) => i.id), ['kz_ksrtc', 'mj_ksrtc', 'hl_ksrtc', 'wy_ksrtc', 'mp_ksrtc']); assert.deepEqual(S.SHOPS.bus_mj_ksrtc.items.map((i) => i.id), ['kz_ksrtc', 'cy_ksrtc', 'hl_ksrtc', 'wy_ksrtc', 'mp_ksrtc']); assert.deepEqual(S.SHOPS.bus_hl_ksrtc.items.map((i) => i.id), ['kz_ksrtc', 'cy_ksrtc', 'mj_ksrtc', 'wy_ksrtc', 'mp_ksrtc']); assert.deepEqual(S.SHOPS.bus_wy_ksrtc.items.map((i) => i.id), ['kz_ksrtc', 'cy_ksrtc', 'mj_ksrtc', 'hl_ksrtc', 'mp_ksrtc']); assert.deepEqual(S.SHOPS.bus_mp_ksrtc.items.map((i) => i.id), ['mj_ksrtc', 'kz_ksrtc', 'cy_ksrtc', 'hl_ksrtc', 'wy_ksrtc']); assert.deepEqual(S.SHOPS.auto_hl_park.items.map((i) => i.id), ['hl_mall', 'hl_bypass']);
  assert.deepEqual(S.SHOPS.auto_cy_station.items.map((i) => i.id), ['cy_mid', 'cy_stand']); assert.ok(/24 min|about 40 min/.test(S.SHOPS.bus_kz_ksrtc.items[0].desc), S.SHOPS.bus_kz_ksrtc.items[0].desc);
});
t('rides are not barter goods', () => { assert.equal(S.barterList('auto_kz_beach').length, 0); assert.equal(S.barterList('bus_kz_ksrtc').length, 0); });
/* ---- opening hours ---- */
t('shops keep hours: the tea stall opens before the hardware store, and chargers, autos and buses are always open', () => {
  assert.equal(S.isOpen('snacks', 5.5), true); assert.equal(S.isOpen('tools', 5.5), false); assert.equal(S.isOpen('tools', 9), true); assert.equal(S.isOpen('tools', 19), false, 'closing time is closed');
  for (const k of ['kseb', 'auto_kz_beach', 'bus_kz_ksrtc', 'ledger']) for (const h of [0, 3, 12, 23.9]) assert.equal(S.isOpen(k, h), true, k + ' at ' + h);
  assert.equal(S.isOpen('nowhere', 12), false);
});
t('a closed shop refuses a bill with the opening time, and takes nothing; the same cart works when it opens', () => {
  const c = bctx(100); S.tariffHours = () => 3;
  const q = S.quote('pharmacy', { tulsi: 1 }, {}, c); assert.equal(q.ok, false); assert.equal(q.closed, true); assert.ok(/Closed now\. Open 8 am to 10 pm/.test(q.problems[0]), q.problems[0]);
  const r = S.checkout('pharmacy', { tulsi: 1 }, { method: 'cash' }, c); assert.equal(r.ok, false); assert.equal(c.cash(), 100); assert.deepEqual(c.applied, []);
  S.tariffHours = () => 12; const id = S.SHOPS.pharmacy.items[0].id; assert.ok(S.quote('pharmacy', { [id]: 1 }, {}, c).ok); S.tariffHours = () => 16.5;
});
t('the scrap dealer is shut at night too, and the opening line reads in plain words', () => {
  S.tariffHours = () => 22; const c = sctx(0, { bag: { paper: 2 } }); const q = S.quote('scrap', { paper: 1 }, {}, c); assert.equal(q.ok, false); assert.equal(q.closed, true); assert.equal(q.payout, 0); S.tariffHours = () => 16.5;
  assert.equal(S.openLine('tools'), 'Open 9 am to 7 pm (game hours).'); assert.equal(S.openLine('snacks'), 'Open 5 am to 10 pm (game hours).'); assert.equal(S.openLine('kseb'), '');
});
console.log('\n' + n + ' tests passed');
