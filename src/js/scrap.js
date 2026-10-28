/* Robo Run: the scrap bag. Old paper, plastic, tins, glass and iron picked up around town are sold to the scrap dealer by weight.
   Exposes window.RoboScrap = { TYPES, add, have, take, total, pay }. Saved under 'runaway.scrap'. The rates are posted game rates, not real market prices. */
(function () {
  'use strict';
  const KEY = 'runaway.scrap', CAP = 30;
  const TYPES = {   // kg: weight of one piece, rate: rupees per kg at the dealer's board
    paper: { name: 'Newspaper bundle', emoji: '📰', kg: 0.5, rate: 12 },
    plastic: { name: 'Plastic bottles', emoji: '🧴', kg: 0.3, rate: 10 },
    can: { name: 'Tin cans', emoji: '🥫', kg: 0.2, rate: 30 },
    glass: { name: 'Glass bottles', emoji: '🍾', kg: 0.4, rate: 3 },
    iron: { name: 'Iron pieces', emoji: '🔩', kg: 1.5, rate: 28 }
  };
  let bag = {};
  const total = () => Object.keys(bag).reduce((s, k) => s + bag[k], 0);
  const load = () => {
    let raw = {};
    try { raw = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { raw = {}; }
    bag = {}; let sum = 0;
    for (const id of Object.keys(TYPES)) { const v = Math.floor(Number(raw[id])); if (v > 0 && sum < CAP) { bag[id] = Math.min(v, CAP - sum); sum += bag[id]; } }
  };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(bag)); } catch (e) { /* the bag is just not remembered */ } };
  const api = {
    TYPES, total, CAP,
    pay(id) { const x = TYPES[id]; return x ? Math.max(1, Math.round(x.kg * x.rate)) : 0; },   // what the dealer pays for one piece
    have(id) { return bag[id] || 0; },
    add(id) { if (!TYPES[id] || total() >= CAP) return false; bag[id] = (bag[id] || 0) + 1; save(); return true; },
    take(id, count) { count = Math.floor(Number(count)); if (!TYPES[id] || !(count >= 1) || (bag[id] || 0) < count) return false; bag[id] -= count; if (bag[id] <= 0) delete bag[id]; save(); return true; }
  };
  load();
  window.RoboScrap = api;
})();
