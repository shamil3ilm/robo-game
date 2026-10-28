/* Robo Run: rain in the walkable town. Exposes window.RoboWeather = { create, tempDrop, walkMul }.
   Showers come and go on their own (a dry spell of 4 to 9 minutes, then 1.5 to 3.5 minutes of rain; there is no season or calendar yet), and the rain fades in and out over about 8 seconds.
   While it rains the town is a little cooler (up to 3 degrees) and the wet street slows you by 8% unless you own an umbrella. Time only passes here while you are in the town. */
(function () {
  'use strict';
  const RAMP = 8;   // seconds to fade a shower in or out
  const create = (o) => {
    o = o || {}; const rand = o.rand || Math.random;
    const dry = () => 240 + rand() * 300, wet = () => 90 + rand() * 120;
    let raining = false, left = 120 + rand() * 180, k = 0;
    return {
      /* advance by dt seconds; returns 'start' or 'stop' on the frame a shower begins or ends, else null */
      tick(dt) {
        let ev = null; left -= dt;
        if (left <= 0) { raining = !raining; left = raining ? wet() : dry(); ev = raining ? 'start' : 'stop'; }
        const target = raining ? 1 : 0; k += Math.max(-dt / RAMP, Math.min(dt / RAMP, target - k));
        return ev;
      },
      raining: () => raining,
      intensity: () => k,
      /* force a shower on or off (debugging, tests); `now` skips the fade */
      set(on, now) { raining = !!on; left = raining ? wet() : dry(); if (now) k = raining ? 1 : 0; }   // now: skip the fade
    };
  };
  const tempDrop = (k) => Math.round(3 * Math.max(0, Math.min(1, k)));
  const walkMul = (k, umbrella) => (umbrella ? 1 : 1 - 0.08 * Math.max(0, Math.min(1, k)));
  window.RoboWeather = { create, tempDrop, walkMul, RAMP };
})();
