/* Robo Run: the GPay / UPI part of the wallet. Cash is the game's coin count (picked up and earned); this module holds the UPI balance and issues transaction ids.
   Exposes window.RoboWallet = { upi(), add(n), pay(n, to) }. Saved under 'runaway.wallet'. Moving money between cash and UPI is done by the caller (the shop screen), which spends the cash first. */
(function () {
  'use strict';
  const KEY = 'runaway.wallet', MAX = 1000000;
  let W = { upi: 0, txn: 0 };
  const clean = (v) => { v = Math.floor(Number(v)); return isFinite(v) && v > 0 ? Math.min(v, MAX) : 0; };
  const load = () => {
    let raw = {};
    try { raw = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { raw = {}; }
    W = { upi: clean(raw.upi), txn: clean(raw.txn) };
  };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(W)); } catch (e) { /* storage full or blocked: the balance just is not remembered */ } };
  /* a 12-digit reference like the ones UPI apps show, different for every payment */
  const ref = (k) => { let x = (k * 2654435761 + 40503) % 1000000000000; if (x < 1e11) x += 1e11; return 'UPI' + String(Math.floor(x)); };
  const api = {
    upi() { return W.upi; },
    add(n) { n = clean(n); if (!n) return; W.upi = Math.min(MAX, W.upi + n); save(); },
    pay(n, to) {
      n = Math.floor(Number(n));
      if (!(n >= 1) || W.upi < n) return { ok: false, msg: n >= 1 ? 'Your GPay balance is ' + W.upi + ', and this needs ' + n + '.' : 'Nothing to pay.' };
      W.upi -= n; W.txn++; save(); return { ok: true, txn: ref(W.txn), to: to || '', amount: n };
    }
  };
  load();
  window.RoboWallet = api;
})();
