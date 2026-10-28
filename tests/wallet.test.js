// Run: node tests/wallet.test.js  (the GPay / UPI balance in src/js/wallet.js with a stubbed localStorage)
const fs = require('fs'), path = require('path'), assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'wallet.js'), 'utf8');
function fresh(seed) {
  const store = new Map(); if (seed !== undefined) store.set('runaway.wallet', typeof seed === 'string' ? seed : JSON.stringify(seed));
  const win = {}; new Function('window', 'localStorage', src)(win, { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v) });
  return { W: win.RoboWallet, store };
}
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok  ' + name); };

t('a new wallet has no GPay balance', () => { const { W } = fresh(); assert.equal(W.upi(), 0); });
t('adding money raises the balance and is saved', () => { const { W, store } = fresh(); W.add(50); assert.equal(W.upi(), 50); assert.equal(JSON.parse(store.get('runaway.wallet')).upi, 50); const again = fresh(JSON.parse(store.get('runaway.wallet'))); assert.equal(again.W.upi(), 50); });
t('paying takes the money, returns a transaction id that looks like a UPI reference, and each payment gets a different one', () => {
  const { W } = fresh({ upi: 100, txn: 0 }); const a = W.pay(30, 'Hotel Farsa'), b = W.pay(30, 'Hotel Farsa');
  assert.ok(a.ok && b.ok); assert.equal(W.upi(), 40); assert.ok(/^UPI\d{12}$/.test(a.txn), a.txn); assert.notEqual(a.txn, b.txn);
});
t('paying more than the balance does nothing', () => { const { W } = fresh({ upi: 20, txn: 0 }); const r = W.pay(21, 'x'); assert.equal(r.ok, false); assert.equal(W.upi(), 20); });
t('zero, negative and fractional amounts are refused or rounded down, never created from nothing', () => {
  const { W } = fresh({ upi: 20, txn: 0 }); assert.equal(W.pay(0, 'x').ok, false); assert.equal(W.pay(-5, 'x').ok, false); W.add(-10); assert.equal(W.upi(), 20); W.add(2.9); assert.equal(W.upi(), 22);
});
t('a corrupt or hostile save falls back to a clean wallet', () => { assert.equal(fresh('{bad json').W.upi(), 0); assert.equal(fresh({ upi: -50, txn: 'x' }).W.upi(), 0); assert.equal(fresh({ upi: 1e15 }).W.upi() <= 1000000, true); });
console.log('\n' + n + ' tests passed');
