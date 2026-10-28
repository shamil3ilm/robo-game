/* Robo Run — progression: missions, daily challenges, badges, robot skins, wallet and backup codes.
   Exposes window.RoboProgress. Player-facing text is English and lives in the tables below. */
(function () {
  'use strict';
  const PRE = 'runaway.';
  const get = (k, d) => { try { const v = localStorage.getItem(PRE + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const set = (k, v) => { try { localStorage.setItem(PRE + k, JSON.stringify(v)); } catch (e) {} };
  const num = (n) => Math.floor(n || 0).toLocaleString();
  const hex = (n) => '#' + n.toString(16).padStart(6, '0');

  const SKINS = [
    { id: 'scout', name: 'Scout', price: 0, body: 0xd8d4cb, dark: 0x2a2e33, acc: 0xe0612a, glow: 0x46e0ff },
    { id: 'jade', name: 'Jade', price: 250, body: 0x9cc7a4, dark: 0x1f2b25, acc: 0xf2c46b, glow: 0x7dffc4 },
    { id: 'ember', name: 'Ember', price: 400, body: 0x3d3532, dark: 0x1a1614, acc: 0xff6a2a, glow: 0xffb050 },
    { id: 'frost', name: 'Frost', price: 600, body: 0xe9f1f8, dark: 0x5a6a7a, acc: 0x58b8ff, glow: 0xbfe8ff },
    { id: 'night', name: 'Midnight', price: 900, body: 0x2c3160, dark: 0x14162a, acc: 0xf2c46b, glow: 0xb06bff },
    { id: 'gold', name: 'Golden', price: 1500, body: 0xe6c36a, dark: 0x4a3a1a, acc: 0xfaf6ea, glow: 0xfff0a0 },
    /* human characters: swatches show shirt / headwear / skin; `human` drives the body (see characters.js); `gate` = unlocked by playing, not bought */
    { id: 'fisher', name: 'Fisher', price: 300, body: 0x2f6fa0, dark: 0xf2f0e6, acc: 0x1f4f7a, glow: 0x8a4f2e,
      human: { skin: 0x8a4f2e, hair: 0x1a1410, top: 0x2f6fa0, sleeve: 'short', bottom: 'mundu', bottomColor: 0xf2f0e6, trim: 0xd4a93a, shoe: null, head: 'cap', headColor: 0x1f4f7a, build: 'regular' } },
    { id: 'farmer', name: 'Estate farmer', price: 500, body: 0x6a8a4a, dark: 0x6a5a40, acc: 0xd9c27a, glow: 0xa8693f,
      human: { skin: 0xa8693f, hair: 0x2a2018, top: 0x6a8a4a, sleeve: 'long', bottom: 'trousers', bottomColor: 0x6a5a40, shoe: 0x3a2a1a, head: 'hat', headColor: 0xd9c27a, build: 'sturdy' } },
    { id: 'footballer', name: 'Footballer', price: 700, body: 0x3aa6d8, dark: 0xffffff, acc: 0xffffff, glow: 0xc68a62,
      human: { skin: 0xc68a62, hair: 0x14100c, top: 0x3aa6d8, sleeve: 'short', bottom: 'shorts', bottomColor: 0xffffff, trim: 0xffffff, shoe: 0x1a1a1a, head: 'none', stripes: true, build: 'slim' } },
    /* town clothes (the Textiles shop sells them, and the Characters screen lists them): everyday mundu and shirt, the khaki of Kerala's auto drivers, and the cream-and-gold kasavu of Onam */
    { id: 'mundushirt', name: 'Mundu and shirt', price: 240, body: 0x9fc3e0, dark: 0xf6f3ea, acc: 0xe8e0c8, glow: 0xa8693f,
      human: { skin: 0xa8693f, hair: 0x1a1410, top: 0x9fc3e0, sleeve: 'long', bottom: 'mundu', bottomColor: 0xf6f3ea, trim: 0xe8e0c8, shoe: null, head: 'none', build: 'regular' } },
    { id: 'khaki', name: 'Auto driver', price: 400, body: 0xc2b280, dark: 0xa89a6a, acc: 0x6a5a3a, glow: 0x8d5524,
      human: { skin: 0x8d5524, hair: 0x120e0a, top: 0xc2b280, sleeve: 'short', bottom: 'trousers', bottomColor: 0xa89a6a, shoe: 0x2a2a2a, head: 'none', build: 'regular' } },
    { id: 'kasavu', name: 'Kasavu set', price: 600, body: 0xf3ead2, dark: 0xf3ead2, acc: 0xd4a93a, glow: 0x8d5524,
      human: { skin: 0x8d5524, hair: 0x120e0a, top: 0xf3ead2, sleeve: 'short', bottom: 'mundu', bottomColor: 0xf3ead2, trim: 0xd4a93a, shoe: null, head: 'none', build: 'slim' } },
    { id: 'chef', name: 'Chef', price: 1e9, gate: 'Cook 3 dishes', body: 0xf4f1ea, dark: 0x2a2a30, acc: 0xb8281e, glow: 0xe0ac86,
      human: { skin: 0xe0ac86, hair: 0x3a2a20, top: 0xf4f1ea, sleeve: 'long', bottom: 'trousers', bottomColor: 0x2a2a30, shoe: 0x222222, head: 'chef', headColor: 0xffffff, apron: 0xb8281e, build: 'regular' } },
    { id: 'guide', name: 'Forest guide', price: 1e9, gate: 'Collect 25 ingredients', body: 0x3a6a8a, dark: 0x7a6a50, acc: 0xd9792a, glow: 0x6a3a22,
      human: { skin: 0x6a3a22, hair: 0x120e0a, top: 0x3a6a8a, sleeve: 'short', bottom: 'trousers', bottomColor: 0x7a6a50, shoe: 0x3a2a1a, head: 'band', headColor: 0xd9792a, build: 'regular' } }
  ];
  // m = run stat from the engine (dist, energy, jumps, slides, dodges, powerups, zones, noHit) or a running total (runs, dist, energy)
  const MISSIONS = [
    { id: 'd500', m: 'dist', n: 500, r: 50, t: 'Run {n} m in one run' },
    { id: 'd1500', m: 'dist', n: 1500, r: 100, t: 'Run {n} m in one run' },
    { id: 'd3000', m: 'dist', n: 3000, r: 200, t: 'Run {n} m in one run' },
    { id: 'e50', m: 'energy', n: 50, r: 60, t: 'Collect {n} energy in one run' },
    { id: 'e150', m: 'energy', n: 150, r: 150, t: 'Collect {n} energy in one run' },
    { id: 'j15', m: 'jumps', n: 15, r: 60, t: 'Jump over {n} obstacles in one run' },
    { id: 's10', m: 'slides', n: 10, r: 60, t: 'Slide under {n} beams in one run' },
    { id: 'o20', m: 'dodges', n: 20, r: 70, t: 'Dodge {n} blocks in one run' },
    { id: 'p3', m: 'powerups', n: 3, r: 80, t: 'Pick up {n} power-ups in one run' },
    { id: 'z2', m: 'zones', n: 2, r: 80, t: 'Reach the River Crossing', place: true },
    { id: 'z3', m: 'zones', n: 3, r: 150, t: 'Reach the Crystal Caves', place: true },
    { id: 'h800', m: 'noHit', n: 800, r: 120, t: 'Run {n} m without a scratch' },
    { id: 'tr3', m: 'runs', n: 3, r: 40, t: 'Play {n} runs', total: true },
    { id: 'te300', m: 'energy', n: 300, r: 100, t: 'Collect {n} energy in total', total: true },
    { id: 'td5000', m: 'dist', n: 5000, r: 150, t: 'Run {n} m in total', total: true }
  ];
  const DAILY = [
    { id: 'dd2000', m: 'dist', n: 2000, r: 250, t: 'Run {n} m in one run' },
    { id: 'de120', m: 'energy', n: 120, r: 250, t: 'Collect {n} energy in one run' },
    { id: 'dj25', m: 'jumps', n: 25, r: 200, t: 'Jump over {n} obstacles in one run' },
    { id: 'ds15', m: 'slides', n: 15, r: 200, t: 'Slide under {n} beams in one run' },
    { id: 'dp4', m: 'powerups', n: 4, r: 200, t: 'Pick up {n} power-ups in one run' },
    { id: 'dz4', m: 'zones', n: 4, r: 300, t: 'Reach the Ice Temple', place: true },
    { id: 'dh1200', m: 'noHit', n: 1200, r: 300, t: 'Run {n} m without a scratch' }
  ];
  const BADGES = [
    { id: 'first', icon: 'flag', name: 'First Steps', desc: 'Finish your first run', s: 'runs', n: 1 },
    { id: 'river', icon: 'water', name: 'River Runner', desc: 'Reach the River Crossing', s: 'zones', n: 2, place: true },
    { id: 'caves', icon: 'diamond', name: 'Cave Explorer', desc: 'Reach the Crystal Caves', s: 'zones', n: 3, place: true },
    { id: 'ice', icon: 'ac_unit', name: 'Ice Breaker', desc: 'Reach the Ice Temple', s: 'zones', n: 4, place: true },
    { id: 'lava', icon: 'local_fire_department', name: 'Fire Walker', desc: 'Reach the Volcano', s: 'zones', n: 5, place: true },
    { id: 'sky', icon: 'cloud', name: 'Sky High', desc: 'Reach the Sky Ruins', s: 'zones', n: 6, place: true },
    { id: 'marathon', icon: 'directions_run', name: 'Marathon', desc: 'Run 5,000 m in one run', s: 'dist', n: 5000 },
    { id: 'untouchable', icon: 'shield', name: 'Untouchable', desc: 'Run 1,500 m without a scratch', s: 'noHit', n: 1500 },
    { id: 'acrobat', icon: 'swipe_up', name: 'Acrobat', desc: 'Jump over 40 obstacles in one run', s: 'jumps', n: 40 },
    { id: 'surge', icon: 'bolt', name: 'Power Surge', desc: 'Pick up 6 power-ups in one run', s: 'powerups', n: 6 },
    { id: 'collector', icon: 'star', name: 'Collector', desc: 'Collect 1,000 energy in total', s: 'totalEnergy', n: 1000 },
    { id: 'ace', icon: 'task_alt', name: 'Mission Ace', desc: 'Complete 10 missions', s: 'done', n: 10 },
    { id: 'streak', icon: 'today', name: 'Daily Runner', desc: 'Finish daily challenges 3 days in a row', s: 'streak', n: 3 },
    { id: 'style', icon: 'smart_toy', name: 'New Look', desc: 'Unlock a new robot', s: 'skins', n: 2 }
  ];
  const MDEF = {}, DDEF = {};
  MISSIONS.forEach((m) => (MDEF[m.id] = m)); DAILY.forEach((m) => (DDEF[m.id] = m));
  const text = (d) => d.t.replace('{n}', num(d.n));

  const blank = () => ({
    v: 1, wallet: 0, owned: ['scout'], equipped: 'scout', active: [], done: 0, lastDone: null,
    daily: null, dailyDone: 0, streak: 0, lastDaily: null, badges: {},
    totals: { runs: 0, dist: 0, energy: 0 }, bests: { dist: 0, energy: 0, jumps: 0, slides: 0, dodges: 0, powerups: 0, zones: 0, noHit: 0 }
  });
  let P;
  const load = () => {
    const raw = get('progress', {}), b = blank();
    P = Object.assign(b, raw);
    P.totals = Object.assign(b.totals, raw.totals || {}); P.bests = Object.assign(blank().bests, raw.bests || {});
    fill(); rollDaily(); save();
  };
  const save = () => set('progress', P);
  const dayStr = (off) => { const d = new Date(); d.setDate(d.getDate() + (off || 0)); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  function fill() {
    const ids = P.active.map((a) => a.id);
    while (P.active.length < 3) {
      const pool = MISSIONS.filter((m) => ids.indexOf(m.id) < 0 && m.id !== P.lastDone);
      const m = pool[(Math.random() * pool.length) | 0];
      P.active.push({ id: m.id, cur: 0, base: m.total ? P.totals[m.m] || 0 : 0 }); ids.push(m.id);
    }
  }
  function rollDaily() {
    const d = dayStr(0);
    if (!P.daily || P.daily.date !== d) P.daily = { date: d, id: DAILY[hash(d) % DAILY.length].id, cur: 0, done: false };
  }
  const stats = (run) => {
    const r = run || {}, b = P.bests, mx = (k) => Math.max(b[k] || 0, r[k] || 0);
    return { runs: P.totals.runs, totalEnergy: P.totals.energy, totalDist: P.totals.dist, dist: mx('dist'), zones: mx('zones'), noHit: mx('noHit'), jumps: mx('jumps'), powerups: mx('powerups'), done: P.done, streak: P.streak, skins: P.owned.length };
  };
  let runEvents = [];
  const badgeCheck = (run) => {
    const S = stats(run), ev = [];
    BADGES.forEach((b) => { if (!P.badges[b.id] && S[b.s] >= b.n) { P.badges[b.id] = dayStr(0); ev.push({ kind: 'badge', icon: b.icon, text: b.name, reward: 0 }); } });
    return ev;
  };
  const doTrack = (run) => {
    const ev = [];
    for (let i = 0; i < P.active.length; i++) {
      const a = P.active[i], d = MDEF[a.id]; if (!d || d.total) continue;
      a.cur = Math.max(a.cur, run[d.m] || 0);
      if (a.cur >= d.n) { P.wallet += d.r; P.done++; P.lastDone = d.id; P.active.splice(i, 1); i--; ev.push({ kind: 'mission', icon: 'task_alt', text: text(d), reward: d.r }); }
    }
    rollDaily();
    const dd = DDEF[P.daily.id];
    if (!P.daily.done) {
      P.daily.cur = Math.max(P.daily.cur, run[dd.m] || 0);
      if (P.daily.cur >= dd.n) {
        P.daily.done = true; P.wallet += dd.r; P.dailyDone++;
        P.streak = P.lastDaily === dayStr(-1) ? P.streak + 1 : 1; P.lastDaily = dayStr(0);
        ev.push({ kind: 'daily', icon: 'today', text: text(dd), reward: dd.r });
      }
    }
    if (ev.length) { fill(); save(); }
    return ev;
  };

  const api = {
    SKINS,
    beginRun() { rollDaily(); runEvents = []; },
    track(run) {
      let up = false;
      for (const k in P.bests) if (k !== 'energy' && (run[k] || 0) > (P.bests[k] || 0)) { P.bests[k] = run[k]; up = true; } // keep bests honest even if the run is quit
      const ev = doTrack(run).concat(badgeCheck(run));
      if (ev.length || (up && Date.now() - (this.savedAt || 0) > 3000)) { save(); this.savedAt = Date.now(); }
      runEvents = runEvents.concat(ev); return ev;
    },
    endRun(run) {
      const ev = doTrack(run);
      P.totals.runs++; P.totals.dist += run.dist || 0; P.totals.energy += run.energy || 0;
      for (const k in P.bests) P.bests[k] = Math.max(P.bests[k] || 0, run[k] || 0);
      P.wallet += run.energy || 0;
      for (let i = 0; i < P.active.length; i++) {
        const a = P.active[i], d = MDEF[a.id]; if (!d.total) continue;
        a.cur = (P.totals[d.m] || 0) - a.base;
        if (a.cur >= d.n) { P.wallet += d.r; P.done++; P.lastDone = d.id; P.active.splice(i, 1); i--; ev.push({ kind: 'mission', icon: 'task_alt', text: text(d), reward: d.r }); }
      }
      fill();
      const all = runEvents.concat(ev, badgeCheck(run)); runEvents = [];
      save();
      return { events: all, earned: (run.energy || 0) + all.reduce((s, e) => s + (e.reward || 0), 0) };
    },
    snapshot(unlockAll) {
      rollDaily();
      const S = stats(null), pct = (c, n) => Math.round(Math.min(1, n ? c / n : 0) * 100) + '%';
      const row = (d, cur) => ({ id: d.id, text: text(d), reward: num(d.r), pct: pct(cur, d.n), label: d.place ? '' : num(Math.min(cur, d.n)) + ' / ' + num(d.n) });
      const dd = DDEF[P.daily.id], now = new Date(), mid = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const hrs = Math.max(1, Math.ceil((mid - now) / 3600000));
      const owned = (id) => unlockAll || P.owned.indexOf(id) >= 0;
      return {
        wallet: P.wallet, walletLabel: num(P.wallet),
        missions: P.active.map((a) => { const d = MDEF[a.id]; return row(d, d.total ? (P.totals[d.m] || 0) - a.base : a.cur); }),
        daily: Object.assign(row(dd, P.daily.cur), { done: P.daily.done, resets: hrs === 1 ? 'New challenge in 1 hour' : 'New challenge in ' + hrs + ' hours' }),
        streak: P.streak, missionsDone: P.done,
        badges: BADGES.map((b) => ({ id: b.id, icon: b.icon, name: b.name, desc: b.desc, got: !!P.badges[b.id], pct: P.badges[b.id] ? '100%' : pct(S[b.s], b.n), label: P.badges[b.id] ? 'Unlocked' : b.place ? 'Not reached yet' : num(Math.min(S[b.s], b.n)) + ' / ' + num(b.n) })),
        badgeCount: BADGES.filter((b) => P.badges[b.id]).length, badgeTotal: BADGES.length,
        skins: SKINS.map((s) => ({ id: s.id, name: s.name, price: s.price, priceLabel: s.gate || num(s.price), gate: s.gate || '', owned: owned(s.id), equipped: P.equipped === s.id, body: hex(s.body), acc: hex(s.acc), glow: hex(s.glow), dark: hex(s.dark) }))
      };
    },
    skin(id) { return SKINS.find((s) => s.id === (id || P.equipped)) || SKINS[0]; },
    buy(id) {
      const s = SKINS.find((x) => x.id === id); if (!s || P.owned.indexOf(id) >= 0 || P.wallet < s.price) return [];
      P.wallet -= s.price; P.owned.push(id); P.equipped = id; const ev = badgeCheck(null); save(); return ev;
    },
    equip(id) { if (SKINS.some((s) => s.id === id)) { P.equipped = id; save(); } },
    grant(id) { if (!SKINS.some((s) => s.id === id) || P.owned.indexOf(id) >= 0) return false; P.owned.push(id); save(); return true; },   // unlock a character without paying
    spend(n) { if (!(n > 0) || P.wallet < n) return false; P.wallet -= n; save(); return true; },
    exportCode() {
      const data = {};
      for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf(PRE) === 0) data[k.slice(PRE.length)] = localStorage.getItem(k); }
      const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
      return 'RR1-' + b64 + '-' + (hash(b64) % 1679616).toString(36).padStart(4, '0');
    },
    importCode(code) {
      const m = /^RR1-([A-Za-z0-9+/=]+)-([0-9a-z]{4})$/.exec(String(code || '').replace(/\s+/g, ''));
      if (!m || (hash(m[1]) % 1679616).toString(36).padStart(4, '0') !== m[2]) return false;
      let data; try { data = JSON.parse(decodeURIComponent(escape(atob(m[1])))); } catch (e) { return false; }
      if (!data || typeof data !== 'object') return false;
      const old = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf(PRE) === 0) old.push(k); }
      try { old.forEach((k) => localStorage.removeItem(k)); for (const k in data) if (typeof data[k] === 'string') localStorage.setItem(PRE + k, data[k]); } catch (e) { return false; }
      load(); return true;
    }
  };
  load();
  window.RoboProgress = api;
})();
