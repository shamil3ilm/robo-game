/* Robo Run: the map screen. Exposes window.RoboMap = { open, close, isOpen, noteVisit, visited, REGION, LABELS, CATS, categoryOf, displayName, placesFor, fit, toCanvas, fromCanvas, nearestMarker, regionEdges }.
   Two tabs. "Here" is a detailed map of the area you are in: streets and big places named, every spot on it as a dot coloured by what it is, a list of places sorted by distance, and "Show the way" to put a cyan beam on any of them.
   "Region" is a sketch of how the places connect: the four town areas, the Wayanad Churam, the KSRTC buses between them with their fares and times, and where you are. The sketch is NOT to scale (the directions are about right, the distances are not).
   Everything that is data (names, labels, categories) or arithmetic is pure and tested in Node; the drawing and the panel are checked in the browser. Names are only ones that exist in the game's areas (explore_notes.js and the area files). */
(function () {
  'use strict';
  if (window.RoboMap) return;   // the page loads each script twice; the first copy is the one
  const ML = '"Nirmala UI","Noto Sans Malayalam","Kartika",sans-serif';
  const OPEN = () => window.ROBO_ACTIVE_AREAS || null, areaOpen = (id) => !OPEN() || OPEN().indexOf(id) >= 0, manyOpen = () => !OPEN() || OPEN().indexOf('city') >= 0;   // the WORLD tab only when the towns are joined by the highway   // which towns are open (index.html); none set = all
  const OX = { kozhikode: 0, city: 200, hilite: 400, manjeri: 600, wayanad: -300, malappuram: 900 };   // each area's centre in the town's one big scene (the same numbers as explore.js and explore_rides.js)

  /* what the map shows about each place on the region sketch. x, y are in a 0-100 box with the sea on the left. */
  const REGION = {
    nodes: {
      kozhikode: { name: 'Kozhikode Beach and Mittai Theruvu', short: 'Beach town', local: 'കോഴിക്കോട് ബീച്ച്', emoji: '🏖️', x: 15, y: 50, area: true,
        text: 'The old sweet street (S. M. Street, about 2.1 km long), the beach where the Kerala Literature Festival is held, a temple, a mosque and a church, and Robo\'s dock. Kozhikode became a UNESCO City of Literature in October 2023.' },
      city: { name: 'Kozhikode city (Mavoor Road)', short: 'City', local: 'കോഴിക്കോട് നഗരം', emoji: '🏙️', x: 32, y: 42, area: true,
        text: 'The railway station (four platforms), the KSRTC Bus Stand and the Mofussil Bus Stand, EMS Stadium (opened 1977, about 50,000 seats), Baby Memorial Hospital, Aster MIMS and a school.' },
      hilite: { name: 'HiLITE City (Palazhi)', short: 'HiLITE City', local: 'ഹൈലൈറ്റ് സിറ്റി', emoji: '🏬', x: 40, y: 67, area: true,
        text: 'HiLITE Mall (opened 10 April 2015), the HiLITE Business Park twin towers, UL Cyberpark, and the NH 66 bypass.' },
      manjeri: { name: 'Manjeri', short: 'Manjeri', local: 'മഞ്ചേരി', emoji: '⚽', x: 76, y: 82, area: true,
        text: 'A Malappuram town: the KSRTC station, Hotel Farsa on Pandikkad Road, a football turf (Malappuram is football country), the Government Medical College and Zilla Money, the game\'s parody of Zil Money\'s engineering office.' },
      wayanad: { name: 'Thamarassery Churam and Lakkidi', short: 'Lakkidi', local: 'താമരശ്ശേരി ചുരം · ലക്കിടി', emoji: '⛰️', x: 70, y: 20, area: true, walk: { x: -300, z: 48 },
        text: 'NH 766 climbs about 14 km from Adivaram to the Lakkidi view point in nine hairpin bends, into Wayanad. In the game you can walk it: take the highway east of Manjeri and turn up the ghat road. At the top are Lakkidi, the view point and a tea estate. On the three-lane run, keep running along the beach road and the ghat begins.' }
,
      malappuram: { name: 'Malappuram', short: 'Malappuram', local: 'മലപ്പുറം', emoji: '🕌', x: 66, y: 88, area: true,
        text: 'The district town, 14 km from Manjeri. The KSRTC Bus Terminal stands at the junction where Malappuram-Perinthalmanna Road meets Kottakkunnu Road; the Civil Station and the Collectorate stand on Civil Station Road, and the Town Hall is close by. Take the KSRTC bus from Manjeri.' }
    },
    /* places that are not open yet: they are on the map, marked as restricted areas, so the map is never empty (only real places; no claim about what will be there) */
    locked: {
      karipur: { name: 'Kondotty and Karipur airport', short: 'Karipur', local: 'കൊണ്ടോട്ടി · കരിപ്പൂർ', emoji: '🔒', x: 57, y: 76 },
      nilambur: { name: 'Nilambur', short: 'Nilambur', local: 'നിലമ്പൂർ', emoji: '🔒', x: 91, y: 66 },
      beyond: { name: 'Wayanad beyond Lakkidi', short: 'Beyond Lakkidi', local: 'വയനാട്', emoji: '🔒', x: 88, y: 9 }
    },
    /* the KSRTC links come from the ride data (so the fares here are always the real ones in the game); this one is the road you run */
    road: { from: 'city', to: 'wayanad', label: 'the three-lane run', short: 'NH 766 · run it' },
    coast: 'M 8 0 C 10 18, 6 30, 12 44 C 15 52, 13 60, 17 70 C 20 80, 16 90, 20 100'   // a stylised coastline
  };
  const ZONE_OF_STOP = { kz_ksrtc: 'kozhikode', cy_ksrtc: 'city', mj_ksrtc: 'manjeri', hl_ksrtc: 'hilite', wy_ksrtc: 'wayanad', mp_ksrtc: 'malappuram' };
  /* the KSRTC bus stop spot of an area (so a place in another area can be reached: walk to this stop, take the bus) */
  const STOP_ARG = { kozhikode: 'bus_kz_ksrtc', city: 'bus_cy_ksrtc', hilite: 'bus_hl_ksrtc', manjeri: 'bus_mj_ksrtc', wayanad: 'bus_wy_ksrtc', malappuram: 'bus_mp_ksrtc' };
  const busStopSpot = (spots, area) => (spots || []).find((sp) => sp.kind === 'shop' && sp.arg === STOP_ARG[area]) || null;
  const regionEdges = () => {
    const RR = window.RoboExploreRides; if (!RR || !RR.BUS_LINKS) return [];
    return RR.BUS_LINKS.map((l) => ({ a: ZONE_OF_STOP[l.a], b: ZONE_OF_STOP[l.b], fare: l.fare, hours: l.hours, label: 'KSRTC ₹' + l.fare + ' · ' + (l.hours >= 1 ? Math.floor(l.hours) + ' h' + (l.hours % 1 ? ' ' + Math.round((l.hours % 1) * 60) + ' min' : '') : Math.round(l.hours * 60) + ' min') }));
  };

  /* names written on the area map: [text, local x, local z, size 1-3]; streets and big places that are not spots */
  const LABELS = {
    kozhikode: [['Mittai Theruvu', 0, -6, 3], ['Temple lane', 10, -26, 1], ['Market lane', -10, -26, 1], ['Temple courtyard', 24, -26, 1], ['Mosque courtyard', -24, -26, 1], ['Church square', 26, 64, 1], ['Beach promenade', 0, 70, 2], ['Kozhikode Beach', 0, 90, 3], ['East beach', 60, 88, 2], ['West beach', -60, 88, 2], ['The sea', 0, 101, 1]],
    city: [['Station Lane', -62, -10, 3], ['Mobile Repair', -53, -16, 1], ['Cycle Shop', -53, 10, 1], ['Mofussil yard', -45, 44, 1], ['Mavoor Road', 0, 12, 3], ['Railway station', 0, -57, 3], ['EMS Stadium', 13, -33, 2], ['Baby Memorial Hospital', 16, -10, 2], ['Aster MIMS', -15, -10, 2], ['KSEB', 12, 8, 1], ['School', -14, 9, 1], ['KSRTC Bus Stand', 19, 45, 2], ['Mofussil Bus Stand', -19, 45, 2]],
    manjeri: [['Manjeri Junction', 0, 8, 3], ['Manjeri-Pandikkad Road', 56, 0, 2], ['Bypass road', -52, 0, 2], ['Kozhikode-Manjeri Road', 0, -62, 2], ['Kozhikode-Malappuram Bypass', 0, 62, 2], ['Cherani Cross Road', 40, -64, 1], ['Happy Road', 22, -100, 1], ['To Kozhikode', 0, -131, 1], ['To Malappuram', 0, 102, 1], ['Zilla Money', 11, -126, 2], ['Al Rayadhan', -9, -119, 1], ['Hotel Zindagi', -9, -103, 1], ['Vanitha Mess', 9, -86, 1], ['Hotel Farsa', 20, 9, 1], ['KSRTC station', 43, 19, 2], ['Software studio', 67, -9, 1], ['Repair shop', 82, -9, 1], ['Government Medical College', 22, 38, 2], ['Football turf', -21, 44, 2], ['Hotel Oottupura', -75, 9, 1], ["Robo's Dock", -9, 14, 1], ['Budget Hyper Market', 12, 94, 2]],
    malappuram: [['KSRTC junction', 0, 9, 3], ['Malappuram-Perinthalmanna Road', 52, 0, 2], ['Kozhikode Road', -52, 0, 2], ['Kottakkunnu Road', 0, -60, 2], ['Civil Station Road', 0, 66, 2], ['KSRTC Bus Terminal', -37, -22, 2], ['Town Hall', 18, -9, 1], ['Civil Station', -9, 13, 1], ['Collectorate', -9, 34, 1], ['Mariyamman Kovil', 9, 17, 1], ['Hotel Delicia', -9, -30, 1]],
    wayanad: [['Thamarassery Churam', -170, 56, 2], ['Hairpin 1', -120, 48, 1], ['Hairpin 4', -200, 8, 1], ['Hairpin 8', -200, -43, 1], ['Lakkidi gate', -80, -50, 2], ['Lakkidi', 0, 0, 3], ['View point', -64, 18, 2], ['Tea estate', 48, 0, 2], ['Bus stop', 0, 52, 1]],
    hilite: [['Link Road', 62, -10, 3], ['Electronics', 53, -26, 1], ['Mobile Shop', 71, -16, 1], ['Open ground', 46, 26, 1], ['HiLITE City road', 0, 6, 3], ['HiLITE Mall', 24, -20, 3], ['HiLITE Business Park', -21, -21, 2], ['UL Cyberpark', -20, 22, 2], ['NH 66 bypass', 0, 55, 3]]
  };
  /* names on the world map: every area's names, moved to where the area stands, and the highway */
  const worldLabels = () => { const out = [['NH 66 · the highway', 392, 69, 3], ['NH 66 · the highway', 140, 69, 3], ['NH 66 · the highway', 640, 69, 3], ['NH 66 · the highway', -330, 69, 3], ['Arabian Sea', 300, 92, 3], ['Arabian Sea', -300, 92, 3], ['Arabian Sea', 560, 92, 2]]; for (const a of Object.keys(LABELS)) for (const [t, lx, lz, sz] of LABELS[a]) out.push([t, (OX[a] || 0) + lx, lz, sz === 3 ? 2 : sz]); return out; };
  const AREA_SHORT = { kozhikode: 'Kozhikode Beach', city: 'Kozhikode city', hilite: 'HiLITE City', manjeri: 'Manjeri', wayanad: 'Lakkidi · Wayanad', malappuram: 'Malappuram' };
  const AREA_NAME = { kozhikode: 'Kozhikode Beach and Mittai Theruvu', city: 'Kozhikode city (Mavoor Road)', hilite: 'HiLITE City (Palazhi)', manjeri: 'Manjeri', wayanad: 'Thamarassery Churam and Lakkidi, the gateway of Wayanad', malappuram: 'Malappuram town (KSRTC junction)' };

  /* what kind of thing a spot is, for the colour, the list heading and the icon */
  const CATS = {
    shops: { title: 'Shops', emoji: '🛒', color: '#ffd27a' }, eat: { title: 'Eat and drink', emoji: '☕', color: '#ff9a6a' }, health: { title: 'Health', emoji: '🌿', color: '#7fe8a8' },
    travel: { title: 'Autos and buses', emoji: '🚌', color: '#8fc8ff' }, charging: { title: 'Charging', emoji: '🔌', color: '#46e0ff' }, services: { title: 'Services', emoji: '♻️', color: '#b8d89a' },
    jobs: { title: 'Delivery jobs', emoji: '📦', color: '#a8b8ff' }, enter: { title: 'Places to enter', emoji: '🚪', color: '#ffe9b0' }, learn: { title: 'Read about', emoji: '📜', color: '#cfe8ff' },
    pin: { title: 'Chosen spot', emoji: '📍', color: '#ffffff' }, run: { title: 'The run', emoji: '🏃', color: '#7fe8a8' }, home: { title: 'Home', emoji: '🏠', color: '#e0b8ff' }, people: { title: 'People', emoji: '💬', color: '#ffb8d8' }
  };
  const EAT = new Set(['snacks', 'farsa', 'oottupura', 'zindagi', 'vanitha', 'rayadhan', 'bombay', 'swamy']);
  const categoryOf = (sp) => {
    if (!sp || sp.quiet) return null;   // a quiet spot (a parked scooter or auto you can get into) is not a place to list or travel to
    switch (sp.kind) {
      case 'pin': return 'pin'; case 'drive': return 'travel'; case 'door': return 'enter'; case 'talk': return 'people'; case 'note': return 'learn'; case 'job': return 'jobs'; case 'gate': return 'run'; case 'charge': return 'charging'; case 'travel': return 'travel'; case 'menu': return 'home'; case 'exit': return null;
      case 'shop': { const a = String(sp.arg || ''); if (/^(auto|bus)_/.test(a)) return 'travel'; if (a === 'kseb') return 'charging'; if (a === 'scrap') return 'services'; if (EAT.has(a)) return 'eat'; if (a === 'pharmacy') return 'health'; return 'shops'; }
      default: return 'shops';
    }
  };
  const displayName = (sp) => String(sp.label || sp.arg || '').replace(/^(Enter|Leave|Talk to) /i, '').replace(/^Delivery job$/, 'Delivery desk');
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  /* the places of an area, grouped by kind, nearest first inside each group; from = where the player is (or null) */
  const placesFor = (spots, area, from) => {
    const ox = OX[area] === undefined ? 0 : OX[area], out = {};
    for (const sp of spots || []) {
      if (area && area !== 'world' && (sp.x - ox < -100 || sp.x - ox > 100) && !(area === 'kozhikode' && Math.abs(sp.x) < 100)) continue;   // only this area's spots
      const c = categoryOf(sp); if (!c) continue;
      (out[c] = out[c] || []).push({ spot: sp, cat: c, name: displayName(sp), emoji: sp.emoji || CATS[c].emoji, d: from ? dist(sp, from) : 0 });
    }
    for (const c of Object.keys(out)) out[c].sort((p, q) => p.d - q.d || p.name.localeCompare(q.name));
    return out;
  };
  /* drawing arithmetic: fit the area (world x0..x1, z0..z1) into a w by h canvas, with an optional zoom about a world point */
  const fit = (M, w, h, zoom, about, rot) => {   // rot: the world map is turned a quarter so its long side runs down the phone (the sea on the left, north on the right, like a coast map)
    const base = rot ? Math.min(w / (M.z1 - M.z0), h / (M.x1 - M.x0)) : Math.min(w / (M.x1 - M.x0), h / (M.z1 - M.z0)), s = base * (zoom || 1);
    const cx = zoom > 1 && about ? about.x : (M.x0 + M.x1) / 2, cz = zoom > 1 && about ? about.z : (M.z0 + M.z1) / 2;
    return { s, cx, cz, w, h, rot: !!rot };
  };
  /* the map is drawn with a margin of this many metres round the walkable ground; the margin is the restricted area (or the sea, on the beach side of the beach town) */
  const MARGIN = 14, PI_2 = Math.PI / 2;
  const expand = (M, m) => ({ x0: M.x0 - m, x1: M.x1 + m, z0: M.z0 - m, z1: M.z1 + m });
  const SEA_SIDE = { kozhikode: 'south' };
  /* the four strips of the margin: [x0, x1, z0, z1, kind, side] with kind 'sea' or 'restricted'; together they tile the margin ring exactly */
  const outerRects = (M, m, area) => {
    const E = expand(M, m), sea = (side) => (SEA_SIDE[area] === side ? 'sea' : 'restricted');
    return [[E.x0, E.x1, E.z0, M.z0, sea('north'), 'north'], [E.x0, E.x1, M.z1, E.z1, sea('south'), 'south'], [E.x0, M.x0, M.z0, M.z1, sea('west'), 'west'], [M.x1, E.x1, M.z0, M.z1, sea('east'), 'east']];
  };
  const toCanvas = (F, x, z) => (F.rot ? { x: F.w / 2 - (z - F.cz) * F.s, y: F.h / 2 + (x - F.cx) * F.s } : { x: F.w / 2 + (x - F.cx) * F.s, y: F.h / 2 + (z - F.cz) * F.s });
  const fromCanvas = (F, px, py) => (F.rot ? { x: F.cx + (py - F.h / 2) / F.s, z: F.cz - (px - F.w / 2) / F.s } : { x: F.cx + (px - F.w / 2) / F.s, z: F.cz + (py - F.h / 2) / F.s });
  const nearestMarker = (F, spots, px, py, maxPx) => {
    let best = null, bd = (maxPx || 26);
    for (const sp of spots) { if (!categoryOf(sp)) continue; const c = toCanvas(F, sp.x, sp.z), d = Math.hypot(c.x - px, c.y - py); if (d < bd) { bd = d; best = sp; } }
    return best;
  };
  const visited = () => { try { return JSON.parse(localStorage.getItem('runaway.visited') || '{}') || {}; } catch (e) { return {}; } };
  const noteVisit = (area) => { if (!area || !OX.hasOwnProperty(area)) return; const v = visited(); if (v[area]) return; v[area] = true; try { localStorage.setItem('runaway.visited', JSON.stringify(v)); } catch (e) { /* not remembered */ } };

  /* ---------------- the panel (browser only) ---------------- */
  let panel = null, timer = 0, state = null;
  const h = (tag, style, text, attrs) => { const e = document.createElement(tag); if (style) e.style.cssText = style; if (text != null) e.textContent = text; if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
  const BTN = 'min-height:44px;padding:8px 14px;border:1px solid rgba(243,240,232,0.25);border-radius:12px;background:rgba(10,14,12,0.6);color:#f3f0e8;font-family:Oxanium,sans-serif;font-weight:700;font-size:14px;letter-spacing:0.04em;cursor:pointer;touch-action:manipulation';
  const AMBER = 'background:oklch(0.82 0.15 75);color:#14110a;border-color:transparent';
  const T = (s) => (window.RoboI18n && window.RoboI18n.lang() === 'ml' ? window.RoboI18n.tr(s) : s);   // text drawn on the canvas is not page text, so it is translated here
  const fmtD = (m) => (m < 1000 ? Math.round(m) + ' m' : (m / 1000).toFixed(1) + ' km');
  const WALK = 4.2;   // metres a second, the same walking speed as explore.js
  /* "about 30 s", "about 2 min": how long a walk of m metres takes */
  const etaText = (m, mul) => { const s = Math.max(0, m) / (WALK * (mul || 1));   // mul: 2 on the delivery bike
    return s < 8 ? 'a few seconds' : s < 60 ? 'about ' + Math.max(10, Math.round(s / 5) * 5) + ' s' : 'about ' + Math.ceil(s / 60) + ' min'; };

  function drawHere(cv, o, sel) {
    const dpr = Math.min(window.devicePixelRatio || 1, 3), W = cv.clientWidth || 320, H = cv.clientHeight || 320;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    const M = o.maps[o.area]; if (!M) return null;
    const pl = o.getPlayer ? o.getPlayer() : null, F = fit(expand(M, MARGIN), W, H, state.zoom, state.pan || pl, state.view === 'world');
    c.fillStyle = F.rot ? '#1d6272' : (OPEN() && OPEN().indexOf('city') < 0) ? '#1d2618' : '#12170f'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#1d2618'; { const a = toCanvas(F, M.x0, M.z0), b = toCanvas(F, M.x1, M.z1); c.fillRect(a.x, a.y, b.x - a.x, b.y - a.y); }
    const hatch = (() => { const pc = document.createElement('canvas'); pc.width = pc.height = 14; const g = pc.getContext('2d'); g.fillStyle = '#171d14'; g.fillRect(0, 0, 14, 14); g.strokeStyle = '#3b4634'; g.lineWidth = 2; g.beginPath(); g.moveTo(-2, 16); g.lineTo(16, -2); g.moveTo(-2, 2); g.lineTo(2, -2); g.moveTo(12, 16); g.lineTo(16, 12); g.stroke(); return c.createPattern(pc, 'repeat'); })();
    const single = !!(OPEN() && OPEN().indexOf('city') < 0), outer = F.rot || single ? [] : outerRects(M, MARGIN, o.area);   // one town open: no hatched border, the town just ends in jungle   // the world map has the sea all round the left and the hills beyond
    for (const [x0, x1, z0, z1, kind] of outer) { const a = toCanvas(F, x0, z0), b = toCanvas(F, x1, z1); c.fillStyle = kind === 'sea' ? '#1f4a58' : hatch; c.fillRect(a.x, a.y, b.x - a.x, b.y - a.y); }
    for (const [x0, x1, z0, z1, kind, side] of outer) { if (kind === 'sea') continue; const a = toCanvas(F, x0, z0), b = toCanvas(F, x1, z1), w = b.x - a.x, hh = b.y - a.y, cx = Math.max(a.x, 0) + (Math.min(b.x, W) - Math.max(a.x, 0)) / 2, cy = Math.max(a.y, 0) + (Math.min(b.y, H) - Math.max(a.y, 0)) / 2; if (cx < 0 || cx > W || cy < 0 || cy > H) continue; const vertical = side === 'west' || side === 'east'; if ((vertical ? w : hh) < 18) continue; c.save(); c.translate(cx, cy); if (vertical) c.rotate(-Math.PI / 2); c.font = '800 11px Oxanium, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; const label = T('Restricted area'); const tw = c.measureText(label).width + 12; c.fillStyle = 'rgba(14,18,12,0.88)'; c.fillRect(-tw / 2, -9, tw, 18); c.fillStyle = '#ffb878'; c.fillText(label, 0, 0); c.restore(); }
    for (const [x0, x1, z0, z1, col, kind] of M.rects) { const a = toCanvas(F, x0, z0), b = toCanvas(F, x1, z1); c.fillStyle = kind === 'hatch' ? hatch : col; c.fillRect(a.x, a.y, b.x - a.x, b.y - a.y); }
    const ox = OX[o.area] || 0; c.textAlign = 'center'; c.textBaseline = 'middle';
    const placed = [];
    for (const [t, lx, lz, sz] of (LABELS[o.area] || (o.area === 'world' ? worldLabels() : [])).slice().sort((a, b) => b[3] - a[3])) { const p = toCanvas(F, ox + lx, lz); if (p.x < -40 || p.x > W + 40 || p.y < -10 || p.y > H + 10) continue; const px = [0, 10, 12.5, 15][sz] * Math.min(1.5, Math.max(0.85, F.s / 4)); c.font = (sz === 3 ? '800 ' : '700 ') + px + 'px Oxanium, sans-serif'; const w = c.measureText(T(t)).width + 6, box = { x0: p.x - w / 2, x1: p.x + w / 2, y0: p.y - px / 2 - 1, y1: p.y + px / 2 + 1 }; if (placed.some((b) => box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0)) continue; placed.push(box); c.lineWidth = 3; c.strokeStyle = 'rgba(15,20,14,0.85)'; c.strokeText(T(t), p.x, p.y); c.fillStyle = sz === 3 ? '#f3f0e8' : 'rgba(243,240,232,0.82)'; c.fillText(T(t), p.x, p.y); }
    const spots = o.spots.filter((sp) => categoryOf(sp));
    for (const sp of spots) { const p = toCanvas(F, sp.x, sp.z); if (p.x < -10 || p.x > W + 10 || p.y < -10 || p.y > H + 10) continue; const cat = CATS[categoryOf(sp)]; c.fillStyle = cat.color; c.strokeStyle = '#10140f'; c.lineWidth = 2; c.beginPath(); c.arc(p.x, p.y, sp === sel ? 8 : 5, 0, 6.3); c.fill(); c.stroke(); }
    const pathPts = (wpNow) => (wpNow && wpNow.path) || (sel && state.preview && state.preview.sel === sel && state.preview.route ? state.preview.route.points : null);
    const wp0 = o.getWaypoint ? o.getWaypoint() : null, pp = pathPts(wp0 && (!sel || (Math.hypot(wp0.x - sel.x, wp0.z - sel.z) < 0.5)) ? wp0 : null);
    if (pp && pp.length > 1) {   // the way to walk: a dashed line with a dark edge, and a small arrow every so often
      c.save(); c.lineJoin = 'round'; c.lineCap = 'round'; c.setLineDash([9, 7]); c.strokeStyle = '#0b1114'; c.lineWidth = 7; c.beginPath(); pp.forEach((q, i) => { const p = toCanvas(F, q.x, q.z); if (i) c.lineTo(p.x, p.y); else c.moveTo(p.x, p.y); }); c.stroke(); c.strokeStyle = '#6fd6ff'; c.lineWidth = 4; c.stroke(); c.setLineDash([]);
      const nav = window.RoboNav; if (nav) for (const q of nav.sample(pp, 90 / Math.max(F.s, 0.5), 30).slice(1)) { const i = pp.findIndex((_, k) => k < pp.length - 1 && nav.distanceTo([pp[k], pp[k + 1]], q.x, q.z) < 0.05); if (i < 0) continue; const p = toCanvas(F, q.x, q.z), a = toCanvas(F, pp[i].x, pp[i].z), b = toCanvas(F, pp[i + 1].x, pp[i + 1].z), ang = Math.atan2(b.y - a.y, b.x - a.x); c.save(); c.translate(p.x, p.y); c.rotate(ang); c.fillStyle = '#ffffff'; c.strokeStyle = '#0b1114'; c.lineWidth = 2; c.beginPath(); c.moveTo(6, 0); c.lineTo(-4, -5); c.lineTo(-4, 5); c.closePath(); c.stroke(); c.fill(); c.restore(); }
      c.restore();
    }
    if (state.zoom >= 2) {   // names on the pins: light speech bubbles, nearest to the middle first, none on top of another
      const cands = spots.filter((sp) => sp !== sel).map((sp) => ({ sp, p: toCanvas(F, sp.x, sp.z) })).filter((q) => q.p.x > 30 && q.p.x < W - 30 && q.p.y > 34 && q.p.y < H - 8).sort((a, b) => Math.hypot(a.p.x - W / 2, a.p.y - H / 2) - Math.hypot(b.p.x - W / 2, b.p.y - H / 2)), taken = [];
      c.font = '700 12px Barlow, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      for (const q of cands.slice(0, 14)) { const t = T(displayName(q.sp)), w = c.measureText(t).width + 16, bx = q.p.x - w / 2, by = q.p.y - 34, box = { x0: bx, x1: bx + w, y0: by, y1: by + 22 }; if (taken.some((b) => box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0)) continue; taken.push(box); c.fillStyle = 'rgba(255,252,240,0.94)'; c.beginPath(); c.moveTo(bx + 8, by); c.arcTo(bx + w, by, bx + w, by + 22, 8); c.arcTo(bx + w, by + 22, bx, by + 22, 8); c.lineTo(q.p.x + 5, by + 22); c.lineTo(q.p.x, by + 28); c.lineTo(q.p.x - 5, by + 22); c.arcTo(bx, by + 22, bx, by, 8); c.arcTo(bx, by, bx + w, by, 8); c.closePath(); c.fill(); c.fillStyle = '#1c3d2c'; c.fillText(t, q.p.x, by + 11.5); }
    }
    if (o.job && o.job.target) { const p = toCanvas(F, o.job.target.x, o.job.target.z); c.strokeStyle = o.job.phase === 'pickup' ? '#ffe14a' : '#4aff9a'; c.lineWidth = 3; c.beginPath(); c.arc(p.x, p.y, 11, 0, 6.3); c.stroke(); }
    const wp = o.getWaypoint ? o.getWaypoint() : null;
    if (wp) { const p = toCanvas(F, wp.x, wp.z); if (pl) { const q = toCanvas(F, pl.x, pl.z); c.setLineDash([6, 6]); c.strokeStyle = 'rgba(111,214,255,0.85)'; c.lineWidth = 2; c.beginPath(); c.moveTo(q.x, q.y); c.lineTo(p.x, p.y); c.stroke(); c.setLineDash([]); } c.strokeStyle = '#6fd6ff'; c.lineWidth = 3; c.beginPath(); c.arc(p.x, p.y, 13, 0, 6.3); c.stroke(); c.font = '18px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.fillText('🚩', p.x, p.y - 15); if (pl) { const q = toCanvas(F, pl.x, pl.z), t = fmtD(dist(wp, pl)); c.font = '800 12px Oxanium, sans-serif'; const tw = c.measureText(t).width + 12, mx = (q.x + p.x) / 2, my = (q.y + p.y) / 2; c.fillStyle = 'rgba(10,14,12,0.9)'; c.fillRect(mx - tw / 2, my - 10, tw, 20); c.fillStyle = '#6fd6ff'; c.textBaseline = 'middle'; c.fillText(t, mx, my); c.textBaseline = 'alphabetic'; } }
    if (sel) { const p = toCanvas(F, sel.x, sel.z); c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.beginPath(); c.arc(p.x, p.y, 12, 0, 6.3); c.stroke(); const t = (sel.emoji || '') + ' ' + T(displayName(sel)); c.font = '700 13px Oxanium, sans-serif'; const tw = c.measureText(t).width + 14, bx = Math.max(4, Math.min(W - tw - 4, p.x - tw / 2)), by = p.y - 36 < 4 ? p.y + 16 : p.y - 36; c.fillStyle = 'rgba(10,14,12,0.92)'; c.fillRect(bx, by, tw, 24); c.fillStyle = '#f3f0e8'; c.textAlign = 'left'; c.fillText(t, bx + 7, by + 12); c.textAlign = 'center'; }
    if (F.rot) { c.save(); c.translate(W - 26, 26); c.fillStyle = 'rgba(10,14,12,0.8)'; c.beginPath(); c.arc(0, 0, 17, 0, 6.3); c.fill(); c.fillStyle = '#ffb878'; c.beginPath(); c.moveTo(13, 0); c.lineTo(3, -6); c.lineTo(3, 6); c.fill(); c.fillStyle = '#f3f0e8'; c.font = '800 11px Oxanium, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('N', -6, 0); c.restore(); }   // north is to the right
    if (pl) { const p = toCanvas(F, pl.x, pl.z); c.save(); c.translate(p.x, p.y); c.rotate(-(pl.yaw || 0) + (F.rot ? PI_2 : 0)); c.fillStyle = '#ff7a3a'; c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -11); c.lineTo(8, 8); c.lineTo(-8, 8); c.closePath(); c.fill(); c.stroke(); c.restore(); }
    return F;
  }

  function regionSVG(o, sel) {
    const V = visited(), cur = o.area || 'kozhikode', edges = regionEdges(), N = REGION.nodes;
    let s = '<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%;display:block;touch-action:manipulation" role="img" aria-label="Sketch map of the region (not to scale)">';
    s += '<rect width="100" height="100" fill="#1b2a30"/><path d="' + REGION.coast + ' L 0 100 L 0 0 Z" fill="#1f4a58"/><path d="' + REGION.coast + '" fill="none" stroke="#e6cf9c" stroke-width="1.2"/>';
    s += '<text x="3.5" y="30" fill="#8fc8d8" font-size="3" font-style="italic" font-family="Oxanium, sans-serif">Arabian Sea</text>';
    s += '<path d="M 70 8 C 80 6, 96 10, 98 22 L 98 40 C 90 34, 78 30, 66 22 Z" fill="#2c3d2a"/><text x="86" y="31" fill="#9fc38a" font-size="3" text-anchor="middle" font-family="Oxanium, sans-serif">WAYANAD</text>';
    const P = (k) => N[k];
    const road = REGION.road; s += '<path d="M ' + P(road.from).x + ' ' + P(road.from).y + ' Q 52 28 ' + P(road.to).x + ' ' + P(road.to).y + '" fill="none" stroke="#ff9a4a" stroke-width="' + (sel === 'wayanad' ? 1.9 : 1.4) + '" stroke-dasharray="2.4 1.6"/><text x="47" y="30" fill="#ffb878" font-size="2.7" text-anchor="middle" font-family="Oxanium, sans-serif" stroke="#1b2a30" stroke-width="0.7" paint-order="stroke">' + road.short + '</text>';
    edges.forEach((e) => { const a = P(e.a), b = P(e.b), on = sel && (e.a === sel || e.b === sel); s += '<line x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '" stroke="' + (on ? '#bfe0ff' : '#8fc8ff') + '" stroke-width="' + (on ? 1.5 : 0.7) + '" opacity="' + (on || !sel ? 0.85 : 0.35) + '"/>'; });
    for (const k of Object.keys(REGION.locked)) { const n = REGION.locked[k]; s += '<g data-locked="' + k + '" style="cursor:pointer" tabindex="0" role="button" aria-label="' + n.name + ', restricted area"><circle cx="' + n.x + '" cy="' + n.y + '" r="3.6" fill="#161b17" stroke="#7a8580" stroke-width="0.7" stroke-dasharray="1.2 0.9"/><text x="' + n.x + '" y="' + (n.y + 1.2) + '" font-size="3.4" text-anchor="middle">🔒</text><text x="' + n.x + '" y="' + (n.y + 7) + '" fill="#9aa6a0" font-size="2.7" text-anchor="middle" font-family="Oxanium, sans-serif" stroke="#1b2a30" stroke-width="0.7" paint-order="stroke">' + n.short + '</text></g>'; }
    for (const k of Object.keys(N)) { const n = N[k], here = k === cur; s += '<g data-node="' + k + '" style="cursor:pointer" tabindex="0" role="button" aria-label="' + n.name + '"><circle cx="' + n.x + '" cy="' + n.y + '" r="' + (here ? 5.6 : 4.6) + '" fill="' + (here ? '#ff7a3a' : '#10140f') + '" stroke="' + (here ? '#fff' : '#e6cf9c') + '" stroke-width="0.9"/><text x="' + n.x + '" y="' + (n.y + 1.4) + '" font-size="4.4" text-anchor="middle">' + n.emoji + '</text><text x="' + n.x + '" y="' + (n.y + 8.6) + '" fill="#f3f0e8" font-size="3.1" font-weight="700" text-anchor="middle" font-family="Oxanium, sans-serif" stroke="#1b2a30" stroke-width="0.8" paint-order="stroke">' + n.short + (V[k] ? ' ✓' : '') + '</text></g>'; }
    return s + '<text x="3" y="3.2" fill="#8fa0a8" font-size="2.1" text-anchor="start" font-family="Oxanium, sans-serif">Sketch: directions about right, distances not to scale. Blue lines are KSRTC buses. Locked places are restricted areas.</text></svg>';
  }

  function open(o) {
    o = o || {}; if (typeof document === 'undefined') return false; close();
    const maps = o.maps || {}, area = maps[o.area] ? o.area : 'kozhikode'; o.area = area; o.spots = o.spots || [];
    state = { tab: o.tab === 'story' && o.story ? 'story' : o.tab === 'world' && maps.world && manyOpen() ? 'world' : o.tab === 'region' || !maps[area] ? 'region' : 'here', zoom: 1, sel: null, o };
    panel = h('div', 'position:fixed;inset:0;z-index:60;display:flex;flex-direction:column;background:#0b100d;color:#f3f0e8;font-family:Barlow,sans-serif;padding:max(10px,env(safe-area-inset-top)) max(10px,env(safe-area-inset-right)) max(10px,env(safe-area-inset-bottom)) max(10px,env(safe-area-inset-left))', null, { role: 'dialog', 'aria-label': 'Map' });
    const bar = h('div', 'display:flex;align-items:center;gap:8px;flex:none'); const back = h('button', BTN + ';width:48px;padding:0', '✕', { 'aria-label': 'Close the map' }); back.onclick = () => api.close();
    const title = h('div', 'flex:1;font-family:Oxanium,sans-serif;font-weight:800;font-size:18px;letter-spacing:0.06em', '🗺️ MAP'); bar.append(back, title);
    const tabs = h('div', 'display:flex;gap:8px;flex:none;margin:8px 0'); const tabBtn = (id, label) => { const b = h('button', BTN + ';flex:1', label); b.dataset.tab = id; b.onclick = () => { state.tab = id; render(); }; return b; };
    const tHere = tabBtn('here', 'HERE'), tWorld = tabBtn('world', 'WORLD'), tStory = tabBtn('story', 'STORY'), tReg = tabBtn('region', 'PLACES'); if (maps[area]) tabs.append(tHere); if (maps.world && maps[area] && manyOpen()) tabs.append(tWorld); if (o.story) tabs.append(tStory); tabs.append(tReg); if (tabs.children.length < 2) tabs.style.display = 'none';   // one tab only: no tab bar
    const body = h('div', 'flex:1;min-height:0;display:flex;flex-direction:column;gap:8px;overflow:hidden'); panel.append(bar, tabs, body);
    const render = () => {
      for (const b of tabs.children) b.style.cssText = BTN + ';flex:1;' + (b.dataset.tab === state.tab ? AMBER : '');
      body.textContent = ''; clearInterval(timer);
      if (state.tab === 'here') renderHere(body, o, 'here'); else if (state.tab === 'world') renderHere(body, o, 'world'); else if (state.tab === 'story') renderStory(body, o, render); else renderRegion(body, o, render);
      title.textContent = '🗺️ ' + (state.tab === 'here' ? AREA_SHORT[area].toUpperCase() : state.tab === 'world' ? 'WORLD' : state.tab === 'story' ? ((state.o.story && state.o.story.view().title) || 'STORY') : 'REGION');
    };
    document.body.appendChild(panel); render();
    state.keyHandler = (e) => { if (e.key === 'Escape' || e.key === 'm' || e.key === 'M') { e.preventDefault(); e.stopPropagation(); api.close(); } };
    window.addEventListener('keydown', state.keyHandler, true);
    if (o.onOpen) o.onOpen(); return true;
  }

  function renderHere(body, o0, view) {
    const o = view === 'world' ? Object.assign(Object.create(o0), { area: 'world' }) : o0;   // the world map is the same screen with the whole world as its map
    const wrap = h('div', 'position:relative;flex:' + (view === 'world' ? '8' : '3') + ' 1 0;min-height:240px;border:1px solid rgba(243,240,232,0.2);border-radius:14px;overflow:hidden;background:#1d2618');
    const cv = h('canvas', 'position:absolute;inset:0;width:100%;height:100%;touch-action:none', null, { 'aria-label': 'Map of this area; drag to move it, tap a dot to read what it is' });
    const MM = o.maps[o.area], tall = (MM.z1 - MM.z0) / (MM.x1 - MM.x0) > 1.6;
    if (state.view !== view) { state.view = view; state.pan = null; state.sel = null; state.preview = null; state.zoom = o.getPlayer && o.getPlayer() ? (view === 'world' ? 2.4 : tall ? 3 : 1.9) : 1; }   // a long thin area starts close to you: the whole of it would be a thin strip on a phone
    const zoom = h('div', 'position:absolute;right:8px;bottom:8px;display:flex;flex-direction:column;gap:6px'), zb = (label, aria, fn) => { const b = h('button', BTN + ';min-height:44px;min-width:44px;padding:4px 10px;text-align:center', label, { 'aria-label': aria }); b.onclick = fn; return b; };
    const setZoom = (z) => { state.zoom = Math.max(1, Math.min(6, z)); if (state.zoom <= 1) state.pan = null; redraw(); };
    zoom.append(zb('+', 'Zoom in', () => setZoom(state.zoom * 1.6)), zb('\u2212', 'Zoom out', () => setZoom(state.zoom / 1.6)), zb('Me', 'Back to me', () => { state.pan = null; if (state.zoom <= 1) state.zoom = 3; redraw(); }));
    const legend = h('div', 'position:absolute;left:8px;bottom:56px;display:none;flex-wrap:wrap;gap:3px 10px;max-width:calc(100% - 16px);font-size:12px;background:rgba(10,14,12,0.9);border-radius:10px;padding:8px 10px'); const keyBtn = h('button', BTN + ';position:absolute;left:8px;bottom:8px;min-height:40px;padding:6px 12px', 'Key'); keyBtn.onclick = () => { legend.style.display = legend.style.display === 'none' ? 'flex' : 'none'; };
    wrap.append(cv, zoom, keyBtn, legend);
    const info = h('div', 'flex:none;min-height:44px;padding:10px 12px;border-radius:12px;background:rgba(243,240,232,0.07);display:flex;flex-direction:column;gap:8px'); const list = h('div', 'flex:1;min-height:120px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;padding-right:2px');
    if (view === 'world') {   // the districts, one tap to look at each; instead of the list of places
      list.style.cssText = 'flex:none;display:flex;flex-wrap:nowrap;gap:8px;overflow-x:auto;overflow-y:hidden;min-height:0;padding-bottom:2px';
      for (const k of ['wayanad', 'kozhikode', 'city', 'hilite', 'manjeri']) { const b = h('button', BTN + ';flex:0 0 auto;text-align:center;font-size:13px;padding:6px 12px;min-height:40px;white-space:nowrap', AREA_SHORT[k]); b.onclick = () => { state.pan = { x: OX[k] + (k === 'kozhikode' ? 0 : k === 'city' ? -20 : 14), z: 4 }; state.zoom = Math.max(state.zoom, 2.2); redraw(); }; list.append(b); }
    }
    body.append(wrap, info, list);
    let F = null, lastPl = null;
    const select = (sp) => { state.sel = sp; state.preview = sp && o.getPath ? { sel: sp, route: o.getPath(sp.x, sp.z) } : null; renderInfo(); redraw(); };
    const dropPin = (x, z) => { const rt = o.getPath ? o.getPath(x, z) : null; if (o.getPath && !rt) { state.sel = { kind: 'pin', x, z, label: 'Chosen spot', emoji: '📍', noway: true }; state.preview = null; renderInfo(); redraw(); return; } const at = rt ? rt.to : { x, z }; const pin = { kind: 'pin', x: at.x, z: at.z, label: rt && rt.snapped ? 'Nearest reachable spot' : 'Chosen spot', emoji: '📍' }; state.sel = pin; state.preview = { sel: pin, route: rt }; renderInfo(); redraw(); };
    const redraw = () => { F = drawHere(cv, o, state.sel); };
    const setWay = (sp) => { if (o.onWaypoint) o.onWaypoint(sp); renderInfo(); renderList(); redraw(); };
    const begin = (sp) => { setWay(sp); api.close(); };   // begin the journey: the destination is set and you are back in the town, walking
    const renderInfo = () => {
      info.textContent = ''; const sp = state.sel, wp = o.getWaypoint ? o.getWaypoint() : null;
      const pl = o.getPlayer ? o.getPlayer() : null, row = (...kids) => { const r = h('div', 'display:flex;align-items:center;gap:10px;flex-wrap:wrap'); r.append(...kids); return r; };
      if (!sp) {
        if (wp) { const d = pl ? dist(wp, pl) : null; info.append(h('div', 'font-weight:700;font-size:15px', '🚩 ' + (wp.name || 'Your destination')), h('div', 'font-size:13px;color:rgba(243,240,232,0.75)', d === null ? 'On your way.' : fmtD(d) + ' · ' + etaText(d, wp.job ? 2 : 1) + (wp.job ? ' by bike' : ' on foot')));
          const go = h('button', BTN + ';min-height:44px;' + AMBER, 'Continue journey →'); go.onclick = () => api.close(); const clr = h('button', BTN + ';min-height:44px', 'Clear'); clr.onclick = () => setWay(null); info.append(row(go, clr)); return; }
        info.append(row(h('span', 'width:9px;height:9px;border-radius:5px;background:#7fe8a8;flex:none'), h('span', 'font-size:14px;flex:1;color:rgba(243,240,232,0.85)', 'You are at ' + ((pl && pl.place) || AREA_SHORT[o.area] || 'the town')), h('span', 'font-size:13px;color:rgba(243,240,232,0.6)', 'Tap a place or any spot to travel'))); return;
      }
      const c = CATS[categoryOf(sp)], same = wp && Math.hypot(wp.x - sp.x, wp.z - sp.z) < 0.5, rt = state.preview && state.preview.sel === sp ? state.preview.route : null, d = same && wp.length ? window.RoboNav.lengthFrom(wp.path, pl ? pl.x : sp.x, pl ? pl.z : sp.z) : rt ? rt.length : pl ? dist(sp, pl) : null;
      info.append(row(h('span', 'font-size:24px', sp.emoji || c.emoji), h('div', 'flex:1;min-width:120px', null)));
      info.firstChild.lastChild.append(h('div', 'font-family:Oxanium,sans-serif;font-weight:800;font-size:11px;letter-spacing:0.14em;color:' + c.color, c.title.toUpperCase()), h('div', 'font-weight:700;font-size:16px', displayName(sp)), h('div', 'font-size:13px;color:rgba(243,240,232,0.75)', sp.noway ? 'There is no way to walk there from here' : d === null ? (same ? 'Your destination' : 'Open the map in the town to travel here') : fmtD(d) + ' · ' + etaText(d) + ' on foot' + (rt ? ' by the path' : '')));
      if (same) { const go = h('button', BTN + ';min-height:44px;' + AMBER, 'Continue journey →'); go.onclick = () => api.close(); const clr = h('button', BTN + ';min-height:44px', 'Clear'); clr.onclick = () => setWay(null); info.append(row(go, clr)); }
      else if (d !== null && o.onWaypoint && !sp.noway) { const b = h('button', BTN + ';min-height:44px;width:100%;text-align:center;' + AMBER, 'Begin journey →'); b.onclick = () => begin(sp); info.append(b); }
    };
    const renderList = () => {
      if (view === 'world') return;
      list.textContent = ''; const pl = o.getPlayer ? o.getPlayer() : null, groups = placesFor(o.spots, o.area, pl), order = ['people', 'jobs', 'shops', 'eat', 'health', 'travel', 'charging', 'services', 'enter', 'learn', 'run', 'home'];
      for (const k of order) { const g = groups[k]; if (!g) continue; list.append(h('div', 'font-family:Oxanium,sans-serif;font-weight:800;font-size:12px;letter-spacing:0.12em;color:' + CATS[k].color + ';margin-top:4px', CATS[k].emoji + ' ' + CATS[k].title.toUpperCase()));
        for (const p of g) { const r = h('button', 'display:flex;align-items:center;gap:10px;min-height:44px;padding:6px 12px;border:1px solid ' + (state.sel === p.spot ? '#fff' : 'rgba(243,240,232,0.14)') + ';border-radius:10px;background:rgba(243,240,232,0.05);color:#f3f0e8;font-family:Barlow,sans-serif;font-size:14px;text-align:left;cursor:pointer;touch-action:manipulation'); r.append(h('span', 'font-size:20px;width:26px;text-align:center', p.emoji), h('span', 'flex:1', p.name), h('span', 'color:rgba(243,240,232,0.6);font-size:13px;white-space:nowrap', pl ? fmtD(p.d) : '')); r.onclick = () => select(p.spot); list.append(r); } }
    };
    for (const k of Object.keys(CATS)) { if (k === 'home') continue; const it = h('span', 'white-space:nowrap'); it.append(h('span', 'display:inline-block;width:8px;height:8px;border-radius:4px;margin-right:3px;background:' + CATS[k].color), document.createTextNode(CATS[k].title)); legend.append(it); }
    let drag = null, dragged = false;
    cv.addEventListener('pointerdown', (e) => { if (!F) return; drag = { x: e.clientX, y: e.clientY, cx: F.cx, cz: F.cz }; dragged = false; try { cv.setPointerCapture(e.pointerId); } catch (er) { /* a mouse without capture still works */ } });
    cv.addEventListener('pointermove', (e) => { if (!drag || !F) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (!dragged && Math.hypot(dx, dy) < 8) return; dragged = true; if (state.zoom > 1) { state.pan = F.rot ? { x: drag.cx - dy / F.s, z: drag.cz + dx / F.s } : { x: drag.cx - dx / F.s, z: drag.cz - dy / F.s }; redraw(); } });
    cv.addEventListener('pointerup', () => { drag = null; });
    cv.addEventListener('pointercancel', () => { drag = null; });
    cv.addEventListener('click', (e) => { if (dragged) { dragged = false; return; } if (!F) return; const r = cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top, sp = nearestMarker(F, o.spots, px, py, 28); if (sp) select(sp); else { const w = fromCanvas(F, px, py), M = o.maps[o.area]; if (o.onWaypoint && M && w.x > M.x0 && w.x < M.x1 && w.z > M.z0 && w.z < M.z1) dropPin(w.x, w.z); else { state.sel = null; state.preview = null; renderInfo(); redraw(); } } });
    renderInfo(); renderList(); redraw();
    timer = setInterval(() => { const pl = o.getPlayer ? o.getPlayer() : null; if (!pl || (lastPl && Math.hypot(pl.x - lastPl.x, pl.z - lastPl.z) < 0.25 && Math.abs((pl.yaw || 0) - (lastPl.yaw || 0)) < 0.05)) return; lastPl = { x: pl.x, z: pl.z, yaw: pl.yaw }; redraw(); }, 250);
    new ResizeObserver(redraw).observe(wrap);
  }

  /* the Story tab: the chapters, the quests of the open chapter, and for the step to do now a button that puts the way on the map */
  function renderStory(body, o, rerender) {
    const Q = o.story, V = Q.view(), nx = Q.next(), wrap = h('div', 'flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:10px;padding-right:2px'); body.append(wrap);
    if (V.tagline) wrap.append(h('div', 'font-size:13px;font-style:italic;color:rgba(243,240,232,0.7);padding:0 2px', V.tagline));
    const npcSpot = (id) => o.spots.find((sp) => sp.kind === 'talk' && sp.arg === id);
    for (const c of V.chapters) {
      const card = h('div', 'padding:12px 14px;border-radius:14px;border:1px solid ' + (c.state === 'active' ? 'oklch(0.82 0.15 75)' : 'rgba(243,240,232,0.16)') + ';background:' + (c.state === 'restricted' ? 'rgba(243,240,232,0.03)' : 'rgba(243,240,232,0.07)') + ';' + (c.state === 'restricted' ? 'opacity:0.75' : ''));
      const head = h('div', 'display:flex;align-items:center;gap:8px;flex-wrap:wrap'); head.append(h('span', 'font-family:Oxanium,sans-serif;font-weight:800;font-size:12px;letter-spacing:0.12em;color:#ffb878', c.day.toUpperCase()), h('span', 'font-family:Oxanium,sans-serif;font-weight:800;font-size:16px', c.title), h('span', 'margin-left:auto;font-size:12px;color:' + (c.state === 'done' ? '#7fe8a8' : c.state === 'active' ? '#ffd27a' : '#9aa6a0'), c.state === 'done' ? '✓ Done' : c.state === 'active' ? 'In progress' : '🔒 Restricted')); card.append(head);
      card.append(h('div', 'font-size:12px;color:rgba(243,240,232,0.6);margin:2px 0 6px', c.theme));
      if (c.state === 'restricted') { card.append(h('div', 'font-size:14px;line-height:1.45;color:#ffb878;font-weight:700', 'Restricted area'), h('div', 'font-size:13px;line-height:1.45;color:rgba(243,240,232,0.75)', 'This chapter is not open yet.')); wrap.append(card); continue; }   // no spoilers: only the day, the theme and the lock
      card.append(h('div', 'font-size:14px;line-height:1.45;margin-bottom:8px', c.summary));
      for (const q of c.quests) {
        const row = h('div', 'margin-top:8px'); const mark = q.state === 'done' ? '✓' : q.state === 'active' ? '▶' : '…';
        row.append(h('div', 'font-weight:700;font-size:14px;color:' + (q.state === 'done' ? '#7fe8a8' : q.state === 'active' ? '#f3f0e8' : 'rgba(243,240,232,0.5)'), mark + ' ' + q.title + (q.reward && q.reward.coins ? '  (+₹' + q.reward.coins + ')' : '')));
        if (q.state === 'active') for (const s of q.steps) {
          const line = h('div', 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:4px 0 0 14px;font-size:13px;line-height:1.4;color:' + (s.done ? 'rgba(243,240,232,0.5)' : '#f3f0e8'));
          line.append(h('span', null, (s.done ? '☑ ' : '☐ ') + s.text + (s.n > 1 && !s.done ? ' (' + s.progress + '/' + s.n + ')' : '')));
          if (s.current && s.target && s.target.puzzle && o.onPuzzle) { const b = h('button', BTN + ';min-height:36px;padding:4px 10px;font-size:13px;' + AMBER, '💻 Open the terminal'); b.onclick = () => o.onPuzzle(s.target.puzzle); line.append(b); }
          else if (s.current && s.target && s.target.npc) { const sp = npcSpot(s.target.npc); if (sp && o.onWaypoint) { const b = h('button', BTN + ';min-height:36px;padding:4px 10px;font-size:13px;' + AMBER, 'Show the way'); b.onclick = () => { o.onWaypoint(sp); state.tab = 'here'; state.sel = sp; rerender(); }; line.append(b); } else if (nx && nx.area && !sp) line.append(h('span', 'font-size:12px;color:#9aa6a0', '(open the map in the town to show the way)')); }
          row.append(line);
        }
        card.append(row);
      }
      wrap.append(card);
    }
    wrap.append(h('div', 'font-size:12px;color:rgba(243,240,232,0.5);padding:4px 2px 10px', V.note || 'The characters are made up; the places are real.'));
  }

  function renderRegion(body, o, rerender) {
    const wrap = h('div', 'flex:2.4 1 0;min-height:260px;border:1px solid rgba(243,240,232,0.2);border-radius:14px;overflow:hidden;background:#1b2a30'); wrap.innerHTML = regionSVG(o);
    const card = h('div', 'flex:1 1 0;min-height:120px;max-height:38%;overflow-y:auto;padding:10px 12px;border-radius:12px;background:rgba(243,240,232,0.07);font-size:14px;line-height:1.45');
    body.append(wrap, card);
    const show = (k) => {
      const n = REGION.nodes[k], V = visited(), edges = regionEdges().filter((e) => e.a === k || e.b === k); card.textContent = ''; wrap.innerHTML = regionSVG(o, k);
      card.append(h('div', 'font-family:Oxanium,sans-serif;font-weight:800;font-size:16px;margin-bottom:2px', n.emoji + ' ' + n.name), h('div', 'font-family:' + ML + ';color:#ffe9b0;margin-bottom:6px', n.local), h('div', null, n.text));
      const cur = (o.area || 'kozhikode') === k; if (cur) card.append(h('div', 'margin-top:6px;color:#ffb878;font-weight:700', 'You are here.')); else if (n.area && !V[k] && areaOpen(k)) card.append(h('div', 'margin-top:6px;color:rgba(243,240,232,0.7)', 'You have not been here yet. Take a KSRTC bus from any bus stop.'));
      /* set a destination: in this area it opens the area map; in another area it sends you to this area's bus stop, where the KSRTC bus to that place leaves */
      if (n.area && !areaOpen(k)) { card.append(h('div', 'margin-top:10px;color:#ffb878;font-weight:700', '🚧 Not open yet. This town opens in a later version.')); }
      else if (n.area && o.spots.length) {
        const here = (o.area || 'kozhikode') === k, stop = busStopSpot(o.spots, o.area), link = edges.find((e) => e.a === o.area || e.b === o.area), act = h('div', 'margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center');
        if (here) { const b = h('button', BTN + ';' + AMBER, 'Open the area map'); b.onclick = () => { state.tab = 'here'; rerender(); }; act.append(b); }
        else if (n.walk && o.onWaypoint) {   // the highway joins every area, so there is no bus: walk it
          const pl = o.getPlayer ? o.getPlayer() : null, d = pl ? dist(n.walk, pl) : null, b = h('button', BTN + ';' + AMBER, 'Begin journey to ' + n.short + ' →'); b.onclick = () => { o.onWaypoint({ kind: 'pin', x: n.walk.x, z: n.walk.z, label: n.short, emoji: n.emoji }, n.short); api.close(); }; act.append(b);
          act.append(h('span', 'font-size:13px;color:#bfe0ff;flex:1;min-width:150px', d === null ? 'On foot along the highway and up the ghat road.' : 'On foot along the highway and up the ghat road (' + fmtD(d) + ', ' + etaText(d) + ').'));
        }
        else if (stop && o.onWaypoint) {
          const pl = o.getPlayer ? o.getPlayer() : null, d = pl ? dist(stop, pl) : null, b = h('button', BTN + ';' + AMBER, 'Begin journey to ' + n.short + ' →'); b.onclick = () => { o.onWaypoint(stop, 'KSRTC stop, for the bus to ' + n.short); api.close(); }; act.append(b);
          act.append(h('span', 'font-size:13px;color:#bfe0ff;flex:1;min-width:150px', (d === null ? 'Walk to the bus stop here' : 'Walk to the bus stop here (' + fmtD(d) + ', ' + etaText(d) + ')') + (link ? ', then take the KSRTC bus (' + link.label.replace('KSRTC ', '') + ').' : '. No direct bus: change at another stop.')));
        }
        card.append(act);
      }
      if (edges.length) { const t = h('div', 'margin-top:8px;font-size:13px;color:#bfe0ff'); t.textContent = 'KSRTC from here: ' + edges.map((e) => { const other = REGION.nodes[e.a === k ? e.b : e.a]; return other.short + ' ' + e.label.replace('KSRTC ', ''); }).join(' · '); card.append(t); }
    };
    const showLocked = (k) => { const n = REGION.locked[k]; card.textContent = ''; card.append(h('div', 'font-family:Oxanium,sans-serif;font-weight:800;font-size:16px;margin-bottom:2px', '🔒 ' + n.name), h('div', 'font-family:' + ML + ';color:#ffe9b0;margin-bottom:6px', n.local), h('div', 'color:#ffb878;font-weight:700', 'Restricted area'), h('div', 'margin-top:4px', 'This part of Malabar is not open yet. It is planned for a later chapter.')); };
    wrap.addEventListener('click', (e) => { const l = e.target.closest && e.target.closest('[data-locked]'); if (l) { showLocked(l.getAttribute('data-locked')); return; } const g = e.target.closest && e.target.closest('[data-node]'); if (g) show(g.getAttribute('data-node')); });
    wrap.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { const l = e.target.closest && e.target.closest('[data-locked]'); if (l) { e.preventDefault(); showLocked(l.getAttribute('data-locked')); return; } const g = e.target.closest && e.target.closest('[data-node]'); if (g) { e.preventDefault(); show(g.getAttribute('data-node')); } } });
    show(REGION.nodes[o.area || 'kozhikode'] ? (o.area || 'kozhikode') : 'kozhikode');
  }

  function close() {
    if (!panel) return; clearInterval(timer); if (state && state.keyHandler) window.removeEventListener('keydown', state.keyHandler, true);
    const o = state && state.o; panel.remove(); panel = null; state = null; if (o && o.onClose) o.onClose();
  }
  const api = { open, close, isOpen: () => !!panel, MARGIN, expand, outerRects, noteVisit, visited, REGION, LABELS, CATS, OX, AREA_NAME, AREA_SHORT, categoryOf, displayName, placesFor, fit, toCanvas, fromCanvas, nearestMarker, regionEdges, dist, busStopSpot, STOP_ARG, fmtD, etaText };
  window.RoboMap = api;
})();
