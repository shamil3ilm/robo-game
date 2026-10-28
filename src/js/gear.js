/* Robo Run: the shoes the robot owns. Exposes window.RoboGear = { has, equip, best, walkMul, runBoost }. Saved under 'runaway.gear'.
   Rubber chappals: walk 8% faster in town. Sports shoes: walk 15% faster in town, and every run starts with 12 seconds of sprint. The best owned pair is worn. */
(function () {
  'use strict';
  const KEY = 'runaway.gear', PAIRS = ['chappal', 'sports'];   // worst to best
  let owned = {};
  const load = () => {
    let raw = {};
    try { raw = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { raw = {}; }
    owned = {}; const o = raw.owned && typeof raw.owned === 'object' ? raw.owned : {};
    PAIRS.forEach((id) => { if (o[id] === true) owned[id] = true; });
  };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ owned })); } catch (e) { /* the shoes are just not remembered */ } };
  const best = () => (owned.sports ? 'sports' : owned.chappal ? 'chappal' : '');
  window.RoboGear = {
    has: (id) => !!owned[id],
    equip(id) { if (PAIRS.indexOf(id) < 0) return false; owned[id] = true; save(); return true; },
    best,
    walkMul: () => ({ sports: 1.15, chappal: 1.08 }[best()] || 1),
    runBoost: () => (best() === 'sports' ? 12 : 0)
  };
  load();
})();
