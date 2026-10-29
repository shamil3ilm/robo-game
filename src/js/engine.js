/* Run Away — game engine v4 (responsive camera framing, phone-friendly pixel ratio). Based on v3: adds Rival Robots combat & loot (tuning: COMBAT object below). (three.js r147 UMD global). Exposes window.RunAwayGame.create(container, opts).
   v2: six zones, rollers/sliders/lava/void gaps, multiplier + jetpack, assist (kids) mode, reduce motion, tap-zone and
   one-button control styles, remappable keys, gamepad, playable tutorial, music tracks + volume buses, captions, auto quality, run stats. */
(function () {
'use strict';
const PI = Math.PI, LANE = 2.6, G = -38, JUMP_V = 13.5, ZONE_LEN = 750, TRACK_L = 240;
const rng = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const approach = (v, t, s) => (v < t ? Math.min(t, v + s) : Math.max(t, v - s));
const lerp = (a, b, t) => a + (b - a) * t;
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const zoneAt = (d) => Math.floor(Math.max(0, d) / ZONE_LEN) % ZONES.length;
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

const CLASSIC_ZONES = [
  { kind: 'jungle', music: 'temple-ruins', gates: true, fog: 0x8ea383, density: 0.016, sun: 2.4, sunColor: 0xffe2b8, sky: 0xcfe3bf, ground: 0x3d3322, hemi: 0.8, head: 0, env: 1, track: 0xffffff, floor: 0xffffff, floorEm: 0x000000, dust: 0xffe2a0, dustOp: 0.5 },
  { kind: 'river', music: 'river-crossing', gap: 'gap', fog: 0x93aead, density: 0.014, sun: 2.1, sunColor: 0xfff0d8, sky: 0xcfe4e4, ground: 0x2f3c36, hemi: 0.85, head: 0, env: 1, track: 0xe2e6df, floor: 0xa8b6a0, floorEm: 0x000000, dust: 0xf4f0d8, dustOp: 0.5 },
  { kind: 'cave', music: 'crystal-caves', fog: 0x0f1517, density: 0.034, sun: 0.25, sunColor: 0x8aa4ff, sky: 0x3c4a5e, ground: 0x120f0c, hemi: 0.45, head: 5, env: 0.18, track: 0x80858c, floor: 0x55504a, floorEm: 0x000000, dust: 0x7ff0ff, dustOp: 0.85 },
  { kind: 'ice', music: 'ice-temple', gates: true, fog: 0xc4d3e2, density: 0.018, sun: 2.5, sunColor: 0xf2f6ff, sky: 0xe4edf8, ground: 0x6a7a8a, hemi: 0.95, head: 0, env: 1.1, track: 0xe6f0ff, floor: 0xffffff, floorEm: 0x8a9cb0, dust: 0xffffff, dustOp: 0.9 },
  { kind: 'lava', music: 'volcano', gap: 'lava', fog: 0x2a1410, density: 0.026, sun: 1.1, sunColor: 0xff9a5a, sky: 0x5a2a1c, ground: 0x1a0c08, hemi: 0.55, head: 3, env: 0.35, track: 0x9a8478, floor: 0x3a2a24, floorEm: 0x1a0400, dust: 0xff8a3a, dustOp: 0.9 },
  { kind: 'sky', music: 'sky-ruins', gates: true, gap: 'void', fog: 0xbfd3ea, density: 0.012, sun: 2.8, sunColor: 0xfff4e0, sky: 0xdfeaf6, ground: 0x8a9ab0, hemi: 1.0, head: 0, env: 1.1, track: 0xf2ece0, floor: 0xffffff, floorEm: 0xa8bcd4, dust: 0xffffff, dustOp: 0.45 }
];
/* worlds: each is a list of zones that loop; the Malabar tables live in malabar.js (optional, loaded before this file) */
const MAL_W = window.MalabarWorld || null;
const WORLDS = { classic: CLASSIC_ZONES, malabar: MAL_W ? MAL_W.zones : CLASSIC_ZONES };
let ZONES = CLASSIC_ZONES;
const zname = (z) => ZONES[z].name || STR.zones[z];
/* every line the engine shows or speaks (English; ready for a translation table) */
const STR = {
  zones: ['Temple Ruins', 'River Crossing', 'Crystal Caves', 'Ice Temple', 'Volcano', 'Sky Ruins'],
  enter: ['Entering temple ruins.', 'Entering river crossing.', 'Entering crystal caves. Headlight on.', 'Entering ice temple. Watch your step.', 'Entering the volcano. Heat rising.', 'Entering sky ruins. Do not look down.'],
  start: 'Systems online. Run.', startKids: "Let's go, little robot!", shieldDown: 'Shield down.', hull: 'Warning. Hull damage.', critical: 'Critical damage.',
  oops: 'Oops! Keep going!', over: 'System failure.', overKids: "Nice try! Let's go again.", magnet: 'Magnet active.', shield: 'Shield online.',
  mult: 'Double score.', jet: 'Jetpack engaged.', ready: 'Training complete. Good luck.',
  boss: 'Warning. Guardian approaching.', bossDown: 'Guardian defeated.', rivals: 'Rival robots incoming.', rivalsKids: 'Here come the racers!'
};
const ASSIST = { v: 0.82, vmax: 0.72, acc: 0.6, gap: 1.3 };

/* ==========================================================================
   RIVAL ROBOTS: COMBAT & LOOT — TUNING
   Every combat and loot number lives in this one object. Ranges are [min, max].
   ========================================================================== */
const COMBAT = {
  waves: {
    first: 280,                                   // metres run before the first wave
    gap: [320, 480],                              // calm metres between waves (scaled by difficulty below)
    size: { base: 1, perMetres: 1400, max: 3 },   // rivals per wave: base + 1 per perMetres run, capped at max
    spawnSpacing: 0.9,                            // seconds between rivals of one wave
    stay: [9, 15],                                // seconds a rival runs alongside before falling behind
    weaponChance: 0.7,                            // chance a wave brings a weapon pickup (the first wave always does)
    mix: { sprinter: 4, bruiser: 3.5, trickster: 2.5 },                   // how often each rival type appears
    weaponMix: { pipe: 3, wrench: 2, baton: 2, blaster: 2, magnet: 1.2 }, // which weapons appear on the track
    difficulty: { Relaxed: { gap: 1.35, size: 0, aggro: 0.7 }, Moderate: { gap: 1, size: 0, aggro: 1 }, Hard: { gap: 0.75, size: 1, aggro: 1.3 } }
  },
  kids: { gap: 1.4, sizeMax: 2, aggro: 0.6, hp: 0.7, coinBoost: 1.5 },   // kids mode: calmer waves, softer rivals, more coins
  rivals: {
    bruiser:   { hp: 120, speed: 0.97, hard: true,  cooldown: [2.2, 3.4], dodge: 0.7,  laneHop: 0,          weapon: 'wrench', weaponChance: 0.75, coins: [12, 18], energy: [0, 3],   scale: 1.1,  color: 0xb5482e },
    sprinter:  { hp: 45,  speed: 1.04, hard: false, cooldown: [2.6, 4.0], dodge: 0.86, laneHop: [1.2, 2.2], weapon: 'pipe',   weaponChance: 0.15, coins: [2, 5],   energy: [8, 14],  scale: 0.92, color: 0x27b3a0 },
    trickster: { hp: 60,  speed: 1.0,  hard: false, cooldown: [1.6, 2.6], dodge: 0.82, laneHop: [2.5, 4.0], weapon: null,     weaponChance: 0,    coins: [5, 8],   energy: [2, 4],   scale: 0.95, color: 0x8b55d6, steal: 10, bonus: 10 },
    boss:      { hp: 420, speed: 1.0,  hard: true,  cooldown: [3.0, 4.5], dodge: 1,    laneHop: 0,          weapon: null,     weaponChance: 0,    coins: [45, 60], energy: [10, 15], scale: 1.75, color: 0x3b4150 }
  },
  boss: { metresBeforeZoneEnd: 170, slamEvery: [4.5, 6.5], warnSeconds: 1.2, warnAhead: 2.4 }, // warnAhead: seconds of running between player and slam spot
  shove: { damage: 14, cooldown: 0.45, reach: 2.2 },                                             // attacking with no weapon
  rivalHit: { reach: 1.5, windup: 0.4, speedLoss: 0.85, coinsDropped: [4, 8], maxCoinsDropped: 10 },
  weapons: {
    pipe:    { melee: true,  uses: 8,  damage: 34, push: 0, stagger: 0.35, cooldown: 0.28, reach: 2.4 },
    wrench:  { melee: true,  uses: 6,  damage: 46, push: 1, stagger: 0.7,  cooldown: 0.5,  reach: 2.4 },
    baton:   { melee: true,  uses: 6,  damage: 24, push: 0, stagger: 0.2,  cooldown: 0.4,  reach: 2.4, stun: 1.5 },
    blaster: { ranged: true, uses: 10, damage: 30, cooldown: 0.25, boltSpeed: 44 },
    magnet:  { ranged: true, uses: 3,  damage: 8,  cooldown: 0.5,  boltSpeed: 32, disarm: true },
    foam:    { melee: true,  uses: 8,  damage: 34, push: 1, stagger: 0.4,  cooldown: 0.3,  reach: 2.4 },  // kids mode melee
    bubble:  { ranged: true, uses: 10, damage: 30, cooldown: 0.3,  boltSpeed: 30 }                       // kids mode ranged
  },
  obstacleDamage: 0.65,  // share of max health a rival loses when it crashes into an obstacle
  wallDamage: 0.35,      // share lost when shoved off the edge of the track
  points: { takedown: 250, environmental: 400, boss: 2000 },
  combo: { window: 4, max: 4 },                  // takedowns within window seconds stack x2, x3, x4
  loot: { envCoins: 6, comboCoins: 3, returnBonus: 5, crateCoins: 3, bossWeapons: ['blaster', 'baton'] },
  coins: { trackChance: 0.3, value: 1, score: 5 }, // trackChance: share of energy lines that are coins instead
  hitStop: 0.06, shake: 0.16
};
const DIFF = {
  Relaxed: { v0: 9.5, vmax: 19, acc: 0.0028, gap: 1.25 },
  Moderate: { v0: 11, vmax: 23, acc: 0.004, gap: 1 },
  Hard: { v0: 13, vmax: 27, acc: 0.0055, gap: 0.85 }
};
const K = ['py', 'bx', 'tx', 'ty', 'hx', 'hy', 'hipL', 'hipR', 'kL', 'kR', 'aL', 'aR', 'shL', 'shR', 'shZ', 'elL', 'elR', 'hs'];   // hs: legs spread apart (astride)
const legFK = (h, k) => -0.6 * Math.cos(h) - 0.6 * Math.cos(h - k) - 0.13; // sole height below hip joint

/* ---------- poses (joint angles in radians) ---------- */
function poseRun(p, amp) {
  const s = Math.sin(p), c = Math.cos(p), P = {};
  P.hipL = amp * s - 0.04; P.hipR = -amp * s - 0.04;
  P.kL = 0.28 + 1.3 * Math.max(0, c) + 0.18 * Math.max(0, -c);
  P.kR = 0.28 + 1.3 * Math.max(0, -c) + 0.18 * Math.max(0, c);
  P.aL = -(P.hipL - P.kL) - 0.35 * Math.max(0, c);
  P.aR = -(P.hipR - P.kR) - 0.35 * Math.max(0, -c);
  P.py = 0.1 - Math.min(legFK(P.hipL, P.kL), legFK(P.hipR, P.kR)) + 0.14 * (1 - Math.abs(c));
  P.shL = -0.9 * amp * s + 0.1; P.shR = 0.9 * amp * s + 0.1; P.shZ = 0.12;
  P.elL = 1.25 + 0.25 * s; P.elR = 1.25 - 0.25 * s;
  P.ty = 0.15 * s; P.hy = -0.1 * s; P.tx = -0.16; P.bx = -0.05; P.hx = 0.12;
  return P;
}
function poseIdle(t) {
  const P = { hipL: 0.03, hipR: -0.02, kL: 0.1, kR: 0.08 };
  P.aL = -(P.hipL - P.kL); P.aR = -(P.hipR - P.kR);
  P.py = 0.1 - Math.min(legFK(P.hipL, P.kL), legFK(P.hipR, P.kR));
  const b = Math.sin(t * 1.7);
  P.tx = -0.03 + b * 0.015; P.ty = Math.sin(t * 0.4) * 0.08; P.hx = 0.05 + Math.sin(t * 0.9) * 0.04; P.hy = Math.sin(t * 0.55) * 0.45;
  P.bx = 0; P.shL = 0.05 + b * 0.02; P.shR = 0.05 + b * 0.02; P.shZ = 0.14; P.elL = 0.3; P.elR = 0.3;
  return P;
}
function poseJump(vy) {
  const u = clamp((vy + 6) / 16, 0, 1), P = {};
  P.hipL = lerp(0.35, 1.15, u); P.kL = lerp(0.45, 1.8, u); P.hipR = lerp(0.05, -0.3, u); P.kR = lerp(0.5, 1.3, u);
  P.aL = -(P.hipL - P.kL) * 0.6; P.aR = -(P.hipR - P.kR) * 0.6 - 0.3;
  P.py = 0.1 - Math.min(legFK(P.hipL, P.kL), legFK(P.hipR, P.kR));
  P.bx = -0.08; P.tx = -0.22; P.ty = 0; P.hx = 0.15; P.hy = 0;
  P.shL = lerp(0.4, -0.7, u); P.shR = lerp(0.6, 1.3, u); P.shZ = 0.3; P.elL = 0.9; P.elR = 1.1;
  return P;
}
const POSE_SLIDE = { py: 0.6, bx: 1.15, tx: -0.25, ty: 0, hx: -0.55, hy: 0, hipL: 0.38, kL: 0.12, hipR: 0.2, kR: 0.55, aL: -0.6, aR: -0.3, shL: -0.7, shR: -0.5, shZ: 0.45, elL: 0.5, elR: 0.6 };
/* seated on a ride: pelvis height, torso lean (tx < 0 = forward), thighs forward with knees bent, hands on the bars or the neck */
const POSE_RIDE = {
  scooter: { py: 1.12, bx: 0, tx: -0.35, ty: 0, hx: 0.3, hy: 0, hipL: 1.4, kL: 0.75, hipR: 1.4, kR: 0.75, aL: -0.65, aR: -0.65, shL: 0.45, shR: 0.45, shZ: 0.1, elL: 0.3, elR: 0.3, hs: 0 },
  buffalo: { py: 1.78, bx: 0, tx: -0.4, ty: 0, hx: 0.3, hy: 0, hipL: 0.5, kL: 0.8, hipR: 0.5, kR: 0.8, aL: 0.2, aR: 0.2, shL: 0.45, shR: 0.45, shZ: 0.15, elL: 0.25, elR: 0.25, hs: 0.55 }
};
/* rides are timed power-ups that take hits for you; `smash` lists what they crash through without damage */
const RIDES = {
  scooter: { secs: 12, speed: 1.35, hp: 2, smash: {}, say: 'Scooter ride.' },
  buffalo: { secs: 14, speed: 1.08, hp: 3, smash: { log: 1, crate: 1, block: 1, beam: 1, roller: 1, slider: 1 }, say: 'Buffalo ride. Charge!' }
};
const POSE_DOWN = { py: 0.78, bx: 0, tx: -0.5, ty: 0.1, hx: -0.6, hy: 0.25, hipL: 1.5, kL: 1.5, hipR: -0.15, kR: 1.42, aL: 0, aR: 0.6, shL: 0.15, shR: 0.05, shZ: 0.18, elL: 0.35, elR: 0.2 };

/* ---------- audio: synthesised ambience + SFX, music tracks from music/, device speech for callouts ---------- */
function makeAudio(store) {
  const A = { ctx: null, muted: store.get('muted', false), voice: store.get('voice', true), zone: 0, nextBird: 2, lastCollect: 0, lastSay: 0, ducked: false, paused: false, hidden: false, onCaption: null,
    vol: { music: store.get('vol.music', 0.7), sfx: store.get('vol.sfx', 0.8), voice: store.get('vol.voice', 1) } };
  const AMB = 0.6, SFX = 0.75;
  A.init = () => {
    if (A.ctx) { if (A.ctx.state !== 'running') A.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    const ctx = (A.ctx = new C());
    A.master = ctx.createGain(); A.master.gain.value = A.muted ? 0 : 0.9; A.master.connect(ctx.destination);
    A.amb = ctx.createGain(); A.amb.gain.value = AMB * A.vol.sfx; A.amb.connect(A.master);
    A.sfx = ctx.createGain(); A.sfx.gain.value = SFX * A.vol.sfx; A.sfx.connect(A.master);
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = nb.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    A.nb = nb;
    const loop = (type, f, q, g0) => {
      const s = ctx.createBufferSource(); s.buffer = nb; s.loop = true; s.loopStart = 0; s.loopEnd = 2;
      const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      const g = ctx.createGain(); g.gain.value = g0; s.connect(fl); fl.connect(g); g.connect(A.amb); s.start(0, Math.random() * 2);
      return { f: fl, g };
    };
    const lfo = (param, rate, depth) => { const o = ctx.createOscillator(); o.frequency.value = rate; const g = ctx.createGain(); g.gain.value = depth; o.connect(g); g.connect(param); o.start(); };
    A.wind = loop('lowpass', 420, 0.6, 0.32); lfo(A.wind.f.frequency, 0.06, 220); lfo(A.wind.g.gain, 0.045, 0.1);
    A.leaves = loop('bandpass', 3200, 0.8, 0.045); lfo(A.leaves.g.gain, 0.11, 0.025);
    A.water = loop('bandpass', 650, 0.45, 0); A.water2 = loop('highpass', 2600, 0.6, 0);
    A.rain = loop('bandpass', 4800, 0.6, 0); A.rainSet = (i) => { if (A.rain) A.rain.g.gain.value = 0.2 * i; };   // the hiss of rain in the town
    A.drone = ctx.createGain(); A.drone.gain.value = 0; A.drone.connect(A.amb);
    [55, 55.6, 82.4].forEach((f) => { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.connect(A.drone); o.start(); });
    A.setZone(A.zone, true);
  };
  const ramp = (p, v, t = 1.5) => { if (!A.ctx) return; const n = A.ctx.currentTime; p.cancelScheduledValues(n); p.setValueAtTime(p.value, n); p.linearRampToValueAtTime(v, n + t); };
  const MIX = { jungle: [0.045, 0, 0, 0, 0.32], river: [0.03, 0.2, 0.035, 0, 0.32], cave: [0, 0, 0, 0.05, 0.18], ice: [0, 0, 0.012, 0, 0.46], lava: [0, 0, 0, 0.085, 0.16], sky: [0.008, 0, 0, 0, 0.5], beach: [0.006, 0.17, 0.04, 0, 0.3], wayanad: [0.05, 0.04, 0, 0, 0.38] }; // leaves, water, hiss, drone, wind
  A.setZone = (z, now) => {
    A.zone = z; if (!A.ctx) return; const t = now ? 0.05 : 2.5, m = MIX[ZONES[z].kind] || MIX.jungle;
    ramp(A.leaves.g.gain, m[0], t); ramp(A.water.g.gain, m[1], t); ramp(A.water2.g.gain, m[2], t); ramp(A.drone.gain, m[3], t); ramp(A.wind.g.gain, m[4], t);
  };
  const out = () => A.sfx;
  const env = (g, t, a, peak, dec) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); };
  const pan = (dest, p) => { if (!A.ctx.createStereoPanner) return dest; const s = A.ctx.createStereoPanner(); s.pan.value = p; s.connect(dest); return s; };
  A.tone = (type, f0, f1, dur, peak, when = 0, dest = out(), att = 0.005) => {
    const ctx = A.ctx, t = ctx.currentTime + when, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + att + dur);
    env(g, t, att, peak, dur); o.connect(g); g.connect(dest); o.start(t); o.stop(t + att + dur + 0.05);
  };
  A.noise = (type, f0, f1, q, dur, peak, when = 0, dest = out(), att = 0.004) => {
    const ctx = A.ctx, t = ctx.currentTime + when, s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = A.nb; fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f0, t); if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + att + dur);
    env(g, t, att, peak, dur); s.connect(fl); fl.connect(g); g.connect(dest); s.start(t, Math.random() * 1.5); s.stop(t + att + dur + 0.05);
  };
  const ok = () => A.ctx && A.ctx.state === 'running';
  let stepSide = 1;
  A.step = (spd) => { if (!ok()) return; stepSide *= -1; const v = 0.1 + Math.min(0.08, spd * 0.003); const d = pan(out(), stepSide * 0.12); A.noise('lowpass', 300, 120, 0.7, 0.07, v, 0, d); A.tone('triangle', 640, 560, 0.035, 0.02, 0, d); };
  A.jump = () => { if (!ok()) return; A.noise('bandpass', 400, 1700, 1.2, 0.26, 0.12); A.tone('sawtooth', 220, 520, 0.18, 0.018); };
  A.land = () => { if (!ok()) return; A.noise('lowpass', 260, 90, 0.8, 0.14, 0.22); A.tone('triangle', 300, 180, 0.08, 0.04); };
  A.slide = () => { if (!ok()) return; A.noise('highpass', 1800, 900, 0.7, 0.5, 0.07, 0, out(), 0.03); };
  A.whoosh = (dir) => { if (!ok()) return; A.noise('bandpass', 900, 2200, 1.4, 0.13, 0.06, 0, pan(out(), dir * 0.5)); };
  let streak = 0;
  A.collect = () => {
    if (!ok()) return; const n = A.ctx.currentTime; if (n - A.lastCollect < 0.04) return;
    streak = n - A.lastCollect < 0.7 ? Math.min(streak + 1, 12) : 0; A.lastCollect = n;
    const f = 880 * Math.pow(2, [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28][streak] / 12);
    A.tone('sine', f, 0, 0.2, 0.07); A.tone('triangle', f * 2, 0, 0.08, 0.02);
  };
  A.power = () => { if (!ok()) return; [523, 659, 784, 1047].forEach((f, i) => A.tone('triangle', f, 0, 0.16, 0.06, i * 0.07)); };
  A.shieldBreak = () => { if (!ok()) return; A.noise('highpass', 3000, 1200, 0.5, 0.4, 0.12); A.tone('sine', 1400, 300, 0.4, 0.06); };
  A.splash = () => { if (!ok()) return; A.noise('bandpass', 1900, 650, 1.2, 0.22, 0.07); A.noise('highpass', 3000, 1800, 0.8, 0.12, 0.03, 0.04); A.tone('sine', 520, 260, 0.1, 0.02); };   // a foot in a puddle
  A.drip = () => { if (!ok() || A.lastDrip > A.ctx.currentTime - 0.22) return; A.lastDrip = A.ctx.currentTime; A.tone('sine', 1500 + Math.random() * 500, 900, 0.06, 0.012); };   // a drop from an awning, quietly
  A.bump = (kind, s) => {   // a knock in town: each kind of thing sounds different
    if (!ok()) return; const v = 0.12 + 0.2 * (s || 0.5);
    if (kind === 'vehicle') [0, 0.22].forEach((w) => { A.tone('square', 420, 0, 0.16, 0.05, w); A.tone('square', 530, 0, 0.16, 0.04, w); });   // peep peep
    else if (kind === 'pole') { A.tone('triangle', 880, 640, 0.35, 0.07); A.noise('highpass', 2500, 1500, 0.8, 0.12, 0.05); }
    else if (kind === 'person') { A.tone('triangle', 260, 170, 0.14, 0.06); A.noise('lowpass', 500, 200, 0.7, 0.08, 0.08); }
    else if (kind === 'stall') { A.noise('bandpass', 1000, 700, 2, 0.1, 0.12); A.noise('bandpass', 1300, 900, 2, 0.1, 0.1, 0.07); A.tone('triangle', 330, 250, 0.1, 0.03); }
    else if (kind === 'palm') { A.noise('highpass', 1500, 3200, 0.6, 0.35, 0.09); A.tone('triangle', 200, 120, 0.12, 0.05); }
    else if (kind === 'fence') { A.noise('highpass', 2500, 1800, 1.2, 0.25, 0.08); A.tone('triangle', 1200, 700, 0.2, 0.03); }
    else { A.noise('lowpass', 300, 90, 0.8, 0.14, v); A.tone('triangle', 240, 140, 0.09, 0.04); }
  };
  A.hit = () => { if (!ok()) return; A.noise('lowpass', 1400, 200, 0.8, 0.42, 0.35); A.tone('square', 140, 40, 0.38, 0.06); A.tone('triangle', 900, 300, 0.12, 0.05, 0.02); };
  A.over = () => { if (!ok()) return; A.tone('sawtooth', 420, 55, 1.3, 0.06, 0.1, out(), 0.02); A.noise('lowpass', 700, 80, 0.6, 1.0, 0.1, 0.05); };
  A.overSoft = () => { if (!ok()) return; [784, 659, 523].forEach((f, i) => A.tone('triangle', f, 0, 0.22, 0.05, i * 0.16)); };
  A.jet = () => { if (!ok()) return; A.noise('bandpass', 520, 380, 0.7, 0.1, 0.045); };
  A.clang = (v = 1) => { if (!ok()) return; [523, 1187, 1973, 2731].forEach((f, i) => A.tone(i % 2 ? 'square' : 'triangle', f, f * 0.97, 0.26 - i * 0.04, (0.05 * v) / (i + 1), 0, out(), 0.002)); A.noise('highpass', 3500, 1800, 0.8, 0.08, 0.08 * v); };
  A.crash = () => { if (!ok()) return; A.noise('lowpass', 2400, 300, 0.7, 0.5, 0.22); [880, 1320, 1760].forEach((f, i) => A.tone('triangle', f, f * 0.7, 0.18, 0.03, i * 0.05)); };
  A.boing = () => { if (!ok()) return; A.tone('sine', 220, 660, 0.22, 0.08); A.tone('sine', 660, 330, 0.2, 0.05, 0.16); };
  A.pop = () => { if (!ok()) return; A.tone('sine', 900, 1800, 0.06, 0.06); A.noise('bandpass', 2400, 1200, 1, 0.05, 0.04); };
  A.coin = () => { if (!ok()) return; A.tone('square', 1568, 0, 0.05, 0.022); A.tone('square', 2093, 0, 0.1, 0.022, 0.045); };
  A.warn = () => { if (!ok()) return; [0, 0.22, 0.44].forEach((w) => A.tone('square', 660, 640, 0.12, 0.04, w)); };
  A.slam = () => { if (!ok()) return; A.noise('lowpass', 600, 60, 0.7, 0.8, 0.4); A.tone('sine', 90, 35, 0.7, 0.25); };
  A.equip = () => { if (!ok()) return; [660, 990].forEach((f, i) => A.tone('triangle', f, 0, 0.1, 0.05, i * 0.06)); };
  A.zap = () => { if (!ok()) return; A.tone('sawtooth', 1400, 400, 0.12, 0.03); };
  A.bird = () => {
    const kind = (Math.random() * 3) | 0, base = rng(2200, 3800), n = 2 + ((Math.random() * 4) | 0), d = pan(A.amb, rng(-0.9, 0.9)), v = rng(0.012, 0.03);
    for (let i = 0; i < n; i++) {
      if (kind === 0) A.tone('sine', base, base * 1.45, 0.07, v, i * 0.11, d, 0.01);
      else if (kind === 1) A.tone('sine', base * 1.3, base * 0.85, 0.12, v, i * 0.22, d, 0.02);
      else A.tone('sine', base * (i % 2 ? 1.25 : 1), 0, 0.05, v, i * 0.07, d, 0.008);
    }
  };
  A.gull = () => { const f = rng(1500, 2100), d = pan(A.amb, rng(-0.9, 0.9)); [0, 0.2, 0.42].forEach((w, i) => A.tone('sine', f * (1.15 - i * 0.1), f * (0.8 - i * 0.08), 0.16, 0.02, w, d, 0.02)); };
  A.drip = () => { const f = rng(900, 1600), d = pan(A.amb, rng(-0.8, 0.8)); [0, 0.21, 0.42].forEach((w, i) => A.tone('sine', f, f * 0.45, 0.1, 0.035 / (i * 1.8 + 1), w, d, 0.004)); };
  A.splash = () => { A.noise('bandpass', 1200, 500, 0.9, 0.35, 0.025, 0, pan(A.amb, rng(-0.8, 0.8)), 0.04); };
  A.chime = () => { const f = rng(1800, 3200), d = pan(A.amb, rng(-0.8, 0.8)); A.tone('sine', f, 0, 0.6, 0.012, 0, d, 0.01); A.tone('sine', f * 1.5, 0, 0.4, 0.006, 0.05, d, 0.01); };
  A.crackle = () => { const d = pan(A.amb, rng(-0.9, 0.9)), n = 3 + ((Math.random() * 4) | 0); for (let i = 0; i < n; i++) A.noise('highpass', rng(2500, 5000), 0, 0.7, 0.02, rng(0.02, 0.05), i * rng(0.03, 0.09), d, 0.002); };
  A.tick = (dt) => {
    musicTick(dt);
    if (!ok()) return; A.nextBird -= dt;
    if (A.nextBird <= 0) {
      const k = ZONES[A.zone].kind;
      A.nextBird = k === 'cave' || k === 'lava' ? rng(0.8, 2.6) : k === 'sky' ? rng(3, 7) : rng(1.2, 4.2);
      if (k === 'cave') A.drip(); else if (k === 'lava') A.crackle(); else if (k === 'ice') A.chime();
      else if (k === 'beach') { if (Math.random() < 0.5) A.gull(); else A.splash(); }
      else { A.bird(); if (k === 'river' && Math.random() < 0.5) A.splash(); }
    }
  };
  A.duck = (on) => { if (!A.ctx || A.ducked === on) return; A.ducked = on; ramp(A.amb.gain, (on ? 0.18 : AMB) * A.vol.sfx, 0.25); ramp(A.sfx.gain, (on ? 0.5 : SFX) * A.vol.sfx, 0.25); };
  A.setVol = (k, v) => {
    A.vol[k] = clamp(v, 0, 1); store.set('vol.' + k, A.vol[k]);
    if (A.ctx && k === 'sfx') { ramp(A.amb.gain, (A.ducked ? 0.18 : AMB) * A.vol.sfx, 0.1); ramp(A.sfx.gain, (A.ducked ? 0.5 : SFX) * A.vol.sfx, 0.1); }
  };
  /* music: a looping track per zone plus a title theme, crossfaded. Files live in music/<key>.mp3; missing ones are skipped. */
  const MUS = {}; let want = null, unlocked = false;
  A.music = (key) => { want = key; };
  A.unlock = () => { unlocked = true; };
  A.musicFound = () => { let n = 0; for (const k in MUS) if (MUS[k].ok) n++; return n; };
  const track = (key) => {
    const el = new Audio(), m = { el, v: 0, ok: null, busy: false };
    el.loop = true; el.preload = 'auto'; el.volume = 0;
    el.addEventListener('canplay', () => { m.ok = true; }); el.addEventListener('error', () => { m.ok = false; });
    el.src = 'music/' + key + '.mp3'; MUS[key] = m; return m;
  };
  const musicTick = (dt) => {
    if (want && !MUS[want]) track(want);
    for (const k in MUS) {
      const m = MUS[k]; if (m.ok === false) continue;
      const on = k === want && unlocked && !A.muted && !A.paused && !A.hidden;
      m.v = approach(m.v, on ? A.vol.music * (A.ducked ? 0.35 : 1) : 0, dt / 1.2);
      if (m.v > 0.002) {
        m.el.volume = clamp(m.v, 0, 1);
        if (m.el.paused && !m.busy && m.ok) { m.busy = true; const p = m.el.play(); if (p && p.then) p.then(() => { m.busy = false; }, () => { m.busy = false; unlocked = false; }); else m.busy = false; }
      } else if (!m.el.paused) { m.el.pause(); if (k !== want) m.el.currentTime = 0; }
    }
  };
  const stopMusic = () => { for (const k in MUS) if (!MUS[k].el.paused) MUS[k].el.pause(); };
  let voices = [];
  const loadVoices = () => { if (window.speechSynthesis) voices = speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang)); };
  loadVoices(); if (window.speechSynthesis) speechSynthesis.onvoiceschanged = loadVoices;
  A.say = (text, force) => {
    const now = performance.now(); if (!force && now - A.lastSay < 1600) return; A.lastSay = now;
    if (A.onCaption) A.onCaption(text);
    if (A.muted || !A.voice || !window.speechSynthesis || A.vol.voice <= 0) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text); u.pitch = 0.2; u.rate = 1.05; u.volume = A.vol.voice; u.lang = 'en-GB';
    const v = voices.find((x) => /Google UK English Male|Daniel|Fred|Alex|Male/i.test(x.name)) || voices[0]; if (v) u.voice = v;
    u.onstart = () => A.duck(true); u.onend = u.onerror = () => A.duck(false);
    speechSynthesis.speak(u);
  };
  A.setMuted = (m) => { A.muted = m; store.set('muted', m); if (A.ctx) ramp(A.master.gain, m ? 0 : 0.9, 0.15); if (m && window.speechSynthesis) speechSynthesis.cancel(); };
  A.setVoice = (v) => { A.voice = v; store.set('voice', v); if (!v && window.speechSynthesis) speechSynthesis.cancel(); };
  A.suspend = () => { A.paused = true; stopMusic(); if (A.ctx && A.ctx.state === 'running') A.ctx.suspend(); if (window.speechSynthesis) speechSynthesis.cancel(); A.duck(false); };
  A.resume = () => { A.paused = false; if (A.ctx && A.ctx.state !== 'running') A.ctx.resume(); };
  A.hide = (h) => { A.hidden = h; if (h) stopMusic(); };
  A.close = () => { stopMusic(); if (window.speechSynthesis) speechSynthesis.cancel(); if (A.ctx) A.ctx.close(); };
  return A;
}

