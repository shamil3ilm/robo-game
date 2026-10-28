/* Robo Run: the game clock, the temperature, the light by time of day, and the EV charging tariff. Exposes window.RoboClock = { create, fmt, phase, icon, temperature, light, evTariff }.
   Temperatures are believable typical values for each place, not measurements: a coastal town at 25 to 32 degrees C, an inland town a little more extreme, the Wayanad ghat clearly cooler.
   The EV tariff is the per-unit KSEB public-charging rate as reported in May 2025 (AC slow 8.50 and DC fast 16.50 per unit from 9 am to 4 pm; 14.23 and 23.23 from 4 pm to 9 am); check current rates before relying on them. */
(function () {
  'use strict';
  const TAU = Math.PI * 2, wrap = (h) => ((h % 24) + 24) % 24;
  const fmt = (h) => { h = wrap(h); let m = Math.floor(h * 60 + 1e-6), hh = Math.floor(m / 60) % 24; m %= 60; const ap = hh >= 12 ? 'pm' : 'am', h12 = hh % 12 === 0 ? 12 : hh % 12; return h12 + ':' + String(m).padStart(2, '0') + ' ' + ap; };
  const PHASES = [[5, 7, 'Dawn', '🌅'], [7, 11, 'Morning', '☀️'], [11, 14, 'Midday', '☀️'], [14, 16.5, 'Afternoon', '🌤️'], [16.5, 18.5, 'Evening', '🌇'], [18.5, 19.5, 'Dusk', '🌆']];
  const pick = (h) => { h = wrap(h); for (const p of PHASES) if (h >= p[0] && h < p[1]) return p; return [19.5, 29, 'Night', '🌙']; };
  const phase = (h) => pick(h)[2], icon = (h) => pick(h)[3];
  const PLACES = { kozhikode: [28.5, 3.5], manjeri: [28.5, 4.5], wayanad: [21, 3.5] };   // [mean, swing]: hottest about 2:30 pm, coolest about 2:30 am
  const temperature = (place, h) => { const p = PLACES[place] || PLACES.kozhikode; return Math.round(p[0] + p[1] * Math.cos((TAU * (wrap(h) - 14.5)) / 24)); };

  /* key moments of the day; everything is blended smoothly between neighbours, and the day wraps */
  const hex = (n) => [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  const KEYS = [
    { h: 0, sun: [0xaab8e8, 0.12, 40], hemiSky: 0x5a6a9a, hemiGround: 0x2a2a3a, hemi: 0.35, bg: 0x141c34, fog: 0x1a2240, sky: 0.25, lamps: 1 },
    { h: 5.5, sun: [0xc8c8e8, 0.2, 15], hemiSky: 0x7a8ab8, hemiGround: 0x3a3a48, hemi: 0.45, bg: 0x5a6a90, fog: 0x6a7898, sky: 0.45, lamps: 1 },
    { h: 7.5, sun: [0xffd6a0, 1.3, 25], hemiSky: 0xffe4be, hemiGround: 0x7a6248, hemi: 0.7, bg: 0xe8c898, fog: 0xe8cfa6, sky: 0.9, lamps: 0 },
    { h: 12, sun: [0xfff4e0, 1.5, 80], hemiSky: 0xdfeaff, hemiGround: 0x8a7a5a, hemi: 0.68, bg: 0xa8cff0, fog: 0xc8d8e4, sky: 1.15, lamps: 0 },
    { h: 16.5, sun: [0xffc27a, 1.3, 31], hemiSky: 0xffe4be, hemiGround: 0x7a6248, hemi: 0.58, bg: 0xf0bf8a, fog: 0xf0c28e, sky: 1.0, lamps: 0 },
    { h: 18.5, sun: [0xff8a50, 0.7, 5], hemiSky: 0xe8a888, hemiGround: 0x5a4a48, hemi: 0.5, bg: 0xc87858, fog: 0xc88060, sky: 0.7, lamps: 0.5 },
    { h: 20, sun: [0x8a9ad8, 0.2, 40], hemiSky: 0x5a6a9a, hemiGround: 0x2a2a3a, hemi: 0.38, bg: 0x1e2644, fog: 0x242c4c, sky: 0.3, lamps: 1 },
    { h: 24, sun: [0xaab8e8, 0.12, 40], hemiSky: 0x5a6a9a, hemiGround: 0x2a2a3a, hemi: 0.35, bg: 0x141c34, fog: 0x1a2240, sky: 0.25, lamps: 1 }
  ];
  const lerp = (a, b, t) => a + (b - a) * t, lerp3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)], sm = (t) => t * t * (3 - 2 * t);
  const light = (h) => {
    h = wrap(h); let i = 0; while (i < KEYS.length - 2 && h >= KEYS[i + 1].h) i++;
    const a = KEYS[i], b = KEYS[i + 1], t = sm((h - a.h) / (b.h - a.h));
    return {
      sun: { color: lerp3(hex(a.sun[0]), hex(b.sun[0]), t), intensity: lerp(a.sun[1], b.sun[1], t), elev: lerp(a.sun[2], b.sun[2], t) },
      hemi: { sky: lerp3(hex(a.hemiSky), hex(b.hemiSky), t), ground: lerp3(hex(a.hemiGround), hex(b.hemiGround), t), intensity: lerp(a.hemi, b.hemi, t) },
      bg: lerp3(hex(a.bg), hex(b.bg), t), fog: lerp3(hex(a.fog), hex(b.fog), t), sky: lerp(a.sky, b.sky, t), lamps: lerp(a.lamps, b.lamps, t)
    };
  };
  /* the camera's exposure through the day: the sun straight overhead lights things about two and a half times as hard as at 5 pm, so around midday (08:00 to 17:00, lowest at 12:30) the picture is dimmed a little, and the evening and night are untouched */
  const exposure = (h) => { const d = Math.abs(wrap(h) - 12.5), x = Math.max(0, 1 - d / 4.5); return 1 - 0.22 * x * x * (3 - 2 * x); };
  const evTariff = (h) => { h = wrap(h); return h >= 9 && h < 16 ? { ac: 8.5, dc: 16.5, band: 'Day (9 am to 4 pm)' } : { ac: 14.23, dc: 23.23, band: 'Evening and night (4 pm to 9 am)' }; };

  /* the running clock: one game minute every `secsPerMinute` real seconds (4 by default, so a game hour is four real minutes) */
  const create = (o) => {
    o = o || {}; let h = wrap(o.hours == null ? 16.5 : o.hours); const spm = o.secsPerMinute || 4;
    return { hours: () => h, tick(dt) { h = wrap(h + dt / (spm * 60)); }, set(v) { h = wrap(v); } };
  };
  window.RoboClock = { create, fmt, phase, icon, temperature, light, evTariff, exposure };
})();
