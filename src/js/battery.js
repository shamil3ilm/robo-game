/* Robo Run: the robot's battery. Exposes window.RoboBattery. Saved under 'runaway.battery'.
   Walking uses it (1% for every 15 m, half as much again when running). Below 20% you slow down, at 0% you crawl at 60% speed. A battery of 90% or more gives a short sprint at the start of a run.
   Charging is sold in blocks of 10%. Game scale: a full battery is 3 units, so a block is 0.3 unit, priced at the KSEB per-unit tariff of the hour (clock.js evTariff), rounded up to the rupee.
   AC (slow) gives a block in 40 game minutes, DC (fast) in 10. Charging at home is free and takes the AC time. */
(function () {
  'use strict';
  const KEY = 'runaway.battery', BLOCK = 10, UNITS_PER_BLOCK = 0.3, MIN_PER_BLOCK = { ac: 40, dc: 10 }, M_PER_PCT = 15, RUN_EXTRA = 1.5;
  let level = 100;
  const clampPct = (v) => Math.max(0, Math.min(100, v));
  const load = () => {
    let raw = {};
    try { raw = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { raw = {}; }
    const v = Number(raw.level); level = Number.isFinite(v) ? clampPct(v) : 100;
  };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ level: Math.round(level * 10) / 10 })); } catch (e) { /* the level is just not remembered */ } };
  const pct = () => Math.round(level);
  window.RoboBattery = {
    BLOCK, UNITS_PER_BLOCK, MIN_PER_BLOCK,
    pct,
    room: () => 100 - pct(),
    /* walk `metres`; returns the warning level just crossed (20, 10 or 0), or null */
    drain(metres, running) {
      if (!(metres > 0) || level <= 0) return null;
      const before = pct(); level = clampPct(level - (metres * (running ? RUN_EXTRA : 1)) / M_PER_PCT); const after = pct();
      if (after !== before) save();
      const w = [20, 10, 0].find((t) => before > t && after <= t);
      return w === undefined ? null : w;
    },
    speedMul() { const p = level; return p >= 20 ? 1 : 0.6 + 0.4 * (p / 20); },
    runBoost: () => (pct() >= 90 ? 5 : 0),
    /* add percent (never past 100); returns how much was added */
    charge(p) { const add = Math.max(0, Math.min(Math.floor(Number(p) || 0), 100 - pct())); level = clampPct(Math.round(level) + add); save(); return add; },
    /* one block at the given tariff ({ ac, dc } rupees per unit): the price in whole rupees, the rate, the units and the game minutes it takes */
    blockCost(kind, tariff) { const rate = tariff && tariff[kind]; if (!(rate > 0) || !MIN_PER_BLOCK[kind]) return null; return { price: Math.ceil(rate * UNITS_PER_BLOCK - 1e-9), rate, units: UNITS_PER_BLOCK, minutes: MIN_PER_BLOCK[kind] }; },
    reset() { level = 100; save(); }
  };
  load();
})();