/* ---------- main ---------- */
function create(container, opts) {
  const THREE = window.THREE;
  const onHud = opts.onHud || function () {};
  const touch = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window;
  const DEFAULT_KEYS = { left: ['ArrowLeft', 'a'], right: ['ArrowRight', 'd'], jump: ['ArrowUp', 'w', ' '], slide: ['ArrowDown', 's'], pause: ['p', 'Escape'], attackL: ['q', 'j'], attackR: ['e', 'k'] };
  const opt = { quality: opts.quality || 'Auto', difficulty: opts.difficulty || 'Moderate', assist: !!opts.assist, unlimited: !!opts.unlimited, reduceMotion: !!opts.reduceMotion, scheme: opts.scheme || 'standard', keymap: Object.assign({}, DEFAULT_KEYS, opts.keymap || {}), startZone: opts.startZone || 0, combat: opts.combat !== false, world: opts.world || 'classic', umbrella: !!opts.umbrella, pack: opts.pack || null, post: opts.post !== false };
  ZONES = WORLDS[opt.world] || CLASSIC_ZONES;
  const onPad = opts.onPad || function () {}, onRunEnd = opts.onRunEnd || function () {}, onFood = opts.onFood || function () {}, onHerb = opts.onHerb || function () {}, onShop = opts.onShop || function () {}, onExploreExit = opts.onExploreExit || function () {}, onMenu = opts.onMenu || function () {}, onScrap = opts.onScrap || function () { return true; }, onCharge = opts.onCharge || function () {}, onBattery = opts.onBattery || function () {}, onRideEnd = opts.onRideEnd || function () {}, onWeather = opts.onWeather || function () {}, onStory = opts.onStory || function () {};
  const store = {
    get(k, d) { try { const v = localStorage.getItem('runaway.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('runaway.' + k, JSON.stringify(v)); } catch (e) {} }
  };
  const bestKey = () => (opt.assist ? 'best.kids' : 'best');
  let best = store.get(bestKey(), 0);
  let autoQ = store.get('autoQ', null) || (((navigator.deviceMemory && navigator.deviceMemory <= 4) || (touch && (navigator.hardwareConcurrency || 8) <= 4)) ? 'Low' : 'High');
  const effQ = () => (opt.quality === 'Auto' ? autoQ : opt.quality);
  let inTown = false;   /* true while walking the town (set when it opens and closes): the pixel ratio differs there */
  let exSlow = store.get('exSlow', false);   /* the town ran slowly on this device: draw it at the device's plain resolution (set by the frame-rate watch in explore, kept between visits) */
  const audio = makeAudio(store);
  const weather = window.RoboWeather ? window.RoboWeather.create() : null;   // showers in the town
  const clock = window.RoboClock ? window.RoboClock.create({ hours: store.get('clockH', 16.5) }) : null;   // the game clock: it runs in the town and on the road, and is remembered
  let clockSave = 5;

  /* renderer + scene */
  if (window.RoboBend) window.RoboBend.install(THREE);   // must run before the first material compiles: bends the whole world in the Wayanad zones
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  /* post-processing, High quality only: the scene renders off-screen (this three.js version still tone-maps inside the materials), bright things bloom,
     and one final pass grades, adds a soft vignette and converts to sRGB. Any failure here quietly falls back to the plain renderer. */
  const FINAL = {
    uniforms: { tDiffuse: { value: null }, uExposure: { value: 1 }, uVig: { value: 0.3 }, uGrade: { value: new THREE.Vector3(1.03, 1.0, 0.97) } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: [
      'uniform sampler2D tDiffuse; uniform float uExposure; uniform float uVig; uniform vec3 uGrade; varying vec2 vUv;',
      'vec3 fit(vec3 v) { vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }',
      'vec3 aces(vec3 c) { const mat3 mi = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777)); const mat3 mo = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602)); c *= uExposure / 0.6; c = mi * c; c = fit(c); c = mo * c; return clamp(c, 0.0, 1.0); }',
      'vec3 srgb(vec3 c) { return mix(c * 12.92, pow(c, vec3(1.0 / 2.4)) * 1.055 - 0.055, step(vec3(0.0031308), c)); }',
      'void main() { vec3 c = clamp(texture2D(tDiffuse, vUv).rgb * uGrade, 0.0, 1.0); c = srgb(c); c *= 1.0 - uVig * smoothstep(0.38, 0.9, distance(vUv, vec2(0.5))); gl_FragColor = vec4(c, 1.0); }'
    ].join('\n')
  };
  let composer = null, postFailed = false, bloomPass = null;
  const usePost = () => !postFailed && opt.post !== false && effQ() === 'High' && !!(THREE.EffectComposer && THREE.UnrealBloomPass);
  const ensureComposer = () => {
    if (composer) return composer;
    try {
      const sz = renderer.getSize(new THREE.Vector2()), rt = new THREE.WebGLRenderTarget(sz.x, sz.y, { type: THREE.HalfFloatType, samples: 4 });
      composer = new THREE.EffectComposer(renderer, rt); composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(sz.x, sz.y);
      composer.addPass(new THREE.RenderPass(scene, camera));
      bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(sz.x, sz.y), 0.35, 0.5, 0.88); composer.addPass(bloomPass);   // strength, radius, threshold: only the brightest things (sun, lamps, glowing pickups) bloom
      const fin = new THREE.ShaderPass(new THREE.ShaderMaterial(FINAL)); composer.addPass(fin);
    } catch (e) { console.warn('[robo] post-processing unavailable, using the plain renderer', e); postFailed = true; composer = null; }
    return composer;
  };
  const setPR = () => renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, inTown && opt.quality === 'Auto' && exSlow ? 1.25 : inTown ? 2 : effQ() === 'High' ? 2 : 1.5));   /* the town is drawn sharp (up to 2 pixels to a CSS pixel: text and fine detail need it); only a device that cannot keep up drops to 1.25 */
  setPR();
  const cv = renderer.domElement;
  cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;outline:none;';
  container.appendChild(cv);
  const flashEl = document.createElement('div');
  flashEl.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0;box-shadow:inset 0 0 180px 50px rgba(255,64,32,.85);';
  container.appendChild(flashEl);

  const scene = new THREE.Scene();
  const fog = new THREE.FogExp2(ZONES[0].fog, ZONES[0].density); scene.fog = fog;
  scene.background = fog.color;
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 260);

  // environment map for metal reflections
  {
    const pm = new THREE.PMREMGenerator(renderer), es = new THREE.Scene();
    const g = new THREE.SphereGeometry(50, 32, 16), p = g.attributes.position, cols = [];
    const lo = new THREE.Color(0x2b3322), hi = new THREE.Color(0xe4ecd6), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) { c.copy(lo).lerp(hi, clamp((p.getY(i) / 50 + 0.2) / 1.2, 0, 1)); cols.push(c.r, c.g, c.b); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    es.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    const panel = (x, y, z, s, k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })); m.material.color.setRGB(k, k * 0.95, k * 0.85); m.position.set(x, y, z); m.lookAt(0, 0, 0); es.add(m); };
    panel(20, 30, 10, 18, 6); panel(-30, 15, -20, 14, 1.6); panel(10, 8, -40, 20, 1.2);
    scene.environment = pm.fromScene(es, 0.04).texture;
    pm.dispose();
  }

  const hemi = new THREE.HemisphereLight(ZONES[0].sky, ZONES[0].ground, ZONES[0].hemi); scene.add(hemi);
  const sun = new THREE.DirectionalLight(ZONES[0].sunColor, ZONES[0].sun);
  sun.castShadow = true;
  const setShadowSize = () => { const s = effQ() === 'High' ? 2048 : 1024; sun.shadow.mapSize.set(s, s); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } };
  setShadowSize();
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  /* textures */
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const mkTex = (size, draw) => { const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding; t.anisotropy = aniso; return t; };
  const stoneTex = mkTex(512, (x, s) => {
    x.fillStyle = '#3a372f'; x.fillRect(0, 0, s, s);
    const rows = 6, h = s / rows;
    for (let r = 0; r < rows; r++) {
      let cx = rng(-80, 0);
      while (cx < s) {
        const w = rng(90, 190); x.fillStyle = `hsl(${rng(35, 52)},${rng(5, 14)}%,${rng(36, 55)}%)`;
        for (const off of [0, s, -s]) x.fillRect(cx + off + 3, r * h + 3, w - 6, h - 6);
        cx += w;
      }
    }
    for (let i = 0; i < 6000; i++) { x.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,.09)' : 'rgba(255,250,235,.06)'; x.fillRect(Math.random() * s, Math.random() * s, rng(1, 4), rng(1, 4)); }
    for (let i = 0; i < 70; i++) { x.fillStyle = `hsla(${rng(70, 105)},${rng(25, 45)}%,${rng(16, 28)}%,${rng(0.12, 0.35)})`; x.beginPath(); x.ellipse(Math.random() * s, Math.random() * s, rng(6, 40), rng(4, 18), Math.random() * PI, 0, PI * 2); x.fill(); }
    x.strokeStyle = 'rgba(20,18,14,.5)'; x.lineWidth = 1.5;
    for (let i = 0; i < 14; i++) { x.beginPath(); let px = Math.random() * s, py = Math.random() * s; x.moveTo(px, py); for (let j = 0; j < 5; j++) { px += rng(-18, 18); py += rng(-18, 18); x.lineTo(px, py); } x.stroke(); }
  });
  const leafTex = mkTex(512, (x, s) => {
    x.fillStyle = '#26271a'; x.fillRect(0, 0, s, s);
    for (let i = 0; i < 1600; i++) { const r = rng(2, 10); x.fillStyle = `hsla(${rng(25, 95)},${rng(20, 45)}%,${rng(9, 24)}%,${rng(0.5, 0.9)})`; x.beginPath(); x.ellipse(Math.random() * s, Math.random() * s, r, r * rng(0.3, 0.7), Math.random() * PI, 0, PI * 2); x.fill(); }
  });
  const rep = (t, u, v) => { const c = t.clone(); c.needsUpdate = true; c.repeat.set(u, v); return c; };

  /* materials */
  const MATS = [];
  const std = (o, minEnv) => { const m = new THREE.MeshStandardMaterial(o); m.userData.env = m.envMapIntensity; m.userData.minEnv = minEnv || 0; MATS.push(m); return m; };
  const trackTex = rep(stoneTex, 2, TRACK_L / 4.6), floorTex = rep(leafTex, 20, TRACK_L / 9), sTex = rep(stoneTex, 1, 1), curbTex = rep(stoneTex, 0.4, 0.4);
  const M = {
    track: std({ map: trackTex, bumpMap: trackTex, bumpScale: 0.035, roughness: 0.9 }),
    floor: std({ map: floorTex, roughness: 1 }),
    stone: std({ map: sTex, bumpMap: sTex, bumpScale: 0.03, roughness: 0.92, color: 0xd8d2c4 }),
    curb: std({ map: curbTex, roughness: 0.92, color: 0xcfc8b8 }),
    bark: std({ color: 0x4a3a2a, roughness: 1 }),
    leaf: [0x2f5a22, 0x3d6b2a, 0x24461b, 0x4a7a2f].map((c) => std({ color: c, roughness: 0.85, flatShading: true })),
    fern: std({ color: 0x5b8a2e, roughness: 0.8, flatShading: true, side: THREE.DoubleSide }),
    rock: std({ color: 0x5f5c55, roughness: 0.95, flatShading: true }),
    caveRock: std({ color: 0x38342f, roughness: 0.9, flatShading: true }),
    crystal: [0x2fd9ff, 0xb06bff, 0x5fffc0].map((c) => std({ color: 0x0b2a33, emissive: c, emissiveIntensity: 1.6, roughness: 0.2, metalness: 0.1, flatShading: true })),
    water: std({ color: 0x173330, roughness: 0.12, metalness: 0.1, envMapIntensity: 0.55 }),
    reed: std({ color: 0x6b7d3a, roughness: 0.9 }),
    lava: std({ color: 0x220802, emissive: 0xff5410, emissiveIntensity: 1.25, roughness: 0.55 }),
    lavaPool: std({ color: 0x120402, emissive: 0xff4a0a, emissiveIntensity: 0.5, roughness: 0.6 }),
    voidM: std({ color: 0x4f6a8e, roughness: 1 }),
    ice: std({ color: 0xcfe6ff, roughness: 0.18, metalness: 0.1, emissive: 0x0a1826, flatShading: true }),
    snow: std({ color: 0xf2f6fb, roughness: 0.95, flatShading: true }),
    shard: std({ color: 0x9fdcff, emissive: 0x6fc8ff, emissiveIntensity: 0.6, roughness: 0.1, metalness: 0.1, flatShading: true }),
    ember: std({ color: 0x2a0800, emissive: 0xff7a1a, emissiveIntensity: 1.8, roughness: 0.4, flatShading: true }),
    cloud: std({ color: 0xffffff, emissive: 0x8796a8, roughness: 1, flatShading: true }),
    rune: std({ color: 0x1a1206, emissive: 0xf2a33a, emissiveIntensity: 1.4, roughness: 0.4 }),
    lane: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.16, depthWrite: false })
  };

  /* geometry helpers */
  const mergeGeos = (parts) => {
    const ps = parts.map((g) => (g.index ? g.toNonIndexed() : g)); let n = 0; ps.forEach((g) => (n += g.attributes.position.count));
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
    ps.forEach((g) => { if (!g.attributes.normal) g.computeVertexNormals(); pos.set(g.attributes.position.array, o); nor.set(g.attributes.normal.array, o); o += g.attributes.position.count * 3; });
    const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); return out;
  };
  const rockGeo = (r, detail, k, squash = 0.8) => {
    const g = new THREE.IcosahedronGeometry(1, detail), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const d = 1 + 0.22 * Math.sin(x * 3.1 + k) * Math.cos(y * 2.7 + k * 1.3) + 0.12 * Math.sin(z * 5.3 + x * 2.1 + k * 0.7); p.setXYZ(i, x * d * r, y * d * r * squash, z * d * r); }
    g.computeVertexNormals(); return g;
  };
  const treeGeo = () => {
    const h = rng(7, 12), trunk = new THREE.CylinderGeometry(0.22, 0.5, h, 7, 4), tp = trunk.attributes.position, bend = rng(-0.7, 0.7);
    for (let i = 0; i < tp.count; i++) { const y = tp.getY(i) + h / 2; tp.setX(i, tp.getX(i) + bend * Math.pow(y / h, 2)); }
    trunk.translate(0, h / 2, 0); trunk.computeVertexNormals();
    const parts = [], n = 5 + ((Math.random() * 3) | 0);
    for (let i = 0; i < n; i++) { const g = new THREE.IcosahedronGeometry(rng(1.4, 2.6), 1), a = Math.random() * PI * 2, d = i === 0 ? 0 : rng(1, 2.3); g.scale(1, rng(0.55, 0.8), 1); g.translate(Math.cos(a) * d + bend, h + rng(-1.3, 0.8), Math.sin(a) * d); parts.push(g); }
    return { trunk, leaves: mergeGeos(parts) };
  };
  const TREES = Array.from({ length: 6 }, treeGeo);
  const BUSH = Array.from({ length: 3 }, () => mergeGeos(Array.from({ length: 4 }, () => { const g = new THREE.IcosahedronGeometry(rng(0.5, 0.9), 1); g.scale(1, 0.7, 1); g.translate(rng(-0.7, 0.7), rng(0.3, 0.6), rng(-0.7, 0.7)); return g; })));
  const FERN = mergeGeos(Array.from({ length: 9 }, (_, i) => new THREE.ConeGeometry(0.12, 1.4, 4).translate(0, 0.7, 0).rotateZ(rng(0.6, 1.1)).rotateY((i / 9) * PI * 2)));
  const REEDS = mergeGeos(Array.from({ length: 14 }, () => { const h = rng(0.8, 2); return new THREE.CylinderGeometry(0.015, 0.035, h, 4).translate(rng(-0.8, 0.8), h / 2, rng(-1.5, 1.5)); }));
  const CRYSTAL = mergeGeos(Array.from({ length: 4 }, () => new THREE.OctahedronGeometry(0.3, 0).scale(1, rng(2.2, 3.6), 1).rotateZ(rng(-0.5, 0.5)).rotateX(rng(-0.4, 0.4)).translate(rng(-0.4, 0.4), 0.5, rng(-0.4, 0.4))));
  const STAL = mergeGeos([0, 1, 2].map(() => new THREE.ConeGeometry(rng(0.3, 0.6), rng(2, 4), 6).rotateX(PI).translate(rng(-0.8, 0.8), 0, rng(-0.8, 0.8))));
  const ROCKS = [0, 1, 2].map((k) => rockGeo(1, 1, k * 2.1));
  const PILLAR = new THREE.CylinderGeometry(0.5, 0.56, 4, 14).translate(0, 2, 0);
  const WALL = new THREE.BoxGeometry(3.2, 2.4, 0.9).translate(0, 1.2, 0);
  const WALL_TOP = new THREE.BoxGeometry(1.6, 0.8, 0.9).translate(-0.6, 2.8, 0);
  const WATER = new THREE.PlaneGeometry(42, 5.2).rotateX(-PI / 2);
  const PEAK = new THREE.ConeGeometry(1, 1.6, 7).translate(0, 0.8, 0);

  /* ground: track + jungle floor follow the player; textures offset so tiles stay fixed in the world */
  const track = new THREE.Mesh(new THREE.PlaneGeometry(9.2, TRACK_L, 1, 80), M.track); track.rotation.x = -PI / 2; track.receiveShadow = true;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(180, TRACK_L, 1, 80), M.floor); floor.rotation.x = -PI / 2; floor.position.y = -0.03; floor.receiveShadow = true;
  const laneLines = [-1, 1].map((s) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.07, TRACK_L, 1, 80), M.lane); m.rotation.x = -PI / 2; m.position.set(s * LANE / 2, 0.006, 0); return m; });
  scene.add(track, floor, ...laneLines);
  const CURB_N = 64, CURB_LEN = 2.3;
  const curbs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 0.4, CURB_LEN - 0.08), M.curb, CURB_N * 2);
  curbs.receiveShadow = true; curbs.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(curbs);
  const curbZ = new Float32Array(CURB_N * 2), dummy = new THREE.Object3D();
  const setCurb = (i) => { dummy.position.set((i < CURB_N ? -1 : 1) * 4.95, 0.2 + rng(-0.04, 0.03), curbZ[i]); dummy.rotation.set(0, rng(-0.02, 0.02), rng(-0.02, 0.02)); dummy.scale.set(1, rng(0.85, 1.15), 1); dummy.updateMatrix(); curbs.setMatrixAt(i, dummy.matrix); };

  /* side decoration slots (recycled ahead of the player, styled by zone) */
  const SLOT_N = 28, SLOT_GAP = 5, slots = [];
  const mesh = (geo, mat, parent, cast) => { const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; m.castShadow = !!cast; m.visible = false; parent.add(m); return m; };
  const treeObj = (parent, leafMat) => { const t = TREES[(Math.random() * TREES.length) | 0], g = new THREE.Group(); g.add(new THREE.Mesh(t.trunk, M.bark), new THREE.Mesh(t.leaves, leafMat || M.leaf[(Math.random() * 4) | 0])); g.visible = false; parent.add(g); return g; };
  for (const side of [-1, 1]) for (let i = 0; i < SLOT_N; i++) {
    const g = new THREE.Group(); scene.add(g);
    const wall = new THREE.Group(); wall.add(new THREE.Mesh(WALL, M.stone), new THREE.Mesh(WALL_TOP, M.stone)); wall.visible = false; g.add(wall);
    slots.push({ g, side, z: 0, items: {
      bush: mesh(BUSH[i % 3], M.leaf[i % 4], g), fern: mesh(FERN, M.fern, g), pillar: mesh(PILLAR, M.stone, g), wall,
      reeds: mesh(REEDS, M.reed, g), rock: mesh(ROCKS[i % 3], M.rock, g), rockwall: mesh(ROCKS[(i + 1) % 3], M.caveRock, g),
      crystal: mesh(CRYSTAL, M.crystal[i % 3], g), stal: mesh(STAL, M.caveRock, g), treeA: treeObj(g), treeB: treeObj(g), water: mesh(WATER, M.water, g),
      icePillar: mesh(PILLAR, M.ice, g), snowBush: mesh(BUSH[i % 3], M.snow, g), shard: mesh(CRYSTAL, M.shard, g), snowTree: treeObj(g, M.snow),
      lavaPool: mesh(WATER, M.lavaPool, g), basalt: mesh(PILLAR, M.caveRock, g), darkRock: mesh(ROCKS[(i + 2) % 3], M.caveRock, g), ember: mesh(CRYSTAL, M.ember, g), peak: mesh(PEAK, M.caveRock, g),
      cloud: mesh(BUSH[(i + 1) % 3], M.cloud, g), cloud2: mesh(BUSH[(i + 2) % 3], M.cloud, g)
    } });
  }
  /* optional Malabar world: adds its own scenery items to every slot and takes over zones of its kinds */
  const MAL = MAL_W ? MAL_W.init({ THREE, scene, renderer, M, std, mkTex, rng, lerp, clamp, PI, TRACK_L, effQ, geo: { BUSH, FERN, ROCKS } }) : null;
  if (MAL) slots.forEach((sl, i) => Object.assign(sl.items, MAL.slotItems(sl.g, i)));
  const fxK = {};
  const placeItem = (it, side, x, y, s, sy) => { it.visible = true; it.position.set(side * x, y, rng(-1.5, 1.5)); it.rotation.set(0, Math.random() * PI * 2, 0); it.scale.set(s, sy || s, s); return it; };
  const decorate = (sl) => {
    const I = sl.items, sd = sl.side, z = zoneAt(-sl.z), lowQ = effQ() !== 'High';
    for (const k in I) I[k].visible = false;
    sl.g.position.set(0, 0, sl.z);
    const r = Math.random();
    const kind = ZONES[z].kind;
    if (kind === 'jungle') {
      if (r < 0.5) placeItem(I.bush, sd, rng(6.2, 8.5), 0, rng(0.8, 1.6));
      else if (r < 0.68) { const p = placeItem(I.pillar, sd, rng(6.5, 9), 0, rng(0.9, 1.1), rng(0.5, 1.6)); p.rotation.z = rng(-0.08, 0.08); }
      else if (r < 0.8) { const w = placeItem(I.wall, sd, rng(7, 10), 0, rng(0.8, 1.2)); w.rotation.y = rng(-0.3, 0.3) + PI / 2; }
      if (Math.random() < 0.45) placeItem(I.fern, sd, rng(5.6, 6.6), 0, rng(0.7, 1.2));
      if (Math.random() < 0.75) placeItem(I.treeA, sd, rng(9.5, 15), 0, rng(0.8, 1.25));
      if (Math.random() < (lowQ ? 0.25 : 0.55)) placeItem(I.treeB, sd, rng(17, 28), 0, rng(0.9, 1.4));
    } else if (kind === 'river') {
      I.water.visible = true; I.water.position.set(sd * (5.35 + 21), 0.04, 0); I.water.rotation.set(0, 0, 0); I.water.scale.set(1, 1, 1);
      if (r < 0.55) placeItem(I.reeds, sd, rng(5.8, 7.5), 0, rng(0.8, 1.3));
      else if (r < 0.75) placeItem(I.rock, sd, rng(8, 18), -0.3, rng(0.7, 1.6));
      else if (r < 0.85) { const p = placeItem(I.pillar, sd, rng(9, 18), -0.4, 1, rng(0.4, 1.2)); p.rotation.z = rng(-0.25, 0.25); }
      if (Math.random() < 0.35) placeItem(I.treeA, sd, rng(16, 26), -0.2, rng(0.9, 1.3));
      if (Math.random() < (lowQ ? 0.15 : 0.35)) placeItem(I.treeB, sd, rng(24, 34), -0.2, rng(1, 1.4));
    } else if (kind === 'cave') {
      const w = placeItem(I.rockwall, sd, rng(7.4, 8.6), rng(0.5, 1.8), rng(2.4, 3.4)); w.scale.y = rng(2.5, 5);
      if (r < 0.45) placeItem(I.crystal, sd, rng(5.7, 6.4), 0, rng(0.7, 1.4));
      if (Math.random() < 0.3) { const s = placeItem(I.stal, sd, rng(0.5, 5), rng(7, 9), rng(0.8, 1.4)); s.position.y = rng(7.5, 9.5); }
    } else if (kind === 'ice') {
      if (r < 0.4) placeItem(I.snowBush, sd, rng(6.2, 8.5), -0.1, rng(0.9, 1.7));
      else if (r < 0.66) { const p = placeItem(I.icePillar, sd, rng(6.5, 9), 0, rng(0.9, 1.15), rng(0.6, 1.7)); p.rotation.z = rng(-0.1, 0.1); }
      else if (r < 0.8) { const w = placeItem(I.wall, sd, rng(7, 10), 0, rng(0.8, 1.2)); w.rotation.y = rng(-0.3, 0.3) + PI / 2; }
      if (Math.random() < 0.45) placeItem(I.shard, sd, rng(5.7, 6.6), 0, rng(0.8, 1.5));
      if (Math.random() < (lowQ ? 0.4 : 0.75)) placeItem(I.snowTree, sd, rng(9.5, 18), 0, rng(0.8, 1.3));
    } else if (kind === 'lava') {
      I.lavaPool.visible = true; I.lavaPool.position.set(sd * (5.35 + 21), 0.03, 0); I.lavaPool.rotation.set(0, 0, 0); I.lavaPool.scale.set(1, 1, 1);
      if (r < 0.45) placeItem(I.darkRock, sd, rng(6.5, 12), -0.2, rng(0.8, 1.8));
      else if (r < 0.7) { const p = placeItem(I.basalt, sd, rng(7, 12), -0.2, rng(0.9, 1.2), rng(0.4, 1.4)); p.rotation.z = rng(-0.12, 0.12); }
      if (Math.random() < 0.4) placeItem(I.ember, sd, rng(5.7, 6.5), 0, rng(0.6, 1.2));
      if (Math.random() < (lowQ ? 0.12 : 0.3)) placeItem(I.peak, sd, rng(32, 60), -0.5, rng(9, 16));
    } else if (MAL && MAL.kinds.includes(kind)) {
      MAL.decorate(sl, sd, placeItem, lowQ, kind);
    } else {
      if (r < 0.42) { const p = placeItem(I.pillar, sd, rng(6.5, 9), 0, rng(0.9, 1.1), rng(0.7, 2.2)); p.rotation.z = rng(-0.06, 0.06); }
      else if (r < 0.62) { const w = placeItem(I.wall, sd, rng(7, 10), 0, rng(0.8, 1.2)); w.rotation.y = rng(-0.3, 0.3) + PI / 2; }
      if (Math.random() < 0.7) placeItem(I.cloud, sd, rng(10, 22), rng(-1.4, -0.4), rng(3, 6), rng(1.5, 3));
      if (Math.random() < (lowQ ? 0.25 : 0.5)) placeItem(I.cloud2, sd, rng(24, 40), rng(-2, 0), rng(5, 9), rng(2, 4));
    }
  };

  /* temple gates over the track */
  const gates = [];
  for (let i = 0; i < 4; i++) {
    const g = new THREE.Group();
    [-1, 1].forEach((s) => { const p = new THREE.Mesh(new THREE.BoxGeometry(1.2, 7.2, 1.2).translate(0, 3.6, 0), M.stone); p.position.x = s * 5.9; p.receiveShadow = true; g.add(p); });
    const l = new THREE.Mesh(new THREE.BoxGeometry(14, 1.2, 1.5), M.stone); l.position.y = 7.7; g.add(l);
    g.add(new THREE.Mesh(mergeGeos(Array.from({ length: 16 }, () => { const h = rng(0.8, 3.2); return new THREE.CylinderGeometry(0.03, 0.05, h, 4).translate(rng(-6.5, 6.5), 7.1 - h / 2, rng(-0.6, 0.6)); })), M.leaf[2]));
    scene.add(g); gates.push({ g, z: 0 });
  }
  const placeGate = (gt, z) => { gt.z = z; gt.g.position.set(0, 0, z); gt.g.visible = !!ZONES[zoneAt(-z)].gates && -z > 30; };

  /* robot (jointed rig: pelvis → torso → head/arms; hips → knees → ankles) */
  const R = (() => {
    const mBody = std({ color: 0xd8d4cb, metalness: 0.7, roughness: 0.32 }, 0.6);
    const mDark = std({ color: 0x2a2e33, metalness: 0.85, roughness: 0.38 }, 0.6);
    const mAcc = std({ color: 0xe0612a, metalness: 0.35, roughness: 0.42 }, 0.6);
    const mGlow = std({ color: 0x0a1a20, emissive: 0x46e0ff, emissiveIntensity: 2.4, roughness: 0.3 });
    const robotMeshes = [];   // every robot body part, so a human character can hide them
    const mk = (geo, mat, x, y, z, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); robotMeshes.push(m); return m; };
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const pelvis = new THREE.Group(); pelvis.position.y = 1.4; body.add(pelvis);
    mk(new THREE.BoxGeometry(0.62, 0.26, 0.36), mDark, 0, 0, 0, pelvis);
    mk(new THREE.BoxGeometry(0.52, 0.08, 0.4), mAcc, 0, 0.14, 0, pelvis);
    const torso = new THREE.Group(); torso.position.y = 0.15; pelvis.add(torso);
    mk(new THREE.CylinderGeometry(0.17, 0.22, 0.32, 12), mDark, 0, 0.18, 0, torso);
    mk(new THREE.BoxGeometry(0.82, 0.6, 0.48), mBody, 0, 0.62, 0, torso);
    mk(new THREE.BoxGeometry(0.5, 0.3, 0.06), mAcc, 0, 0.66, -0.25, torso);
    mk(new THREE.CylinderGeometry(0.075, 0.075, 0.04, 16).rotateX(PI / 2), mGlow, 0, 0.66, -0.29, torso);
    mk(new THREE.BoxGeometry(0.52, 0.5, 0.22), mDark, 0, 0.6, 0.34, torso);
    [-1, 1].forEach((s) => mk(new THREE.CylinderGeometry(0.06, 0.06, 0.42, 10), mGlow, s * 0.14, 0.6, 0.46, torso));
    mk(new THREE.CylinderGeometry(0.08, 0.1, 0.16, 10), mDark, 0, 0.98, 0, torso);
    const head = new THREE.Group(); head.position.y = 1.05; torso.add(head);
    mk(new THREE.BoxGeometry(0.5, 0.4, 0.46), mBody, 0, 0.2, 0, head);
    const visor = mk(new THREE.BoxGeometry(0.42, 0.13, 0.05), mGlow, 0, 0.22, -0.235, head);
    mk(new THREE.BoxGeometry(0.46, 0.05, 0.05), mDark, 0, 0.31, -0.235, head);
    [-1, 1].forEach((s) => mk(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 14).rotateZ(PI / 2), mAcc, s * 0.27, 0.2, 0, head));
    mk(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 6), mDark, 0.14, 0.52, 0.08, head);
    mk(new THREE.SphereGeometry(0.035, 10, 8), mGlow, 0.14, 0.68, 0.08, head);
    const lamp = new THREE.SpotLight(0xd6ecff, 0, 40, 0.55, 0.6, 1.4); lamp.position.set(0, 0.22, -0.3);
    const lampT = new THREE.Object3D(); lampT.position.set(0, -1.6, -9); head.add(lamp, lampT); lamp.target = lampT;
    const J = { root, body, pelvis, torso, head, visor, lamp, mGlow, mBody, mDark, mAcc, robotMeshes, sh: [], el: [], hip: [], knee: [], ank: [], parts: [] };
    [-1, 1].forEach((s) => {
      const sh = new THREE.Group(); sh.position.set(s * 0.5, 0.82, 0); torso.add(sh);
      mk(new THREE.SphereGeometry(0.16, 14, 10), mAcc, 0, 0, 0, sh);
      mk(new THREE.CylinderGeometry(0.09, 0.08, 0.42, 10), mBody, 0, -0.25, 0, sh);
      const el = new THREE.Group(); el.position.y = -0.48; sh.add(el);
      mk(new THREE.SphereGeometry(0.09, 12, 8), mDark, 0, 0, 0, el);
      mk(new THREE.CylinderGeometry(0.085, 0.07, 0.38, 10), mBody, 0, -0.2, 0, el);
      mk(new THREE.BoxGeometry(0.15, 0.16, 0.14), mDark, 0, -0.44, 0, el);
      const hip = new THREE.Group(); hip.position.set(s * 0.19, -0.1, 0); pelvis.add(hip);
      mk(new THREE.SphereGeometry(0.13, 12, 10), mDark, 0, 0, 0, hip);
      mk(new THREE.CylinderGeometry(0.13, 0.1, 0.56, 12), mBody, 0, -0.3, 0, hip);
      mk(new THREE.BoxGeometry(0.2, 0.3, 0.05), mAcc, 0, -0.26, -0.12, hip);
      const knee = new THREE.Group(); knee.position.y = -0.6; hip.add(knee);
      mk(new THREE.SphereGeometry(0.11, 12, 8), mDark, 0, 0, 0, knee);
      mk(new THREE.CylinderGeometry(0.1, 0.075, 0.54, 12), mBody, 0, -0.29, 0, knee);
      mk(new THREE.BoxGeometry(0.16, 0.2, 0.05), mDark, 0, -0.18, -0.1, knee);
      const ank = new THREE.Group(); ank.position.y = -0.6; knee.add(ank);
      mk(new THREE.BoxGeometry(0.2, 0.1, 0.38), mDark, 0, -0.06, -0.07, ank);
      mk(new THREE.BoxGeometry(0.21, 0.04, 0.4), mAcc, 0, -0.11, -0.07, ank);
      J.sh.push(sh); J.el.push(el); J.hip.push(hip); J.knee.push(knee); J.ank.push(ank);
    });
    const shield = new THREE.Mesh(new THREE.SphereGeometry(1.75, 32, 20), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
      uniforms: { uCol: { value: new THREE.Color(0x58b8ff) }, uT: { value: 0 } },
      vertexShader: 'varying vec3 vN; varying vec3 vV; varying float vY; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vY = position.y; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 uCol; uniform float uT; varying vec3 vN; varying vec3 vV; varying float vY; void main(){ float r = pow(1.0 - abs(dot(vN, vV)), 2.6); float band = 0.5 + 0.5 * sin(vY * 9.0 - uT * 5.0); gl_FragColor = vec4(uCol * (r * 0.9 + band * r * 0.35 + 0.03), 1.0); }'
    }));
    shield.position.y = 1.35; shield.visible = false; root.add(shield); J.shield = shield;
    scene.add(root);
    return J;
  })();
  const umb = MAL && MAL.umbrella ? MAL.umbrella() : null;
  if (umb) { umb.visible = false; R.root.add(umb); }
  const rideM = {};   // ride models, children of the character so they move and jump with it
  if (MAL && MAL.ride) ['scooter', 'buffalo'].forEach((k) => { const m = MAL.ride(k); m.visible = false; R.root.add(m); rideM[k] = m; });
  const applyPose = (P) => {
    R.pelvis.position.y = P.py; R.body.rotation.x = P.bx;
    R.torso.rotation.set(P.tx, P.ty, 0); R.head.rotation.set(P.hx, P.hy, 0);
    R.hip[0].rotation.x = P.hipL; R.hip[1].rotation.x = P.hipR; R.hip[0].rotation.z = -(P.hs || 0); R.hip[1].rotation.z = P.hs || 0;
    R.knee[0].rotation.x = -P.kL; R.knee[1].rotation.x = -P.kR;
    R.ank[0].rotation.x = P.aL; R.ank[1].rotation.x = P.aR;
    R.sh[0].rotation.set(P.shL, 0, -P.shZ); R.sh[1].rotation.set(P.shR, 0, P.shZ);
    R.el[0].rotation.x = P.elL; R.el[1].rotation.x = P.elR;
  };

  /* characters: the robot, or a human on the same joints (characters.js); the backpack (malabar.js) sits on whichever body is active */
  const CH = window.RoboCharacters ? window.RoboCharacters.attach(THREE, R) : null;
  const pack = MAL && MAL.pack ? MAL.pack() : null; if (pack) R.torso.add(pack.g);
  let human = false;
  const applyPack = () => { if (!pack) return; const p = opt.pack; pack.g.visible = !!p; if (p) pack.update(p.cap, p.ids || [], human ? 0.4 : 0.66); };
  const setSkin = (s) => {
    if (!s) return;
    human = !!(s.human && CH);
    if (human) CH.apply(s.human);
    else { if (CH) CH.clear(); R.mBody.color.setHex(s.body); R.mDark.color.setHex(s.dark); R.mAcc.color.setHex(s.acc); }
    skinGlow = s.glow; if (!human && (state !== 'over' || opt.assist)) R.mGlow.emissive.setHex(s.glow);
    applyPack();
  };

  /* obstacles */
  const gapBuild = (mat) => { const g = new THREE.Group(); const w = new THREE.Mesh(new THREE.PlaneGeometry(9.25, 3.8).rotateX(-PI / 2), mat); w.position.y = 0.02; g.add(w); [-1, 1].forEach((s) => { const e = new THREE.Mesh(new THREE.BoxGeometry(9.25, 0.16, 0.3), M.stone); e.position.set(0, 0.04, s * 1.95); g.add(e); }); return g; };
  const OBT = {
    log: { hw: 1.15, hd: 0.5, build() { const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 2.3, 16), M.stone); m.rotation.z = PI / 2; m.position.y = 0.46; g.add(m); [-0.75, 0.75].forEach((x) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.12, 16), M.stone); b.rotation.z = PI / 2; b.position.set(x, 0.46, 0); g.add(b); }); return g; } },
    beam: { hw: 1.1, hd: 0.35, build() { const g = new THREE.Group(); [-1, 1].forEach((s) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.34, 2.1, 0.5).translate(0, 1.05, 0), M.stone); p.position.x = s * 1.12; g.add(p); }); const l = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.5, 0.6), M.stone); l.position.y = 1.85; g.add(l); return g; } },
    block: { hw: 1.12, hd: 0.95, build() { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.BoxGeometry(2.24, 2.8, 1.9).translate(0, 1.4, 0), M.stone)); const t = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.7, 1.2).translate(0, 3.15, 0), M.stone); t.rotation.y = 0.35; g.add(t); return g; } },
    boulder: { hw: 1.05, hd: 1.05, build() { const g = new THREE.Group(); const m = new THREE.Mesh(rockGeo(1.18, 2, 1.7, 1), M.rock); m.position.y = 1.18; g.add(m); g.userData.ball = m; return g; } },
    gap: { hw: 99, hd: 1.9, gap: true, build() { return gapBuild(M.water); } },
    lava: { hw: 99, hd: 1.9, gap: true, build() { return gapBuild(M.lava); } },
    void: { hw: 99, hd: 1.9, gap: true, build() { return gapBuild(M.voidM); } },
    roller: { hw: 1.15, hd: 0.5, build() { const g = new THREE.Group(), spin = new THREE.Group(); spin.position.y = 0.48; g.add(spin); const m = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 2.2, 14), M.rock); m.rotation.z = PI / 2; spin.add(m); [-1, 1].forEach((s) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.54, 0.16, 8), M.stone); b.rotation.z = PI / 2; b.position.x = s * 0.95; spin.add(b); }); const k = new THREE.Mesh(new THREE.BoxGeometry(2, 0.14, 0.16), M.stone); k.position.y = 0.47; spin.add(k); g.userData.spin = spin; return g; } },
    slider: { hw: 1.12, hd: 0.95, build() { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.BoxGeometry(2.24, 2.6, 1.9).translate(0, 1.3, 0), M.stone)); [0.55, 2.0].forEach((y) => { const b = new THREE.Mesh(new THREE.BoxGeometry(2.32, 0.16, 1.98), M.rune); b.position.y = y; g.add(b); }); [-1, 1].forEach((s) => { const c = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.4, 4).rotateZ(-s * PI / 2), M.rune); c.position.set(s * 1.3, 1.3, 0); g.add(c); }); return g; } }
  };
  M.crate = std({ color: 0xa8743e, roughness: 0.85 }); M.crateBand = std({ color: 0x5a3a1e, roughness: 0.9 });
  M.barrier = std({ color: 0x2a0a06, emissive: 0xff5a2a, emissiveIntensity: 1.6, roughness: 0.4, transparent: true, opacity: 0.88 });
  OBT.crate = { hw: 0.75, hd: 0.55, build() { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.0, 1.0).translate(0, 0.5, 0), M.crate)); [0.12, 0.88].forEach((y) => { const b = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.1, 1.06), M.crateBand); b.position.y = y; g.add(b); }); const x = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.15, 0.04), M.crateBand); x.rotation.z = 0.7; x.position.set(0, 0.5, -0.52); g.add(x); return g; } };
  OBT.barrier = { hw: 1.12, hd: 0.4, build() { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.6, 0.4).translate(0, 1.3, 0), M.barrier)); [-1, 1].forEach((s) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.9, 0.6).translate(0, 1.45, 0), M.stone); p.position.x = s * 1.15; g.add(p); }); return g; } };
  /* road hazards (Wayanad): flat decals. A pothole costs speed once; mud slows you and makes lane changes slide while you are on it. Jump either. */
  M.potDark = std({ color: 0x141312, roughness: 1, envMapIntensity: 0.1, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -8 });
  M.potWater = std({ color: 0x1f2c31, roughness: 0.1, metalness: 0.2, envMapIntensity: 0.5, polygonOffset: true, polygonOffsetFactor: -9, polygonOffsetUnits: -9 });
  M.potChunk = std({ color: 0x2d2e30, roughness: 1, flatShading: true });
  M.mud = std({ color: 0x3a281a, roughness: 1, envMapIntensity: 0.12, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -8 });
  const flat = (r, sx, sz, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.CircleGeometry(r, 18).rotateX(-PI / 2).scale(sx, 1, sz), mat); m.position.set(x, y, z); return m; };
  OBT.pothole = { hw: 1.0, hd: 0.9, soft: true, build() {
    const g = new THREE.Group(); g.add(flat(1.08, 1, 0.82, M.potDark, 0, 0.04, 0), flat(0.6, 1, 0.55, M.potWater, 0.08, 0.05, 0.04));
    for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2 + rng(-0.2, 0.2), c = new THREE.Mesh(new THREE.BoxGeometry(rng(0.16, 0.3), 0.07, rng(0.12, 0.2)), M.potChunk); c.position.set(Math.cos(a) * rng(1, 1.18), 0.05, Math.sin(a) * rng(0.82, 0.96)); c.rotation.y = rng(0, PI); g.add(c); }
    return g; } };
  OBT.mud = { hw: 1.25, hd: 4.6, soft: true, build() {
    const g = new THREE.Group(); [[-2.8, 1.05, 2.2], [0, 1.2, 2.6], [2.8, 1, 2.2]].forEach(([z, sx, sz]) => g.add(flat(1, sx, sz, M.mud, rng(-0.1, 0.1), 0.04, z)));
    g.add(flat(0.6, 1, 1.3, M.potWater, 0.1, 0.05, 0.5)); return g; } };
  OBT.web = { hw: 1.25, hd: 0.45, soft: true, web: true, build() { return MAL && MAL.webModel ? MAL.webModel() : new THREE.Group(); } };   // spider web at head height: slide under it, or it slows you and breaks
  const SOFT = { pothole: 1, mud: 1, web: 1 };
  /* roadside shops (snacks, pharmacy, tools, textiles): a shopfront with a glowing bay in the right lane; steering into the bay pauses the run and opens the shop */
  ['snacks', 'pharmacy', 'tools', 'clothes'].forEach((k) => { OBT['shop_' + k] = { hw: 1.2, hd: 3.2, soft: true, shop: k, build() { return MAL && MAL.shopModel ? MAL.shopModel(k) : new THREE.Group(); } }; SOFT['shop_' + k] = 1; });
  const isGap = (o) => !!OBT[o.type].gap;
  const TALL = { block: 1, boulder: 1, slider: 1, barrier: 1 };
  const obs = [];
  const getOb = (type) => {
    let o = obs.find((x) => !x.active && x.type === type);
    if (!o) { const g = OBT[type].build(); g.traverse((m) => { if (m.isMesh) { m.castShadow = !OBT[type].gap && !OBT[type].soft; m.receiveShadow = true; } }); scene.add(g); o = { type, g, hw: OBT[type].hw, hd: OBT[type].hd }; obs.push(o); }
    return o;
  };
  const place = (type, lane, z, to) => {
    const o = getOb(type); o.active = true; o.hit = false; o.auto = false; o.threat = false; o.passed = false; o.rv = null; o.lane = lane; o.x = OBT[type].gap ? 0 : lane * LANE; o.z = z;
    o.vz = type === 'boulder' ? 7 : type === 'roller' ? 6 : 0; o.x0 = o.x; o.x1 = to == null ? o.x : to * LANE; if (to != null) o.lane = to;
    if (MAL) MAL.theme(o, ZONES[zoneAt(-z)].kind);
    o.g.visible = true; o.g.position.set(o.x, 0, z); o.g.rotation.y = type === 'block' || type === 'slider' ? rng(-0.06, 0.06) : 0; return o;
  };

  /* energy cells (instanced) */
  const CELL_N = 160;
  const cellCore = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15, 0.15, 0.42, 12), std({ color: 0x0c2a22, emissive: 0x6dffbe, emissiveIntensity: 2.2, roughness: 0.3 }), CELL_N);
  const cellCaps = new THREE.InstancedMesh(mergeGeos([new THREE.CylinderGeometry(0.19, 0.19, 0.08, 12).translate(0, 0.24, 0), new THREE.CylinderGeometry(0.19, 0.19, 0.08, 12).translate(0, -0.24, 0)]), std({ color: 0xc9c5bc, metalness: 0.9, roughness: 0.3 }), CELL_N);
  [cellCore, cellCaps].forEach((m) => { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.castShadow = true; m.frustumCulled = false; scene.add(m); });
  const cells = Array.from({ length: CELL_N }, () => ({ active: false, x: 0, y: 0, z: 0, pull: false }));
  let cellIdx = 0;
  const addCell = (x, y, z) => { for (let n = 0; n < CELL_N; n++) { const c = cells[cellIdx]; cellIdx = (cellIdx + 1) % CELL_N; if (!c.active) { Object.assign(c, { active: true, x, y, z, pull: false }); return; } } };

  /* power-ups */
  const pickups = [];
  const buildPickup = (type) => {
    const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
    if (type.indexOf('food:') === 0) { if (MAL) inner.add(MAL.foodModel(type.slice(5))); }
    else if (type.indexOf('ride:') === 0) { if (MAL) inner.add(MAL.rideIcon(type.slice(5))); }
    else if (type.indexOf('herb:') === 0) { if (MAL) inner.add(MAL.herbModel(type.slice(5))); }
    else if (type === 'magnet') {
      const red = std({ color: 0xd23a2a, metalness: 0.4, roughness: 0.35, emissive: 0x3a0800 }), tip = std({ color: 0xe8e6e0, metalness: 0.9, roughness: 0.25 });
      const u = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.12, 10, 24, PI), red); u.rotation.z = PI; inner.add(u);
      [-1, 1].forEach((s) => { const a = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.3, 12), red); a.position.set(s * 0.34, 0.15, 0); inner.add(a); const t = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.14, 12), tip); t.position.set(s * 0.34, 0.36, 0); inner.add(t); });
    } else if (type === 'mult') {
      const gold = std({ color: 0xf2c46b, metalness: 0.85, roughness: 0.28, emissive: 0x2a1800 }), dark = std({ color: 0x3a2a10, roughness: 0.6 });
      const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 28), gold); coin.rotation.x = PI / 2; inner.add(coin);
      inner.add(new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.05, 8, 28), gold));
      [-1, 1].forEach((s) => [-1, 1].forEach((f) => { const d = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.36, 0.04), dark); d.position.z = f * 0.06; d.rotation.z = s * 0.55; inner.add(d); }));
    } else if (type === 'jet') {
      const white = std({ color: 0xe8e6e0, metalness: 0.6, roughness: 0.3 }), orange = std({ color: 0xe0612a, metalness: 0.35, roughness: 0.4 }), fire = std({ color: 0x1a0a02, emissive: 0xffa040, emissiveIntensity: 2 });
      [-1, 1].forEach((s) => {
        const c = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.55, 12), white); c.position.x = s * 0.16; inner.add(c);
        const n = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.22, 12), orange); n.position.set(s * 0.16, 0.38, 0); inner.add(n);
        const f = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 10).rotateX(PI), fire); f.position.set(s * 0.16, -0.39, 0); inner.add(f);
      });
    } else {
      inner.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.36, 0), std({ color: 0x0a2040, emissive: 0x4fb6ff, emissiveIntensity: 1.8, flatShading: true, roughness: 0.2 })));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.035, 8, 40), std({ color: 0xe8e6e0, metalness: 0.9, roughness: 0.25 })); ring.rotation.x = PI / 2; inner.add(ring);
    }
    g.traverse((m) => { if (m.isMesh) m.castShadow = true; }); scene.add(g);
    const p = { type, g, inner, active: false }; pickups.push(p); return p;
  };
  const placePickup = (type, lane, z) => { const p = pickups.find((x) => !x.active && x.type === type) || buildPickup(type); p.active = true; p.x = lane * LANE; p.z = z; p.g.visible = true; p.g.position.set(p.x, 1.2, z); };

  /* particles: ambient motes + spark bursts */
  const DUST_N = 160, dustGeo = new THREE.BufferGeometry(), dustPos = new Float32Array(DUST_N * 3);
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({ size: 0.07, color: ZONES[0].dust, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });
  const dust = new THREE.Points(dustGeo, dustMat); dust.frustumCulled = false; scene.add(dust);
  const SPK_N = 140, spkGeo = new THREE.BufferGeometry(), spkPos = new Float32Array(SPK_N * 3), spkCol = new Float32Array(SPK_N * 3), spkVel = new Float32Array(SPK_N * 3), spkLife = new Float32Array(SPK_N), spkBase = new Float32Array(SPK_N * 3);
  spkGeo.setAttribute('position', new THREE.BufferAttribute(spkPos, 3)); spkGeo.setAttribute('color', new THREE.BufferAttribute(spkCol, 3));
  const sparks = new THREE.Points(spkGeo, new THREE.PointsMaterial({ size: 0.13, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  sparks.frustumCulled = false; scene.add(sparks);
  let spkI = 0; const tmpC = new THREE.Color();
  const burst = (x, y, z, color, n, spd) => { tmpC.set(color); if (effQ() !== 'High') n = Math.ceil(n * 0.5); for (let k = 0; k < n; k++) { const i = spkI; spkI = (spkI + 1) % SPK_N; spkPos.set([x, y, z], i * 3); spkVel.set([rng(-1, 1) * spd, rng(0.2, 1.2) * spd, rng(-1, 1) * spd], i * 3); spkBase.set([tmpC.r, tmpC.g, tmpC.b], i * 3); spkLife[i] = rng(0.4, 0.8); } };
  const thrust = () => { tmpC.set(0xffa040); for (let s = -1; s <= 1; s += 2) { const i = spkI; spkI = (spkI + 1) % SPK_N; spkPos.set([px + s * 0.14, py + 1.95, pz + 0.5], i * 3); spkVel.set([rng(-0.4, 0.4), -rng(3, 6), rng(0.5, 2)], i * 3); spkBase.set([tmpC.r, tmpC.g, tmpC.b], i * 3); spkLife[i] = rng(0.2, 0.4); } };
  const jetTrail = () => { const pat = [0, 0, 0, 1, 1, 1, 0, 0, 0, -1, -1, -1]; for (let i = 0; i < 44; i++) addCell(pat[i % pat.length] * LANE, JET_Y + 1.2, pz - 14 - i * 2.6); };

  /* ---------- rival robots: combat & loot (all numbers live in COMBAT at the top of this file) ---------- */
  const CB = (() => {
    const C = COMBAT, W = C.weapons;
    const low = () => effQ() !== 'High';
    const pickW = (list) => { let t = 0; for (const k in list) t += list[k]; let r = Math.random() * t; for (const k in list) { r -= list[k]; if (r <= 0 && list[k] > 0) return k; } return Object.keys(list)[0]; };
    const ri = (a) => (Array.isArray(a) ? Math.round(rng(a[0], a[1])) : a || 0);
    const kidsW = (t) => (opt.assist ? (W[t].ranged ? 'bubble' : 'foam') : t);
    const hints = store.get('combatHints', {});
    const sayHint = (k) => { if (hints[k]) return; hints[k] = true; store.set('combatHints', hints); hint = k; hintT = 3.6; emit(); };
    const box = (w, h, d) => new THREE.BoxGeometry(w, h, d), cyl = (a, b, h, n) => new THREE.CylinderGeometry(a, b, h, n || 10);
    const mk = (g, m, x, y, z, p) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; p.add(o); return o; };
    const mDark = std({ color: 0x23272c, metalness: 0.8, roughness: 0.4 }, 0.5);
    let popup = null, popT = 0, warnT = 0, combo = 0, comboT = 0, atkT = 0, atkCd = 0, atkDir = 1, weapon = null;
    const pop = (kind, n, c) => { popup = { kind, n: n || 0, combo: c || 0 }; popT = 1.6; emit(); };

    /* weapons: models shared by pickups, the player's hand and rivals' hands */
    const WM = {
      metal: std({ color: 0xb8bcc4, metalness: 0.9, roughness: 0.3 }), grip: std({ color: 0x2a2e33, roughness: 0.7 }),
      blue: std({ color: 0x0a1a30, emissive: 0x58b8ff, emissiveIntensity: 2 }), teal: std({ color: 0x0a2a26, emissive: 0x6dffe0, emissiveIntensity: 2 }),
      orange: std({ color: 0xe0612a, metalness: 0.3, roughness: 0.45 }), red: std({ color: 0xd23a2a, metalness: 0.4, roughness: 0.35 }),
      foam: std({ color: 0xff8fb8, roughness: 0.95 }), foamTip: std({ color: 0xffe066, roughness: 0.95 }),
      bubble: new THREE.MeshStandardMaterial({ color: 0xbfefff, roughness: 0.05, transparent: true, opacity: 0.55 })
    };
    const weaponModel = (t) => {
      const g = new THREE.Group();
      if (t === 'pipe') { mk(cyl(0.055, 0.055, 1.05), WM.metal, 0, 0.42, 0, g); mk(cyl(0.075, 0.075, 0.1), WM.metal, 0, 0.95, 0, g); mk(cyl(0.07, 0.07, 0.22, 8), WM.grip, 0, 0, 0, g); }
      else if (t === 'wrench') { mk(box(0.1, 0.9, 0.06), WM.metal, 0, 0.38, 0, g); const h = mk(new THREE.TorusGeometry(0.15, 0.055, 6, 12, PI * 1.5), WM.metal, 0, 0.92, 0, g); h.rotation.z = PI * 0.25; mk(box(0.12, 0.24, 0.08), WM.grip, 0, 0, 0, g); }
      else if (t === 'baton') { mk(cyl(0.05, 0.05, 0.9), WM.grip, 0, 0.4, 0, g); mk(cyl(0.07, 0.07, 0.22), WM.blue, 0, 0.86, 0, g); [0.3, 0.55].forEach((y) => mk(cyl(0.065, 0.065, 0.04), WM.blue, 0, y, 0, g)); }
      else if (t === 'blaster') { mk(cyl(0.13, 0.15, 0.5, 12), WM.orange, 0, 0.3, 0, g); mk(new THREE.SphereGeometry(0.11, 12, 10), WM.teal, 0, 0.6, 0, g); mk(box(0.09, 0.22, 0.12), WM.grip, 0, 0, 0.06, g); [0.18, 0.36].forEach((y) => mk(cyl(0.16, 0.16, 0.04, 12), WM.teal, 0, y, 0, g)); }
      else if (t === 'magnet') { mk(cyl(0.05, 0.05, 0.5, 8), WM.grip, 0, 0.2, 0, g); const u = mk(new THREE.TorusGeometry(0.17, 0.07, 8, 16, PI), WM.red, 0, 0.55, 0, g); u.rotation.z = PI; [-1, 1].forEach((k) => mk(cyl(0.075, 0.075, 0.12, 8), WM.metal, k * 0.17, 0.6, 0, g)); }
      else if (t === 'foam') { mk(cyl(0.15, 0.07, 0.95, 12), WM.foam, 0, 0.45, 0, g); mk(new THREE.SphereGeometry(0.15, 12, 10), WM.foamTip, 0, 0.93, 0, g); }
      else { mk(cyl(0.12, 0.14, 0.42, 12), WM.foamTip, 0, 0.25, 0, g); const ring = mk(new THREE.TorusGeometry(0.16, 0.035, 8, 20), WM.teal, 0, 0.5, 0, g); ring.rotation.x = PI / 2; mk(new THREE.SphereGeometry(0.14, 12, 10), WM.bubble, 0, 0.68, 0, g); }
      return g;
    };
    const iconTex = {};
    const icon = (t) => {
      if (iconTex[t]) return iconTex[t];
      const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
      x.fillStyle = 'rgba(10,14,12,0.8)'; x.beginPath(); x.arc(64, 64, 58, 0, PI * 2); x.fill(); x.strokeStyle = '#f2c46b'; x.lineWidth = 6; x.stroke();
      x.strokeStyle = x.fillStyle = '#f3f0e8'; x.lineCap = 'round'; x.lineJoin = 'round'; x.lineWidth = 12;
      const ln = (a, b, c2, d) => { x.beginPath(); x.moveTo(a, b); x.lineTo(c2, d); x.stroke(); };
      if (t === 'pipe') ln(40, 88, 88, 40);
      else if (t === 'wrench') { ln(42, 90, 74, 58); x.beginPath(); x.arc(82, 48, 15, PI * 0.15, PI * 1.6); x.stroke(); }
      else if (t === 'baton') { x.beginPath(); x.moveTo(72, 26); x.lineTo(50, 66); x.lineTo(74, 66); x.lineTo(54, 104); x.stroke(); }
      else if (t === 'blaster') { x.beginPath(); x.arc(64, 64, 13, 0, PI * 2); x.fill(); for (let i = 0; i < 8; i++) { const a = (i / 8) * PI * 2; ln(64 + Math.cos(a) * 25, 64 + Math.sin(a) * 25, 64 + Math.cos(a) * 37, 64 + Math.sin(a) * 37); } }
      else if (t === 'magnet') { x.lineWidth = 16; x.beginPath(); x.moveTo(44, 34); x.lineTo(44, 64); x.arc(64, 64, 20, PI, 0, true); x.lineTo(84, 34); x.stroke(); }
      else if (t === 'foam') { x.lineWidth = 22; ln(46, 84, 82, 46); }
      else { x.lineWidth = 6; [[54, 70, 16], [80, 50, 11], [80, 82, 8]].forEach(([a, b, r]) => { x.beginPath(); x.arc(a, b, r, 0, PI * 2); x.stroke(); }); }
      const tx = new THREE.CanvasTexture(c); tx.encoding = THREE.sRGBEncoding; return (iconTex[t] = tx);
    };
    const held = {};
    const showHeld = () => { if (weapon && !held[weapon.type]) { const m = weaponModel(weapon.type); m.rotation.x = -PI / 2; m.position.set(0, -0.48, -0.02); R.el[1].add(m); held[weapon.type] = m; } for (const k in held) held[k].visible = !!weapon && weapon.type === k; };
    const WP = [], ringMat = new THREE.MeshBasicMaterial({ color: 0xf2c46b, transparent: true, opacity: 0.75, depthWrite: false });
    const placeWeapon = (t, l, z, uses) => {
      let p = WP.find((q) => !q.active && q.type === t);
      if (!p) {
        const g = new THREE.Group(), spin = new THREE.Group(); g.add(spin);
        const m = weaponModel(t); m.position.y = -0.45; m.rotation.z = 0.6; spin.add(m);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.035, 6, 32), ringMat); ring.rotation.x = PI / 2; ring.position.y = -1.1; g.add(ring);
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: icon(t), depthTest: false, transparent: true })); sp.scale.set(0.8, 0.8, 1); sp.position.y = 1.0; sp.renderOrder = 5; g.add(sp);
        scene.add(g); p = { type: t, g, spin, active: false }; WP.push(p);
      }
      Object.assign(p, { active: true, x: l * LANE, z, uses: uses == null ? W[t].uses : uses }); p.g.visible = true; p.g.position.set(p.x, 1.45, z);
      sayHint('weapon');
    };

    /* rival robots: pooled, one simple rig per type with its own silhouette */
    const PROP = {
      bruiser: { hip: 1.22, tw: 1.15, th: 0.95, td: 0.72, head: 'box', hs: [0.42, 0.32, 0.4], leg: 0.19, arm: 0.16, pads: true },
      sprinter: { hip: 1.42, tw: 0.6, th: 0.62, td: 0.42, head: 'fin', hs: [0.34, 0.34, 0.42], leg: 0.1, arm: 0.075 },
      trickster: { hip: 1.15, tw: 0.72, th: 0.62, td: 0.52, head: 'ball', hs: [0.3], leg: 0.12, arm: 0.09, sack: true },
      boss: { hip: 1.3, tw: 1.25, th: 1.0, td: 0.82, head: 'box', hs: [0.5, 0.36, 0.46], leg: 0.21, arm: 0.18, pads: true, horns: true }
    };
    const RV = [];
    const buildRival = (type) => {
      const T = C.rivals[type], P = PROP[type], simple = low(), seg = simple ? 6 : 10;
      const mb = std({ color: T.color, metalness: 0.55, roughness: 0.42 }, 0.5);
      const mEye = std({ color: 0x140806, emissive: type === 'boss' ? 0xff3a1a : 0xffb050, emissiveIntensity: 2.4 });
      const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
      const hip = new THREE.Group(); hip.position.y = P.hip; body.add(hip);
      mk(box(P.tw * 0.7, 0.24, P.td * 0.8), mDark, 0, 0, 0, hip);
      const torso = new THREE.Group(); torso.position.y = 0.1; hip.add(torso);
      mk(box(P.tw, P.th, P.td), mb, 0, P.th / 2 + 0.05, 0, torso);
      mk(box(P.tw * 0.55, P.th * 0.3, 0.05), mEye, 0, P.th * 0.55, -P.td / 2 - 0.02, torso);
      const top = P.th + 0.1;
      if (P.head === 'ball') {
        mk(new THREE.SphereGeometry(0.38, simple ? 10 : 16, simple ? 8 : 12), mb, 0, top + 0.32, 0, torso); mk(box(0.36, 0.08, 0.05), mEye, 0, top + 0.34, -0.37, torso);
        if (!simple) [-1, 1].forEach((k) => { const e = mk(new THREE.ConeGeometry(0.08, 0.36, 6), mDark, k * 0.24, top + 0.7, 0, torso); e.rotation.z = -k * 0.5; });
      } else {
        mk(box(P.hs[0], P.hs[1], P.hs[2]), mb, 0, top + P.hs[1] / 2 + 0.06, 0, torso); mk(box(P.hs[0] * 0.85, 0.09, 0.05), mEye, 0, top + P.hs[1] * 0.6, -P.hs[2] / 2 - 0.02, torso);
        if (P.head === 'fin' && !simple) mk(box(0.05, 0.24, 0.44), mEye, 0, top + P.hs[1] + 0.16, 0.04, torso);
      }
      if (P.pads && !simple) [-1, 1].forEach((k) => mk(box(0.42, 0.18, P.td * 0.95), mDark, k * (P.tw / 2 + 0.08), P.th + 0.02, 0, torso));
      if (P.horns && !simple) [-1, 1].forEach((k) => { const h = mk(new THREE.ConeGeometry(0.1, 0.42, 6), mEye, k * (P.tw / 2 + 0.1), P.th + 0.34, 0, torso); h.rotation.z = -k * 0.35; });
      if (P.sack && !simple) mk(new THREE.SphereGeometry(0.3, 10, 8), mDark, 0, P.th * 0.6, P.td / 2 + 0.22, torso);
      const legs = [], arms = [];
      [-1, 1].forEach((k) => {
        const l = new THREE.Group(); l.position.set(k * P.tw * 0.26, -0.06, 0); hip.add(l);
        mk(cyl(P.leg, P.leg * 0.85, 0.6, seg), mb, 0, -0.3, 0, l);
        const kn = new THREE.Group(); kn.position.y = -0.6; l.add(kn);
        mk(cyl(P.leg * 0.85, P.leg * 0.7, 0.56, seg), mDark, 0, -0.28, 0, kn); mk(box(P.leg * 2, 0.1, 0.36), mb, 0, -0.6, -0.06, kn);
        legs.push({ l, k: kn });
        const a = new THREE.Group(); a.position.set(k * (P.tw / 2 + P.arm + 0.02), P.th - 0.02, 0); torso.add(a);
        mk(cyl(P.arm, P.arm * 0.9, 0.46, seg), mb, 0, -0.24, 0, a);
        const e = new THREE.Group(); e.position.y = -0.48; a.add(e);
        mk(cyl(P.arm * 0.9, P.arm * 0.8, 0.4, seg), mDark, 0, -0.2, 0, e); mk(box(P.arm * 2, P.arm * 2, P.arm * 2), mb, 0, -0.44, 0, e);
        arms.push({ a, e });
      });
      const bar = new THREE.Group(); bar.position.y = P.hip + top + (P.head === 'ball' ? 1.0 : 0.78); root.add(bar);
      const bw = type === 'boss' ? 1.4 : 0.9;
      const bg = new THREE.Mesh(new THREE.PlaneGeometry(bw + 0.08, 0.17), new THREE.MeshBasicMaterial({ color: 0x0a0e0c, transparent: true, opacity: 0.8, depthTest: false })); bg.renderOrder = 6; bar.add(bg);
      const fill = new THREE.Mesh(new THREE.PlaneGeometry(bw, 0.1), new THREE.MeshBasicMaterial({ color: 0xf2c46b, depthTest: false })); fill.renderOrder = 7; bar.add(fill);
      root.scale.setScalar(T.scale); root.visible = false; scene.add(root);
      const r = { id: RV.length, type, root, body, hip, torso, legs, arms, bar, fill, bw, mb, held: {}, active: false };
      RV.push(r); return r;
    };
    const rivalHold = (r) => { if (r.weapon && !r.held[r.weapon.type]) { const m = weaponModel(r.weapon.type); m.rotation.x = -PI / 2; m.position.set(0, -0.5, -0.02); r.arms[1].e.add(m); r.held[r.weapon.type] = m; } for (const k in r.held) r.held[k].visible = !!r.weapon && r.weapon.type === k; };
    const remove = (r) => { r.active = false; r.root.visible = false; r.weapon = null; rivalHold(r); };
    const aggro = () => (opt.assist ? C.kids.aggro : (C.waves.difficulty[opt.difficulty] || {}).aggro || 1);
    const occupied = (l, z0, self) => RV.some((q) => q !== self && q.active && !q.dying && q.lane === l && Math.abs(q.z - z0) < 3.2);
    const tallAhead = (l, z0, range) => obs.some((o) => o.active && TALL[o.type] && Math.abs(o.x - l * LANE) < 1.3 && z0 - o.z > -1 && z0 - o.z < range);
    const tryLane = (r, d) => { const l = r.lane + d; if (l < -1 || l > 1 || occupied(l, r.z, r) || (l === lane && Math.abs(r.z - pz) < 2.6)) return false; r.lane = l; return true; };
    const dodgeLane = (r) => { for (const d of shuffle([-1, 1])) { const l = r.lane + d; if (l >= -1 && l <= 1 && !tallAhead(l, r.z, 14) && tryLane(r, d)) return true; } return false; };
    const freeLane = () => { for (const l of shuffle([-1, 0, 1])) if (l !== lane && !occupied(l, pz, null)) return l; return lane === 0 ? (Math.random() < 0.5 ? -1 : 1) : 0; };
    const spawn = (type, laneHint) => {
      const T = C.rivals[type], r = RV.find((x) => !x.active && x.type === type) || buildRival(type), hpK = opt.assist ? C.kids.hp : 1, l = laneHint != null ? laneHint : freeLane();
      Object.assign(r, { active: true, dying: 0, fly: null, fy: 0, broken: false, mode: 'join', hp: T.hp * hpK, max: T.hp * hpK, lane: l, x: l * LANE, z: pz + 16 + rng(0, 4), py: 0, vy: 0, slideT: 0, phase: rng(0, 6), v: speed,
        cd: rng(1.2, 2.4), wind: 0, windDir: 1, strikeT: 0, stun: 0, stagger: 0, flashT: 0, stay: rng(C.waves.stay[0], C.waves.stay[1]), tdz: type === 'boss' ? rng(-1.5, 0.5) : rng(-3.2, 2.4),
        coinsHeld: 0, energyHeld: 0, stoleWeapon: false, weapon: null, lastObs: null, hopT: Array.isArray(T.laneHop) ? rng(T.laneHop[0], T.laneHop[1]) : 0, slamT: rng(2.5, 3.5), zone: Math.floor(dist / ZONE_LEN) });
      if (T.weapon && Math.random() < T.weaponChance) { const wt = kidsW(T.weapon); r.weapon = { type: wt, uses: W[wt].uses }; }
      rivalHold(r); r.root.visible = true; r.body.rotation.set(0, 0, 0); r.root.position.set(r.x, 0, r.z);
      sayHint('rival');
      return r;
    };

    /* coins: instanced, with an arc for loot drops and a flight path for coins a rival grabs */
    const COIN_N = 160;
    const coinMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.24, 0.24, 0.07, 16).rotateX(PI / 2), std({ color: 0xf2c46b, metalness: 0.9, roughness: 0.25, emissive: 0x3a2400 }), COIN_N);
    coinMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); coinMesh.frustumCulled = false; coinMesh.castShadow = true; scene.add(coinMesh);
    const coins = Array.from({ length: COIN_N }, () => ({ active: false, x: 0, y: 0, z: 0, pull: false, fly: 0, to: null }));
    let ci = 0;
    const takeCoin = () => { for (let n = 0; n < COIN_N; n++) { const c = coins[ci]; ci = (ci + 1) % COIN_N; if (!c.active) return c; } return null; };
    const addCoin = (x, y, z) => { const c = takeCoin(); if (c) Object.assign(c, { active: true, x, y, z, pull: false, fly: 0, to: null }); };
    const lootCoin = (sx, sy, sz, tx, tz) => { const c = takeCoin(); if (c) Object.assign(c, { active: true, x: sx, y: sy, z: sz, sx, sy, sz, tx, tz, fly: 0.55, dur: 0.55, pull: false, to: null }); };
    const flyCoin = (sx, sy, sz, r) => { const c = takeCoin(); if (c) Object.assign(c, { active: true, x: sx, y: sy, z: sz, sx, sy, sz, fly: 0.45, dur: 0.45, to: r, pull: false }); };
    const coinStep = (dt) => {
      const cy = py + (slideT > 0 && grounded ? 0.6 : 1.2), cr = opt.assist ? 1.5 : 1;
      for (const c of coins) {
        if (!c.active) continue;
        if (c.fly > 0) {
          c.fly -= dt; const k = 1 - Math.max(0, c.fly) / c.dur;
          if (c.to) { c.x = lerp(c.sx, c.to.x, k); c.z = lerp(c.sz, c.to.z, k); c.y = lerp(c.sy, 1.8, k) + Math.sin(k * PI) * 1.2; if (c.fly <= 0) c.active = false; }
          else { c.x = lerp(c.sx, c.tx, k); c.z = lerp(c.sz, c.tz, k); c.y = lerp(c.sy, 1.0, k) + Math.sin(k * PI) * 2.2; }
          continue;
        }
        if (c.z > pz + 5) { c.active = false; continue; }
        if (magnetT > 0 && c.z < pz + 1 && c.z > pz - 16) c.pull = true;
        if (c.pull) { const k = 1 - Math.exp(-9 * dt); c.x += (px - c.x) * k; c.y += (cy - c.y) * k; c.z += (pz - c.z) * k; }
        if (Math.abs(c.z - pz) < 1.1 * cr && Math.abs(c.x - px) < 1.0 * cr && Math.abs(c.y - cy) < 1.35 * cr) { c.active = false; run.coins += C.coins.value; score += C.coins.score * (multT > 0 ? 2 : 1); audio.coin(); burst(c.x, c.y, c.z, 0xf2c46b, 4, 2); }
      }
    };

    /* debris: tumbling pieces when a rival or crate breaks apart */
    const DEB = [], debGeo = [box(0.32, 0.22, 0.26), box(0.18, 0.4, 0.18), box(0.42, 0.14, 0.3)];
    const debris = (x, y, z, mat, n) => {
      for (let i = 0; i < n; i++) {
        let d = DEB.find((q) => !q.active);
        if (!d) { if (DEB.length >= 48) break; d = { m: new THREE.Mesh(debGeo[DEB.length % 3], mat), active: false }; d.m.castShadow = true; scene.add(d.m); DEB.push(d); }
        d.m.material = mat; d.active = true; d.t = rng(1.1, 1.6); d.m.visible = true; d.m.position.set(x + rng(-0.4, 0.4), y + rng(0, 1.2), z + rng(-0.4, 0.4));
        d.v = [rng(-5, 5), rng(4, 9), rng(-2, 6)]; d.s = [rng(-9, 9), rng(-9, 9), rng(-9, 9)];
      }
    };

    /* loot, takedowns and damage */
    const dropLoot = (r, how) => {
      const T = C.rivals[r.type];
      let n = ri(T.coins) + (how === 'env' ? C.loot.envCoins : 0) + (combo > 1 ? C.loot.comboCoins * (combo - 1) : 0) + r.coinsHeld + (r.coinsHeld ? C.loot.returnBonus : 0);
      const cellsN = ri(T.energy) + r.energyHeld + (r.type === 'trickster' && (r.energyHeld || r.stoleWeapon) ? T.bonus : 0);
      if (opt.assist) n = Math.round(n * C.kids.coinBoost);
      const lanes = [r.lane], l2 = r.lane + (Math.random() < 0.5 ? -1 : 1); if (Math.random() < 0.6 && l2 >= -1 && l2 <= 1) lanes.push(l2);
      const z0 = pz - speed * 0.6 - 6;
      for (let i = 0; i < n; i++) lootCoin(r.x, r.py + 1.8, r.z, lanes[i % lanes.length] * LANE + rng(-0.35, 0.35), z0 - Math.floor(i / lanes.length) * 1.2);
      for (let i = 0; i < cellsN; i++) addCell(lanes[(i + 1) % lanes.length] * LANE, 1.0, z0 - 2 - Math.floor(i / lanes.length) * 1.5);
      let wt = r.weapon;
      if (r.type === 'boss') { const t = kidsW(C.loot.bossWeapons[(Math.random() * C.loot.bossWeapons.length) | 0]); wt = { type: t, uses: W[t].uses }; }
      if (wt) placeWeapon(wt.type, lanes[lanes.length - 1], z0 - 4 - Math.ceil(Math.max(n, cellsN) / lanes.length) * 1.3, wt.uses);
      r.weapon = null; rivalHold(r);
      if (n + cellsN > 0) sayHint('loot');
    };
    const takedown = (r, how) => {
      if (r.dying) return;
      r.dying = opt.assist ? 1.3 : 1.2; r.broken = false; r.wind = 0; r.fy = 0;
      combo = comboT > 0 ? Math.min(C.combo.max, combo + 1) : 1; comboT = C.combo.window;
      const base = r.type === 'boss' ? C.points.boss : how === 'env' ? C.points.environmental : C.points.takedown, pts = base * combo * (multT > 0 ? 2 : 1);
      score += pts; run.takedowns++;
      pop(r.type === 'boss' ? 'boss' : combo > 1 ? 'combo' : how === 'env' ? 'env' : 'takedown', pts, combo);
      dropLoot(r, how);
      if (opt.assist) { r.fly = { vx: (r.x >= px ? 1 : -1) * rng(5, 8), vy: 9, spin: rng(5, 9) * (Math.random() < 0.5 ? -1 : 1) }; audio.boing(); burst(r.x, 1.8, r.z, 0xf2c46b, 30, 5); }
      else audio.clang(1.2);
      if (r.type === 'boss') { boss = null; audio.say(STR.bossDown, true); }
      hitStop = C.hitStop * 1.5;
      emit();
    };
    const hitRival = (r, dmg, o) => {
      if (!r.active || r.dying) return;
      const isBoss = r.type === 'boss';
      r.hp -= dmg; r.flashT = 0.16; r.wind = 0;
      if (!isBoss) { r.stagger = Math.max(r.stagger, o.stagger || 0.3); if (o.stun) r.stun = Math.max(r.stun, o.stun); }
      burst((r.x + px) / 2, 1.6, r.z, o.color || 0xffd080, 26, 5);
      if (o.sound !== false) (opt.assist ? audio.boing : audio.clang)(1);
      hitStop = C.hitStop; if (!opt.reduceMotion) shake = Math.max(shake, C.shake * 0.8);
      let env = false;
      if (o.push && !isBoss) { const nl = r.lane + o.dir * o.push; if (nl < -1 || nl > 1) { r.hp -= r.max * C.wallDamage; env = true; burst(r.x + o.dir * 1.2, 1.2, r.z, 0xffffff, 14, 4); } else r.lane = nl; }
      r.z += isBoss ? 0.3 : 0.8;
      if (r.hp <= 0) takedown(r, env ? 'env' : 'hit');
    };
    const crash = (r, o) => {
      r.hp -= r.max * C.obstacleDamage; r.stagger = 0.9; r.flashT = 0.2; r.z += 1.5;
      burst(r.x, 1.4, r.z - 0.4, 0xffb050, 24, 5); audio.clang(0.8);
      if (r.hp <= 0) takedown(r, 'env');
    };
    const breakCrate = (o) => {
      o.active = false; o.g.visible = false; burst(o.x, 0.6, o.z, 0xc8a26a, 22, 5); debris(o.x, 0.4, o.z, M.crate, low() ? 4 : 7); audio.crash();
      for (let i = 0; i < C.loot.crateCoins; i++) addCoin(o.x + rng(-0.3, 0.3), 1.0, o.z - 1 - i * 1.2);
    };

    /* rivals hitting the player */
    const strike = (r) => {
      const T = C.rivals[r.type]; r.cd = rng(T.cooldown[0], T.cooldown[1]) / aggro(); r.strikeT = 0.22;
      if (state !== 'playing' || jetT > 0 || Math.abs(r.z - pz) > C.rivalHit.reach + 0.8 || Math.abs(r.lane - lane) !== 1) return;
      const dir = Math.sign(lane - r.lane) || 1, cx = (r.x + px) / 2, cz = (r.z + pz) / 2;
      if (shieldT > 0) { burst(cx, 1.5 + py, cz, 0x9fdcff, 22, 4); audio.clang(0.5); r.stagger = 0.5; tryLane(r, -dir); return; }
      if (r.type === 'trickster') {
        if (weapon) { r.weapon = weapon; weapon = null; r.stoleWeapon = true; showHeld(); rivalHold(r); pop('stolenW'); }
        else if (energy > 0) { const n = Math.min(T.steal, energy); energy -= n; r.energyHeld += n; pop('stolenE', n); }
        else { r.cd = 1; return; }
        r.mode = 'flee'; burst(cx, 1.5, cz, 0xb98aff, 18, 3); audio.whoosh(-dir); emit(); return;
      }
      move(dir); speed *= C.rivalHit.speedLoss; hitT = Math.max(hitT, 0.3);
      burst(cx, 1.5 + py, cz, 0xffc060, 22, 4.5); audio.clang(1); hitStop = C.hitStop; if (!opt.reduceMotion) shake = Math.max(shake, C.shake);
      if ((T.hard || r.weapon) && !opt.assist && run.coins > 0) {
        const n = Math.min(C.rivalHit.maxCoinsDropped, run.coins, ri(C.rivalHit.coinsDropped)); run.coins -= n; r.coinsHeld += n;
        for (let i = 0; i < Math.min(n, 8); i++) flyCoin(px + rng(-0.3, 0.3), 1.6 + py, pz, r);
        pop('coinsLost', n);
      }
      if (r.weapon && W[r.weapon.type].melee) { r.weapon.uses--; if (r.weapon.uses <= 0) { r.weapon = null; rivalHold(r); } }
      emit();
    };

    /* rival AI: follow a slot beside the player, dodge obstacles (sometimes failing), shove when adjacent */
    const rivalStep = (r, dt) => {
      const T = C.rivals[r.type], isBoss = r.type === 'boss';
      if (r.dying) {
        r.dying -= dt;
        if (r.fly) { r.fly.vy += G * 0.6 * dt; r.x += r.fly.vx * dt; r.fy += r.fly.vy * dt; r.z -= speed * 0.6 * dt; r.body.rotation.z += r.fly.spin * dt; r.body.rotation.x += r.fly.spin * 0.5 * dt; }
        else {
          r.z -= speed * 0.85 * dt;
          if (Math.random() < 0.5) burst(r.x + rng(-0.4, 0.4), 1.5 + rng(-0.5, 0.6), r.z, 0xffd080, 2, 3);
          if (r.dying <= 0.85 && !r.broken) { r.broken = true; r.root.visible = false; debris(r.x, 0.6, r.z, r.mb, low() ? 6 : 11); debris(r.x, 0.9, r.z, mDark, low() ? 3 : 5); burst(r.x, 1.5, r.z, 0xffb050, 40, 6); audio.crash(); }
        }
        if (r.dying <= 0) remove(r);
        return;
      }
      r.cd -= dt; r.stun = Math.max(0, r.stun - dt); r.stagger = Math.max(0, r.stagger - dt); r.flashT = Math.max(0, r.flashT - dt); r.strikeT = Math.max(0, r.strikeT - dt);
      if (r.mode === 'run' || r.mode === 'join') r.stay -= dt;
      if (r.mode === 'join' && Math.abs(r.z - (pz + r.tdz)) < 1.5) r.mode = 'run';
      if ((r.mode === 'run' || r.mode === 'join') && r.stay <= 0 && !isBoss) r.mode = 'leave';
      const tz = r.mode === 'leave' ? pz + 40 : r.mode === 'flee' ? pz - 120 : pz + r.tdz;
      let v = Math.max(0, speed * T.speed + clamp((r.z - tz) * 1.4, -9, r.mode === 'flee' ? 14 : 9));
      if (r.stun > 0 || r.stagger > 0) v *= 0.8;
      r.z -= v * dt; r.v = v;
      if ((r.mode === 'leave' && r.z > pz + 26) || (r.mode === 'flee' && r.z < pz - 110) || r.z > pz + 60) { remove(r); return; }
      if (r.hopT > 0 && r.stun <= 0) { r.hopT -= dt; if (r.hopT <= 0) { tryLane(r, Math.random() < 0.5 ? -1 : 1); r.hopT = rng(T.laneHop[0], T.laneHop[1]); } }
      if (r.stun > 0 && Math.random() < dt * 1.2) { const o = obs.find((q) => q.active && TALL[q.type] && r.z - q.z > 4 && r.z - q.z < 20); tryLane(r, o ? Math.sign(laneOf(o.x) - r.lane) || 1 : Math.random() < 0.5 ? -1 : 1); }
      r.x = damp(r.x, r.lane * LANE, r.stun > 0 ? 6 : 9, dt);
      if (r.py > 0 || r.vy > 0) { r.vy += G * dt; r.py += r.vy * dt; if (r.py <= 0) { r.py = 0; r.vy = 0; } }
      if (r.slideT > 0) r.slideT -= dt;
      if (!isBoss && r.stun <= 0 && r.stagger <= 0) {
        for (const o of obs) {
          if (!o.active) continue;
          const ahead = r.z - o.z; if (ahead < 0 || ahead > 16) continue;
          if (!isGap(o) && Math.abs(o.x - r.x) > o.hw * 0.9 + 0.3) continue;
          o.rv = o.rv || {}; if (o.rv[r.id] === undefined) o.rv[r.id] = Math.random() < T.dodge;
          if (!o.rv[r.id]) continue;
          const tti = ahead / Math.max(1, v + o.vz);
          if (TALL[o.type]) { if (tti < 1.1) dodgeLane(r); }
          else if (o.type === 'beam') { if (tti < 0.32 && r.slideT <= 0 && r.py <= 0) r.slideT = 0.75; }
          else if (tti < 0.36 && r.py <= 0) { r.vy = JUMP_V; r.py = 0.001; }
        }
      }
      for (const o of obs) {
        if (!o.active || o === r.lastObs || Math.abs(o.z - r.z) > o.hd + 0.3) continue;
        if (!isGap(o) && Math.abs(o.x - r.x) > o.hw * 0.9 + 0.3) continue;
        const top = r.py + (r.slideT > 0 ? 1.15 : 2.6);
        let bad = false;
        if (o.type === 'log' || o.type === 'roller' || o.type === 'crate') bad = r.py < 0.95;
        else if (o.type === 'beam') bad = top > 1.58 && r.py < 2.1;
        else if (TALL[o.type]) bad = r.py < 2.8;
        else if (isGap(o)) bad = r.py < 0.05 && Math.abs(o.z - r.z) < o.hd - 0.5;
        if (!bad) continue;
        r.lastObs = o;
        if (isBoss) { if (!isGap(o)) { o.active = false; o.g.visible = false; burst(o.x, 1.2, o.z, 0xd8d2c4, 26, 6); audio.crash(); } continue; }
        crash(r, o); if (r.dying) return;
      }
      if (r.wind > 0) { r.wind -= dt; if (r.wind <= 0) strike(r); }
      else if (r.cd <= 0 && r.stun <= 0 && r.stagger <= 0 && jetT <= 0 && (r.mode === 'run' || r.mode === 'join') && Math.abs(r.lane - lane) === 1 && Math.abs(r.z - pz) < C.rivalHit.reach && r.py <= 0 && py < 1.5) {
        r.wind = C.rivalHit.windup * (opt.assist ? 1.4 : 1); r.windDir = Math.sign(lane - r.lane) || 1;
      }
      if (r.lane === lane && Math.abs(r.z - pz) < 1.3 && Math.abs(r.x - px) < 1) { if (!tryLane(r, r.x >= px ? 1 : -1) && !tryLane(r, r.x >= px ? -1 : 1)) r.z += 2.5; }
    };

    /* waves and the zone boss */
    let nextWave = C.waves.first, wave = null, waveN = 0, boss = null, bossZone = -1, slam = null;
    const gapMul = () => (opt.assist ? C.kids.gap : (C.waves.difficulty[opt.difficulty] || {}).gap || 1);
    const pickType = () => { const mix = Object.assign({}, C.waves.mix); if (RV.some((r) => r.active && r.type === 'trickster') || (energy < 5 && !weapon)) mix.trickster = 0; return pickW(mix); };
    const waveStep = (dt) => {
      if (wave) {
        if (wave.left > 0) { wave.t -= dt; if (wave.t <= 0) { spawn(pickType()); wave.left--; wave.t = C.waves.spawnSpacing; } }
        else if (!RV.some((r) => r.active && r.type !== 'boss')) { wave = null; nextWave = dist + rng(C.waves.gap[0], C.waves.gap[1]) * gapMul(); }
        return;
      }
      if (boss || dist < nextWave) return;
      const D = C.waves.difficulty[opt.difficulty] || {};
      let n = Math.min(C.waves.size.max, C.waves.size.base + Math.floor(dist / C.waves.size.perMetres) + (opt.assist ? 0 : D.size || 0));
      if (opt.assist) n = Math.min(n, C.kids.sizeMax);
      wave = { left: n, t: 0.2 }; waveN++;
      if (waveN === 1 || Math.random() < C.waves.weaponChance) { const l = shuffle([-1, 0, 1]).find((q) => !tallAhead(q, pz - 30, 14)); placeWeapon(kidsW(pickW(C.waves.weaponMix)), l == null ? lane : l, pz - 36); }
      audio.say(opt.assist ? STR.rivalsKids : STR.rivals);
    };
    const decal = new THREE.Mesh(new THREE.RingGeometry(0.55, 1.25, 32).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: 0xff5a2a, transparent: true, opacity: 0.8, depthWrite: false }));
    decal.add(new THREE.Mesh(new THREE.CircleGeometry(1.25, 32).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: 0xff5a2a, transparent: true, opacity: 0.22, depthWrite: false })));
    decal.visible = false; scene.add(decal);
    const slamCancel = () => { slam = null; decal.visible = false; };
    const spawnBoss = () => { bossZone = Math.floor(dist / ZONE_LEN); boss = spawn('boss', lane <= 0 ? 1 : -1); boss.zone = bossZone; warnT = 2.5; audio.say(STR.boss, true); audio.warn(); emit(); };
    const bossStep = (dt) => {
      const zi = Math.floor(dist / ZONE_LEN);
      if (!boss && !wave && zi !== bossZone && dist - zi * ZONE_LEN > ZONE_LEN - C.boss.metresBeforeZoneEnd && dist > 500) spawnBoss();
      if (!boss) return;
      if (!boss.active) { boss = null; slamCancel(); return; }
      if (boss.dying) { slamCancel(); return; }
      if (zi !== boss.zone && boss.mode !== 'leave') { boss.mode = 'leave'; slamCancel(); }
      if (boss.mode === 'leave') return;
      boss.slamT -= dt;
      if (!slam && boss.slamT <= 0 && boss.mode === 'run') {
        slam = { lane, z: pz - speed * C.boss.warnAhead - 4, t: C.boss.warnSeconds };
        decal.position.set(slam.lane * LANE, 0.04, slam.z); decal.visible = true; boss.wind = 0; audio.warn(); emit();
      }
      if (slam) {
        slam.t -= dt; decal.material.opacity = opt.reduceMotion ? 0.8 : 0.45 + 0.4 * Math.abs(Math.sin(time * 9));
        if (slam.t <= 0) {
          place('barrier', slam.lane, slam.z); burst(slam.lane * LANE, 0.6, slam.z, 0xff7a3a, 36, 7); audio.slam(); if (!opt.reduceMotion) shake = Math.max(shake, 0.3);
          boss.strikeT = 0.3; slamCancel(); boss.slamT = rng(C.boss.slamEvery[0], C.boss.slamEvery[1]) / aggro(); emit();
        }
      }
    };

    /* projectiles: blaster bolts, magnet shots, bubbles */
    const BOLTS = [], boltGeo = new THREE.SphereGeometry(0.17, 10, 8);
    const boltMat = { blaster: new THREE.MeshBasicMaterial({ color: 0x8ff6ff }), magnet: new THREE.MeshBasicMaterial({ color: 0xff8a6a }), bubble: new THREE.MeshStandardMaterial({ color: 0xcff4ff, roughness: 0.05, transparent: true, opacity: 0.6 }) };
    const rangedTarget = (dir) => {
      let best = null, bd = 1e9;
      for (const r of RV) { if (!r.active || r.dying) continue; const dx = r.x - px, dz = pz - r.z; if (dz < -6 || dz > 34) continue; if (!(Math.sign(dx) === dir || Math.abs(dx) < 0.9)) continue; const d = Math.abs(dz) + Math.abs(dx) * 0.5; if (d < bd) { bd = d; best = r; } }
      return best;
    };
    const fire = (dir, t) => {
      let b = BOLTS.find((q) => !q.active);
      if (!b) { if (BOLTS.length >= 14) return; b = { m: new THREE.Mesh(boltGeo, boltMat.blaster) }; scene.add(b.m); BOLTS.push(b); }
      const tgt = rangedTarget(dir), sp = W[t].boltSpeed;
      Object.assign(b, { active: true, t, tgt, life: 1.4, x: px + dir * 0.45, y: py + 1.55, z: pz - 0.5 });
      const ax = tgt ? tgt.x : clamp(lane + dir, -1, 1) * LANE, az = tgt ? tgt.z : pz - 22, dx = ax - b.x, dz = az - b.z, L = Math.hypot(dx, dz) || 1;
      b.vx = (dx / L) * sp; b.vz = (dz / L) * sp - speed;
      b.m.material = boltMat[t] || boltMat.blaster; b.m.visible = true; b.m.position.set(b.x, b.y, b.z);
      if (t === 'bubble') audio.pop(); else audio.zap();
    };
    const boltStep = (b, dt) => {
      b.life -= dt; if (b.life <= 0) { b.active = false; b.m.visible = false; return; }
      if (b.tgt && b.tgt.active && !b.tgt.dying) { const dx = b.tgt.x - b.x, dz = b.tgt.z - b.z, L = Math.hypot(dx, dz) || 1, sp = W[b.t].boltSpeed; b.vx = damp(b.vx, (dx / L) * sp, 6, dt); b.vz = damp(b.vz, (dz / L) * sp - speed, 6, dt); }
      b.x += b.vx * dt; b.z += b.vz * dt;
      for (const r of RV) {
        if (!r.active || r.dying) continue; const sc = C.rivals[r.type].scale;
        if (Math.abs(r.x - b.x) < 0.8 * sc && Math.abs(r.z - b.z) < 0.9 * sc) {
          b.active = false; b.m.visible = false;
          if (W[b.t].disarm && r.weapon) { weapon = { type: r.weapon.type, uses: r.weapon.uses }; r.weapon = null; rivalHold(r); showHeld(); run.looted++; pop('disarm'); audio.equip(); r.stagger = 0.4; }
          else hitRival(r, W[b.t].damage, { stagger: 0.25, color: b.t === 'bubble' ? 0xcff4ff : b.t === 'magnet' ? 0xff8a6a : 0x8ff6ff, sound: b.t !== 'bubble' });
          return;
        }
      }
      for (const o of obs) {
        if (!o.active || isGap(o) || Math.abs(o.z - b.z) > o.hd + 0.3 || Math.abs(o.x - b.x) > o.hw * 0.9) continue;
        if (o.type === 'crate') { breakCrate(o); b.active = false; b.m.visible = false; return; }
        if (TALL[o.type]) { b.active = false; b.m.visible = false; burst(b.x, b.y, b.z, 0x8ff6ff, 6, 2); return; }
      }
    };

    /* player attacks: Q / E, the corner buttons, or LB / RB */
    const attack = (dir) => {
      if (!opt.combat || state !== 'playing' || tut || atkCd > 0 || jetT > 0) return;
      const Wt = weapon ? W[weapon.type] : null;
      atkDir = dir; atkT = 0.28; atkCd = Wt ? Wt.cooldown : C.shove.cooldown;
      if (Wt && Wt.ranged) { fire(dir, weapon.type); weapon.uses--; }
      else {
        const reach = Wt ? Wt.reach : C.shove.reach; let tgt = null, bd = 1e9;
        for (const r of RV) {
          if (!r.active || r.dying) continue;
          const dx = r.x - px, dz = Math.abs(r.z - pz); if (dz > reach) continue;
          if (!((Math.sign(dx) === dir && Math.abs(dx) < LANE * 1.6) || Math.abs(dx) < 0.9)) continue;
          const d = dz + Math.abs(dx) * 0.25; if (d < bd) { bd = d; tgt = r; }
        }
        audio.whoosh(dir);
        if (tgt) { hitRival(tgt, Wt ? Wt.damage : C.shove.damage, { push: Wt ? Wt.push : 1, dir, stun: Wt ? Wt.stun || 0 : 0, stagger: Wt ? Wt.stagger : 0.45 }); if (Wt) weapon.uses--; }
      }
      if (weapon && weapon.uses <= 0) { weapon = null; showHeld(); burst(px + dir * 0.4, 1.4 + py, pz - 0.4, 0xd8d2c4, 12, 3); pop('broke'); }
      emit();
    };

    return {
      addCoin,
      attack,
      debris,
      give(t) { const k = kidsW(t); weapon = { type: k, uses: W[k].uses }; showHeld(); emit(); },
      debugWave() { nextWave = 0; wave = null; },
      debugBoss() { if (!boss) spawnBoss(); },
      debugInfo() { return { rivals: RV.filter((r) => r.active).map((r) => ({ type: r.type, lane: r.lane, dz: Math.round((r.z - pz) * 10) / 10, hp: Math.round(r.hp), mode: r.mode, weapon: r.weapon && r.weapon.type, dying: r.dying > 0 })), weapon, coinsOnTrack: coins.filter((c) => c.active).length, pickups: WP.filter((p) => p.active).map((p) => p.type), slam: !!slam, nextWave, wave: !!wave, lane, takedowns: run.takedowns, coins: run.coins, looted: run.looted, score: Math.floor(score), popup: popT > 0 && popup ? popup.kind : '' }; },
      hud: () => ({ on: !!opt.combat, weapon: weapon ? { type: weapon.type, uses: weapon.uses, max: W[weapon.type].uses, ranged: !!W[weapon.type].ranged } : null, popup: popT > 0 ? popup : null, warn: slam ? 'slam' : warnT > 0 ? 'boss' : '', boss: boss && boss.active && !boss.dying ? Math.max(0, boss.hp / boss.max) : -1 }),
      clear() { RV.forEach((r) => r.active && remove(r)); BOLTS.forEach((b) => { b.active = false; b.m.visible = false; }); WP.forEach((p) => { p.active = false; p.g.visible = false; }); weapon = null; showHeld(); boss = null; wave = null; slamCancel(); nextWave = Math.max(dist + 120, C.waves.first); },
      reset() {
        this.clear(); coins.forEach((c) => (c.active = false)); DEB.forEach((d) => { d.active = false; d.m.visible = false; });
        bossZone = -1; nextWave = C.waves.first; waveN = 0; combo = comboT = popT = warnT = atkT = atkCd = 0; popup = null;
      },
      end() { slamCancel(); atkT = 0; },
      update(dt) {
        atkT = Math.max(0, atkT - dt); atkCd = Math.max(0, atkCd - dt); if (comboT > 0) comboT -= dt;
        if (popT > 0) { popT -= dt; if (popT <= 0) emit(); }
        if (warnT > 0) { warnT -= dt; if (warnT <= 0) emit(); }
        coinStep(dt);
        if (tut) return;
        if (opt.combat) { waveStep(dt); bossStep(dt); }
        for (const r of RV) if (r.active) rivalStep(r, dt);
        for (const b of BOLTS) if (b.active) boltStep(b, dt);
        for (const p of WP) {
          if (!p.active) continue;
          if (p.z > pz + 6) { p.active = false; p.g.visible = false; continue; }
          if (Math.abs(p.z - pz) < 1.2 && Math.abs(p.x - px) < 1.15 && py < 2.6) {
            p.active = false; p.g.visible = false; weapon = { type: p.type, uses: p.uses }; showHeld(); run.looted++; audio.equip(); burst(p.x, 1.4, p.z, 0xf2c46b, 20, 3); pop('equip'); emit();
          }
        }
      },
      pose() {
        if (atkT <= 0) return;
        const k = Math.sin((1 - atkT / 0.28) * PI), d = atkDir;
        R.torso.rotation.z += -d * 0.38 * k; R.root.position.x += d * 0.35 * k;
        if (weapon && W[weapon.type].melee) { R.sh[1].rotation.x = lerp(R.sh[1].rotation.x, -1.9, k); R.sh[1].rotation.z = d > 0 ? 0.9 * k : -0.2 * k; }
        else if (weapon) { R.sh[1].rotation.x = -1.5; R.sh[1].rotation.z = d * 0.5; }
        else R.sh[d > 0 ? 1 : 0].rotation.z += (d > 0 ? 1 : -1) * 0.9 * k;
      },
      visuals(dt) {
        for (const r of RV) {
          if (!r.active) continue;
          r.root.position.set(r.x, r.py + r.fy, r.z);
          if (!r.fly) {
            r.phase += dt * (r.v || speed) * 0.55;
            const s = Math.sin(r.phase), L = r.legs, A = r.arms, P = PROP[r.type];
            if (r.py > 0) { L[0].l.rotation.x = 0.9; L[0].k.rotation.x = -1.4; L[1].l.rotation.x = -0.2; L[1].k.rotation.x = -0.6; }
            else if (r.slideT > 0) { L[0].l.rotation.x = 1.2; L[1].l.rotation.x = 1.0; L[0].k.rotation.x = L[1].k.rotation.x = -0.1; }
            else { L[0].l.rotation.x = 0.75 * s; L[1].l.rotation.x = -0.75 * s; L[0].k.rotation.x = -Math.max(0, -s) * 1.2 - 0.15; L[1].k.rotation.x = -Math.max(0, s) * 1.2 - 0.15; }
            A[0].a.rotation.x = -0.7 * s; A[1].a.rotation.x = 0.7 * s; A[0].e.rotation.x = A[1].e.rotation.x = -0.9; A[1].a.rotation.z = 0;
            r.body.rotation.x = r.slideT > 0 ? 1.0 : 0;
            r.hip.position.y = P.hip - (r.slideT > 0 ? 0.55 : 0) + (r.py <= 0 && r.slideT <= 0 ? Math.abs(Math.cos(r.phase)) * 0.06 : 0);
            let lean = 0;
            if (r.wind > 0 || (r.type === 'boss' && slam)) { lean = r.windDir * 0.35; A[1].a.rotation.x = -2.2; A[0].a.rotation.x = r.type === 'boss' ? -2.2 : A[0].a.rotation.x; }
            else if (r.strikeT > 0) { lean = -r.windDir * 0.5; A[1].a.rotation.z = r.windDir * 1.1; }
            if (r.stun > 0) lean = Math.sin(time * 16) * 0.22;
            if (r.dying) lean = Math.sin(time * 30) * 0.3;
            r.torso.rotation.z = damp(r.torso.rotation.z, lean, 12, dt);
          }
          r.bar.visible = !r.dying; r.bar.quaternion.copy(camera.quaternion);
          const k = clamp(r.hp / r.max, 0, 1); r.fill.scale.x = Math.max(0.001, k); r.fill.position.x = -(1 - k) * r.bw / 2;
          r.mb.emissive.setHex(r.flashT > 0 ? 0x664422 : r.stun > 0 ? 0x10305a : 0x000000);
        }
        for (const b of BOLTS) if (b.active) b.m.position.set(b.x, b.y, b.z);
        for (const p of WP) if (p.active) { p.spin.rotation.y = time * 2; p.g.position.set(p.x, 1.45 + Math.sin(time * 2.4) * 0.12, p.z); }
        for (const d of DEB) {
          if (!d.active) continue; d.t -= dt; if (d.t <= 0) { d.active = false; d.m.visible = false; continue; }
          d.v[1] += G * 0.7 * dt; const q = d.m.position; q.x += d.v[0] * dt; q.y += d.v[1] * dt; q.z += d.v[2] * dt;
          if (q.y < 0.12) { q.y = 0.12; d.v[1] *= -0.35; d.v[0] *= 0.7; d.v[2] *= 0.7; }
          d.m.rotation.x += d.s[0] * dt; d.m.rotation.y += d.s[1] * dt; d.m.rotation.z += d.s[2] * dt;
        }
        for (let i = 0; i < COIN_N; i++) {
          const c = coins[i];
          if (c.active && c.z > pz - 150) { dummy.position.set(c.x, c.y + (c.fly > 0 ? 0 : Math.sin(time * 3 + i) * 0.06), c.z); dummy.rotation.set(0, time * 3 + i, 0); dummy.scale.setScalar(1); }
          else { dummy.position.set(0, -50, 0); dummy.scale.setScalar(0.0001); }
          dummy.updateMatrix(); coinMesh.setMatrixAt(i, dummy.matrix);
        }
        coinMesh.instanceMatrix.needsUpdate = true;
      }
    };
  })();

  /* game state */
  let state = 'title', time = 0, dist = 0, pz = 0, speed = 0, lane = 0, px = 0, py = 0, vy = 0, grounded = true, slideT = 0, slideQueued = false;
  let phase = 0, lives = 3, energy = 0, magnetT = 0, shieldT = 0, invuln = 0, hitT = 0, shake = 0, flash = 0, camBlend = 0, overT = 0, overShown = false;
  let nextRowZ = -48, nextPower = 300, curZone = 0, toast = '', toastT = 0, hint = '', hintT = 0, hudT = 0, newBest = false;
  let score = 0, multT = 0, jetT = 0, jetFx = 0, caption = '', capT = 0, notice = '', noticeT = 0, menuOpen = false, lastInput = touch ? 'touch' : 'keys', padOn = false;
  let lastHairpin = 0;
  let ex = null, exYaw = 0, exAct = false, exLook = 0, exDrag = null, carryFx = [];   // explore mode (see below)
  let tut = null, tScale = 1, tTarget = 1, skinGlow = 0x46e0ff, gliding = false, umbK = 0, sprintT = 0, foodLuck = 1, gradeS = 0, mudT = 0, webT = 0, rideKind = null, rideT = 0, rideHp = 0, nextRide = 400, rideBump = 0, crashV = 0, crashed = false, nextHerb = 300, nextShop = 420, shopIdx = 0, bootsOn = false, sickleOn = false;   // gradeS: current slope as a speed change (+ uphill / - downhill)
  const JET_T = 6, JET_Y = 4.2, HOLD_T = 0.18;
  const run = { dist: 0, energy: 0, jumps: 0, slides: 0, dodges: 0, powerups: 0, zones: 1, hits: 0, noHit: 0, score: 0, coins: 0, takedowns: 0, looted: 0 };
  const btn = { down: false, t: 0, slid: false, src: null };
  const fps = { t: 0, n: 0, low: 0, skip: 2 };
  let coinsTotal = store.get('coins', 0), hitStop = 0;
  const hinted = {}, W = { idle: 1, run: 0, jump: 0, slide: 0, down: 0, ride: 0 }, envC = { fog: new THREE.Color(), sky: new THREE.Color(), ground: new THREE.Color(), sun: new THREE.Color(), track: new THREE.Color(), floor: new THREE.Color(), floorEm: new THREE.Color(), dust: new THREE.Color() };
  let aspect = 1, envK = 1, sideCam = false;
  const HINT_KIND = { block: 'lane', log: 'jump', beam: 'slide', boulder: 'boulder', gap: 'gap', lava: 'gap', void: 'gap', roller: 'roller', slider: 'slider', crate: 'crate', barrier: 'lane', pothole: 'pothole', mud: 'mud', web: 'web', shop_snacks: 'shop', shop_pharmacy: 'shop', shop_tools: 'shop', shop_clothes: 'shop' };

  const clockInfo = (area) => {   // the time, the day's part and the temperature for where you are (the Wayanad ghat is cooler than the coast)
    if (!clock || !window.RoboClock || opt.world !== 'malabar') return null;
    const C = window.RoboClock, h = clock.hours(), kind = area || (ZONES[curZone] && ZONES[curZone].kind === 'wayanad' ? 'wayanad' : 'kozhikode');
    return { label: C.fmt(h), icon: C.icon(h), phase: C.phase(h), temp: C.temperature(kind, h) };
  };
  const emit = () => onHud({
    screen: state === 'over' ? (overShown ? 'over' : 'playing') : state,
    score: Math.floor(score), dist: Math.floor(dist), cells: energy, lives, unlimited: opt.unlimited, best, newBest, zone: curZone,
    magnet: magnetT > 0 ? Math.min(1, magnetT / 10) : 0, shield: shieldT > 0 ? Math.min(1, shieldT / 15) : 0, mult: multT > 0 ? Math.min(1, multT / 12) : 0, jet: jetT > 0 ? jetT / JET_T : 0,
    slope: gradeS > 0.05 ? 'up' : gradeS < -0.05 ? 'down' : '',
    boots: bootsOn ? 1 : 0, sickle: sickleOn ? 1 : 0,
    ride: rideKind || '', rideT: rideKind ? Math.max(0, rideT / RIDES[rideKind].secs) : 0, rideHp,
    toast: toastT > 0 ? toast : '', hint: hintT > 0 ? hint : '', caption: capT > 0 ? caption : '', notice: noticeT > 0 ? notice : '',
    tut: tut ? { step: Math.min(tut.i + 1, tut.steps.length), total: tut.steps.length, kind: tut.prompt, waiting: tut.waiting } : null,
    muted: audio.muted, voice: audio.voice, vol: { music: audio.vol.music, sfx: audio.vol.sfx, voice: audio.vol.voice }, music: audio.musicFound(),
    touch, input: lastInput, pad: padOn, quality: effQ(), tutorialDone: store.get('tutDone', false),
    clock: clockInfo(), coins: run.coins, coinsTotal, cb: CB.hud(),
    run: Object.assign({}, run, { dist: Math.floor(dist), energy, score: Math.floor(score), noHit: run.hits ? run.noHit : Math.floor(dist) })
  });
  const showToast = (t) => { toast = t; toastT = 2.8; emit(); };
  const showNotice = (k) => { notice = k; noticeT = 4; emit(); };
  const setInput = (k) => { if (lastInput !== k) { lastInput = k; emit(); } };
  audio.onCaption = (t) => { caption = t; capT = Math.max(2.4, t.length * 0.08); emit(); };
  const showHint = (t) => { hint = t; hintT = 2.2; emit(); };

  const SUN0 = [8, 16, -3], sunOff = new THREE.Vector3(...SUN0), tv = new THREE.Vector3(), fxKinds = MAL ? MAL.kinds : [];   // light offset from the player; blend of each Malabar zone kind (0..1)
  const snapEnv = (z) => {
    const Z = ZONES[z];
    envC.fog.set(Z.fog); envC.sky.set(Z.sky); envC.ground.set(Z.ground); envC.sun.set(Z.sunColor); envC.track.set(Z.track); envC.floor.set(Z.floor); envC.floorEm.set(Z.floorEm); envC.dust.set(Z.dust);
    fog.density = Z.density; sun.intensity = Z.sun; hemi.intensity = Z.hemi; R.lamp.intensity = Z.head; envK = Z.env;
    sunOff.set(...(Z.sunPos || SUN0)); for (const f of fxKinds) fxK[f] = Z.kind === f ? 1 : 0;
  };
  const tc = new THREE.Color();
  const lerpEnv = (z, dt) => {
    const Z = ZONES[z], k = 1 - Math.exp(-0.8 * dt);
    sunOff.lerp(tv.set(...(Z.sunPos || SUN0)), k); for (const f of fxKinds) fxK[f] = lerp(fxK[f] || 0, Z.kind === f ? 1 : 0, k);
    envC.fog.lerp(tc.set(Z.fog), k); envC.sky.lerp(tc.set(Z.sky), k); envC.ground.lerp(tc.set(Z.ground), k); envC.sun.lerp(tc.set(Z.sunColor), k);
    envC.track.lerp(tc.set(Z.track), k); envC.floor.lerp(tc.set(Z.floor), k); envC.floorEm.lerp(tc.set(Z.floorEm), k); envC.dust.lerp(tc.set(Z.dust), k);
    fog.density = lerp(fog.density, Z.density, k); sun.intensity = lerp(sun.intensity, Z.sun, k); hemi.intensity = lerp(hemi.intensity, Z.hemi, k); R.lamp.intensity = lerp(R.lamp.intensity, Z.head, k); envK = lerp(envK, Z.env, k);
  };
  const applyEnv = () => {
    fog.color.copy(envC.fog); hemi.color.copy(envC.sky); hemi.groundColor.copy(envC.ground); sun.color.copy(envC.sun);
    M.track.color.copy(envC.track); M.curb.color.copy(envC.track).multiplyScalar(0.85); M.floor.color.copy(envC.floor); M.floor.emissive.copy(envC.floorEm); dustMat.color.copy(envC.dust);
    dustMat.opacity = lerp(dustMat.opacity, ZONES[curZone].dustOp, 0.05);
    for (const m of MATS) m.envMapIntensity = m.userData.env * Math.max(envK, m.userData.minEnv);
  };

  const resetWorld = () => {
    ZONES = WORLDS[opt.world] || CLASSIC_ZONES;
    dist = 0; pz = 0; speed = 0; lane = 0; px = 0; py = 0; vy = 0; grounded = true; slideT = 0; slideQueued = false; phase = 0;
    lives = 3; energy = 0; magnetT = 0; shieldT = 0; invuln = 0; hitT = 0; shake = 0; flash = 0; overT = 0; overShown = false; newBest = false;
    score = 0; multT = 0; jetT = 0; capT = 0; noticeT = 0; btn.down = false; Object.assign(run, { dist: 0, energy: 0, jumps: 0, slides: 0, dodges: 0, powerups: 0, zones: 1, hits: 0, noHit: 0, score: 0, coins: 0, takedowns: 0, looted: 0 }); hitStop = 0; CB.reset();
    nextRowZ = -48; nextPower = rng(260, 360); curZone = 0; toastT = 0; hintT = 0; sprintT = 0; foodLuck = 1; gradeS = 0; mudT = 0; webT = 0; rideKind = null; rideT = 0; rideHp = 0; rideBump = 0; crashV = 0; crashed = false; nextRide = rng(300, 450); nextHerb = rng(200, 320); nextShop = rng(350, 500); shopIdx = 0; bootsOn = false; sickleOn = false; for (const k in rideM) rideM[k].visible = false;
    obs.forEach((o) => { o.active = false; o.g.visible = false; });
    cells.forEach((c) => (c.active = false));
    pickups.forEach((p) => { p.active = false; p.g.visible = false; });
    slots.forEach((s, i) => { s.z = 12 - (i % SLOT_N) * SLOT_GAP; decorate(s); });
    for (let i = 0; i < CURB_N * 2; i++) { curbZ[i] = 10 - (i % CURB_N) * CURB_LEN; setCurb(i); }
    curbs.instanceMatrix.needsUpdate = true;
    gates.forEach((g, i) => placeGate(g, -40 - i * 55));
    R.root.visible = true; R.shield.visible = false; R.mGlow.emissive.setHex(skinGlow); R.mGlow.emissiveIntensity = 2.4;
    for (const k in W) W[k] = k === 'idle' ? 1 : 0;
    snapEnv(0); applyEnv(); audio.setZone(0, true);
    for (let i = 0; i < DUST_N; i++) dustPos.set([rng(-10, 10), rng(0.3, 6), rng(-70, 5)], i * 3);
    spkLife.fill(0);
  };

  /* level generation */
  const levelAt = (d) => (d < 250 ? 0 : d < 650 ? 1 : d < 1150 ? 2 : d < 2000 ? 3 : 4);
  const spawnRow = (z) => {
    const d = -z, lv = levelAt(opt.assist ? d * 0.6 : d), zone = zoneAt(d), Z = ZONES[zone], L = shuffle([-1, 0, 1]), pats = [];
    if (Z.shops && !tut && d > nextShop) { nextShop = d + rng(650, 900); place('shop_' + Z.shops[shopIdx++ % Z.shops.length], 1, z); return; }   // a shop takes the whole row
    const add = (w, fn) => pats.push([w, fn]);
    add(3, () => place('block', L[0], z));
    add(3, () => place('log', L[0], z));
    add(lv >= 4 ? 3 : 1.5, () => { place('block', L[0], z); place('block', L[1], z); });
    if (lv >= 1) { add(2.5, () => place('beam', L[0], z)); add(1.5, () => [-1, 0, 1].forEach((l) => place('log', l, z))); }
    if (lv >= 2) {
      add(1.5, () => [-1, 0, 1].forEach((l) => place('beam', l, z)));
      add(2, () => { place('block', L[0], z); place('beam', L[1], z); place('log', L[2], z); });
      add(1.5, () => { place('block', L[0], z); place('log', L[1], z); place('log', L[2], z); });
    }
    if (lv >= 3) { add(2, () => place('boulder', L[0], z - 28)); add(lv >= 4 ? 2 : 1, () => { place('boulder', L[0], z - 28); place('block', L[1], z); }); }
    if (lv >= 2) {
      const ice = Z.kind === 'ice' ? 2.5 : 1;
      add(Z.kind === 'sky' ? 2.6 : 1.3, () => place('roller', L[0], z - 24));
      add(1.3 * ice, () => { const a = Math.random() < 0.5 ? -1 : 1; if (Math.random() < 0.5) place('slider', a, z, 0); else place('slider', 0, z, a); });
      add(0.9 * ice, () => { const e = Math.random() < 0.5 ? -1 : 1; place('block', e, z); if (Math.random() < 0.5) place('slider', 0, z, -e); else place('slider', -e, z, 0); });
    }
    if (lv >= 1) add(opt.combat ? 1.6 : 1, () => place('crate', L[0], z));
    if (Z.gap && lv >= 1) add(2.5, () => place(Z.gap, 0, z));
    if (Z.gap && d % ZONE_LEN < 60 && lv >= 1) pats.length = 0, add(1, () => place(Z.gap, 0, z)); // greet the zone with its gap
    if (Z.road) {
      add(2.2, () => place('pothole', L[0], z));
      add(1.3, () => { place('pothole', L[0], z); place('pothole', L[1], z - 3); });
      add(1.6, () => place('mud', L[0], z - 2));
    }
    if (Z.webs) { add(1.9, () => place('web', L[0], z)); add(0.8, () => { place('web', L[0], z); place('web', L[1], z); }); }
    let tot = pats.reduce((s, p) => s + p[0], 0), r = Math.random() * tot;
    for (const [w, fn] of pats) { r -= w; if (r <= 0) { fn(); break; } }
    // energy cells on a passable lane leading into this row
    if (Math.random() < 0.8) {
      const rowObs = obs.filter((o) => o.active && Math.abs(o.z - z) < 1);
      const tall = (l) => rowObs.some((o) => TALL[o.type] && o.lane === l);
      const free = [-1, 0, 1].filter((l) => !tall(l)), l = free[(Math.random() * free.length) | 0], x = l * LANE;
      const inLane = rowObs.find((o) => o.lane === l || isGap(o));
      if (Math.random() < COMBAT.coins.trackChance) for (let i = 0; i < 5; i++) CB.addCoin(x, 1.0, z + 5 + i * 2.4);
      else for (let i = 0; i < 5; i++) addCell(x, 1.0, z + 5 + i * 2.4);
      if (inLane && (inLane.type === 'log' || inLane.type === 'pothole' || isGap(inLane))) [[-1.8, 2.0], [0, 2.5], [1.8, 2.0]].forEach(([dz, y]) => addCell(x, y, z + dz));
      else if (inLane && inLane.type === 'beam') [-1, 0, 1].forEach((dz) => addCell(x, 0.6, z + dz * 1.4));
      if (d > nextPower) {
        nextPower = d + rng(380, 540);
        const pl = free.filter((q) => q !== l), pw = [['magnet', 3], ['shield', 3], ['mult', 2.5], ['jet', lv >= 1 ? 1.6 : 0]];
        let pr = Math.random() * pw.reduce((a, p) => a + p[1], 0), pt = 'magnet'; for (const [k, w] of pw) { pr -= w; if (pr <= 0) { pt = k; break; } }
        placePickup(pt, pl.length ? pl[0] : l, z + 9);
      }
      if (Z.herbs && !tut && d > nextHerb) {   // a health herb now and then, more often when you are hurt
        nextHerb = d + rng(220, 360);
        const fl = free.filter((q) => q !== l);
        if (fl.length && (lives < 3 || Math.random() < 0.3)) placePickup('herb:' + Z.herbs[(Math.random() * Z.herbs.length) | 0], fl[(Math.random() * fl.length) | 0], z + 15);
      }
      if (Z.rides && !tut && !rideKind && d > nextRide) {
        const fl = free.filter((q) => q !== l);
        if (fl.length) { nextRide = d + rng(550, 800); placePickup('ride:' + Z.rides[(Math.random() * Z.rides.length) | 0], fl[(Math.random() * fl.length) | 0], z + 11); }
      }
      if (Z.food && !tut && Math.random() < (opt.assist ? 0.34 : 0.24) * foodLuck) {
        const fl = free.filter((q) => q !== l);
        if (fl.length) placePickup('food:' + Z.food[(Math.random() * Z.food.length) | 0], fl[(Math.random() * fl.length) | 0], z + 13);
      }
    }
  };
  const diff = () => { const D = DIFF[opt.difficulty] || DIFF.Moderate; return opt.assist ? { v0: D.v0 * ASSIST.v, vmax: D.vmax * ASSIST.vmax, acc: D.acc * ASSIST.acc, gap: D.gap * ASSIST.gap } : D; };
  const rowGap = (d) => { const D = diff(); return Math.max(15, (30 - 14 * Math.min(1, d / 2600)) * D.gap + rng(0, 6)); };
  const spawnAhead = () => { while (nextRowZ > pz - 150) { spawnRow(nextRowZ); nextRowZ -= rowGap(-nextRowZ); } };

  /* actions */
  const move = (dir) => { const n = clamp(lane + dir, -1, 1); if (n !== lane) { lane = n; audio.whoosh(dir); } };
  const jump = () => { if (grounded && jetT <= 0) { grounded = false; vy = JUMP_V; slideT = 0; py = Math.max(py, 0.001); audio.jump(); } };
  const startSlide = () => { slideT = clamp(11 / Math.max(speed, 8), 0.4, 0.55); slideQueued = false; audio.slide(); };   // was a flat 0.75 s: about 17 m at top speed; now 0.55 s down to 0.4 s as you speed up (a beam is under a metre deep)
  const slide = () => { if (jetT > 0 || rideKind) return; if (grounded) startSlide(); else { vy = Math.min(vy, -24); slideQueued = true; } };
  /* player input goes through act(): during a tutorial freeze only the move being taught is accepted */
  const act = (kind, dir) => {
    if (state !== 'playing') return;
    if (kind === 'move' && clamp(lane + dir, -1, 1) === lane) return;
    if (tut && tut.waiting) { if (kind !== TUT[tut.steps[tut.i]].wait) return; tut.waiting = false; tut.ok = true; tTarget = 1; tScale = Math.max(tScale, 0.75); tut.prompt = 'nice'; emit(); }
    if (kind === 'move') move(dir); else if (kind === 'jump') jump(); else slide();
  };
  /* tutorial: one obstacle per lesson; time eases to a stop at the ideal moment until the player does the move */
  const TUT = {
    lane: { spawn: () => [place('block', lane, pz - 46)], ideal: () => speed * 0.5 + 1.8, wait: 'move' },
    jump: { spawn: () => [-1, 0, 1].map((l) => place('log', l, pz - 46)), ideal: () => speed * 0.36, wait: 'jump' },
    slide: { spawn: () => [-1, 0, 1].map((l) => place('beam', l, pz - 46)), ideal: () => speed * 0.25 + 0.9, wait: 'slide' },
    autojump: { spawn: () => [-1, 0, 1].map((l) => place('log', l, pz - 46)), wait: null },
    autosteer: { spawn: () => [place('block', lane, pz - 46)], wait: null }
  };
  const TUT_STEPS = { standard: ['lane', 'jump', 'slide'], tapzones: ['lane', 'autojump'], onebutton: ['jump', 'slide', 'autosteer'] };
  const tutUpdate = (dt) => {
    const st = TUT[tut.steps[tut.i]];
    if (!tut.obs) { tut.gapT -= dt; if (tut.gapT <= 0) { tut.obs = st.spawn(); tut.prompt = tut.steps[tut.i]; tut.waiting = false; tut.ok = false; emit(); } return; }
    const o = tut.obs[0], ahead = pz - o.z;
    if (st.wait && !tut.ok && !tut.waiting && ahead <= st.ideal() + speed * 0.1) {
      const ready = st.wait === 'move' ? Math.abs(o.x - lane * LANE) < 0.5 : st.wait === 'jump' ? grounded : slideT <= 0;
      if (ready) { tut.waiting = true; tTarget = 0; emit(); } else tut.ok = true;
    }
    if (o.z > pz + 3) {
      tut.obs = null; tut.i++; tut.gapT = 1.1; tut.prompt = 'nice';
      if (tut.i >= tut.steps.length) { tut = null; store.set('tutDone', true); ['block', 'log', 'beam'].forEach((t) => (hinted[t] = true)); nextRowZ = pz - 60; showNotice('ready'); audio.say(STR.ready, true); }
      emit();
    }
  };
  const tutRetry = () => { if (!tut || !tut.obs) return; tut.obs.forEach((o) => { o.active = false; o.g.visible = false; }); tut.obs = null; tut.gapT = 1.2; tut.prompt = 'again'; tut.waiting = false; tTarget = 1; };
  /* assisted control styles: tap-zones auto-jumps and auto-slides; one-button steers around tall obstacles */
  const laneOf = (x) => Math.round(x / LANE);
  const blocked = (l, t0, t1) => obs.some((o) => {
    if (!o.active || o.hit || !TALL[o.type]) return false;
    const tti = (pz - o.z) / Math.max(1, speed + o.vz);
    return tti > t0 && tti < t1 && (laneOf(o.x) === l || laneOf(o.x1) === l);
  });
  const autoPlay = () => {
    if (opt.scheme === 'standard' || jetT > 0) return;
    if (opt.scheme === 'tapzones') {
      for (const o of obs) {
        if (!o.active || o.hit || o.auto) continue;
        const gap = isGap(o); if (!gap && Math.abs(o.x - lane * LANE) > 1.2) continue;
        const tti = (pz - o.z) / Math.max(1, speed + o.vz); if (tti < 0) continue;
        if ((o.type === 'log' || o.type === 'roller' || gap) && tti <= 0.36 && grounded) { o.auto = true; jump(); }
        else if (o.type === 'beam' && tti <= 0.3) { o.auto = true; slide(); }
      }
    } else if (blocked(lane, -0.15, 0.85)) {
      let to = null;
      for (const l of [lane - 1, lane + 1, lane - 2, lane + 2]) if (l >= -1 && l <= 1 && !blocked(l, -0.35, 1.4) && (Math.abs(l - lane) < 2 || !blocked((l + lane) / 2, -0.1, 0.25))) { to = l; break; }
      if (to !== null) { const s = Math.sign(to - lane); while (lane !== to) move(s); }
    }
  };

  /* things that break apart when something runs into them: tumbling pieces in the obstacle's own material */
  const SHATTER = { block: 1, log: 1, beam: 1, slider: 1, roller: 1 };
  const shatter = (o) => {
    o.active = false; o.g.visible = false;
    let m = null; o.g.traverse((c) => { if (!m && c.isMesh && c.material && c.material !== M.rune) m = c.material; });
    CB.debris(o.x, 0.5, o.z, m || M.stone, effQ() === 'High' ? 9 : 5); burst(o.x, 1.3, o.z, 0xd8c8a8, 28, 5.5);
  };
  /* running through a block during the grace period after a hit: it shatters harmlessly instead of being walked through like a ghost */
  const bumpThrough = (o) => { if (!SHATTER[o.type]) return; o.hit = true; shatter(o); audio.crash(); if (!opt.reduceMotion) shake = Math.max(shake, 0.18); };
  const hit = (o) => {
    o.hit = true;
    if (shieldT > 0) {
      shieldT = 0; invuln = 0.8; if (SHATTER[o.type]) shatter(o); else { o.active = false; o.g.visible = false; } hitStop = Math.max(hitStop, 0.06); burst(o.x, 1.2, o.z, 0x9fdcff, 40, 6); audio.shieldBreak(); audio.say(STR.shieldDown, true); emit(); return;
    }
    const soft = !!tut; // practice hits are free
    if (!soft) { if (!run.hits) run.noHit = Math.floor(dist); run.hits++; if (!opt.unlimited) lives--; }
    invuln = soft ? 1 : 2.0; hitT = 0.45; speed *= soft ? 0.7 : 0.55; shake = opt.reduceMotion || soft ? 0 : 0.45; flash = opt.reduceMotion || soft ? 0.3 : 1;
    burst(px, 1.6 + py, pz - 0.4, 0xffb050, 46, 5.5); audio.hit();
    if (isGap(o)) { vy = 11; grounded = false; py = Math.max(py, 0.01); }
    if (soft) { if (SHATTER[o.type]) shatter(o); audio.crash(); hitStop = Math.max(hitStop, 0.07); if (!opt.reduceMotion) shake = 0.25; tutRetry(); }   // practice hit: the block still shatters and thumps, it just costs nothing
    else if (lives <= 0) gameOver(o);   // the block you crashed into stays where it stopped you
    else { audio.say(opt.assist ? STR.oops : lives === 1 ? STR.critical : STR.hull, true); hitStop = Math.max(hitStop, 0.07); if (SHATTER[o.type]) shatter(o); }
    emit();
  };
  /* mounting, taking hits on the ride's behalf, and getting off */
  const startRide = (kind) => {
    const sp = RIDES[kind]; if (!sp || !rideM[kind]) return;
    rideKind = kind; rideT = sp.secs; rideHp = sp.hp; jetT = 0; slideT = 0; slideQueued = false; gliding = false;
    for (const k in rideM) rideM[k].visible = k === kind;
    burst(px, 1 + py, pz, 0xffd27a, 30, 4); audio.power(); audio.say(sp.say, true); emit();
  };
  const endRide = (broken) => {
    rideKind = null; rideT = 0; for (const k in rideM) rideM[k].visible = false;
    invuln = Math.max(invuln, 1.4); burst(px, 1.2 + py, pz, broken ? 0xff9a60 : 0xffe2a0, 30, 5); if (broken) audio.shieldBreak(); emit();
  };
  const rideHit = (o) => {
    o.hit = true;
    if (RIDES[rideKind].smash[o.type]) {   // the ride crashes through: obstacle shatters, short freeze, the ride nods into it
      if (SHATTER[o.type]) shatter(o); else { o.active = false; o.g.visible = false; burst(o.x, 1.2, o.z, 0xd8c8a8, 26, 5); }
      audio.crash(); score += 40; speed *= 0.9; rideBump = 0.3; hitStop = Math.max(hitStop, 0.05); if (!opt.reduceMotion) shake = Math.max(shake, 0.3); return;
    }
    rideHp--; hitT = 0.45; invuln = Math.max(invuln, 0.8); speed *= 0.7; rideBump = 0.4; hitStop = Math.max(hitStop, 0.08); shake = opt.reduceMotion ? 0 : 0.4;
    burst(px, 1.4 + py, pz - 0.4, 0xffb050, 30, 5); audio.hit(); if (SHATTER[o.type]) shatter(o);
    if (isGap(o)) { vy = 11; grounded = false; py = Math.max(py, 0.01); }
    if (rideHp <= 0) endRide(true); else emit();
  };
  const gameOver = (o) => {
    state = 'over'; overT = 0; invuln = 0; R.root.visible = true; jetT = 0; rideKind = null; for (const k in rideM) rideM[k].visible = false; btn.down = false; tut = null; tScale = tTarget = 1;
    if (o && !isGap(o) && Math.abs(o.x - px) < 1.6) {
      o.vz = 0; dist = Math.min(dist, -(o.z + o.hd + 0.7)); pz = -dist; speed = 0;
      if (SHATTER[o.type]) { let m = null; o.g.traverse((c) => { if (!m && c.isMesh && c.material && c.material !== M.rune) m = c.material; }); CB.debris(o.x, 1, o.z + o.hd, m || M.stone, 5); }
      crashed = true; crashV = 6; vy = 6; grounded = false; hitT = 0.6; burst(px, 1.2, pz - 0.6, 0xd8c8a8, 30, 5);   // knocked back off the block
    }
    const sc = Math.floor(score);
    if (sc > best) { best = sc; newBest = true; store.set(bestKey(), best); }
    if (opt.assist) audio.overSoft(); else { R.mGlow.emissive.set(0xff5533); audio.over(); }
    setTimeout(() => audio.say(opt.assist ? STR.overKids : STR.over, true), 350);
    audio.music('title'); CB.end();
    coinsTotal += run.coins; store.set('coins', coinsTotal);
    onRunEnd(Object.assign({}, run, { dist: Math.floor(dist), energy, score: sc, newBest, noHit: run.hits ? run.noHit : Math.floor(dist), kids: opt.assist }));
  };

  /* simulation step (fixed 1/120 s) */
  const tmpP = {};
  const update = (dt) => {
    time += dt;
    const D = diff();
    if (state === 'playing') {
      const zg = ZONES[zoneAt(dist)].grade, gk = zg && !tut ? Math.sin(((dist % ZONE_LEN) / ZONE_LEN) * zg[0] * PI * 2) * zg[1] : 0;   // zone grade: [slope waves per zone, speed change]
      gradeS = lerp(gradeS, gk, 1 - Math.exp(-2 * dt));
      const tgt = (tut ? D.v0 : Math.min(D.vmax, D.v0 + dist * D.acc)) * (1 - gradeS) * (sprintT > 0 ? 1.12 : 1) * (mudT > 0 ? 0.8 : 1) * (webT > 0 ? 0.72 : 1) * (rideKind ? RIDES[rideKind].speed : 1); speed = approach(speed, tgt, (speed < tgt ? 7 : 20) * dt); camBlend = Math.min(1, camBlend + dt / 1.1); }
    else if (state === 'over') { speed = approach(speed, 0, 26 * dt); overT += dt; if (overT > 1.2 && !overShown) { overShown = true; emit(); } }
    else if (state === 'explore') exStep(dt);   // walking: explore.js moves the character, then the same pose blending below animates it
    else speed = 0;
    if (state !== 'explore') {
      dist += speed * dt; pz = -dist;
      if (crashV > 0) { dist -= crashV * dt; pz = -dist; crashV = Math.max(0, crashV - 15 * dt); }
      px = damp(px, lane * LANE, mudT > 0 && grounded ? 4.5 : 13, dt);
    }
    if (jetT > 0) {
      jetT -= dt; py = damp(py, JET_Y, 3.2, dt); vy = 0; grounded = false; gliding = false;
      jetFx -= dt; if (jetFx <= 0) { jetFx = 1 / 60; thrust(); if (Math.random() < 0.2) audio.jet(); }
      if (jetT <= 0) { jetT = 0; invuln = Math.max(invuln, 1.3); emit(); }
    } else if (!grounded) {
      vy += G * dt; gliding = !!umb && opt.umbrella && !rideKind && !slideQueued && vy < -3 && py > 0.3; if (gliding) vy = Math.max(vy, -4.2);
      py += vy * dt; if (py <= 0) { py = 0; vy = 0; grounded = true; audio.land(); if (slideQueued) startSlide(); }
    } else gliding = false;
    if (slideT > 0) slideT -= dt;
    const sliding = slideT > 0 && grounded;
    let amp = 0;
    if (state !== 'title') {
      amp = clamp(0.52 + speed * 0.011, 0.5, 0.8) * clamp(speed / 7, 0.3, 1);
      if (grounded && !sliding && speed > 0.05) {
        const S = amp * PI * 1.12, prev = phase; // stride length matched to leg sweep so the planted foot doesn't slide
        phase += (speed * dt * PI) / S;
        if (Math.floor((phase + 0.4) / PI) !== Math.floor((prev + 0.4) / PI) && speed > 1.5) audio.step(speed);
      }
    }
    // weights
    const tgtW = { idle: 0, run: 0, jump: 0, slide: 0, down: 0, ride: 0 };
    if (state === 'title') tgtW.idle = 1;
    else if (state === 'over' && overT > 0.25) tgtW.down = 1;
    else if (rideKind || (state === 'explore' && exR && exR.bike)) tgtW.ride = 1;   // seated on the delivery bike
    else if (!grounded) tgtW.jump = 1;
    else if (sliding) tgtW.slide = 1;
    else if (speed < 0.3) tgtW.idle = 1;
    else tgtW.run = 1;
    let ws = 0; for (const k in W) { W[k] = damp(W[k], tgtW[k], state === 'over' ? 5 : 16, dt); ws += W[k]; }
    const poses = [[W.idle, poseIdle(time)], [W.run, poseRun(phase, Math.max(amp, 0.3))], [W.jump, poseJump(vy)], [W.slide, POSE_SLIDE], [W.down, POSE_DOWN], [W.ride, POSE_RIDE[rideKind || 'scooter']]];
    for (const k of K) { let v = 0; for (const [w, p] of poses) if (w > 0.001) v += w * (p[k] || 0); tmpP[k] = v / ws; }
    if (hitT > 0) { hitT -= dt; const h = Math.sin((hitT / 0.45) * PI); tmpP.tx += 0.45 * h; tmpP.shL -= 1.1 * h; tmpP.shR -= 0.9 * h; tmpP.hx += 0.3 * h; }
    applyPose(tmpP);
    R.root.position.set(px, py, pz);
    CB.pose();
    if (state === 'explore') R.root.rotation.set(0, exYaw, 0); else R.root.rotation.set(crashed && state === 'over' ? Math.min(1.25, overT * 3.5) : 0, (px - lane * LANE) * 0.1, (px - lane * LANE) * 0.07);
    // timers
    if (invuln > 0) { invuln -= dt; R.root.visible = invuln <= 0 || opt.reduceMotion || Math.floor(invuln * 12) % 2 === 0; } else R.root.visible = true;
    if (magnetT > 0) { magnetT -= dt; if (magnetT <= 0) emit(); }
    if (multT > 0) { multT -= dt; if (multT <= 0) emit(); }
    if (shieldT > 0) { shieldT -= dt; if (shieldT <= 0) emit(); }
    R.shield.visible = shieldT > 0 && (shieldT > 2 || opt.reduceMotion || Math.floor(shieldT * 8) % 2 === 0);
    if (R.shield.visible) { R.shield.scale.setScalar(1 + Math.sin(time * 6) * 0.03); R.shield.material.uniforms.uT.value = time; }
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) emit(); }
    if (hintT > 0) { hintT -= dt; if (hintT <= 0) emit(); }
    if (capT > 0) { capT -= dt; if (capT <= 0) emit(); }
    if (noticeT > 0) { noticeT -= dt; if (noticeT <= 0) emit(); }
    shake = Math.max(0, shake - dt); flash = Math.max(0, flash - dt * 2.2);
    if (state === 'playing') {
      // zones
      const z = zoneAt(dist);
      if (window.RoboBend && opt.world === 'malabar') { const hp = window.RoboBend.hairpin(dist); if (hp && hp !== lastHairpin) { lastHairpin = hp; showToast('Hairpin ' + hp + ' of 9'); } else if (!hp) lastHairpin = 0; }
      if (z !== curZone) { curZone = z; if (opt.world === 'classic') run.zones++; showToast(zname(z)); audio.setZone(z); audio.music(ZONES[z].music); audio.say(ZONES[z].enter || STR.enter[z]); }
      score += speed * dt * (multT > 0 ? 2 : 1);
      if (sprintT > 0) sprintT -= dt;
      if (mudT > 0) mudT -= dt;
      if (webT > 0) webT -= dt;
      if (rideKind) { rideT -= dt; if (rideT <= 0) endRide(false); }
      if (tut) tutUpdate(dt); else spawnAhead();
      autoPlay();
      CB.update(dt);
      // obstacles
      const playerTop = py + (sliding ? 1.15 : 2.6);
      for (const o of obs) {
        if (!o.active) continue;
        if (o.vz) { o.z += o.vz * dt; o.g.position.z = o.z; const u = o.g.userData; if (u.ball) u.ball.rotation.x += (o.vz * dt) / 1.18; if (u.spin) u.spin.rotation.x += (o.vz * dt) / 0.48; }
        const ahead = pz - o.z;
        if (o.x1 !== o.x0) { o.x = lerp(o.x0, o.x1, smooth((46 - ahead) / 22)); o.g.position.x = o.x; }
        if (!o.passed && o.z > pz + o.hd + 0.4) {
          o.passed = true;
          if (!o.hit && jetT <= 0 && !tut) { const near = Math.abs(o.x - px) < o.hw * 0.9 + 0.35; if (o.type === 'beam') { if (near) run.slides++; } else if (TALL[o.type]) { if (o.threat) run.dodges++; } else if (near) run.jumps++; }
        }
        if (o.z > pz + 12) { o.active = false; o.g.visible = false; continue; }
        if (!o.threat && ahead > 0 && ahead < 9 && Math.abs(o.x - px) < 1.2) o.threat = true;
        if (!tut && !hinted[o.type] && ahead > 18 && ahead < 40 && (isGap(o) || OBT[o.type].shop || Math.abs(o.x - lane * LANE) < 0.1)) { hinted[o.type] = true; hint = HINT_KIND[o.type]; hintT = 2.4; emit(); }
        if (OBT[o.type].shop) {   // steer into the glowing bay: the run pauses and the shop opens (the shop screen resumes it)
          if (!o.hit && !tut && state === 'playing' && Math.abs(o.z - pz) < o.hd && Math.abs(o.x - px) < o.hw) { o.hit = true; speed *= 0.4; onShop(OBT[o.type].shop); api.pause(); }
          continue;
        }
        if (SOFT[o.type]) {
          if (OBT[o.type].web) {   // a web hangs between 1.3 m and 3 m: sliding passes under it, standing or jumping goes through it
            if (!tut && !rideKind && jetT <= 0 && !o.hit && Math.abs(o.z - pz) < o.hd && Math.abs(o.x - px) < o.hw && playerTop > 1.3 && py < 2.4) {
              o.hit = true; o.active = false; o.g.visible = false; if (!sickleOn) { webT = 1.3; speed *= 0.75; } shake = Math.max(shake, 0.15); burst(o.x, 2.1, o.z, 0xf2f0e6, 28, 3.5); audio.pop();   // a sickle cuts straight through
            }
            continue;
          }
          if (!tut && !rideKind && !(bootsOn && o.type === 'mud') && jetT <= 0 && grounded && Math.abs(o.z - pz) < o.hd && Math.abs(o.x - px) < o.hw) {
            if (o.type === 'mud') mudT = 0.3;
            else if (!o.hit) { o.hit = true; speed *= 0.55; shake = Math.max(shake, 0.25); burst(px, 0.3, pz, 0x8fa0a6, 16, 3); audio.land(); }
          }
          continue;
        }
        if (o.hit || jetT > 0) continue;
        const as = opt.assist;
        if (Math.abs(o.z - pz) > o.hd + (as ? 0.05 : 0.3)) continue;
        if (Math.abs(o.x - px) > o.hw * (as ? 0.72 : 0.9) + (as ? 0.2 : 0.35)) continue;
        let bad = false;
        if (o.type === 'log' || o.type === 'roller' || o.type === 'crate') bad = py < (as ? 0.7 : 0.95);
        else if (o.type === 'beam') bad = playerTop > (as ? 1.85 : 1.58) && py < 2.1;
        else if (o.type === 'block' || o.type === 'slider' || o.type === 'barrier') bad = py < 2.8;
        else if (o.type === 'boulder') bad = py < 2.0;
        else if (isGap(o)) bad = py < 0.05 && Math.abs(o.z - pz) < o.hd - (as ? 0.8 : 0.5);
        if (bad) { if (rideKind) rideHit(o); else if (invuln > 0) bumpThrough(o); else hit(o); }
      }
      // cells
      const cy = py + (sliding ? 0.6 : 1.2);
      for (const c of cells) {
        if (!c.active) continue;
        if (c.z > pz + 5) { c.active = false; continue; }
        if (magnetT > 0 && c.z < pz + 1 && c.z > pz - 16) c.pull = true;
        if (c.pull) { const k = 1 - Math.exp(-9 * dt); c.x += (px - c.x) * k; c.y += (cy - c.y) * k; c.z += (pz - c.z) * k; }
        const cr = opt.assist ? 1.5 : 1;
        if (Math.abs(c.z - pz) < 1.1 * cr && Math.abs(c.x - px) < 1.0 * cr && Math.abs(c.y - cy) < 1.35 * cr) { c.active = false; energy++; score += 10 * (multT > 0 ? 2 : 1); audio.collect(); burst(c.x, c.y, c.z, 0x7dffc4, 6, 2.2); }
      }
      // pickups
      for (const p of pickups) {
        if (!p.active) continue;
        if (p.z > pz + 6) { p.active = false; p.g.visible = false; continue; }
        if (Math.abs(p.z - pz) < 1.2 && Math.abs(p.x - px) < 1.1 && py < 2.2) {
          p.active = false; p.g.visible = false;
          if (p.type.indexOf('ride:') === 0) { startRide(p.type.slice(5)); continue; }
          if (p.type.indexOf('herb:') === 0) {
            const healed = !opt.unlimited && lives < 3; if (healed) lives++; else if (opt.unlimited) energy += 5;
            score += 50; audio.power(); burst(p.x, 1.2, p.z, 0x8fe08a, 26, 4); onHerb(p.type.slice(5), healed); emit(); continue;
          }
          if (p.type.indexOf('food:') === 0) { audio.collect(); burst(p.x, 1.2, p.z, 0xffd27a, 14, 3); onFood(p.type.slice(5)); continue; }
          audio.power(); run.powerups++;
          burst(p.x, 1.4, p.z, { magnet: 0xff7a5a, shield: 0x7fc8ff, mult: 0xf2c46b, jet: 0xffa040 }[p.type], 30, 4);
          if (p.type === 'magnet') { magnetT = 10; audio.say(STR.magnet, true); }
          else if (p.type === 'shield') { shieldT = 15; audio.say(STR.shield, true); }
          else if (p.type === 'mult') { multT = 12; audio.say(STR.mult, true); }
          else { if (rideKind) endRide(false); jetT = JET_T; vy = 0; grounded = false; slideT = 0; slideQueued = false; jetTrail(); audio.say(STR.jet, true); }
          emit();
        }
      }
      hudT -= dt; if (hudT <= 0) { hudT = 0.1; emit(); }
    }
    if (state === 'explore') return;
    // recycle scenery
    for (const s of slots) if (s.z > pz + 14) { s.z -= SLOT_N * SLOT_GAP; decorate(s); }
    let cm = false;
    for (let i = 0; i < CURB_N * 2; i++) if (curbZ[i] > pz + 10) { curbZ[i] -= CURB_N * CURB_LEN; setCurb(i); cm = true; }
    if (cm) curbs.instanceMatrix.needsUpdate = true;
    for (const g of gates) if (g.z > pz + 12) placeGate(g, g.z - gates.length * 55);
    // particles
    for (let i = 0; i < DUST_N; i++) {
      let z = dustPos[i * 3 + 2]; if (z > pz + 5) { z -= 75; dustPos[i * 3] = px + rng(-10, 10); dustPos[i * 3 + 1] = rng(0.3, 6); }
      dustPos[i * 3 + 2] = z; dustPos[i * 3 + 1] += Math.sin(time * 0.7 + i) * 0.002;
    }
    for (let i = 0; i < SPK_N; i++) {
      if (spkLife[i] <= 0) { spkCol[i * 3] = spkCol[i * 3 + 1] = spkCol[i * 3 + 2] = 0; continue; }
      spkLife[i] -= dt; spkVel[i * 3 + 1] -= 14 * dt;
      for (let a = 0; a < 3; a++) spkPos[i * 3 + a] += spkVel[i * 3 + a] * dt;
      const f = Math.max(0, spkLife[i] / 0.8); for (let a = 0; a < 3; a++) spkCol[i * 3 + a] = spkBase[i * 3 + a] * f;
    }
  };

  /* per-frame visuals */
  const lookV = new THREE.Vector3();
  const frameVisuals = (dt) => {
    if (window.RoboBend) window.RoboBend.update(opt.world === 'malabar' && state !== 'title' ? dist : -1);
    lerpEnv(state === 'title' ? 0 : zoneAt(dist), dt); applyEnv();
    const mz = pz - 90;
    track.position.z = floor.position.z = mz; laneLines.forEach((l) => (l.position.z = mz));
    trackTex.offset.y = -mz / 4.6; floorTex.offset.y = -mz / 9;
    sun.position.set(px + sunOff.x, sunOff.y, pz + sunOff.z); sun.target.position.set(px, 0, pz - 7);
    if (MAL) MAL.frame(dt, time, px, pz, fxK);
    if (rideKind) { const rm = rideM[rideKind]; rm.userData.tick(dt, speed); if (rideBump > 0) rideBump = Math.max(0, rideBump - dt); rm.rotation.x = rideBump > 0 ? -Math.sin((rideBump / 0.4) * PI) * 0.14 : 0; }
    if (umb) { umbK = lerp(umbK, gliding ? 1 : 0, 1 - Math.exp(-16 * dt)); umb.visible = umbK > 0.03; umb.scale.set(umbK, umbK, umbK); umb.rotation.z = Math.sin(time * 5) * 0.04 * umbK; }
    // cells
    for (let i = 0; i < CELL_N; i++) {
      const c = cells[i];
      if (c.active && c.z > pz - 150) { dummy.position.set(c.x, c.y + Math.sin(time * 3 + i) * 0.06, c.z); dummy.rotation.set(0.35, time * 2.4 + i, 0); dummy.scale.setScalar(1); }
      else { dummy.position.set(0, -50, 0); dummy.scale.setScalar(0.0001); }
      dummy.updateMatrix(); cellCore.setMatrixAt(i, dummy.matrix); cellCaps.setMatrixAt(i, dummy.matrix);
    }
    cellCore.instanceMatrix.needsUpdate = cellCaps.instanceMatrix.needsUpdate = true;
    for (const p of pickups) if (p.active) { p.inner.rotation.y = time * 2; p.g.position.y = 1.2 + Math.sin(time * 2.5) * 0.12; }
    dustGeo.attributes.position.needsUpdate = true; spkGeo.attributes.position.needsUpdate = true; spkGeo.attributes.color.needsUpdate = true;
    flashEl.style.opacity = flash.toFixed(3);
    // camera
    // ease the framing toward the target for this screen shape, so rotating a phone glides instead of jumping
    const ck = 1 - Math.exp(-3 * dt); for (const key in cam) cam[key] += (camT[key] - cam[key]) * ck;
    if (Math.abs(camera.fov - cam.fov) > 0.01) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }
    const back = cam.back, up = cam.up;
    const b = camBlend * camBlend * (3 - 2 * camBlend);
    const cx = lerp(2.7, px * cam.follow, b), cyy = lerp(2.2, up + py * 0.35, b), czz = lerp(pz - 5.6, pz + back, b);
    lookV.set(lerp(0, px * cam.look, b), lerp(1.65, 1.5 + py * 0.4, b) + gradeS * 9, lerp(pz, pz - 7, b));
    const sh = shake * 0.5;
    if (sideCam) { camera.position.set(px + 6.5, 1.6 + py, pz - 0.5); lookV.set(px, 1.2 + py, pz - 0.5); camera.lookAt(lookV); return; }
    camera.position.set(cx + (Math.random() - 0.5) * sh, cyy + (Math.random() - 0.5) * sh, czz);
    camera.lookAt(lookV);
  };

  /* loop */
  let raf = 0, last = performance.now(), acc = 0;
  const STEP = 1 / 120;
  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    const raw = Math.max(0, (now - last) / 1000), dt = Math.min(0.1, raw); last = now;
    pollPad(dt);
    if (clock) { clock.tick(dt); clockSave -= dt; if (clockSave <= 0) { clockSave = 5; store.set('clockH', clock.hours()); } }
    if (state !== 'paused') {
      tScale = tTarget > tScale ? Math.min(tTarget, tScale + dt * 4) : damp(tScale, tTarget, 9, dt); if (tTarget === 0 && tScale < 0.015) tScale = 0;
      if (btn.down && state === 'playing') { btn.t += dt; if (!btn.slid && btn.t > HOLD_T) { btn.slid = true; act('slide'); } if (btn.slid && grounded && slideT > 0) slideT = Math.max(slideT, 0.12); }
      if (hitStop > 0) hitStop -= raw; else acc += dt * tScale;
      let n = 0;
      while (acc >= STEP && n < 12) { update(STEP); acc -= STEP; n++; }
      if (n === 12) acc = 0;
      if (state === 'explore') exVisuals(dt); else frameVisuals(dt);
      CB.visuals(dt);
      audio.tick(dt);
      if (state === 'playing' && tScale > 0.9) {
        if (fps.skip > 0) fps.skip -= raw;
        else { fps.t += raw; fps.n++; if (fps.t >= 3) { const f = fps.n / fps.t; fps.t = 0; fps.n = 0; if (opt.quality === 'Auto' && autoQ === 'High') { fps.low = f < 40 ? fps.low + 1 : 0; if (fps.low >= 2) { autoQ = 'Low'; store.set('autoQ', 'Low'); applyQuality(); showNotice('lowgfx'); } } } }
      }
    }
    if (state === 'explore' && opt.quality === 'Auto' && !exSlow && renderer.getPixelRatio() > 1.3) {   /* the town: if it stays under 22 frames a second for three checks of 4 s, draw at a lower resolution (it is the pixels that cost most on a phone); a slow stretch must last 12 s, so a loading hitch does not trigger it */
      if (fps.skip > 0) fps.skip -= raw;
      else { fps.t += raw; fps.n++; if (fps.t >= 4) { const f = fps.n / fps.t; fps.t = 0; fps.n = 0; fps.low = f < 22 ? fps.low + 1 : 0; if (fps.low >= 3) { exSlow = true; store.set('exSlow', true); applyQuality(); if (exUI) exUI.note({ title: 'Smoother mode', emoji: '⚙️', body: 'The town was running slowly on this device, so it now draws at a lower sharpness to keep moving smoothly. Set Quality to High in Settings to turn this off.', src: '' }); } } }
    }
    for (const o of obs) if (o.active && o.g.userData.tick) o.g.userData.tick(time);   // animated obstacles (the spider on its web)
    if (state === 'explore') renderer.render(ex.scene, camera); else if (usePost() && ensureComposer()) composer.render(); else renderer.render(scene, camera);
  };
  const applyQuality = () => { setPR(); setShadowSize(); resize(); };

  /* camera framing by screen shape: landscape keeps the classic view; narrower screens widen the view and pull back
     until both outer lanes (plus rivals running in them) fit at the player's distance */
  let camInit = false;
  const camT = { fov: 58, back: 7.2, up: 4.2, follow: 0.6, look: 0.75 }, cam = Object.assign({}, camT);
  const frameFor = (a) => {
    const t = clamp((a - 0.45) / 0.85, 0, 1), up = lerp(5.6, 4.2, t), follow = lerp(0.2, 0.6, t), look = lerp(0.2, 0.75, t);
    if (t >= 1) return { fov: 58, back: 7.2, up, follow, look };
    let back = lerp(9.6, 7.2, t);
    const need = 3.75 + follow * LANE + 0.35, rise = up - 1.5, maxHalf = (41 * PI) / 180;
    let half = Math.atan(need / Math.hypot(back, rise) / a);
    if (half > maxHalf) { const D = need / (Math.tan(maxHalf) * a); back = Math.sqrt(Math.max(1, D * D - rise * rise)); half = maxHalf; }
    return { fov: clamp((2 * half * 180) / PI, 58, 82), back, up, follow, look };
  };
  const resize = () => {
    const w = container.clientWidth || window.innerWidth, h = container.clientHeight || window.innerHeight;
    aspect = w / h; renderer.setSize(w, h, false); camera.aspect = aspect;
    if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); }
    Object.assign(camT, frameFor(aspect));
    if (!camInit) { Object.assign(cam, camT); camInit = true; camera.fov = cam.fov; }
    camera.updateProjectionMatrix();
  };
  const ro = window.ResizeObserver ? new ResizeObserver(resize) : null;
  if (ro) ro.observe(container); window.addEventListener('resize', resize); window.addEventListener('orientationchange', resize);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);

  /* input: remappable keys, swipe / tap-zone / one-button pointer styles, gamepad */
  const nk = (k) => (k && k.length === 1 ? k.toLowerCase() : k);
  const keyAct = (k) => { const m = opt.keymap || DEFAULT_KEYS; for (const a in m) if ((m[a] || []).some((x) => nk(x) === k)) return a; return null; };
  const btnDown = (src) => { if (btn.down || state !== 'playing') return; btn.down = true; btn.t = 0; btn.slid = false; btn.src = src; };
  const btnUp = (src) => { if (!btn.down || btn.src !== src) return; btn.down = false; if (!btn.slid) act('jump'); };
  const typing = () => { const a = document.activeElement; return !!a && /^(INPUT|TEXTAREA|BUTTON|SELECT)$/.test(a.tagName); };
  const onKey = (e) => {
    const k = nk(e.key), a = keyAct(k); let used = true;
    audio.unlock(); setInput('keys');
    if (menuOpen) return;
    if (state === 'explore') {
      if (k === 'Escape') { if (exUI.noteOpen()) exUI.hideNote(); else api.exitExplore(); }
      else if (k === 'm' || k === 'M') { if (!e.repeat) api.openMap('here'); }
      else if (k === 'f' || ((k === 'Enter' || k === ' ') && !typing())) { if (!e.repeat) exAct = true; }
      else if (k === 'h' || k === 'H') { if (!e.repeat && ex && ex.horn) ex.horn(); }
      else if (k.length === 1 || k.indexOf('Arrow') === 0 || k === 'Shift') exKeys[k] = true; else used = false;
      if (used) e.preventDefault(); return;
    }
    if (state === 'playing') {
      if (e.repeat) { if (a) e.preventDefault(); return; }
      if (a === 'pause') api.pause();
      else if (opt.scheme === 'onebutton' && (a === 'jump' || a === 'slide' || k === 'Enter')) btnDown('key');
      else if (a === 'left' || a === 'right') act('move', a === 'left' ? -1 : 1);
      else if (a === 'jump') act('jump');
      else if (a === 'slide') act('slide');
      else if (a === 'attackL' || a === 'attackR') CB.attack(a === 'attackL' ? -1 : 1);
      else used = false;
    } else if (state === 'paused') { if (a === 'pause') api.resume(); else used = false; }
    else if ((state === 'title' || (state === 'over' && overShown)) && k === 'Enter' && !typing()) api.start({ tutorial: !store.get('tutDone', false) });
    else used = false;
    if (used) e.preventDefault();
  };
  const onKeyUp = (e) => { const k = nk(e.key), a = keyAct(k); delete exKeys[k]; if (a === 'jump' || a === 'slide' || k === 'Enter') btnUp('key'); };
  window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKeyUp);
  let sw = null;
  const pDown = (e) => {
    audio.unlock(); setInput(e.pointerType === 'mouse' ? 'keys' : 'touch');
    if (state === 'explore') { exDrag = e.clientX; return; }
    if (state !== 'playing') return;
    if (opt.scheme === 'tapzones') { const r = cv.getBoundingClientRect(); act('move', e.clientX < r.left + r.width / 2 ? -1 : 1); return; }
    if (opt.scheme === 'onebutton') { btnDown('ptr'); return; }
    sw = { x: e.clientX, y: e.clientY, done: false };
  };
  const pMove = (e) => {
    if (exDrag !== null && state === 'explore') { exLook -= (e.clientX - exDrag) * 0.006; exDrag = e.clientX; return; }
    if (!sw || sw.done || state !== 'playing') return;
    const dx = e.clientX - sw.x, dy = e.clientY - sw.y, th = Math.max(22, Math.min(window.innerWidth, window.innerHeight) * 0.035);
    if (Math.abs(dx) < th && Math.abs(dy) < th) return;
    sw.done = true;
    if (Math.abs(dx) > Math.abs(dy)) act('move', dx > 0 ? 1 : -1); else if (dy < 0) act('jump'); else act('slide');
  };
  const pUp = () => { sw = null; exDrag = null; btnUp('ptr'); };
  window.addEventListener('blur', () => { for (const k in exKeys) delete exKeys[k]; });
  cv.addEventListener('pointerdown', pDown); cv.addEventListener('pointermove', pMove);
  window.addEventListener('pointerup', pUp); window.addEventListener('pointercancel', pUp);
  let padPrev = {}, padRep = { dir: null, t: 0 };
  const pollPad = (dt) => {
    const list = navigator.getGamepads ? navigator.getGamepads() : []; let p = null;
    for (const g of Array.from(list || [])) if (g && g.connected) { p = g; break; }
    if (!!p !== padOn) { padOn = !!p; emit(); }
    if (!p) { padPrev = {}; return; }
    const b = (i) => !!(p.buttons[i] && p.buttons[i].pressed), ax = p.axes[0] || 0, ay = p.axes[1] || 0;
    const cur = { left: b(14) || ax < -0.55, right: b(15) || ax > 0.55, up: b(12) || ay < -0.55, down: b(13) || ay > 0.55, a: b(0), b: b(1), start: b(9) || b(8), lb: b(4) || b(6), rb: b(5) || b(7) };
    const edge = (k) => cur[k] && !padPrev[k];
    if (Object.keys(cur).some(edge)) { setInput('pad'); audio.unlock(); }
    if (state === 'playing' && !menuOpen) {
      if (edge('start')) api.pause();
      if (edge('left')) act('move', -1); if (edge('right')) act('move', 1);
      if (edge('lb')) CB.attack(-1); if (edge('rb')) CB.attack(1);
      if (opt.scheme === 'onebutton') { if (edge('a') || edge('b')) btnDown('pad'); if (btn.src === 'pad' && !cur.a && !cur.b) btnUp('pad'); }
      else { if (edge('a') || edge('up')) act('jump'); if (edge('b') || edge('down')) act('slide'); }
    } else {
      for (const k of ['up', 'down', 'left', 'right']) if (edge(k)) { onPad(k); padRep = { dir: k, t: 0.4 }; }
      if (padRep.dir && cur[padRep.dir]) { padRep.t -= dt; if (padRep.t <= 0) { padRep.t = 0.12; onPad(padRep.dir); } } else padRep.dir = null;
      if (edge('a')) onPad('confirm'); if (edge('b')) onPad('back'); if (edge('start')) onPad('start');
    }
    padPrev = cur;
  };
  const onVis = () => { audio.hide(document.hidden); if (document.hidden && state === 'playing') api.pause(); };
  document.addEventListener('visibilitychange', onVis);
  const onHide = () => { if (state === 'playing') api.pause(); };
  window.addEventListener('pagehide', onHide);

  const warpTo = (d) => {
    dist = d; pz = -d; nextRowZ = -d - 48;
    slots.forEach((s, i) => { s.z = -d + 12 - (i % SLOT_N) * SLOT_GAP; decorate(s); });
    for (let i = 0; i < CURB_N * 2; i++) { curbZ[i] = -d + 10 - (i % CURB_N) * CURB_LEN; setCurb(i); } curbs.instanceMatrix.needsUpdate = true;
    obs.forEach((o) => { o.active = false; o.g.visible = false; }); cells.forEach((c) => (c.active = false)); gates.forEach((g, i) => placeGate(g, -d - 40 - i * 55)); CB.clear();
    for (let i = 0; i < DUST_N; i++) dustPos.set([rng(-10, 10), rng(0.3, 6), -d + rng(-70, 5)], i * 3);
  };
  /* ---------- Explore mode: a walkable town (explore.js) on its own scene; the character is moved into it and back ---------- */
  const exKeys = {}; let exIn = { x: 0, y: 0 }, exR = null;
  const exUI = (() => {
    const el = document.createElement('div');
    el.style.cssText = 'position:absolute;inset:0;display:none;pointer-events:none;font-family:Oxanium,sans-serif;color:#f3f0e8;user-select:none;-webkit-user-select:none;touch-action:none';
    const chip = 'display:flex;align-items:center;gap:6px;min-height:40px;padding:0 12px;border-radius:12px;background:rgba(10,14,12,0.6);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);font-weight:700;font-size:16px';
    el.innerHTML = '<div style="position:absolute;top:max(10px,env(safe-area-inset-top));left:max(10px,env(safe-area-inset-left));right:max(10px,env(safe-area-inset-right));display:flex;gap:8px;align-items:center">'
      + '<button data-x="exit" aria-label="Back to the title" style="pointer-events:auto;width:44px;height:44px;border:0;border-radius:12px;background:rgba(10,14,12,0.6);color:#f3f0e8;font-size:22px;cursor:pointer;touch-action:manipulation">\u2190</button>'
      + '<div data-x="place" style="' + chip + '">Mittai Theruvu \u00b7 Kozhikode</div><div style="flex:1"></div>'
      + '<div style="' + chip + '"><span style="width:17px;height:17px;border-radius:9px;background:#f2c46b;box-shadow:inset 0 0 0 2px #c9922f;color:#5a3a08;font:800 11px/17px Oxanium,sans-serif;text-align:center">₹</span><span data-x="coins">0</span></div></div>'
      + '<button data-x="dest" aria-label="Your destination. Press to open the map" style="display:none;pointer-events:auto;position:absolute;left:max(10px,env(safe-area-inset-left));top:calc(max(10px,env(safe-area-inset-top)) + 174px);max-width:min(64vw,300px);min-height:44px;align-items:center;gap:8px;padding:0 6px 0 12px;border:1px solid rgba(111,214,255,0.6);border-radius:12px;background:rgba(10,14,12,0.78);color:#f3f0e8;font:700 14px Oxanium,sans-serif;cursor:pointer;touch-action:manipulation"><span style="flex:1;min-width:0;text-align:left"><span data-x="destKick" style="display:block;font-size:10px;letter-spacing:0.14em;color:#8fd8ff"></span><span data-x="destText" style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:15px"></span><span data-x="destProg" style="display:block;font-size:12px;font-weight:600;color:rgba(243,240,232,0.75)"></span><span style="display:block;height:4px;border-radius:2px;background:rgba(243,240,232,0.18);margin-top:4px;overflow:hidden"><span data-x="destBar" style="display:block;height:100%;width:0;background:#f2c46b"></span></span></span><span data-x="destClear" role="button" aria-label="Clear the destination" style="flex:none;width:36px;height:36px;border-radius:10px;background:rgba(243,240,232,0.14);text-align:center;font-size:18px;line-height:36px">\u2715</span></button>'
      + '<style>@media (max-width: 640px) { .ex-job { top: calc(max(10px, env(safe-area-inset-top)) + 178px) !important; max-width: 92vw !important; } .has-dest .ex-job { top: calc(max(10px, env(safe-area-inset-top)) + 228px) !important; } }</style><div data-x="job" class="ex-job" style="position:absolute;left:50%;transform:translateX(-50%);top:calc(max(10px,env(safe-area-inset-top)) + 54px);max-width:min(86vw,520px);padding:8px 14px;border-radius:12px;background:rgba(10,14,12,0.7);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);font-weight:700;font-size:15px;text-align:center;display:none"></div>'
      + '<div data-x="note" style="position:absolute;left:50%;transform:translateX(-50%);bottom:calc(max(14px,env(safe-area-inset-bottom)) + 84px);width:min(92vw,440px);max-height:46vh;overflow:auto;padding:14px 16px 12px;border-radius:16px;background:rgba(14,19,16,0.94);border:1px solid rgba(243,240,232,0.18);pointer-events:auto;display:none"><div style="display:flex;gap:8px;align-items:flex-start"><div data-x="noteTitle" style="flex:1;font-family:Oxanium,sans-serif;font-weight:800;font-size:18px;line-height:1.25"></div><button data-x="noteClose" aria-label="Close note" style="flex:none;width:36px;height:36px;border:0;border-radius:10px;background:rgba(243,240,232,0.1);color:#f3f0e8;font-size:18px;cursor:pointer">✕</button></div><div data-x="noteBody" style="margin-top:8px;font-size:14px;line-height:1.5;white-space:pre-line;color:rgba(243,240,232,0.92)"></div><div data-x="noteSrc" style="margin-top:8px;font-size:12px;color:rgba(243,240,232,0.6)"></div></div>'
      + '<div data-x="fade" style="position:absolute;inset:0;background:#0b0f0d;color:#f3f0e8;font-family:Oxanium,sans-serif;font-weight:800;font-size:28px;letter-spacing:0.08em;display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none"></div>'
      + '<div data-x="clock" aria-label="Time and temperature" style="position:absolute;right:max(10px,env(safe-area-inset-right));top:calc(max(10px,env(safe-area-inset-top)) + 52px);padding:6px 12px;border-radius:12px;background:rgba(10,14,12,0.6);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);font-weight:700;font-size:15px;white-space:nowrap"></div>'
      + '<canvas data-x="map" width="256" height="256" aria-label="Round map of the town: up is where the camera looks, N marks north. Press to open the full map" style="cursor:pointer;pointer-events:auto;position:absolute;left:max(10px,env(safe-area-inset-left));top:calc(max(10px,env(safe-area-inset-top)) + 54px);width:112px;height:112px;border-radius:50%;box-shadow:0 4px 14px rgba(0,0,0,0.45)"></canvas>'
      + '<div data-x="stick" style="position:absolute;left:max(18px,env(safe-area-inset-left));bottom:max(22px,env(safe-area-inset-bottom));width:132px;height:132px;border-radius:66px;background:rgba(243,240,232,0.1);border:2px solid rgba(243,240,232,0.25);pointer-events:auto;touch-action:none;display:none"><div data-x="knob" style="position:absolute;left:41px;top:41px;width:50px;height:50px;border-radius:25px;background:rgba(243,240,232,0.45)"></div></div>'
      + '<div data-x="keys" style="position:absolute;left:0;right:0;bottom:max(14px,env(safe-area-inset-bottom));text-align:center;font-size:14px;color:rgba(243,240,232,0.85);text-shadow:0 1px 4px #000">WASD or arrows walk · Shift runs \u00b7 Q E or drag to look \u00b7 F to use \u00b7 Esc to leave</div>'
      + '<button data-x="horn" aria-label="Horn" style="position:absolute;right:max(18px,env(safe-area-inset-right));bottom:calc(max(26px,env(safe-area-inset-bottom)) + 76px);width:56px;height:56px;border:0;border-radius:28px;background:rgba(20,17,10,0.72);color:#ffe9b0;font-size:26px;cursor:pointer;display:none;pointer-events:auto;touch-action:manipulation">\ud83d\udd14</button>'
      + '<button data-x="run" aria-label="Run on or off" style="position:absolute;right:max(18px,env(safe-area-inset-right));bottom:calc(max(26px,env(safe-area-inset-bottom)) + 76px);width:56px;height:56px;border:0;border-radius:28px;background:rgba(20,17,10,0.72);color:#ffe9b0;font-size:26px;cursor:pointer;display:none;pointer-events:auto;touch-action:manipulation">\ud83c\udfc3</button>'
      + '<button data-x="act" style="position:absolute;right:max(18px,env(safe-area-inset-right));bottom:max(26px,env(safe-area-inset-bottom));min-height:60px;padding:10px 22px;border:0;border-radius:16px;background:oklch(0.82 0.15 75);color:#14110a;font-family:Oxanium,sans-serif;font-weight:800;font-size:18px;letter-spacing:0.05em;cursor:pointer;display:none;pointer-events:auto;touch-action:manipulation"></button>';
    container.appendChild(el);
    const q = (n) => el.querySelector('[data-x="' + n + '"]'), stickEl = q('stick'), knob = q('knob'), actEl = q('act'), hornEl = q('horn'), runEl = q('run'), keysEl = q('keys'), coinsEl = q('coins'), placeEl = q('place'), jobEl = q('job'), noteEl = q('note'), fadeEl = q('fade'), clockEl = q('clock'), destEl = q('dest'), destText = q('destText'), destKick = q('destKick'), destProg = q('destProg'), destBar = q('destBar'); let lastClock = ''; let lastJob = ''; let lastDest = '', jny = { key: '', total: 1 };
    const hideNote = () => { noteEl.style.display = 'none'; };
    q('noteClose').addEventListener('click', hideNote);
    const ML = { 'Mittai Theruvu': 'മിഠായിത്തെരുവ്', 'Station Lane': 'സ്റ്റേഷൻ ലെയ്ൻ', 'NH 66 highway': 'എൻഎച്ച് 66 ഹൈവേ', 'Thamarassery Churam': 'താമരശ്ശേരി ചുരം', 'Kozhikode-Manjeri Road': 'കോഴിക്കോട്–മഞ്ചേരി റോഡ്', 'Kozhikode-Malappuram Bypass': 'കോഴിക്കോട്–മലപ്പുറം ബൈപ്പാസ്', 'Manjeri Junction': 'മഞ്ചേരി ജങ്ഷൻ', 'Manjeri-Pandikkad Road': 'മഞ്ചേരി–പാണ്ടിക്കാട് റോഡ്', 'Bypass road': 'ബൈപ്പാസ് റോഡ്', 'Cherani Cross Road': 'ചേരാണി ക്രോസ് റോഡ്', 'Happy Road': 'ഹാപ്പി റോഡ്', 'Medical college': 'മെഡിക്കൽ കോളേജ്', 'Lakkidi': 'ലക്കിടി', 'Lakkidi view point': 'ലക്കിടി വ്യൂ പോയിന്റ്', 'Lakkidi gate': 'ലക്കിടി ഗേറ്റ്', 'Lakkidi bus stop': 'ലക്കിടി ബസ് സ്റ്റോപ്പ്', 'Tea estate': 'തേയിലത്തോട്ടം', 'Pandikkad Road': 'പാണ്ടിക്കാട് റോഡ്', 'Link Road': 'ലിങ്ക് റോഡ്', 'East beach': 'കിഴക്കൻ കടൽത്തീരം', 'West beach': 'പടിഞ്ഞാറൻ കടൽത്തീരം', 'Temple lane': 'അമ്പല ഇടവഴി', 'Temple courtyard': 'ക്ഷേത്രമുറ്റം', 'Market lane': 'ചന്ത ഇടവഴി', 'Mosque courtyard': 'പള്ളിമുറ്റം', 'Church square': 'ചർച്ച് സ്ക്വയർ', 'Beach promenade': 'ബീച്ച് നടപ്പാത', 'Kozhikode Beach': 'കോഴിക്കോട് ബീച്ച്', 'Manjeri town': 'മഞ്ചേരി', 'Mavoor Road': 'മാവൂർ റോഡ്', 'HiLITE City': 'ഹൈലൈറ്റ് സിറ്റി', 'NH 66 bypass': 'എൻഎച്ച് 66 ബൈപ്പാസ്', 'Mall forecourt': 'മാൾ മുറ്റം', 'HiLITE Business Park': 'ഹൈലൈറ്റ് ബിസിനസ് പാർക്ക്', 'Railway station': 'റെയിൽവേ സ്റ്റേഷൻ', 'KSRTC bus stand': 'കെഎസ്ആർടിസി ബസ് സ്റ്റാൻഡ്', 'Mofussil bus stand': 'മൊഫ്യൂസിൽ ബസ് സ്റ്റാൻഡ്', 'KSRTC station': 'ബസ് സ്റ്റേഷൻ', 'Football turf': 'ഫുട്ബോൾ ടർഫ്', 'Medical college gate': 'മെഡിക്കൽ കോളേജ്' };   // place names in English and Malayalam, as the signboards are
    let sid = null, lastLabel = null, lastCoins = -1, lastTouch = null, lastPlace = '', mapBase = null, mapT = 0;
    const mapEl = q('map'), mapCtx = mapEl.getContext('2d'), L = window.RoboExplore ? window.RoboExplore.layout : null;   // map scale: pixels per metre on the 2x canvas
    const RAD = 46;   // the round map shows 46 m from you to its edge, and "up" is where the camera is looking
    const drawMap = (spots, r, job) => {
      if (!L || !L.maps) return;
      const W = mapEl.width, c0 = W / 2, area = (r && r.area) || 'kozhikode', M = L.maps.world || L.maps[area];
      mapCtx.clearRect(0, 0, W, W); if (!M || !r) return;                                   // no map inside a building
      const S = c0 / RAD, cy = r.camYaw || 0, al = -Math.PI / 2 - Math.atan2(-Math.cos(cy), -Math.sin(cy));   // turn the world so the camera's forward is up
      mapCtx.save(); mapCtx.beginPath(); mapCtx.arc(c0, c0, c0 - 3, 0, 6.3); mapCtx.clip();
      mapCtx.fillStyle = '#26301f'; mapCtx.fillRect(0, 0, W, W);
      mapCtx.translate(c0, c0); mapCtx.rotate(al); mapCtx.scale(S, S); mapCtx.translate(-r.x, -r.z);
      for (const [x0, x1, z0, z1, col] of M.rects) { mapCtx.fillStyle = col; mapCtx.fillRect(x0, z0, x1 - x0, z1 - z0); }
      for (const sp of spots) { if (Math.abs(sp.x - r.x) > RAD + 5 || Math.abs(sp.z - r.z) > RAD + 5) continue; mapCtx.fillStyle = sp.kind === 'talk' ? '#ffb8d8' : sp.kind === 'gate' ? '#7fe8a8' : sp.kind === 'job' ? '#8fc8ff' : sp.kind === 'travel' ? '#ff9a6a' : sp.kind === 'door' ? '#ffe9b0' : '#ffd27a'; mapCtx.beginPath(); mapCtx.arc(sp.x, sp.z, 5 / S, 0, 6.3); mapCtx.fill(); mapCtx.strokeStyle = 'rgba(0,0,0,0.55)'; mapCtx.lineWidth = 1 / S; mapCtx.stroke(); }
      const wpp = ex && ex.getWaypoint ? ex.getWaypoint() : null;   // the path to the destination, as a dashed line on the round map
      if (wpp && wpp.path && wpp.path.length > 1) { mapCtx.save(); mapCtx.setLineDash([6 / S, 5 / S]); mapCtx.lineJoin = 'round'; mapCtx.strokeStyle = '#0b1114'; mapCtx.lineWidth = 6 / S; mapCtx.beginPath(); wpp.path.forEach((p, i) => (i ? mapCtx.lineTo(p.x, p.z) : mapCtx.moveTo(p.x, p.z))); mapCtx.stroke(); mapCtx.strokeStyle = '#6fd6ff'; mapCtx.lineWidth = 3.5 / S; mapCtx.stroke(); mapCtx.restore(); }
      if (job && job.target) { mapCtx.strokeStyle = job.phase === 'pickup' ? '#ffe14a' : '#4aff9a'; mapCtx.lineWidth = 3 / S; mapCtx.beginPath(); mapCtx.arc(job.target.x, job.target.z, 8 / S, 0, 6.3); mapCtx.stroke(); }
      mapCtx.save(); mapCtx.translate(r.x, r.z); mapCtx.rotate(-r.yaw); mapCtx.scale(1 / S, 1 / S); mapCtx.fillStyle = '#ff7a3a'; mapCtx.strokeStyle = '#fff'; mapCtx.lineWidth = 2; mapCtx.beginPath(); mapCtx.moveTo(0, -11); mapCtx.lineTo(8, 8); mapCtx.lineTo(-8, 8); mapCtx.closePath(); mapCtx.fill(); mapCtx.stroke(); mapCtx.restore();
      mapCtx.restore();
      const wpt = ex && ex.getWaypoint ? ex.getWaypoint() : null;   // the destination: a flag on the map, or an arrow at the rim pointing the way when it is beyond the map
      if (wpt) {
        const dx = wpt.x - r.x, dz = wpt.z - r.z, px = S * (dx * Math.cos(al) - dz * Math.sin(al)), py = S * (dx * Math.sin(al) + dz * Math.cos(al)), d = Math.hypot(px, py), edge = c0 - 20, k = d > edge ? edge / d : 1, fx = c0 + px * k, fy = c0 + py * k;
        mapCtx.save(); mapCtx.translate(fx, fy);
        if (d > edge) { mapCtx.rotate(Math.atan2(py, px) + Math.PI / 2); mapCtx.fillStyle = '#6fd6ff'; mapCtx.strokeStyle = '#0b1114'; mapCtx.lineWidth = 3; mapCtx.beginPath(); mapCtx.moveTo(0, -15); mapCtx.lineTo(11, 7); mapCtx.lineTo(-11, 7); mapCtx.closePath(); mapCtx.stroke(); mapCtx.fill(); }
        else { mapCtx.strokeStyle = '#6fd6ff'; mapCtx.lineWidth = 4; mapCtx.beginPath(); mapCtx.arc(0, 0, 13, 0, 6.3); mapCtx.stroke(); mapCtx.fillStyle = '#6fd6ff'; mapCtx.beginPath(); mapCtx.arc(0, 0, 5, 0, 6.3); mapCtx.fill(); }
        mapCtx.restore();
      }
      mapCtx.strokeStyle = 'rgba(243,240,232,0.7)'; mapCtx.lineWidth = 4; mapCtx.beginPath(); mapCtx.arc(c0, c0, c0 - 3, 0, 6.3); mapCtx.stroke();
      const nx = c0 + (c0 - 16) * Math.sin(al), nz = c0 - (c0 - 16) * Math.cos(al); mapCtx.fillStyle = '#10140f'; mapCtx.beginPath(); mapCtx.arc(nx, nz, 11, 0, 6.3); mapCtx.fill(); mapCtx.fillStyle = '#ff7a6a'; mapCtx.font = 'bold 16px sans-serif'; mapCtx.textAlign = 'center'; mapCtx.textBaseline = 'middle'; mapCtx.fillText('N', nx, nz + 1);   // north
    };
    const setStick = (e) => {
      const r = stickEl.getBoundingClientRect(); let dx = (e.clientX - (r.left + r.width / 2)) / 50, dy = (e.clientY - (r.top + r.height / 2)) / 50; const m = Math.hypot(dx, dy);
      if (m > 1) { dx /= m; dy /= m; } exIn = { x: dx, y: -dy }; knob.style.transform = 'translate(' + dx * 40 + 'px,' + dy * 40 + 'px)';
    };
    stickEl.addEventListener('pointerdown', (e) => { sid = e.pointerId; try { stickEl.setPointerCapture(sid); } catch (err) { /* capture is optional */ } setStick(e); e.preventDefault(); });
    stickEl.addEventListener('pointermove', (e) => { if (e.pointerId === sid) setStick(e); });
    const endStick = (e) => { if (e.pointerId !== sid) return; sid = null; exIn = { x: 0, y: 0 }; knob.style.transform = ''; };
    stickEl.addEventListener('pointerup', endStick); stickEl.addEventListener('pointercancel', endStick);
    destEl.addEventListener('click', (e) => { if (e.target && e.target.getAttribute && e.target.getAttribute('data-x') === 'destClear') { if (ex) ex.clearWaypoint(); lastDest = ''; e.stopPropagation(); return; } api.openMap('here'); });
    placeEl.style.cssText += ';display:block;overflow:hidden;line-height:1.25;padding:5px 12px;min-height:0';   /* the place is two single lines (English, then Malayalam), each cut with an ellipsis: a long name must not run down over the map and the clock */
    actEl.addEventListener('click', () => { exAct = true; }); hornEl.addEventListener('click', () => { if (ex && ex.horn) ex.horn(); }); runEl.addEventListener('click', () => { exKeys.Shift = !exKeys.Shift; });   /* on a phone there is no Shift key: the button turns running on and off */ mapEl.addEventListener('click', () => api.openMap('here')); q('exit').addEventListener('click', () => api.exitExplore());
    return {
      show(on) { el.style.display = on ? 'block' : 'none'; lastLabel = null; lastCoins = -1; exIn = { x: 0, y: 0 }; knob.style.transform = ''; },
      note(n) { if (!n) return; if (noteEl.style.display === 'block' && q('noteTitle').textContent === n.title) { hideNote(); return; } q('noteTitle').textContent = n.emoji + ' ' + n.title; q('noteBody').textContent = n.body; q('noteSrc').textContent = n.src ? 'Source: ' + n.src : ''; noteEl.style.display = 'block'; },
      fade(text) { fadeEl.textContent = text; fadeEl.style.transition = 'none'; fadeEl.style.opacity = '1'; setTimeout(() => { fadeEl.style.transition = 'opacity 0.9s'; fadeEl.style.opacity = '0'; }, 400); },
      hideNote, noteOpen() { return noteEl.style.display === 'block'; },
      map(spots, r, dt) { mapT -= dt; if (mapT <= 0) { mapT = 0.12; drawMap(spots, r, r && r.job); this.dest(r); } },
      dest(r) {   // the journey card: where you are going, how far is left and a bar of how far you have come; hidden when there is no destination or inside a building
        const w = r && ex && ex.getWaypoint ? ex.getWaypoint() : null, M = window.RoboMap;
        if (!w) { if (lastDest) { lastDest = ''; destEl.style.display = 'none'; el.classList.remove('has-dest'); } return; }
        const d = w.path && w.path.length > 1 && window.RoboNav ? window.RoboNav.lengthFrom(w.path, r.x, r.z) : Math.hypot(w.x - r.x, w.z - r.z), key = w.x + ',' + w.z;
        if (jny.key !== key) jny = { key, total: Math.max(d, 1) };   // a new destination: the journey starts from here
        if (d > jny.total) jny.total = d;
        const fmt = M && M.fmtD ? M.fmtD : (m) => Math.round(m) + ' m', t = 'JOURNEY \u00b7 ' + fmt(jny.total).toUpperCase() + '|' + w.name + '|' + fmt(d) + ' to go' + (M && M.etaText ? ' \u00b7 ' + M.etaText(d, w.job ? 2 : 1) : '');
        destBar.style.width = Math.max(2, Math.min(100, Math.round((1 - d / jny.total) * 100))) + '%';
        if (t !== lastDest) { const p = t.split('|'); lastDest = t; destKick.textContent = p[0]; destText.textContent = p[1]; destProg.textContent = p[2]; destEl.style.display = 'flex'; el.classList.add('has-dest'); }
      },
      update(near, coins, isTouch, place, job, clk) {
        const ct = clk ? clk.icon + ' ' + clk.label + ' · ' + clk.temp + '°C' + (clk.bat != null ? ' · 🔋 ' + clk.bat + '%' : '') : ''; if (ct !== lastClock) { lastClock = ct; clockEl.textContent = ct; clockEl.style.display = ct ? 'block' : 'none'; clockEl.setAttribute('aria-label', clk ? clk.phase + ', ' + clk.label + ', ' + clk.temp + ' degrees' : ''); }
        const jt = job ? (job.msg || (job.label ? (job.phase === 'pickup' ? '🟡 ' : '🟢 ') + job.label + ' · ₹' + job.fare + (job.secs ? ' · ' + Math.floor(job.secs / 60) + ':' + String(job.secs % 60).padStart(2, '0') : '') : '')) : '';
        if (jt !== lastJob) { lastJob = jt; jobEl.textContent = jt; jobEl.style.display = jt ? 'block' : 'none'; }
        const pn = place || 'Mittai Theruvu', pl = pn.indexOf(' · ') >= 0 ? pn : pn + ' · ' + (ML[pn] || ''); if (pl !== lastPlace) { lastPlace = pl; placeEl.textContent = ''; pl.split(' · ').filter((s) => s.trim()).forEach((s, i) => { const ln = document.createElement('div'); ln.textContent = s; ln.style.cssText = 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis' + (i ? ';font-size:13px;font-weight:600;opacity:0.85' : ''); placeEl.appendChild(ln); }); }
        const RS = window.RoboShop, shut = !!(near && near.kind === 'shop' && RS && RS.openLine(near.arg) && !RS.isOpen(near.arg, clock ? clock.hours() : 16.5)), label = near ? near.emoji + '  ' + (near.kind === 'gate' ? 'RUN' : near.label.toUpperCase()) + (shut ? ' · CLOSED' : '') : '', hint = near && (near.kind === 'drive' || near.kind === 'bike') ? (isTouch ? 'TAP TO ' : 'PRESS F TO ') + (near.kind === 'drive' ? 'GET IN' : /off the/i.test(near.label) ? 'GET OFF' : 'GET ON') : '';
        if (label + '|' + hint !== lastLabel) { lastLabel = label + '|' + hint; actEl.style.display = near ? 'block' : 'none'; actEl.textContent = label; if (hint) { const hs = document.createElement('div'); hs.style.cssText = 'font-size:11px;letter-spacing:0.14em;opacity:0.75;margin-top:2px;font-weight:700'; hs.textContent = hint; actEl.appendChild(hs); } hornEl.style.display = near && near.kind === 'bike' && /off the (bike|auto)/i.test(near.label) ? 'block' : 'none'; }
        if (coins !== lastCoins) { lastCoins = coins; coinsEl.textContent = String(coins); }
        runEl.style.display = isTouch && hornEl.style.display !== 'block' ? 'block' : 'none'; runEl.style.background = exKeys.Shift ? 'rgba(255,200,87,0.92)' : 'rgba(20,17,10,0.72)';
        if (isTouch !== lastTouch) { lastTouch = isTouch; stickEl.style.display = isTouch ? 'block' : 'none'; keysEl.style.display = isTouch ? 'none' : 'block'; }
      }
    };
  })();
  let storyMode = false;   // true only when the town was entered as the story; free roam never touches the story
  const storyEmit = (type, data) => { const Q = window.RoboQuests; if (!Q || !storyMode) return []; const ev = Q.emit(type, data); if (ev.length) onStory(ev); return ev; };   // the story hears what the player does
  if (window.RoboQuests) window.RoboQuests.setHooks({ reward: (r) => { if (r && r.coins) api.earnCoins(r.coins); } });   // a finished quest pays in coins
  let mapWasOpen = false, lastVisitArea = '', pendingStory = null;   // story notices from a talk wait until you have closed the card and read it
  const exStep = (dt) => {
    if (!ex) return;
    const k = exKeys, kx = (k.d || k.ArrowRight ? 1 : 0) - (k.a || k.ArrowLeft ? 1 : 0), ky = (k.w || k.ArrowUp ? 1 : 0) - (k.s || k.ArrowDown ? 1 : 0);
    const inp = menuOpen ? { x: 0, y: 0, act: false, look: 0 } : { x: clamp(kx + exIn.x, -1, 1), y: clamp(ky + exIn.y, -1, 1), act: exAct, run: !!k.Shift, mul: (window.RoboGear ? window.RoboGear.walkMul() : 1) * (window.RoboBattery ? window.RoboBattery.speedMul() : 1) * (weather ? window.RoboWeather.walkMul(weather.intensity(), !!(window.RoboKitchen && window.RoboKitchen.hasUmbrella())) : 1), look: exLook + ((k.q ? 1 : 0) - (k.e ? 1 : 0)) * 1.8 * dt };
    exAct = false; exLook = 0;
    if (weather) { const ev = weather.tick(dt); if (ev) onWeather(ev); }
    exR = ex.step(dt, inp); if (exR.bump) { audio.bump(exR.bump.kind, exR.bump.s); hitT = 0.45; }   // knock: sound, and the walker flinches
    if (window.RoboBattery && exR.speed > 0 && !menuOpen && !exR.bike) { const w = window.RoboBattery.drain(exR.speed * dt, !!k.Shift); if (w !== null) onBattery(w); }   // walking uses the battery; a warning at 20, 10 and 0%
    px = exR.x; pz = exR.z; speed = exR.speed; exYaw = exR.yaw; py = exR.y || 0; vy = 0; grounded = true;
  };
  const exVisuals = (dt) => { if (clock && window.RoboClock && window.RoboClock.exposure) renderer.toneMappingExposure = ex.state.room ? 0.72 : window.RoboClock.exposure(clock.hours());   /* indoors the picture is a little darker, so cream walls do not wash out */ if (pendingStory && !exUI.noteOpen()) { const ev = pendingStory; pendingStory = null; onStory(ev); } if (window.RoboBend) window.RoboBend.update(-1); ex.visuals(camera, dt, aspect, clock ? clock.hours() : null); if (exUI.noteOpen() && !(exR && exR.near && (exR.near.kind === 'note' || exR.near.kind === 'talk'))) exUI.hideNote(); exUI.map(ex.spots, exR, dt); if (window.RoboMap && exR && exR.climate && exR.climate !== lastVisitArea) { lastVisitArea = exR.climate; window.RoboMap.noteVisit(exR.climate); storyEmit('area', { area: exR.climate }); }
  const ci = clock ? clockInfo(exR && exR.climate) : null; if (ci && window.RoboBattery) ci.bat = window.RoboBattery.pct(); const wk = weather ? weather.intensity() : 0; ex.setRain(wk); if (audio.rainSet) audio.rainSet(ex.state && ex.state.room ? wk * 0.3 : wk); if (ci && wk > 0.05) { ci.temp -= window.RoboWeather.tempDrop(wk); if (wk > 0.3) { ci.icon = '🌧️'; ci.phase = 'Rain'; } } exUI.update(exR && exR.near, coinsTotal, lastInput === 'touch', exR && exR.place, exR && exR.job, ci); };
  const api = {
    get best() { return best; }, touch,
    get tutorialDone() { return store.get('tutDone', false); },
    start(o) {
      audio.init(); audio.unlock(); const fromTitle = state === 'title';
      resetWorld(); state = 'playing'; camBlend = fromTitle ? 0 : 1; last = performance.now(); acc = 0; tScale = tTarget = 1; fps.skip = 2; fps.t = fps.n = fps.low = 0;
      if (opt.startZone > 0) { warpTo(opt.startZone * ZONE_LEN + 5); curZone = zoneAt(dist); snapEnv(curZone); applyEnv(); audio.setZone(curZone, true); }
      tut = o && o.tutorial && !(opt.startZone > 0) ? { steps: TUT_STEPS[opt.scheme] || TUT_STEPS.standard, i: 0, obs: null, gapT: 1.4, prompt: null, waiting: false, ok: false } : null;
      const b = o && o.buff;
      if (b && !tut) {
        if (b.type === 'magnet') magnetT = b.secs; else if (b.type === 'shield') shieldT = b.secs; else if (b.type === 'mult') multT = b.secs;
        else if (b.type === 'weapon' && opt.combat) CB.give(b.weapon);
        else if (b.type === 'forage') foodLuck = 2; else if (b.type === 'sprint') sprintT = b.secs;
      }
      carryFx.splice(0).forEach((e) => api.applyEffect(e));
      const boost = opt.world !== 'malabar' ? 0 : Math.max(window.RoboGear ? window.RoboGear.runBoost() : 0, window.RoboBattery ? window.RoboBattery.runBoost() : 0); if (boost) sprintT = Math.max(sprintT, boost);   // sports shoes, or a nearly full battery: the run starts with a sprint
      showToast(zname(curZone)); audio.music(ZONES[curZone].music); audio.say(opt.assist ? STR.startKids : STR.start, true); emit();
    },
    /* walkable town: only from the title screen, Malabar world */
    explore(asStory) {
      if (state !== 'title' || !window.RoboExplore || !MAL || !MAL.kit) return false;
      if (asStory && opt.assist) return false;   // the story is not for Kids mode
      storyMode = !!asStory;
      audio.init(); audio.unlock();
      if (!ex) {
        ex = window.RoboExplore.create(THREE, MAL.kit, { low: effQ() !== 'High', tex: window.ROBO_TEX,
          onCoin(n) { coinsTotal += n; store.set('coins', coinsTotal); audio.coin(); emit(); },
          onFood(id) { audio.collect(); onFood(id); }, onNote(n) { exUI.note(n); }, onScrap(id) { return onScrap(id); }, onCharge(a) { onCharge(a); storyEmit('charge', {}); }, onArrive(name) { if (exUI.noteOpen()) return; exUI.note({ title: 'Destination reached', emoji: '\ud83d\udea9', body: 'You have arrived: ' + name + '. Your progress is saved.', src: '' }); },
          onTalk(npc) { const Q = window.RoboQuests; if (!Q) return; if (exUI.noteOpen()) { exUI.hideNote(); return; } const r = Q.talk(npc); if (r) { exUI.note(r.card); if (r.events.length) pendingStory = (pendingStory || []).concat(r.events); } }, onJob(kind, mode) { if (kind === 'done') storyEmit('job', { mode: mode || 'parcel' }); }, onRideEnd(i) { audio.power(); onRideEnd(i); }, onMenu(m) { onMenu(m); }, onHorn() { audio.bump('vehicle', 0.3); }, storyJob() { const Q = window.RoboQuests; if (!Q || !storyMode) return null; const nx = Q.next(); return nx && nx.type === 'job' ? { from: nx.from, to: nx.to, mode: nx.mode } : null; }, onSplash() { audio.splash(); }, onDrip() { audio.drip(); }, onFade(t) { exUI.fade(t); }, onTravel(name) { audio.power(); exUI.fade('KSRTC · ' + name); }, onShop(kind) { audio.power(); onShop(kind); }, onGate() { api.exitExplore(true); } });
        ex.scene.environment = scene.environment;
      }
      ex.setStory(storyMode); resetWorld(); state = 'explore'; inTown = true; fps.skip = 3; fps.t = 0; fps.n = 0; fps.low = 0; ex.scene.add(R.root); R.root.scale.setScalar(0.78); R.root.visible = true; ex.enter();
      camera.fov = aspect < 0.8 ? 64 : 56; camera.near = 0.4; applyQuality(); camera.updateProjectionMatrix(); exUI.show(true);   /* the town camera never gets closer than a few metres to anything that matters; a larger near plane gives the depth buffer about four times the precision, so thin things (road paint, kerbs) at 60 m or more stop shimmering */ exUI.update(null, coinsTotal, lastInput === 'touch'); exR = null; last = performance.now(); acc = 0;
      emit(); return true;
    },
    exitExplore(toRun) {
      renderer.toneMappingExposure = 1.0;   // the run has its own light
      if (state !== 'explore') return;
      camera.near = 0.1; camera.updateProjectionMatrix();
      if (window.RoboMap && window.RoboMap.isOpen()) window.RoboMap.close();
      for (const k in exKeys) delete exKeys[k];
      scene.add(R.root); R.root.scale.setScalar(1); R.root.rotation.set(0, 0, 0); exUI.show(false); if (audio.rainSet) audio.rainSet(0);
      storyMode = false; resetWorld(); state = 'title'; inTown = false; applyQuality(); camBlend = 0; audio.music('title'); emit(); onExploreExit(!!toRun);
    },
    pause() { if (state !== 'playing') return; state = 'paused'; btn.down = false; audio.suspend(); emit(); },
    resume() { if (state !== 'paused') return; state = 'playing'; last = performance.now(); fps.skip = 2; audio.resume(); emit(); },
    quit() { resetWorld(); state = 'title'; camBlend = 0; tut = null; tScale = tTarget = 1; audio.resume(); audio.music('title'); emit(); },
    endRun() { if (state === 'paused') { state = 'playing'; audio.resume(); last = performance.now(); } if (state !== 'playing') return; gameOver(null); emit(); },
    toggleMute() { audio.setMuted(!audio.muted); emit(); },
    toggleVoice() { audio.setVoice(!audio.voice); emit(); },
    setMuted(m) { audio.setMuted(!!m); emit(); },
    setVoice(v) { audio.setVoice(!!v); emit(); },
    setVolume(k, v) { audio.setVol(k, v); emit(); },
    setMenu(v) { menuOpen = !!v; if (menuOpen) btn.down = false; },
    setSkin(s) { setSkin(s); },
    attack(dir) { CB.attack(dir); },
    get coins() { return coinsTotal; },
    /* shop support: effects bought on the road, coins, and coming back from the shop screen */
    applyEffect(e) {
      if (state === 'explore') { carryFx.push(e.type === 'heal' ? { type: 'shield', secs: 20 } : e); audio.power(); emit(); return; }   // bought in town: it helps on the next run (medicine becomes a 20 s shield, since a run starts with full hearts)
      if (e.type === 'magnet') magnetT = Math.max(magnetT, e.secs); else if (e.type === 'mult') multT = Math.max(multT, e.secs); else if (e.type === 'shield') shieldT = Math.max(shieldT, e.secs);
      else if (e.type === 'sprint') sprintT = Math.max(sprintT, e.secs); else if (e.type === 'boots') bootsOn = true; else if (e.type === 'sickle') sickleOn = true;
      else if (e.type === 'heal') { if (opt.unlimited) energy += 5; else lives = Math.min(3, lives + 1); }
      audio.power(); burst(px, 1.4 + py, pz, 0xffe2a0, 24, 3.5); emit();
    },
    get coinPool() { return coinsTotal + run.coins; },
    spendCoins(n) { if (!(n > 0) || coinsTotal + run.coins < n) return false; const a = Math.min(run.coins, n); run.coins -= a; coinsTotal -= n - a; store.set('coins', coinsTotal); emit(); return true; },
    /* start a paid trip from the shop screen: an auto ride along the road, or a KSRTC bus to the other town (the clock moves on) */
    startTrip(fx) {
      if (!ex || state !== 'explore' || !fx) return false;
      if (fx.mode === 'auto') return ex.startRide(fx.from, fx.to);
      const RR = window.RoboExploreRides, to = fx.mode === 'bus' && RR && RR.BUS_STOPS[fx.to]; if (!to) return false;
      ex.travelTo(to.area, to.arrive[0], to.arrive[1]); api.advanceClock(fx.hours > 0 ? fx.hours : 1); return true;
    },
    /* the code terminal of a story puzzle: pauses walking while it is open; solving it tells the story */
    openTerminal(id) {
      const T = window.RoboTerminal; if (!T || T.isOpen()) return false; let was = false;
      return T.open({ puzzle: id, onSolved: (pid) => { storyEmit('puzzle', { id: pid }); }, onOpen: () => { was = menuOpen; menuOpen = true; btn.down = false; }, onClose: () => { menuOpen = was; was = false; } });
    },
    /* the map screen: tab 'here' (this area, in detail) or 'region' (how the places connect); pauses walking while it is open */
    openMap(tab) {
      const M = window.RoboMap; if (!M || M.isOpen()) return false;
      const inTown = state === 'explore' && ex, L = window.RoboExplore && window.RoboExplore.layout;
      M.open({
        tab: inTown ? tab : 'region', area: inTown && exR && exR.climate ? exR.climate : 'kozhikode', maps: inTown && L ? L.maps : {}, spots: inTown ? ex.spots : [],
        story: storyMode && inTown ? window.RoboQuests : null, getPlayer: () => (inTown && exR && !(ex.state && ex.state.room) ? { x: exR.x, z: exR.z, yaw: exR.yaw, place: String(exR.place || '').split(' \u00b7 ')[0] } : null), job: inTown && exR ? exR.job : null,
        getWaypoint: () => (inTown ? ex.getWaypoint() : null), getPath: (x, z) => (inTown && ex.route ? ex.route(x, z) : null), onWaypoint: (sp, name) => { if (!inTown) return; if (sp) ex.setWaypoint(sp.x, sp.z, name || M.displayName(sp)); else ex.clearWaypoint(); },
        onPuzzle: (id) => { M.close(); api.openTerminal(id); },
        onOpen: () => { mapWasOpen = menuOpen; menuOpen = true; btn.down = false; }, onClose: () => { menuOpen = mapWasOpen; mapWasOpen = false; }
      });
      return true;
    },
    storyEmit(type, data) { return storyEmit(type, data); },   // the page tells the story about payments and purchases
    advanceClock(hours) { if (clock && hours > 0) { clock.set(clock.hours() + hours); store.set('clockH', clock.hours()); } },   // charging takes time
    clockHours() { return clock ? clock.hours() : 16.5; },
    earnCoins(n) { n = Math.floor(Number(n)); if (!(n > 0)) return; coinsTotal += n; store.set('coins', coinsTotal); audio.coin(); emit(); },   // money coming in (the scrap dealer pays you)
    shopDone() { if (state !== 'explore') invuln = Math.max(invuln, 1.5); },
    setOptions(o) { const q = effQ(), w = opt.world; if ('quality' in o && o.quality !== opt.quality) { exSlow = false; store.set('exSlow', false); }   /* choosing a quality again starts the watch afresh */
      Object.assign(opt, o); if ('pack' in o) applyPack(); if (opt.world !== w && state === 'title') { resetWorld(); frameVisuals(0); } if (o.keymap) opt.keymap = Object.assign({}, DEFAULT_KEYS, o.keymap); if ('combat' in o && !o.combat) CB.clear(); if ('assist' in o) best = store.get(bestKey(), 0); if (o.skin) setSkin(o.skin); if (effQ() !== q) applyQuality(); emit(); },
    // test hooks
    debug: { shadows(on) { renderer.shadowMap.enabled = !!on; if (ex) ex.scene.traverse((o) => { if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; }); } }); return renderer.shadowMap.enabled; },
      visible() { if (!ex) return null; const cam = camera, fr = new THREE.Frustum(), pm = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); fr.setFromProjectionMatrix(pm); let n = 0, casters = 0, groups = {}; ex.scene.traverse((o) => { if (!o.isMesh) return; let v = true, p = o; while (p) { if (!p.visible) { v = false; break; } p = p.parent; } if (!v) return; if (o.geometry.boundingSphere === null) o.geometry.computeBoundingSphere(); const s = o.geometry.boundingSphere.clone().applyMatrix4(o.matrixWorld); if (!fr.intersectsSphere(s)) return; n++; if (o.castShadow) casters++; const m = Array.isArray(o.material) ? o.material[0] : o.material; const k = (m && m.map ? 'textured' : 'plain') + (m && m.transparent ? '+transparent' : '') + (o.isInstancedMesh ? '+instanced' : ''); groups[k] = (groups[k] || 0) + 1; }); return { visibleMeshes: n, shadowCasters: casters, groups }; },
      anatomy() { if (!ex) return null; const sc = ex.scene, out = { topLevel: sc.children.length, loose: 0, groupMeshes: 0, uniqueMats: new Set(), matsInView: new Set(), bigGroups: [] };
        const vis = (o) => { let p = o; while (p) { if (!p.visible) return false; p = p.parent; } return true; };
        for (const ch of sc.children) { let n = 0, nv = 0; ch.traverse((o) => { if (o.isMesh) { n++; out.uniqueMats.add((Array.isArray(o.material) ? o.material[0] : o.material).uuid); if (vis(o)) { nv++; out.matsInView.add((Array.isArray(o.material) ? o.material[0] : o.material).uuid); } } }); if (ch.isMesh) out.loose += nv; else { out.groupMeshes += nv; if (nv >= 12) { let kids = 0; ch.traverse((c) => { if (c !== ch && c.type === 'Group') kids++; }); out.bigGroups.push([ch.type, Math.round(ch.userData && ch.userData.x !== undefined ? ch.userData.x : ch.position.x), Math.round(ch.userData && ch.userData.z !== undefined ? ch.userData.z : ch.position.z), nv, 'groups:' + kids, ch.userData && ch.userData.x !== undefined ? 'cullable' : 'free']); } } }
        out.uniqueMats = out.uniqueMats.size; out.matsInView = out.matsInView.size; out.bigGroups = out.bigGroups.sort((a, b) => b[3] - a[3]).slice(0, 14); return out; },
      person() { if (!ex) return null; let best = null; ex.scene.traverse((o) => { if (best || o.isMesh || o.type !== 'Group') return; let n = 0; o.traverse((c) => { if (c.isMesh) n++; }); if (n >= 30 && n <= 45 && o.parent === ex.scene && o.userData && o.userData.x === undefined) { let kids = 0; o.traverse((c) => { if (c !== o && c.type === 'Group') kids++; }); if (kids >= 5) best = o; } }); if (!best) return 'none'; const tree = (o, d) => { const meshes = o.children.filter((c) => c.isMesh), mats = new Set(meshes.map((m) => m.material.uuid)); return { n: o.children.length, meshes: meshes.length, mats: mats.size, kids: o.children.filter((c) => !c.isMesh).map((c) => tree(c, d + 1)) }; }; return tree(best, 0); },
      /* the textured meshes in view, one row per texture: how many draw calls it costs, how big the picture is */
      textures() { if (!ex) return null; const fr = new THREE.Frustum(); fr.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)); const rows = {}; ex.scene.traverse((o) => { if (!o.isMesh) return; let p = o; while (p) { if (!p.visible) return; p = p.parent; } if (o.geometry.boundingSphere === null) o.geometry.computeBoundingSphere(); if (!fr.intersectsSphere(o.geometry.boundingSphere.clone().applyMatrix4(o.matrixWorld))) return; const m = Array.isArray(o.material) ? o.material[0] : o.material; if (!m || !m.map) return; const im = m.map.image, k = m.map.uuid.slice(0, 6) + ' ' + (im && im.width ? im.width + 'x' + im.height : '?') + (o.isInstancedMesh ? ' inst' : '') + (m.transparent ? ' tr' : ''); rows[k] = (rows[k] || 0) + 1; }); return Object.entries(rows).sort((a, b) => b[1] - a[1]); },
      who() { if (!ex) return null; const cam = camera, fr = new THREE.Frustum(); fr.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)); const sc = ex.scene, top = new Map(), out = { loose: 0, looseByGeo: {}, groups: [] };
        sc.traverse((o) => { if (!o.isMesh) return; let v = true, p = o, t = o; while (p) { if (!p.visible) { v = false; break; } if (p.parent === sc) t = p; p = p.parent; } if (!v) return; if (o.geometry.boundingSphere === null) o.geometry.computeBoundingSphere(); if (!fr.intersectsSphere(o.geometry.boundingSphere.clone().applyMatrix4(o.matrixWorld))) return;
          if (t === o) { out.loose++; const k = o.geometry.type + (o.material.map ? '+map' : '') + (o.material.transparent ? '+tr' : ''); out.looseByGeo[k] = (out.looseByGeo[k] || 0) + 1; } else top.set(t, (top.get(t) || 0) + 1); });
        const arr = [...top.entries()].map(([t, n]) => { let kids = 0; t.traverse((c) => { if (c !== t && c.type === 'Group') kids++; }); return [n, kids, t.userData && t.userData.x !== undefined ? 'cull' : 'free', Math.round(t.userData && t.userData.x !== undefined ? t.userData.x : t.position.x), Math.round(t.userData && t.userData.z !== undefined ? t.userData.z : t.position.z)]; }).sort((a, b) => b[0] - a[0]);
        out.groupTotal = arr.reduce((s, a) => s + a[0], 0); out.groupCount = arr.length; out.groups = arr.slice(0, 12); out.byClass = { personLike: arr.filter((a) => a[1] >= 5 && a[0] <= 20).reduce((s, a) => s + a[0], 0), small: arr.filter((a) => a[0] <= 4).reduce((s, a) => s + a[0], 0), mid: arr.filter((a) => a[0] > 4 && !(a[1] >= 5 && a[0] <= 20)).reduce((s, a) => s + a[0], 0) }; return out; },
      waterInfo() { return ex && ex.waterInfo ? ex.waterInfo() : null; }, wet(v) { if (ex && ex.setWet) ex.setWet(v); },
      townJob() { return exR ? { job: exR.job, x: exR.x, z: exR.z, bike: exR.bike, speed: exR.speed, place: exR.place, near: exR.near } : null; },
      mergeInfo() { return ex && ex.mergeInfo ? ex.mergeInfo() : null; },
      cost() { const i = renderer.info; let meshes = 0, tris = 0, lights = 0; if (ex) ex.scene.traverse((o) => { if (o.isMesh) { meshes++; const g = o.geometry; tris += g.index ? g.index.count / 3 : g.attributes.position.count / 3; } if (o.isLight) lights++; }); return { calls: i.render.calls, drawnTriangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures, sceneMeshes: meshes, sceneTriangles: Math.round(tris), lights }; },
      rainInfo() { return ex ? Object.assign({ weather: weather ? weather.intensity() : null }, ex.rainInfo()) : null; }, rain(on, now) { if (weather) weather.set(on !== false, !!now); return weather ? weather.raining() : null; }, clock(h) { if (clock) { if (h !== undefined) clock.set(h); return clock.hours(); } return null; }, townCars() { return ex ? ex.carCircles() : []; }, townMove(x, z) { if (ex) ex.moveTo(x, z); }, townRoom(id) { if (ex) ex.enterRoom(id); return ex ? ex.state.room && ex.state.room.id : null; }, town(x, z, yaw) { if (ex && x !== undefined) { ex.state.x = x; ex.state.z = z; ex.state.init = false; if (yaw !== undefined) ex.state.camYaw = yaw; } return ex ? { x: ex.state.x, z: ex.state.z } : null; }, townAudit() { return ex ? ex.audit() : null; }, townTravel(id, x, z, yaw) { if (ex) { ex.travelTo(id, x, z); if (yaw !== undefined) ex.state.camYaw = yaw; } return ex ? ex.state.area : null; }, townRoute(x, z) { const r = ex ? ex.route(x, z) : null; return r ? { length: Math.round(r.length), points: r.points.length, snapped: r.snapped } : null; }, townSpots(kind) { return ex ? ex.spots.filter((s) => !kind || s.kind === kind).map((s) => [s.kind, s.arg, s.x, s.z]) : []; }, townPickups() { return ex ? ex.pickups.filter((p) => p.on).map((p) => [p.kind, p.id, Math.round(p.x * 10) / 10, Math.round(p.z * 10) / 10]) : []; }, shop(kind) { place('shop_' + kind, 1, pz - 22); }, ecology() { return MAL && MAL.stats ? MAL.stats() : null; }, herb(id, laneN) { placePickup('herb:' + id, laneN || 0, pz - 14); }, hurt() { lives = Math.max(1, lives - 1); emit(); }, bloom(strength, radius, threshold) { if (bloomPass) { bloomPass.strength = strength; bloomPass.radius = radius; bloomPass.threshold = threshold; } return !!bloomPass; }, post(on) { opt.post = !!on; return usePost() && !!composer; }, ride(k) { startRide(k); }, obstacles() { return obs.filter((o) => o.active).map((o) => ({ type: o.type, lane: o.lane, dz: Math.round(o.z - pz) })); }, pickups() { return pickups.filter((p) => p.active).map((p) => ({ type: p.type, lane: Math.round(p.x / LANE), dz: Math.round(pz - p.z) * -1 })); }, get state() { return { state, dist, speed, lane, px, py, lives, energy, phase, grounded, mud: mudT > 0, web: webT > 0, slope: Math.round(gradeS * 100) / 100, ride: rideKind, rideHp, rideT: Math.round(rideT * 10) / 10, sliding: slideT > 0 }; }, jump, slide, move, warp(d) { warpTo(d); }, wave() { CB.debugWave(); }, boss() { CB.debugBoss(); }, give(t) { CB.give(t); }, combat() { return CB.debugInfo(); }, invuln(t) { invuln = t; }, side(on) { sideCam = on; }, power(t) { if (t === 'shield') shieldT = 15; else if (t === 'mult') multT = 12; else if (t === 'jet') { jetT = JET_T; grounded = false; jetTrail(); } else magnetT = 10; emit(); },
      step(sec) { for (let i = 0; i < Math.round(sec * 120); i++) update(STEP); frameVisuals(sec); },
      text(t) { let d = document.getElementById('__dbg'); if (!d) { d = document.createElement('div'); d.id = '__dbg'; d.style.cssText = 'position:absolute;left:8px;bottom:8px;right:8px;z-index:9;font:12px monospace;color:#fff;background:rgba(0,0,0,.7);padding:6px;white-space:pre-wrap;pointer-events:none'; container.appendChild(d); } d.textContent = t; },
      snap() { renderer.render(scene, camera); let im = document.getElementById('__snap'); if (!im) { im = document.createElement('img'); im.id = '__snap'; im.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;'; container.appendChild(im); } im.src = cv.toDataURL('image/jpeg', 0.85); return im.src.length; },
      unsnap() { const im = document.getElementById('__snap'); if (im) im.remove(); } },
    destroy() {
      cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKeyUp); window.removeEventListener('resize', resize); window.removeEventListener('orientationchange', resize); window.removeEventListener('pagehide', onHide); if (window.visualViewport) window.visualViewport.removeEventListener('resize', resize);
      window.removeEventListener('pointerup', pUp); window.removeEventListener('pointercancel', pUp); document.removeEventListener('visibilitychange', onVis);
      if (ro) ro.disconnect(); audio.close(); renderer.dispose(); cv.remove(); flashEl.remove();
    }
  };
  if (opts.skin) setSkin(opts.skin);
  resetWorld(); resize(); frameVisuals(0); audio.music('title'); emit();
  raf = requestAnimationFrame(frame);
  return api;
}

window.RunAwayGame = { create };
})();
