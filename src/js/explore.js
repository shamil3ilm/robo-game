/* Robo Run: Explore mode, a small walkable Kozhikode town (Mittai Theruvu street, the beach promenade and a gate to the runner).
   Exposes window.RoboExplore = { move, nearest, stick, create }.
   move / nearest / stick are pure rules (tests/explore.test.js); create(THREE, kit, cb) builds the town on its own scene using the models from malabar.js (`kit`).
   Layout (metres): the street runs north to south along x = 0, from the runner gate at z = -72 to the promenade at z = 62; the beach and sea lie to the south (+z).
   Everything follows the real-world rules in DESIGN - Malabar World.md section 3a: a narrow two-way lane with pavements and drains, whitewashed shopfronts with Mangalore-tile roofs,
   Malayalam and English signboards, auto-rickshaws and scooters, hot golden evening light, and people in everyday Kerala dress. */
(function () {
  'use strict';
  const PI = Math.PI, clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------- pure rules ---------- */
  const pushOut = (x, z, r, c) => {
    if (c.t === 'circle') {
      let dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz); const m = r + c.r;
      if (d >= m) return null;
      if (d < 1e-6) { dx = 1; dz = 0; d = 1; }
      return [c.x + (dx / d) * m, c.z + (dz / d) * m];
    }
    const nx = clamp(x, c.x0, c.x1), nz = clamp(z, c.z0, c.z1), dx = x - nx, dz = z - nz, d2 = dx * dx + dz * dz;
    if (d2 >= r * r) return null;
    if (d2 > 1e-12) { const d = Math.sqrt(d2); return [nx + (dx / d) * r, nz + (dz / d) * r]; }
    const l = x - c.x0, rr = c.x1 - x, tp = z - c.z0, bt = c.z1 - z, m = Math.min(l, rr, tp, bt);   // centre is inside the box: leave by the nearest face
    if (m === l) return [c.x0 - r, z]; if (m === rr) return [c.x1 + r, z]; if (m === tp) return [x, c.z0 - r];
    return [x, c.z1 + r];
  };
  /* move a walker of radius r by (vx, vz) * dt, in small steps so a fast frame cannot jump a thin wall, sliding along walls, inside bounds {x0,x1,z0,z1} */
  const move = (pos, vx, vz, dt, r, colliders, b) => {
    let x = pos.x, z = pos.z, hit = null, impact = 0; const dx = vx * dt, dz = vz * dt, n = clamp(Math.ceil(Math.hypot(dx, dz) / 0.15), 1, 400);   // hit: the first thing touched; impact: how fast you were going into it (m/s)
    for (let i = 0; i < n; i++) {
      x += dx / n; z += dz / n;
      for (let pass = 0; pass < 3; pass++) {
        let moved = false;
        for (const c of colliders) { const p = pushOut(x, z, r, c); if (p) { if (!hit) { hit = c; const nx = p[0] - x, nz = p[1] - z, l = Math.hypot(nx, nz) || 1; impact = Math.max(0, -(vx * nx + vz * nz) / l); } x = p[0]; z = p[1]; moved = true; } }
        if (!moved) break;
      }
      x = clamp(x, b.x0 + r, b.x1 - r); z = clamp(z, b.z0 + r, b.z1 - r);
    }
    return { x, z, hit, impact };
  };
  /* turns the stream of "what did I touch this frame" into one bump per collision: it must be a real knock (not a graze), and you must have been free of it for a moment since the last one */
  const bumpGate = () => {
    let free = 1;
    return { step(dt, m) { if (!m.hit) { free += dt; return null; } const fire = free > 0.15 && m.impact > 1.4; free = 0; return fire ? { kind: m.hit.tag || 'wall', s: Math.min(1, m.impact / 5), c: m.hit } : null; } };
  };
  const nearest = (pos, spots) => {
    let best = null, bd = Infinity;
    for (const s of spots) { if (s.off) continue; const d = Math.hypot(pos.x - s.x, pos.z - s.z); if (d < s.r && d < bd) { best = s; bd = d; } }   // an `off` spot (a vehicle you are riding) is not offered
    return best;
  };
  /* stick (x right, y forward, each -1..1) to a ground direction, given the camera's yaw (0 = camera south of the walker, looking north) */
  const stick = (sx, sy, camYaw) => {
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw), rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
    let x = fx * sy + rx * sx, z = fz * sy + rz * sx; const m = Math.hypot(x, z);
    if (m > 1) { x /= m; z /= m; }
    return { x, z };
  };

  /* does the segment a-b cross the rectangle? (used to fade an awning that sits between the camera and the walker) */
  const segHitsRect = (ax, az, bx, bz, x0, x1, z0, z1) => {
    let t0 = 0, t1 = 1; const dx = bx - ax, dz = bz - az;
    for (const [p, q, lo, hi] of [[dx, ax, x0, x1], [dz, az, z0, z1]]) {
      if (Math.abs(p) < 1e-9) { if (q < lo || q > hi) return false; continue; }
      let ta = (lo - q) / p, tb = (hi - q) / p; if (ta > tb) { const s = ta; ta = tb; tb = s; }
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) return false;
    }
    return true;
  };
  /* delivery jobs (after the pick-up / drop-off loop of Hey Auto): a base fare plus a distance fare, and a tip for a quick run. Distances are in metres; the town is small, so 100 m counts as one "kilometre" of fare. */
  const fare = (dist) => Math.round(30 + 15 * (dist / 100));
  const tip = (dist, secs) => { const par = dist / 3.6 + 12; return secs <= par ? 10 : secs <= par * 1.6 ? 5 : 0; };
  const pickJob = (points, rand, minDist) => {
    for (let i = 0; i < 40; i++) {
      const a = points[Math.floor(rand() * points.length)], b = points[Math.floor(rand() * points.length)];
      if (a === b) continue; const d = Math.hypot(a.x - b.x, a.z - b.z);
      if (d >= (minDist || 40)) return { from: a, to: b, dist: d, fare: fare(d) };
    }
    return null;
  };
  /* a job between two named places (the story's deliveries): returns the job, or null when a name is not in the list */
  const namedJob = (points, fromName, toName) => {
    const a = points.find((p) => p.name === fromName), b = points.find((p) => p.name === toName); if (!a || !b || a === b) return null;
    const d = Math.hypot(a.x - b.x, a.z - b.z); return { from: a, to: b, dist: d, fare: fare(d) };
  };
  /* streets run along the axes: a stick (or keys) that points within `deg` degrees of straight along an axis is made exactly straight, so a thumb a little right of "up" does not drift sideways */
  const snapAxis = (x, z, deg) => {
    const m = Math.hypot(x, z); if (m < 1e-6) return { x, z };
    const ang = Math.atan2(z, x), q = Math.round(ang / (PI / 2)) * (PI / 2); let dy = ang - q; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    return Math.abs(dy) < (deg === undefined ? 14 : deg) * PI / 180 ? { x: Math.cos(q) * m, z: Math.sin(q) * m } : { x, z };
  };
  /* the nearest straight camera direction (0, 90, 180, 270 degrees) */
  const snapYaw = (yaw) => Math.round(yaw / (PI / 2)) * (PI / 2);
  const inFollowZone = (x, z) => (Math.abs(x) < STREET_X && z > STREET_Z0 && z < 61) || (Math.abs(z - LANE_Z) < 4.2 && Math.abs(x) >= STREET_X - 0.5 && Math.abs(x) < 16) || FOLLOW.some((r) => x > r[0] && x < r[1] && z > r[2] && z < r[3]);
  /* in the street and the cross lanes the camera follows the walking direction (the walls leave no room for a sideways camera); elsewhere it is free. Returns the wanted camera yaw, or null. */
  const followYaw = (x, z, vx, vz) => {
    if (!inFollowZone(x, z)) return null;
    const ax = Math.abs(vx), az = Math.abs(vz); if (Math.max(ax, az) < 1.8) return null;
    if (az >= ax) return vz < 0 ? 0 : PI;
    return vx > 0 ? -PI / 2 : PI / 2;
  };
  /* a vehicle parked at the kerb faces the shop fronts: getting in turns it along the street, towards the end it is nearest to facing (else the camera starts on a blank wall). Outside a street the heading is kept. */
  const streetYaw = (x, z, yaw) => {
    if (!inFollowZone(x, z)) return yaw;
    const r = FOLLOW.find((q) => x > q[0] && x < q[1] && z > q[2] && z < q[3]), ns = r ? (r[3] - r[2]) > (r[1] - r[0]) : Math.abs(x) < STREET_X, dx = -Math.sin(yaw), dz = -Math.cos(yaw);
    return ns ? (dz <= 0 ? 0 : PI) : (dx >= 0 ? -PI / 2 : PI / 2);
  };
  /* the delivery bike: stick up is the throttle, stick sideways is the steering. v is the bike's signed speed (m/s, forward positive); returns the new speed and the turn rate (rad/s, positive = turning left).
     It speeds up slowly, brakes faster, reverses slowly, and cannot turn on the spot: the turn rate grows with speed. max is the top speed (the run key and the gear and battery multipliers raise it). */
  const bikeDrive = (v, th, st, dt, max, agil) => {
    agil = agil || 1; const target = th > 0 ? th * max : th * 2.5, rate = (target > v ? (v < 0 ? 8 : 5.5) : 8) * agil, nv = v + Math.max(-rate * dt, Math.min(rate * dt, target - v));
    const turn = -st * (0.35 + Math.min(1, Math.abs(nv) / 6) * 1.55) * agil * (nv >= 0 ? 1 : -1) * Math.min(1, Math.abs(nv) / 0.6);
    return { v: nv, turn };
  };
  /* where the walker is, for the label at the top of the screen */
  const placeName = (x, z) => {
    if (x > 1000) return 'Inside';
    if (z > 62.4 && z < 77 && ((x > 84 && x < 500) || x < -150)) return 'NH 66 highway';
    if (x < -150) return wayanadPlace(x, z);
    if (x > 800) return malappuramPlace(x - MALAPPURAM_X, z);
    if (x > 500) return manjeriPlace(x - MANJERI_X, z);
    if (x > 300) return hilitePlace(x - HILITE_X, z);
    if (x > 100) return cityPlace(x - CITY_X, z);
    if (z > 61 && x > 40) return 'East beach'; if (z > 61 && x < -40) return 'West beach';
    if (z > 76) return 'Kozhikode Beach';
    if (x > 17 && z > 54) return 'Church square';
    if (z > 61) return 'Beach promenade';
    if (Math.abs(z - LANE_Z) < 9) { if (x > 15.5) return 'Temple courtyard'; if (x < -15.5) return 'Mosque courtyard'; }
    if (Math.abs(z - LANE_Z) < 4.2) { if (x > 4.6) return 'Temple lane'; if (x < -4.6) return 'Market lane'; }
    return 'Mittai Theruvu';
  };

  /* ---------- the town ---------- */
  /* boards: product words only (never an invented business name), plus the real shops we have checked (REAL_SIGNS) */
  const SIGNS = [['Kozhikodan Halwa', 'കോഴിക്കോടൻ ഹൽവ'], ['Banana Chips', 'ഉപ്പേരി'], ['Sulaimani', 'സുലൈമാനി'], ['Pazham Pori', 'പഴംപൊരി'], ['Spices', 'സുഗന്ധവ്യഞ്ജനം'], ['Tea & Coffee', 'ചായ · കാപ്പി'], ['Biriyani', 'ബിരിയാണി'], ['Fruits', 'പഴങ്ങൾ'], ['Textiles', 'തുണിത്തരങ്ങൾ'], ['Stationery', 'സ്റ്റേഷനറി'], ['Tailors', 'തയ്യൽ'], ['Jewellers', 'ജ്വല്ലറി']];
  const REAL_SIGNS = [{ side: 1, z: -8, note: 'swamy', pair: ['Swamy & Sons', 'കാപ്പി · സ്വാമി ആൻഡ് സൺസ്'] }, { side: -1, z: 54, note: 'bombay', pair: ['Bombay Hotel', 'ബോംബെ ഹോട്ടൽ · 1949'] }];
  const WALLS = [0xf1e6cc, 0xeadaa8, 0xbfd3b0, 0xb7cfd6, 0xe6bfa4, 0xeadf9c, 0xdcb578, 0xf4efe2];
  const SKIN = [0xc68642, 0x8d5524, 0xa86b3c, 0xd9a066, 0x6f4a2e];
  const FOODS_TOWN = ['coconut', 'banana', 'jaggery', 'rice', 'ghee', 'spice', 'tea', 'pepper', 'cardamom'];   // a spice-port town: pepper and cardamom are sold here (coffee stays a Wayanad crop)
  const STREET_X = 4.6, STREET_Z0 = -70, STREET_Z1 = 62;
  const BOUNDS = { x0: -84, x1: 84, z0: -70, z1: 98 };   // the beach town: the street is narrow, the beach front is long (the flanks of the street are walled off below)
  /* the world has two areas in one scene, far apart: Kozhikode (around x = 0) and Manjeri (around x = 200), joined by the KSRTC buses */
  const MALAPPURAM_X = 900;   // Malappuram stands out at x = 900: reached by KSRTC bus from Manjeri, not on foot
  const malappuramPlace = (lx, z) => (lx < -22 && lx > -52 && z < -6 && z > -30 ? 'KSRTC Bus Terminal' : Math.abs(z) < 6 && lx > 5 ? 'Malappuram-Perinthalmanna Road' : Math.abs(z) < 6 && lx < -5 ? 'Kozhikode Road' : Math.abs(lx) < 6 && z > 6 ? 'Civil Station Road' : Math.abs(lx) < 6 && z < -6 ? 'Kottakkunnu Road' : 'KSRTC junction, Malappuram');
  const CHURAM_X = -500, WAYANAD_X = -300;   // west of the beach town, along the highway: the Churam road leaves the highway at x = -500 and climbs east to Lakkidi (the gateway of Wayanad) at -300. Turned so the sea is on the left, the north end of NH 66 is Wayanad and the south end is Manjeri, like the real coast
  const wayanadPlace = (x, z) => (x < WAYANAD_X - 84 ? 'Thamarassery Churam' : x < WAYANAD_X - 50 && z > 8 && z < 28 ? 'Lakkidi view point' : x > WAYANAD_X + 14 && z > -46 && z < 46 ? 'Tea estate' : x < WAYANAD_X - 6 && z < -44 ? 'Lakkidi gate' : z > 41 ? 'Lakkidi bus stop' : 'Lakkidi');
  const MANJERI_X = 600, CITY_X = 200, HILITE_X = 400;   // the world runs west to east: the beach town (x = 0), the city (Mavoor Road, 200), HiLITE City (400), Manjeri (600), joined by the highway along the south edge
  const AREAS = { kozhikode: { name: 'Kozhikode', bounds: BOUNDS, spawn: [0, 56] }, hilite: { name: 'HiLITE City', bounds: { x0: HILITE_X - 36, x1: HILITE_X + 84, z0: -62, z1: 46 }, spawn: [HILITE_X, 40] }, city: { name: 'Kozhikode city', bounds: { x0: CITY_X - 84, x1: CITY_X + 36, z0: -62, z1: 62 }, spawn: [CITY_X, 50] }, manjeri: { name: 'Manjeri', bounds: { x0: MANJERI_X - 150, x1: MANJERI_X + 150, z0: -190, z1: 160 }, spawn: [MANJERI_X, 14] }, malappuram: { name: 'Malappuram', bounds: { x0: MALAPPURAM_X - 150, x1: MALAPPURAM_X + 150, z0: -150, z1: 150 }, spawn: [MALAPPURAM_X - 30, -2] }, wayanad: { name: 'Wayanad', bounds: { x0: WAYANAD_X - 84, x1: WAYANAD_X + 84, z0: -62, z1: 62 }, spawn: [WAYANAD_X, 50] } };
  const areaOf = (x) => (x < -150 ? 'wayanad' : x > 800 ? 'malappuram' : x > 500 ? 'manjeri' : x > 300 ? 'hilite' : x > 100 ? 'city' : 'kozhikode');   // which street area a door stands in
  const WORLD = { x0: CHURAM_X - 16, x1: MANJERI_X + 84, z0: -72, z1: 104 };   // the whole walkable world, one rectangle; the walls below close off everything that is not a street, a yard or the highway
  /* which areas are open: index.html sets window.ROBO_ACTIVE_AREAS (for now only Manjeri); with nothing set (the tests, a full build) every area is open. Closed areas are not built, cannot be walked to, and show as "not open yet" on the maps. */
  const ACTIVE = window.ROBO_ACTIVE_AREAS || null, isActive = (id) => !ACTIVE || ACTIVE.indexOf(id) >= 0;
  const walkBounds = (id) => { if (!ACTIVE) return WORLD; const a = AREAS[id] && isActive(id) ? AREAS[id] : AREAS[ACTIVE[0]]; const r = a.bounds; return { x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1 }; };   // each open town is walked on its own: the walk area is that town's rectangle (the jungle ring inside it is the real edge)
  const inOpen = (x, z) => !ACTIVE || x > 1000 || ACTIVE.some((id) => { const r = AREAS[id] && AREAS[id].bounds; return !!r && x > r.x0 - 24 && x < r.x1 + 24 && z > r.z0 - 24 && z < r.z1 + 24; });   // near any open town
  /* the streets of the other towns where the camera follows the way you go (the walls leave no room for a sideways camera; without this the camera ends up inside the shop fronts): [x0, x1, z0, z1] rectangles, a little wider than each road */
  const FOLLOW = [
    [MANJERI_X - 6, MANJERI_X + 6, -138, 108], [MANJERI_X + 6, MANJERI_X + 98, -6, 6], [MANJERI_X - 98, MANJERI_X - 6, -6, 6], [MANJERI_X + 34, MANJERI_X + 46, -138, -56], [MANJERI_X + 6, MANJERI_X + 34, -106, -94],
    [900 - 6, 900 + 6, -98, 88], [900 + 6, 900 + 98, -6, 6], [900 - 83, 900 - 6, -6, 6],
    [CITY_X - 6, CITY_X + 6, -62, 62], [HILITE_X - 6, HILITE_X + 6, -62, 46], [WAYANAD_X - 6, WAYANAD_X + 6, -56, 60]];
  const HW_Z = 69;   // the highway runs west to east along the south edge, joining the beach promenade to every area's side road
  const ROOM_X0 = 2000;   // the rooms you can walk into stand far from the streets, at x = 2000, 2050, ...
  /* Manjeri as it is on the map: the highway runs north-south through Manjeri Junction, Manjeri-Pandikkad Road goes east, the bypass road west; the bus stand is on the east road, the medical college south, Zil Money far north */
  const manjeriPlace = (lx, z) => (lx > 26 && lx < 58 && z > 5 && z < 33 ? 'KSRTC station' : lx > 8 && lx < 40 && z > 26 && z < 50 ? 'Medical college' : lx < -8 && lx > -34 && z > 30 && z < 58 ? 'Football turf' : Math.abs(z) < 6 && lx > 5 ? 'Manjeri-Pandikkad Road' : Math.abs(z) < 6 && lx < -5 ? 'Bypass road' : Math.abs(lx) < 6 && Math.abs(z) < 6 ? 'Manjeri Junction' : Math.abs(lx - 40) < 6 && z < -58 ? 'Cherani Cross Road' : Math.abs(z + 100) < 6 && lx > 5 && lx < 36 ? 'Happy Road' : z < -70 ? 'Kozhikkattu Kunnu' : z < 0 ? 'Kozhikode-Manjeri Road' : 'Kozhikode-Malappuram Bypass');
  const cityPlace = (lx, z) => (lx < -40 ? 'Station Lane' : z < -47 ? 'Railway station' : z > 29 ? (lx > 0 ? 'KSRTC bus stand' : 'Mofussil bus stand') : 'Mavoor Road');
  const hilitePlace = (lx, z) => (lx > 40 ? 'Link Road' : z > 38 ? 'NH 66 bypass' : lx > 5 ? 'Mall forecourt' : lx < -5 ? 'HiLITE Business Park' : 'HiLITE City');
  const hr = (a, b, c, d, col) => [HILITE_X + a, HILITE_X + b, c, d, col];
  const cr = (a, b, c, d, col) => [CITY_X + a, CITY_X + b, c, d, col];
  const mr = (a, b, c, d, col) => [MANJERI_X + a, MANJERI_X + b, c, d, col];
  const MAPS = {   // the minimap: [x0, x1, z0, z1, colour] rectangles per area
    kozhikode: { x0: -84, x1: 84, z0: -72, z1: 104, rects: [[-84, 84, -72, 100, '#4f5a3a'], [-84, -34, -72, 61, '#3a4630'], [34, 84, -72, 61, '#3a4630'], [-4.6, 4.6, -70, 62, '#9a968e'], [-16, 16, -30, -22, '#9a968e'], [16, 32, -34, -18, '#c9a06a'], [-32, -16, -34, -18, '#e0d4b8'], [-84, 84, 61, 77, '#d0a888'], [-84, 84, 77, 100, '#e6cf9c'], [-84, 84, 100, 104, '#2f8a92'], [20, 32, 59, 69, '#f2ece0']] },
    hilite: { x0: HILITE_X - 36, x1: HILITE_X + 84, z0: -62, z1: 62, rects: [hr(-36, 84, -62, 62, '#8f8a7c'), hr(58, 66, -50, 44, '#9a968e'), hr(53.4, 58, -50, 44, '#cfc3a4'), hr(66, 70.6, -50, 44, '#cfc3a4'), hr(48, 57.4, -50, 8, '#d9cfb4'), hr(66.6, 75.6, -50, 40, '#d9cfb4'), hr(34, 58, 8, 44, '#b9b2a4'), hr(-4, 4, -60, 46, '#9a968e'), hr(-36, 36, 48, 62, '#4a4a4c'), hr(14, 34, -44, 4, '#ece4d2'), hr(-34, -8, -44, 2, '#cfd2d4'), hr(-32, -9, 10, 34, '#e3e8e4')] },
    city: { x0: CITY_X - 84, x1: CITY_X + 36, z0: -62, z1: 62, rects: [cr(-84, 36, -62, 62, '#8d8776'), cr(-66, -58, -52, 58, '#9a968e'), cr(-70.6, -66, -52, 58, '#cfc3a4'), cr(-58, -53.4, -52, 26, '#cfc3a4'), cr(-75.6, -66.6, -52, 56, '#d9cfb4'), cr(-57.4, -48, -52, 26, '#d9cfb4'), cr(-58, -33, 29, 59, '#b9b2a4'), cr(-4, 4, -60, 60, '#9a968e'), cr(-34, 34, -62, -47, '#6a655c'), cr(8, 27, -44, -22, '#c9c4b6'), cr(9, 23, -18, -2, '#e9e5da'), cr(-22, -9, -18, -2, '#e3e8ea'), cr(9, 16, 3.5, 12.5, '#e3dcc8'), cr(-21, -7, 2, 16, '#f0e2b8'), cr(5, 33, 29, 59, '#b9b2a4'), cr(-33, -5, 29, 59, '#b9b2a4')] },
    manjeri: { x0: MANJERI_X - 150, x1: MANJERI_X + 150, z0: -190, z1: 160, rects: (window.RoboExploreManjeri ? window.RoboExploreManjeri.shape.mapRects(MANJERI_X) : [mr(-100, 100, -140, 110, '#6f7a44')]).concat([ mr(4.6, 13.5, -135, 105, '#d9cfb4'), mr(-13.5, -4.6, -135, 105, '#d9cfb4'), mr(8, 95, -13.5, -4.6, '#d9cfb4'), mr(8, 95, 4.6, 13.5, '#d9cfb4'), mr(-95, -8, -13.5, -4.6, '#d9cfb4'), mr(-95, -8, 4.6, 13.5, '#d9cfb4'),
      mr(4.6, 16.6, -134.5, -117.5, '#3a6a9a'), mr(26, 58, 5, 33, '#b9b2a4'), mr(8, 40, 26, 50, '#e3e8e4'), mr(-34, -8, 30, 58, '#2f8a3a'),
      mr(35.4, 44.6, -135, -58, '#cfc3a4'), mr(4.6, 40, -104.6, -95.4, '#cfc3a4'), mr(-4.6, 4.6, -135, 105, '#cfc3a4'), mr(-95, 95, -4.6, 4.6, '#cfc3a4'), mr(36, 44, -135, -58, '#9a968e'), mr(4, 40, -104, -96, '#9a968e'), mr(-4, 4, -135, 105, '#9a968e'), mr(4, 95, -4, 4, '#9a968e'), mr(-95, -4, -4, 4, '#9a968e')]) }
  };
  /* the whole world on one map, to scale: the ground between the areas is shut off (hatched), the highway runs along the south edge and each side road joins it */
  { const wx1 = WORLD.x1, hatch = '#232b1f', hw = '#9a968e', pv = '#cfc3a4';
    const hills = window.RoboExploreWayanad ? window.RoboExploreWayanad.hillMapRects(CHURAM_X, WAYANAD_X, hw, hatch, ['#9a968e', '#b9b2a4', '#8a6a44', '#cfc3a4', '#4f8a2a']) : [];
    MAPS.malappuram = { x0: MALAPPURAM_X - 150, x1: MALAPPURAM_X + 150, z0: -150, z1: 150, rects: window.RoboExploreMalappuram && window.RoboExploreMalappuram.shape ? window.RoboExploreMalappuram.mapRects(MALAPPURAM_X) : [] };
    MAPS.wayanad = { x0: CHURAM_X - 16, x1: WAYANAD_X + 84, z0: -72, z1: 62.4, rects: hills };
    MAPS.world = { x0: WORLD.x0, x1: wx1, z0: WORLD.z0, z1: WORLD.z1, rects: [[WORLD.x0, wx1, WORLD.z0, WORLD.z1, '#3b4630'],
      [84, CITY_X - 84, -72, 62.4, hatch, 'hatch'], [CITY_X + 36, HILITE_X - 36, -72, 62.4, hatch, 'hatch'], [HILITE_X + 84, MANJERI_X - 36, -72, 62.4, hatch, 'hatch'],
      [CITY_X - 84, CITY_X + 36, -72, -62.2, hatch, 'hatch'], [HILITE_X - 36, HILITE_X + 84, -72, -62.2, hatch, 'hatch'], [MANJERI_X - 36, MANJERI_X + 84, -72, -62.2, hatch, 'hatch'], [84, wx1, 77, WORLD.z1, '#2f8a92'], [WORLD.x0, -84, 77, WORLD.z1, '#2f8a92'], [WAYANAD_X + 84, -84, -72, 62.4, hatch, 'hatch']]
      .concat(MAPS.kozhikode.rects, MAPS.city.rects, MAPS.hilite.rects, MAPS.manjeri.rects, hills,
        [[84, wx1, HW_Z - 7.4, HW_Z - 5, pv], [84, wx1, HW_Z + 5, HW_Z + 7.4, pv], [84, wx1, HW_Z - 5, HW_Z + 5, hw], [WORLD.x0, -84, HW_Z - 7.4, HW_Z - 5, pv], [WORLD.x0, -84, HW_Z + 5, HW_Z + 7.4, pv], [WORLD.x0, -84, HW_Z - 5, HW_Z + 5, hw], [CHURAM_X - 4, CHURAM_X + 4, 50, HW_Z - 5, hw], [CITY_X - 66, CITY_X - 58, 58, HW_Z - 5, hw], [HILITE_X + 58, HILITE_X + 66, 44, HW_Z - 5, hw], [MANJERI_X + 58, MANJERI_X + 66, 58, HW_Z - 5, hw], [CITY_X - 4, CITY_X + 4, 60, HW_Z - 5, hw], [MANJERI_X - 4, MANJERI_X + 4, 60, HW_Z - 5, hw]]) }; }
  const LANE_Z = -26;   // the two cross lanes: temple lane (east) and market lane (west)
  const LANES = [{ side: 1, z: LANE_Z, hw: 4 }, { side: -1, z: LANE_Z, hw: 4 }];
  const SERVICE = [{ side: 1, z: -44, kind: 'snacks' }, { side: -1, z: -12, kind: 'pharmacy' }, { side: 1, z: 18, kind: 'tools' }, { side: -1, z: 40, kind: 'clothes' }, { side: 1, z: 36, kind: 'footwear' }];

  function create(THREE, kit, cb) {
    cb = cb || {};
    let seed = 20481; const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const rr = (a, b) => a + (b - a) * rnd(), pick = (a) => a[(rnd() * a.length) | 0];
    const scene = new THREE.Scene(), low = !!cb.low;
    scene.background = new THREE.Color(0xf0bf8a); scene.fog = new THREE.Fog(0xf0c28e, 34, 104);   // fully misty at 104 m, and nothing is drawn beyond 92 m, so a phone draws fewer things
    const lampSprites = [];   // the glow of each street lamp: on after dusk
    let lastLightH = -1, rainK = 0, lastWet = 0;   // rainK: how hard it rains, 0 to 1 (set by the engine)
    const frameHooks = [];   // per-frame callbacks from the area builders (the turf ball)
    const fadeables = [];   // awnings that turn see-through when they hide the walker from the camera
    const staticGroups = [], noMerge = new Set();   // noMerge: things the area builders animate themselves (the train)
       // groups that never move: merge.js joins their meshes into a few, so a phone draws far fewer things
    const colliders = [], spots = [], cullables = [], crowns = [], persons = [], pickups = [], sway = [];
    const add = (o, parent) => { (parent || scene).add(o); return o; };
    const box = (w, h, d, mat, x, y, z, parent, shadow) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); if (shadow) { m.castShadow = true; m.receiveShadow = true; } else m.receiveShadow = true; return add(m, parent); };
    const solid = (x0, x1, z0, z1, tag, obj) => colliders.push({ t: 'box', x0, x1, z0, z1, tag: tag || 'wall', obj });   // tag says what it is (wall, stall, vehicle, fence); obj is the thing that reacts when you hit it
    const post = (x, z, r, tag, obj) => colliders.push({ t: 'circle', x, z, r, tag: tag || 'pole', obj });
    const std = (o) => new THREE.MeshStandardMaterial(o);
    const matCache = {}, mat = (hex, o) => matCache[hex + (o ? JSON.stringify(o) : '')] || (matCache[hex + (o ? JSON.stringify(o) : '')] = std(Object.assign({ color: hex, roughness: 0.85 }, o)));
    const canvasTex = (w, h, draw, rx, ry) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h); const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; if (rx) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); } return t; };

    /* light and sky: golden hour, the sun low in the west over the sea */
    const hemi = add(new THREE.HemisphereLight(0xffe4be, 0x7a6248, 0.6)), sun = add(new THREE.DirectionalLight(0xffc27a, 1.7));
    sun.castShadow = !low; sun.shadow.mapSize.set(1024, 1024); const sc = sun.shadow.camera; sc.left = sc.bottom = -30; sc.right = sc.top = 30; sc.near = 1; sc.far = 90; sun.shadow.bias = -0.0006; add(sun.target);
    const SUN_OFF = new THREE.Vector3(-34, 24, 20), SUN_DIR = SUN_OFF.clone().normalize();
    const sky = (() => {
      const t = canvasTex(8, 512, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2f5f9a'); g.addColorStop(0.28, '#5f86b4'); g.addColorStop(0.42, '#e6a468'); g.addColorStop(0.5, '#f6b873'); g.addColorStop(1, '#f0b070'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
      const m = new THREE.Mesh(new THREE.SphereGeometry(230, 32, 24), new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, fog: false, depthWrite: false })); m.renderOrder = -2; return add(m);
    })();
    const skyN = (() => {   // the night sky: a dark blue dome with stars, faded in over the day dome after dusk
      const t = canvasTex(1024, 512, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#060a1c'); g.addColorStop(0.5, '#142048'); g.addColorStop(1, '#26356a'); x.fillStyle = g; x.fillRect(0, 0, w, h); for (let i = 0; i < 420; i++) { const y = Math.random() * h * 0.5; x.fillStyle = 'rgba(255,255,240,' + (0.35 + Math.random() * 0.6) + ')'; x.fillRect(Math.random() * w, y, Math.random() < 0.15 ? 2 : 1, Math.random() < 0.15 ? 2 : 1); } });
      const m = new THREE.Mesh(new THREE.SphereGeometry(228, 32, 24), new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, fog: false, depthWrite: false, transparent: true, opacity: 0 })); m.renderOrder = -1.9; return add(m);
    })();
    const glow = (() => {
      const t = canvasTex(128, 128, (x, w) => { const gr = x.createRadialGradient(w / 2, w / 2, 2, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(255,248,220,1)'); gr.addColorStop(0.25, 'rgba(255,214,140,0.7)'); gr.addColorStop(1, 'rgba(255,170,80,0)'); x.fillStyle = gr; x.fillRect(0, 0, w, w); });
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true })); s.scale.set(70, 70, 1); s.renderOrder = -1; return add(s);
    })();
    const bulbGlowTex = canvasTex(64, 64, (x, w) => { const gr = x.createRadialGradient(w / 2, w / 2, 1, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(255,230,160,1)'); gr.addColorStop(1, 'rgba(255,190,90,0)'); x.fillStyle = gr; x.fillRect(0, 0, w, w); });

    /* ground: earth around the town, asphalt lane, pavements with drains, promenade, sand, sea */
    const asphaltMat = std({ color: 0x4a4744, roughness: 0.95, map: canvasTex(128, 128, (x, w) => { x.fillStyle = '#5a5652'; x.fillRect(0, 0, w, w); for (let i = 0; i < 1400; i++) { x.fillStyle = 'rgba(' + (i % 2 ? '20,20,20' : '190,185,175') + ',.22)'; x.fillRect(Math.random() * w, Math.random() * w, 2, 2); } }, 3, 26) });
    const paverMat = std({ color: 0xd8c4a4, roughness: 0.95, map: canvasTex(128, 128, (x, w) => { x.fillStyle = '#d6c3a2'; x.fillRect(0, 0, w, w); x.strokeStyle = 'rgba(90,70,50,.35)'; x.lineWidth = 2; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * w / 4, 0); x.lineTo(i * w / 4, w); x.moveTo(0, i * w / 4); x.lineTo(w, i * w / 4); x.stroke(); } }, 1, 22) });
    const sandMat = std({ color: 0xd9bf91, roughness: 1, map: canvasTex(128, 128, (x, w) => { x.fillStyle = '#d9bf91'; x.fillRect(0, 0, w, w); for (let i = 0; i < 1500; i++) { x.fillStyle = 'rgba(' + (i % 2 ? '120,95,60' : '250,235,200') + ',.25)'; x.fillRect(Math.random() * w, Math.random() * w, 2, 2); } }, 14, 5) });
    const earthMat = std({ color: 0x7c7a4a, roughness: 1 });
    const plane = (w, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-PI / 2), mat); m.position.set(x, y, z); m.receiveShadow = true; return add(m); };
    plane(500, 500, earthMat, 0, -0.06, 0);
    plane(6.8, STREET_Z1 - STREET_Z0 + 4, asphaltMat, 0, 0.0, (STREET_Z0 + STREET_Z1) / 2);
    [-1, 1].forEach((s) => { box(1.2, 0.16, STREET_Z1 - STREET_Z0 + 4, paverMat, s * 4.0, 0.06, (STREET_Z0 + STREET_Z1) / 2); box(0.34, 0.1, STREET_Z1 - STREET_Z0 + 4, mat(0x8d8a84), s * 3.5, 0.05, (STREET_Z0 + STREET_Z1) / 2); });   // pavement + covered drain
    const promMap = paverMat.map.clone(); promMap.repeat.set(14, 3.2); promMap.needsUpdate = true;
    const promMat = std({ color: 0xd8c4a4, roughness: 0.95, map: promMap });
    plane(200, 16, promMat, 0, 0.02, 69);
    plane(200, 26, sandMat, 0, 0.0, 90); plane(200, 2.2, mat(0x8a7452, { roughness: 0.5 }), 0, 0.01, 99.1);
    const seaBump = canvasTex(128, 128, (x, w) => { x.fillStyle = '#808080'; x.fillRect(0, 0, w, w); for (let i = 0; i < 90; i++) { x.strokeStyle = 'rgba(' + (i % 2 ? '255,255,255' : '0,0,0') + ',.18)'; x.lineWidth = 2; x.beginPath(); const y = Math.random() * w, a = Math.random() * 40; x.moveTo(0, y); x.bezierCurveTo(w * 0.3, y + a, w * 0.6, y - a, w, y); x.stroke(); } }, 12, 12);
    const sea = plane(500, 300, std({ color: 0x1f7f86, roughness: 0.18, metalness: 0.2, bumpMap: seaBump, bumpScale: 1.6 }), 0, 0.02, 250);
    const foam = plane(70, 3, new THREE.MeshBasicMaterial({ color: 0xfff1dc, transparent: true, opacity: 0.6, depthWrite: false }), 0, 0.04, 100.6);
    const earthBack = plane(500, 150, std({ color: 0x6b7a42, roughness: 1 }), 0, -0.04, -150);

    /* photo textures when available (embedded in textures.js): asphalt, pavers, sand */
    const PHOTO = cb.tex || {};
    const photo = (slug, mats, rx, ry, tint) => {
      const t = PHOTO[slug]; if (!t || !t.d) return;
      const im = new Image(); im.onload = () => { for (const [m, ax, ay] of mats) { const tx = new THREE.Texture(im); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.encoding = THREE.sRGBEncoding; tx.anisotropy = 4; tx.repeat.set(ax, ay); tx.needsUpdate = true; m.map = tx; m.color.setHex(tint === undefined ? 0xffffff : tint); m.needsUpdate = true; } };
      im.src = t.d;
    };
    photo('asphalt_02', [[asphaltMat, 3, 14]], 0, 0, 0xcfcac2); photo('square_pavers', [[paverMat, 1.5, 14], [promMat, 12, 3]], 0, 0, 0xf0dcc0); photo('sand_01', [[sandMat, 7, 3]], 0, 0, 0xf2dcb4);

    /* ---------- buildings ---------- */
    const plasterTex = canvasTex(128, 128, (x, w) => {
      x.fillStyle = '#fff'; x.fillRect(0, 0, w, w);
      for (let i = 0; i < 40; i++) { x.fillStyle = 'rgba(70,60,40,' + (0.03 + Math.random() * 0.05) + ')'; x.fillRect(Math.random() * w, Math.random() * w * 0.6, 2 + Math.random() * 5, 12 + Math.random() * 50); }   // rain streaks
      const g = x.createLinearGradient(0, w * 0.7, 0, w); g.addColorStop(0, 'rgba(70,90,40,0)'); g.addColorStop(1, 'rgba(70,90,40,.28)'); x.fillStyle = g; x.fillRect(0, w * 0.7, w, w * 0.3);   // monsoon damp and moss at the base
      for (let i = 0; i < 500; i++) { x.fillStyle = 'rgba(0,0,0,.05)'; x.fillRect(Math.random() * w, Math.random() * w, 1, 1); }
    });
    const wallMats = WALLS.map((h) => std({ color: h, roughness: 0.95, map: plasterTex }));
    const roofTex = canvasTex(128, 128, (x, s2) => { x.fillStyle = '#b5532e'; x.fillRect(0, 0, s2, s2); for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? 'rgba(90,30,15,.35)' : 'rgba(230,140,90,.25)'; x.fillRect(0, i * 8, s2, 4); } for (let i = 0; i < 600; i++) { x.fillStyle = 'rgba(40,15,8,.18)'; x.fillRect(Math.random() * s2, Math.random() * s2, 2, 2); } }, 4, 1);
    const roofMat = std({ map: roofTex, roughness: 0.85, side: THREE.DoubleSide }), darkWood = mat(0x3e2a1c, { roughness: 0.9 }), shutterGreen = mat(0x2f6a4a), glassMat = mat(0x1d2a30, { roughness: 0.2, metalness: 0.3 }), trim = mat(0xe8dcc0);
    const signCache = {};
    const sign = (pair, kindColor, fg) => {
      const key = pair[0]; if (signCache[key]) return signCache[key];
      const bg = ['#7a2a1c', '#1f5a4a', '#23467a', '#6a3a7a', '#8a5a14', '#2a2a2a'][(rnd() * 6) | 0];
      return (signCache[key] = canvasTex(512, 128, (x, w, h) => { x.fillStyle = kindColor || bg; x.fillRect(0, 0, w, h); x.strokeStyle = '#f3e6cf'; x.lineWidth = 6; x.strokeRect(5, 5, w - 10, h - 10); x.fillStyle = fg || '#f7efe0'; x.textBaseline = 'middle'; x.textAlign = 'center'; x.font = 'bold 46px sans-serif'; x.fillText(pair[0].toUpperCase(), w / 2, h / 2 - 22); x.font = 'bold 40px "Nirmala UI","Noto Sans Malayalam","Kartika",sans-serif'; x.fillText(pair[1], w / 2, h / 2 + 28); }));
    };
    let signIdx = 0;
    const makeBuilding = (side, z0, z1, ox0, pairO) => {
      const ox = ox0 || 0, w = z1 - z0, zc = (z0 + z1) / 2, D = rr(7, 9), look = (pairO && pairO[2]) || null, h = look && look.h ? look.h : rr(5.4, 8.4),   /* look: an optional third item of the sign pair, { wall, awning, bg, fg, h, signW }, for a real place whose front is known */ xf = ox + side * STREET_X, xc = ox + side * (STREET_X + D / 2), wm = look && look.wall ? mat(look.wall, { roughness: 0.9 }) : pick(wallMats), g = new THREE.Group();
      box(D, h, w, wm, xc, h / 2, zc, g, true);
      const a = D / 2 + 0.6, th = 0.43, bl = a / Math.cos(th);   // two roof slopes meeting at a ridge over the middle of the building
      [-1, 1].forEach((k) => { const r = box(bl, 0.14, w + 0.8, roofMat, xc + k * (a / 2) * 1.0, h + (a / 2) * Math.tan(th), zc, g, true); r.rotation.z = -k * th; });
      box(0.2, 0.3, w + 0.8, roofMat, xc, h + a * Math.tan(th) + 0.05, zc, g);
      box(0.3, 0.2, w + 0.3, trim, xf + side * 0.12, 3.5, zc, g);   // cornice over the shopfront
      const door = box(0.14, 2.7, Math.max(2.4, w - 2.4), darkWood, xf - side * 0.0 + side * 0.07, 1.35, zc, g);
      for (let i = 0; i < Math.floor((w - 2.4) / 0.9); i++) box(0.04, 2.55, 0.05, mat(0x6a4a2a), xf - side * 0.02, 1.35, zc - (w - 2.4) / 2 + 0.45 + i * 0.9, g);   // roll-shutter / plank slats
      const aw = box(1.5, 0.07, w - 0.6, mat(look && look.awning ? look.awning : pick([0xb8352a, 0x2f6a4a, 0xc89a2a, 0x2b4a7a])), xf - side * 0.7, 3.05, zc, g, true); aw.rotation.z = side * 0.3;   // fabric awning over the shopfront
      aw.material = aw.material.clone(); aw.material.transparent = true; const fade = { m: aw, k: 1, x0: xf - side * 1.5, x1: xf, z0: zc - (w - 0.6) / 2, z1: zc + (w - 0.6) / 2 };
      const real = ox ? null : REAL_SIGNS.find((r) => r.side === side && z0 <= r.z && r.z < z1), pair = pairO || (real ? real.pair : SIGNS[signIdx++ % SIGNS.length]), sg = new THREE.Mesh(new THREE.PlaneGeometry(Math.min((look && look.signW) || 4.4, w - 1), 1.05), new THREE.MeshBasicMaterial({ map: sign(pair, look && look.bg, look && look.fg) })); sg.position.set(xf - side * 0.07, 4.05, zc); sg.rotation.y = -side * PI / 2; g.add(sg);
      const nw = Math.max(1, Math.floor((w - 1.6) / 2.6));
      for (let i = 0; i < nw; i++) { const wz = zc - ((nw - 1) * 2.6) / 2 + i * 2.6; box(0.1, 1.5, 1.2, trim, xf - side * 0.03, 5.5, wz, g); box(0.06, 1.3, 1.0, glassMat, xf - side * 0.07, 5.5, wz, g); box(0.1, 1.3, 0.5, shutterGreen, xf - side * 0.1, 5.5, wz - 0.85, g); box(0.1, 1.3, 0.5, shutterGreen, xf - side * 0.1, 5.5, wz + 0.85, g); }
      /* street dressing: a black water tank and a TV aerial on some roofs, and something in front of each shop (a fruit crate, sacks, a potted plant or a bench); all inside the building's group, so it is merged with it */
      { const ridge = h + (D / 2 + 0.6) * Math.tan(th), span = Math.max(0.5, w / 2 - 1.2);
        if (rnd() < 0.55) { const tz = zc + rr(-span, span); box(1.5, 0.22, 1.5, mat(0x8d8a84), xc, ridge + 0.1, tz, g); const tk = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.66, 1.15, 14), mat(0x1c1d1f, { roughness: 0.55 })); tk.position.set(xc, ridge + 0.78, tz); tk.castShadow = true; g.add(tk); const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.62, 0.22, 14), mat(0x2a2b2e, { roughness: 0.55 })); lid.position.set(xc, ridge + 1.46, tz); g.add(lid); }
        if (rnd() < 0.5) { const az = zc + rr(-span, span), ax = xc + side * rr(0.2, 1.4); const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 2.6, 5), mat(0x9a9a9a, { metalness: 0.5 })); mast.position.set(ax, ridge + 1.3, az); g.add(mast); [0.9, 1.6, 2.3].forEach((hh, i) => box(0.04, 0.04, 1.0 - i * 0.2, mat(0xb0b0b0, { metalness: 0.5 }), ax, ridge + hh, az, g)); } }
      { const kind = (rnd() * 5) | 0, fz = zc + rr(-Math.max(0.5, w / 2 - 1.6), Math.max(0.5, w / 2 - 1.6)), fx = xf - side * 0.85;
        if (kind === 0) { box(0.7, 0.4, 0.9, mat(0x8a6a44), fx, 0.2, fz, g, true); for (let i = 0; i < 5; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), mat(pick([0xd9382a, 0xf2b01c, 0x6ab03a, 0xe87a1c]))); f.position.set(fx + rr(-0.2, 0.2), 0.46, fz + rr(-0.32, 0.32)); g.add(f); } }
        else if (kind === 1) { [0, 1].forEach((i) => { const sk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.7, 10), mat(0xc9ad7a, { roughness: 1 })); sk.position.set(fx + i * 0.05, 0.35, fz + (i ? 0.55 : -0.2)); g.add(sk); }); }
        else if (kind === 2 || kind === 3) { const pt = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.2, 0.42, 10), mat(0xb5532e)); pt.position.set(fx, 0.21, fz); g.add(pt); const lf = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), mat(0x3f7a30, { flatShading: true })); lf.position.set(fx, 0.78, fz); lf.scale.y = 1.2; g.add(lf); }
        else { box(0.5, 0.06, 1.5, mat(0x7a5a38), fx, 0.5, fz, g, true); [-0.6, 0.6].forEach((s) => box(0.46, 0.5, 0.06, mat(0x5a4028), fx, 0.25, fz + s, g)); } }
      return { g, xc, zc, xf, D, fade };
    };
    /* a shopfront row along a north-south street (the building faces the street at x = ox0 + side * STREET_X) */
    const building = (side, z0, z1, ox0, pairO) => {
      const b = makeBuilding(side, z0, z1, ox0, pairO); add(b.g); b.g.userData = { x: b.xc, z: b.zc }; cullables.push(b.g); staticGroups.push(b.g); fadeables.push(b.fade);
      solid(side > 0 ? b.xf : b.xf - b.D, side > 0 ? b.xf + b.D : b.xf, z0, z1);
      return b.g;
    };
    /* the same row along an east-west road at z = tz: lx0..lx1 is the stretch of road (metres east of ox0); side +1 is the north side of the road, -1 the south side. The group is built facing a north-south street and turned a quarter. */
    const buildingEW = (side, lx0, lx1, tz, ox0, pairO) => {
      const b = makeBuilding(side, lx0, lx1, 0.001, pairO), g = b.g, xa = side > 0 ? b.xf : b.xf - b.D, xb = side > 0 ? b.xf + b.D : b.xf;
      g.rotation.y = PI / 2; g.position.set(ox0, 0, tz); add(g); g.userData = { x: ox0 + b.zc, z: tz - b.xc }; cullables.push(g); staticGroups.push(g);
      const f = b.fade; fadeables.push(Object.assign(f, { x0: ox0 + f.z0, x1: ox0 + f.z1, z0: tz - f.x1, z1: tz - f.x0 }));
      solid(ox0 + lx0, ox0 + lx1, tz - xb, tz - xa);
      return g;
    };
    const fillRow = (side) => {
      const res = SERVICE.concat(LANES).filter((s) => s.side === side).sort((a, b) => a.z - b.z); let cur = STREET_Z0;
      const run = (a, b) => { const n = Math.max(1, Math.round((b - a) / 7.5)), w = (b - a) / n; for (let i = 0; i < n; i++) building(side, a + i * w, a + (i + 1) * w); };
      for (const s of res) { run(cur, s.z - (s.hw || 3.6)); cur = s.z + (s.hw || 3.6); }
      run(cur, STREET_Z1 - 4);
    };
    fillRow(1); fillRow(-1);

    /* the four service shops: the same shopfront model as the runner (shop.js sells from them), with a shopkeeper at the counter and a ring to stand in */
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide });
    const marker = (x, z, color) => {
      const g = new THREE.Group(), m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.15, 32).rotateX(-PI / 2), ringMat.clone()); m.material.color.setHex(color || 0xffd27a); m.position.y = 0.09; g.add(m);
      const d = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), new THREE.MeshBasicMaterial({ color: color || 0xffd27a })); d.position.y = 2.9; g.add(d); g.userData.d = d; g.userData.m = m; g.position.set(x, 0, z); sway.push(g); return add(g);
    };
    const SH = window.RoboShop ? window.RoboShop.SHOPS : {};
    SERVICE.forEach((s) => {
      const m = kit.shop(s.kind); m.position.set(s.side > 0 ? 0.6 : -0.6, 0, s.z); m.rotation.y = s.side > 0 ? 0 : PI;   // the shopfront's doorway lands on the building line
      m.children[0].visible = false;   // the runner's glowing bay is not needed here
      add(m); m.userData.cz = s.z; cullables.push(m); m.userData.x = s.side * 7; m.userData.z = s.z;
      solid(s.side > 0 ? STREET_X : -STREET_X - 6.6, s.side > 0 ? STREET_X + 6.6 : -STREET_X, s.z - 2.9, s.z + 2.9);
      [-2.5, 0, 2.5].forEach((dz) => post(s.side * 3.9, s.z + dz, 0.25));
      const cx = s.side * 2.9;
      marker(cx, s.z, 0xffd27a); spots.push({ x: cx, z: s.z, r: 2.1, kind: 'shop', arg: s.kind, label: (SH[s.kind] ? SH[s.kind].name : s.kind), emoji: SH[s.kind] ? SH[s.kind].emoji : '🛒' });
      stander(pick(['mundu', 'lungi']), s.side * 3.7, s.z + 1.5, s.side > 0 ? PI / 2 : -PI / 2);
    });

    /* ---------- people ---------- */
    function person(type, o) {
      o = o || {}; const g = new THREE.Group(), skin = mat(pick(SKIN), { roughness: 0.7 }), hair = mat(0x1b1410, { roughness: 0.9 }), sc = o.scale || 1;
      const W = mat(0xf6f3ea), cream = mat(0xefe3c4), gold = mat(0xc9a13a, { metalness: 0.4, roughness: 0.5 }), navy = mat(0x1f2f5a), shirtCol = pick([0xf2eee2, 0xcfe0e8, 0xe8d9b0, 0xb9d3b0, 0xe6c2b2, 0x9fb7d3]);
      const part = (geo, m, x, y, z, par) => { const q = new THREE.Mesh(geo, m); q.position.set(x, y, z); q.castShadow = !low; (par || g).add(q); return q; };
      const spec = {
        mundu: { shirt: W, low: 'long', lowMat: W, border: true, cap: 0, towel: true },
        lungi: { shirt: mat(shirtCol), low: 'long', lowMat: mat(pick([0x2f5a8a, 0x3a7a5a, 0x7a3a3a]), { map: canvasTex(64, 64, (x, w) => { x.fillStyle = '#fff'; x.fillRect(0, 0, w, w); x.strokeStyle = 'rgba(0,0,0,.55)'; x.lineWidth = 3; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * w / 4, 0); x.lineTo(i * w / 4, w); x.moveTo(0, i * w / 4); x.lineTo(w, i * w / 4); x.stroke(); } }, 2, 2) }), cap: 1 },
        saree: { shirt: mat(pick([0xb8352a, 0x2f6a8a, 0x8a3a6a])), low: 'long', lowMat: cream, border: true, female: true, bun: true },
        thattam: { shirt: mat(pick([0x6a3a7a, 0x1f6a5a, 0x7a2a3a])), low: 'long', lowMat: mat(pick([0x6a3a7a, 0x1f6a5a, 0x7a2a3a])), female: true, scarf: mat(pick([0xf4efe2, 0x2a2a2a, 0xb8c8d8])) },
        techie: { shirt: mat(shirtCol), low: 'trousers', lowMat: mat(pick([0x2a3a5a, 0x3a3a3a, 0x4a4030])) },
        techieF: { shirt: mat(pick([0x8a4a6a, 0x3f7a8a, 0x7a6a2a])), low: 'trousers', lowMat: mat(0x2a2a3a), female: true },
        doctor: { shirt: mat(0xffffff), low: 'trousers', lowMat: mat(0x1f2f5a) },
        schoolgirl: { shirt: W, low: 'skirt', lowMat: navy, female: true, braids: true, scale: 0.78 },
        schoolboy: { shirt: W, low: 'shorts', lowMat: navy, scale: 0.8 },
        fisher: { shirt: mat(0xcfc6b0), low: 'tucked', lowMat: mat(0xe9e3d3), towelHead: true }
      }[type];
      const s2 = (o.scale || spec.scale || 1); g.scale.setScalar(s2);
      // legs (swing at the hips); a long garment hides them
      const legs = [-1, 1].map((k) => { const hp = new THREE.Group(); hp.position.set(k * 0.1, 0.92, 0); g.add(hp); part(new THREE.CylinderGeometry(0.06, 0.05, 0.84, 8).translate(0, -0.42, 0), spec.low === 'trousers' ? spec.lowMat : skin, 0, 0, 0, hp); part(new THREE.BoxGeometry(0.1, 0.06, 0.2).translate(0, -0.86, -0.04), mat(0x2a2220), 0, 0, 0, hp); if (spec.low === 'shorts') part(new THREE.CylinderGeometry(0.075, 0.075, 0.28, 8).translate(0, -0.14, 0), spec.lowMat, 0, 0, 0, hp); return hp; });
      if (spec.low === 'long') { part(new THREE.CylinderGeometry(0.2, 0.27, 0.86, 14, 1, true).translate(0, 0.5, 0), spec.lowMat, 0, 0, 0).material.side = THREE.DoubleSide; if (spec.border) part(new THREE.CylinderGeometry(0.272, 0.272, 0.07, 14, 1, true).translate(0, 0.1, 0), gold, 0, 0, 0); }
      if (spec.low === 'skirt') part(new THREE.CylinderGeometry(0.19, 0.26, 0.36, 12, 1, true).translate(0, 0.78, 0), spec.lowMat, 0, 0, 0).material.side = THREE.DoubleSide;
      if (spec.low === 'tucked') part(new THREE.CylinderGeometry(0.2, 0.25, 0.46, 12, 1, true).translate(0, 0.72, 0), spec.lowMat, 0, 0, 0).material.side = THREE.DoubleSide;
      const body = new THREE.Group(); body.position.y = 0.95; g.add(body);
      part(new THREE.BoxGeometry(spec.female ? 0.36 : 0.42, 0.58, 0.22).translate(0, 0.3, 0), spec.shirt, 0, 0, 0, body);
      if (spec.towel) part(new THREE.BoxGeometry(0.16, 0.08, 0.3).translate(0, 0.6, 0), mat(0xe8e2d0), 0.18, 0, 0, body).rotation.z = 0.3;   // thorthu over the shoulder
      const arms = [-1, 1].map((k) => { const sh = new THREE.Group(); sh.position.set(k * (spec.female ? 0.22 : 0.26), 0.55, 0); body.add(sh); part(new THREE.CylinderGeometry(0.045, 0.04, 0.55, 8).translate(0, -0.27, 0), skin, 0, 0, 0, sh); part(new THREE.CylinderGeometry(0.052, 0.05, 0.22, 8).translate(0, -0.1, 0), spec.shirt, 0, 0, 0, sh); return sh; });
      const head = part(new THREE.SphereGeometry(0.12, 12, 10).translate(0, 0.72, 0), skin, 0, 0, 0, body);
      if (spec.cap) part(new THREE.SphereGeometry(0.125, 12, 8, 0, PI * 2, 0, PI / 2.2).translate(0, 0.75, 0), mat(0xf4f0e6), 0, 0, 0, body);   // white prayer cap
      else if (spec.scarf) part(new THREE.SphereGeometry(0.135, 12, 10, 0, PI * 2, 0, PI * 0.72).translate(0, 0.73, 0.01), spec.scarf, 0, 0, 0, body);   // thattam headscarf
      else if (spec.towelHead) part(new THREE.TorusGeometry(0.12, 0.04, 6, 14).rotateX(PI / 2).translate(0, 0.78, 0), mat(0xe8e2d0), 0, 0, 0, body);
      else part(new THREE.SphereGeometry(0.125, 12, 8, 0, PI * 2, 0, PI / 2.1).translate(0, 0.73, 0.02), hair, 0, 0, 0, body);
      if (spec.bun) { part(new THREE.SphereGeometry(0.07, 8, 6).translate(0, 0.78, 0.13), hair, 0, 0, 0, body); part(new THREE.TorusGeometry(0.075, 0.02, 5, 10).translate(0, 0.78, 0.13), mat(0xfaf6e8), 0, 0, 0, body); }   // jasmine garland on the bun
      if (spec.braids) [-1, 1].forEach((k) => part(new THREE.CylinderGeometry(0.03, 0.02, 0.4, 6).translate(k * 0.1, 0.55, 0.12), hair, 0, 0, 0, body));
      const P = { g, legs, arms, body, head, phase: rr(0, 6), walk: 0, update(t, dt, moving) {
        P.walk += ((moving ? 1 : 0) - P.walk) * Math.min(1, dt * 8); P.phase += dt * (moving ? 7.2 : 0);
        const s = Math.sin(P.phase) * 0.55 * P.walk; legs[0].rotation.x = s; legs[1].rotation.x = -s; arms[0].rotation.x = -s * 0.8; arms[1].rotation.x = s * 0.8;
        body.position.y = 0.95 + Math.abs(Math.cos(P.phase)) * 0.025 * P.walk + Math.sin(t * 1.5 + P.phase) * 0.004; head.rotation.y = Math.sin(t * 0.6 + P.phase) * 0.25 * (1 - P.walk);
      } };
      if (window.RoboMerge && !cb.noMerge) {   // far away a person is drawn as a few joined meshes in the rest pose (about a third of the draw calls); up close, the full model
        const nearKids = g.children.slice(), far = window.RoboMerge.bakeCopy(THREE, g); far.visible = false; g.add(far);
        P.lod = (isFar) => { if (P.isFar === isFar) return; P.isFar = isFar; for (const k of nearKids) k.visible = !isFar; far.visible = isFar; };
      }
      return P;
    }
    // villagers walking the lane and the promenade: [type, route points, speed]
    const WALKS = [
      ['mundu', [[1.2, 50], [1.2, -30], [-1.2, -30], [-1.2, 50]], 1.25], ['lungi', [[-0.8, -58], [-0.8, 20], [0.4, 20], [0.4, -58]], 1.1], ['saree', [[0.6, 30], [0.6, -55]], 1.0], ['thattam', [[-0.6, -50], [-0.6, 45]], 1.05],
      ['schoolgirl', [[1.8, 52], [1.8, 8]], 1.3], ['schoolboy', [[1.4, 52], [1.4, 8]], 1.5], ['fisher', [[-18, 96.5], [18, 96.5]], 1.2], ['saree', [[-12, 66.5], [12, 66.5]], 0.9], ['lungi', [[8, 88.5], [-10, 88.5]], 0.8]
    ];
    const npcCircles = [];   // one moving collision circle per walker, in the same order as the walkers in `persons`
    function walker(type, pts, sp, jitter) { const p = person(type); p.route = pts; p.i = 0; p.speed = sp; p.wait = 0; p.g.position.set(pts[0][0], 0.04, pts[0][1] + rr(-(jitter || 0), jitter || 0)); add(p.g); persons.push(p); const c = { t: 'circle', x: p.g.position.x, z: p.g.position.z, r: 0.4, dyn: true, tag: 'person', who: p }; npcCircles.push(c); colliders.push(c); return p; }
    function stander(type, x, z, yaw) { const p = person(type, { stand: true }); p.g.position.set(x, 0.05, z); p.g.rotation.y = yaw || 0; add(p.g); persons.push(p); return p; }
    WALKS.forEach(([type, pts, sp]) => walker(type, pts, sp, 4));

    /* ---------- street furniture: lamps, bunting, poles with wires, scooters, autos, bench ---------- */
    const lampPos = []; for (let z = -62; z <= 56; z += 14) [-1, 1].forEach((s, i) => { if ((z / 14 + i) % 2 === 0) lampPos.push([s * 3.55, z + (i ? 7 : 0)]); });
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe2a0 }), ironMat = mat(0x2b2b2b, { metalness: 0.5, roughness: 0.6 });
    lampPos.forEach(([x, z]) => {
      const g = new THREE.Group(); box(0.12, 3.8, 0.12, ironMat, 0, 1.9, 0, g); box(0.5, 0.06, 0.5, ironMat, 0, 3.85, 0, g);
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.12, 0.34, 8), lampMat); l.position.y = 4.05; g.add(l);
      const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: bulbGlowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.85 })); gl.scale.set(2.4, 2.4, 1); gl.position.y = 4.05; g.add(gl); lampSprites.push(gl.material);
      g.position.set(x, 0.1, z); add(g); cullables.push(g); g.userData = { x, z }; post(x, z, 0.18, 'pole', g);
    });
    if (!low) for (let z = -56; z <= 52; z += 18) {   // bunting across the street (festival flags and string lights, as in Mittai Theruvu)
      const flags = canvasTex(256, 32, (x, w, h) => { const cols = ['#d94a3a', '#f2c230', '#2f9a5a', '#2f7ad9', '#e87aa8', '#f08a2a']; for (let i = 0; i < 16; i++) { x.fillStyle = cols[i % 6]; x.beginPath(); x.moveTo(i * 16, 2); x.lineTo(i * 16 + 16, 2); x.lineTo(i * 16 + 8, 28); x.fill(); } });
      const f = new THREE.Mesh(new THREE.PlaneGeometry(9.2, 0.7), new THREE.MeshBasicMaterial({ map: flags, transparent: true, side: THREE.DoubleSide, alphaTest: 0.3 })); f.rotation.y = PI / 2; f.position.set(0, 5.0, z); add(f); cullables.push(f); f.userData = { x: 0, z };
    }
    /* no overhead wires: the 2017 makeover of S. M. Street removed them and put up lamp posts instead */
    const scooter = (x, z, ry) => { const m = kit.ride('scooter'); m.scale.setScalar(0.85); m.position.set(x, 0, z); m.rotation.y = ry; add(m); cullables.push(m); m.userData.x = x; m.userData.z = z; post(x, z, 0.7, 'vehicle', m); spots.push({ x, z, r: 2.3, kind: 'drive', arg: 'scooter', label: 'Ride this scooter', emoji: '🛵', obj: m, col: colliders[colliders.length - 1], yaw: ry, quiet: true }); return m; };
    scooter(3.9, -52, PI / 2 + 0.2); scooter(-3.8, -30, -PI / 2); scooter(3.8, 4, PI / 2 - 0.15); scooter(-3.9, 28, -PI / 2 + 0.1); scooter(3.2, 48, PI / 2);
    const auto = (x, z, ry) => {   // Kerala auto-rickshaw: black body, yellow canopy, three wheels
      const g = new THREE.Group(), yel = mat(0xe8b81c, { roughness: 0.5 }), blk = mat(0x1d1d1d, { roughness: 0.6 }), wheel = new THREE.CylinderGeometry(0.28, 0.28, 0.16, 14).rotateZ(PI / 2);
      box(1.25, 0.55, 2.0, blk, 0, 0.62, 0.1, g, true); box(1.25, 0.12, 2.1, yel, 0, 1.3, 0.12, g, true); box(1.2, 0.08, 1.2, blk, 0, 1.28, 0.6, g);
      box(1.2, 0.5, 0.06, mat(0x6a8aa0, { transparent: true, opacity: 0.5 }), 0, 1.0, -0.78, g); [-0.58, 0.58].forEach((px2) => box(0.05, 0.7, 0.05, yel, px2, 0.95, -0.85, g)); [-0.58, 0.58].forEach((px2) => box(0.05, 0.7, 0.05, yel, px2, 0.95, 1.1, g));
      box(0.5, 0.35, 0.5, blk, 0, 0.9, -1.1, g); box(0.18, 0.12, 0.05, mat(0xfff2c0), 0, 0.92, -1.37, g);
      [[-0.6, 0.28, 0.9], [0.6, 0.28, 0.9], [0, 0.28, -1.0]].forEach(([wx, wy, wz]) => { const w = new THREE.Mesh(wheel, blk); w.position.set(wx, wy, wz); g.add(w); });
      g.position.set(x, 0, z); g.rotation.y = ry; add(g); cullables.push(g); g.userData = { x, z }; post(x, z, 1.0, 'vehicle', g); spots.push({ x, z, r: 2.7, kind: 'drive', arg: 'auto', label: 'Drive this auto', emoji: '🛺', obj: g, col: colliders[colliders.length - 1], yaw: ry, quiet: true }); return g;
    };
    auto(2.2, -56, PI + 0.06); auto(-2.4, -57, -0.06); auto(2.2, -61, PI); auto(-2.6, 52, 0.1);   // India drives on the left: east-side vehicles face south, west-side ones north
    box(2.4, 0.08, 0.5, mat(0x5a4028), -6, 0.5, 74, undefined, true); box(2.4, 0.5, 0.06, mat(0x5a4028), -6, 0.8, 74.2); post(-6, 74, 1.2);
    box(2.4, 0.08, 0.5, mat(0x5a4028), 6, 0.5, 74, undefined, true); box(2.4, 0.5, 0.06, mat(0x5a4028), 6, 0.8, 74.2); post(6, 74, 1.2);

    /* ---------- beach and promenade: palms, stalls, boats, nets; coconut grove rising behind the shops ---------- */
    const palmAt = (x, z, i, s) => { const p = kit.palm(i); p.scale.setScalar(s || 1); p.position.set(x, 0, z); p.rotation.y = rr(0, PI * 2); add(p); crowns.push(p); cullables.push(p); p.userData.x = x; p.userData.z = z; if (Math.abs(x) < 33) post(x, z, 0.4, 'palm', p); return p; };
    for (let i = 0; i < 9; i++) palmAt(-30 + i * 7.5 + rr(-1, 1), 64.5 + rr(-0.6, 0.6), i, rr(0.9, 1.15));
    for (let i = 0; i < 7; i++) palmAt(-31 + i * 10 + rr(-2, 2), rr(80, 94), i + 3, rr(0.9, 1.2));
    for (let i = 0; i < (low ? 8 : 16); i++) { const s = i % 2 ? 1 : -1; palmAt(s * rr(14, 36), rr(-66, 56), i, rr(1.0, 1.5)); }
    [-14, 3, 17].forEach((x, i) => { const st = kit.stall(); st.position.set(x, 0, 69); st.rotation.y = PI; st.scale.setScalar(1.15); add(st); cullables.push(st); st.userData = { x, z: 69 }; solid(x - 1.5, x + 1.5, 68.2, 70, 'stall', st); });   // sweet and tea stalls on the promenade, fronts to the sea
    [-22, 12, 26].forEach((x, i) => { const b = kit.boat(i); b.scale.setScalar(1.7); b.position.set(x, 0.3, 86 + (i % 2) * 5); b.rotation.set(0, rr(-0.5, 0.5) + PI / 2, rr(-0.12, 0.12)); add(b); cullables.push(b); b.userData = { x, z: 86 }; post(x, 86 + (i % 2) * 5, 2.2); });

    /* ---------- the gate to the runner (north end of the street) ---------- */
    const gate = new THREE.Group(), stone = mat(0xd8c9a6, { roughness: 0.95 });
    [-1, 1].forEach((s) => box(0.9, 6.4, 0.9, stone, s * 3.2, 3.2, 0, gate, true)); box(7.8, 0.9, 1.1, stone, 0, 6.5, 0, gate, true);
    const gateSign = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.1), new THREE.MeshBasicMaterial({ map: canvasTex(512, 100, (x, w, h) => { x.fillStyle = '#1f5a4a'; x.fillRect(0, 0, w, h); x.strokeStyle = '#f3e6cf'; x.lineWidth = 5; x.strokeRect(4, 4, w - 8, h - 8); x.fillStyle = '#f7efe0'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = 'bold 40px sans-serif'; x.fillText('▶ RUN THE BEACH ROAD', w / 2, h / 2 - 14); x.font = 'bold 30px "Nirmala UI","Noto Sans Malayalam","Kartika",sans-serif'; x.fillText('ഓടാൻ പോകാം', w / 2, h / 2 + 26); }) }));
    gateSign.position.set(0, 6.5, 0.6); gate.add(gateSign);
    const gateGlow = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 5.6), new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide })); gateGlow.position.set(0, 3.0, 0); gate.add(gateGlow);
    gate.position.set(0, 0, STREET_Z0 - 1.8); add(gate); box(26, 7, 1.2, mat(0x8a5a3a), 0, 3.5, STREET_Z0 - 2.8, undefined, true);
    solid(-30, -3.7, STREET_Z0 - 3.6, STREET_Z0 - 1.0); solid(3.7, 30, STREET_Z0 - 3.6, STREET_Z0 - 1.0);
    marker(0, STREET_Z0 + 3.2, 0x9ff0c0); spots.push({ x: 0, z: STREET_Z0 + 3.2, r: 2.6, kind: 'gate', arg: 'run', label: 'Run the beach road', emoji: '🏃' });

    /* ---------- things to pick up: coins on the street and promenade, ingredients on stalls and tables (all return after a while) ---------- */
    const coinGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.06, 18).rotateX(PI / 2), coinMat = new THREE.MeshStandardMaterial({ color: 0xf2c46b, metalness: 0.8, roughness: 0.3, emissive: 0x5a3a08, emissiveIntensity: 0.6 });
    const addPickup = (kind, id, x, z) => {
      for (let pass = 0; pass < 6; pass++) for (const c of colliders) { if (c.dyn) continue; const q = pushOut(x, z, 0.7, c); if (q) { x = q[0]; z = q[1]; } }   // never inside a parked vehicle, pole or wall: keep every pickup reachable
      const o = kind === 'coin' ? new THREE.Mesh(coinGeo, coinMat) : kind === 'scrap' ? scrapModel(id) : kit.food(id); o.position.set(x, 1.0, z); if (kind === 'food') o.scale.setScalar(0.85);
      add(o); const p = { kind, id, x, z, o, t: 0, on: true }; pickups.push(p); return p;
    };
    if (window.RoboExplorePlaces) window.RoboExplorePlaces.build({ THREE, scene, add, mat, solid, post, plane, rr, rnd, pick, walker, stander, addPickup, cullables, staticGroups, palmAt, roofMat, laneZ: LANE_Z, fadeable: (m, cx, cz, hx, hz) => { m.material = m.material.clone(); m.material.transparent = true; fadeables.push({ m, k: 1, x0: cx - hx, x1: cx + hx, z0: cz - hz, z1: cz + hz }); } });
    const NOTES = window.RoboExploreNotes ? window.RoboExploreNotes.NOTES : {};
    /* doors: a ring outside a building leads in; the exit mat inside leads back to the same ring */
    const rooms = {}, exits = {};
    const door = (x, z, roomId, label, emoji) => { marker(x, z, 0xffe9b0); spots.push({ x, z, r: 2.0, kind: 'door', arg: roomId, label, emoji }); exits[roomId] = { area: areaOf(x), x, z }; };
    REAL_SIGNS.forEach((r) => { const n = NOTES[r.note]; if (n) door(r.side * 3.0, r.z, r.note, 'Enter ' + n.title.split(' · ')[0], n.emoji); });
    const V = window.RoboExploreVehicles ? window.RoboExploreVehicles.make(THREE, canvasTex) : null;
    if (V) {   // the KSRTC bus at the west end of the promenade takes you to Manjeri
      const b = V.bus('ksrtc', ['Manjeri', 'മഞ്ചേരി']); b.position.set(-21, 0, 66.5); b.rotation.y = PI / 2; add(b); cullables.push(b); b.userData.x = -21; b.userData.z = 66.5; solid(-26.2, -15.8, 65.2, 67.8, 'vehicle', b);
      marker(-21, 62.6, 0xffd27a); spots.push({ x: -21, z: 62.6, r: 2.2, kind: 'shop', arg: 'bus_kz_ksrtc', label: 'KSRTC tickets', emoji: '🎫' });
    }
    if (window.RoboExploreInteriors) window.RoboExploreInteriors.build({ THREE, add, mat, solid, canvasTex, rr, pick, stander, spots, marker, notes: NOTES, onFrame: (fn) => frameHooks.push(fn), cullables, rooms });
    (() => {   // Robo's own home on the sand below the promenade: a small tiled hut with a dock inside
      const g = new THREE.Group(), hx = 10, hz = 80.5; box(5, 3.2, 5, mat(0xefe3c8), hx, 1.6, hz, g, true); box(1.4, 2.3, 0.12, mat(0x2a6a70), hx, 1.15, hz - 2.53, g);
      [-1, 1].forEach((k) => { const r = box(3.6, 0.14, 5.8, roofMat, hx + k * 1.6, 3.2 + 0.8, hz, g, true); r.rotation.z = -k * 0.43; }); box(0.2, 0.3, 5.8, roofMat, hx, 4.2, hz, g);
      const sg = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.9), new THREE.MeshBasicMaterial({ map: canvasTex(512, 130, (x, w, h) => { x.fillStyle = '#14201c'; x.fillRect(0, 0, w, h); x.strokeStyle = '#46e0ff'; x.lineWidth = 6; x.strokeRect(5, 5, w - 10, h - 10); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#46e0ff'; x.font = 'bold 44px sans-serif'; x.fillText("ROBO'S DOCK", w / 2, 42); x.fillStyle = '#ffe9b0'; x.font = 'bold 38px "Nirmala UI","Noto Sans Malayalam","Kartika",sans-serif'; x.fillText('റോബോയുടെ വീട്', w / 2, 94); }) })); sg.position.set(hx, 3.0, hz - 2.56); sg.rotation.y = PI; g.add(sg);
      add(g); cullables.push(g); g.userData = { x: hx, z: hz }; solid(hx - 2.5, hx + 2.5, hz - 2.5, hz + 2.5);
      door(hx, 77.2, 'home', "Enter Robo's dock", '🤖');
    })();
    /* the beach front, east and west of the promenade: the street's flanks are walled off, the sand is open */
    solid(34, 92, -72, 61); solid(-92, -34, -72, 61);
    [-1, 1].forEach((s) => {
      [[s * 46, 66.4, s > 0 ? -PI / 2 : PI / 2], [s * 70, 66.4, s > 0 ? -PI / 2 : PI / 2]].forEach(([sx, sz, ry]) => { const st = kit.stall(); st.position.set(sx, 0, sz); st.rotation.y = ry; add(st); cullables.push(st); st.userData = { x: sx, z: sz }; solid(sx - 0.9, sx + 0.9, sz - 1.4, sz + 1.4, 'stall', st); stander(pick(['mundu', 'lungi', 'thattam']), sx + (s > 0 ? -1.4 : 1.4), sz + 0.4, ry); });
      for (let i = 0; i < 8; i++) palmAt(s * rr(40, 82), rr(80, 96), i + 90, rr(1.0, 1.5));
      for (let i = 0; i < 10; i++) addPickup('coin', null, s * (38 + i * 4.4), rr(64, 74));
      walker(pick(['fisher', 'schoolboy', 'saree']), [[s * 38, 70], [s * 80, 70]], 1.1, 3); walker(pick(['lungi', 'schoolgirl']), [[s * 80, 86], [s * 40, 86]], 1.0, 3);
    });
    /* ---------- the highway and the walls: one connected world ---------- */
    if (!ACTIVE || ACTIVE.indexOf('city') >= 0) {   // the highway and the walls between towns exist only when the beach town, the city and the rest are open
      const hwMat0 = asphaltMat.clone();
      const hwSeg = (x0, x1, p0) => {   // one stretch of the highway: from the beach promenade east to Manjeri, and from the promenade west to the Churam
        const cx = (x0 + x1) / 2, len = x1 - x0;
        const hwMat = hwMat0.clone(); if (asphaltMat.map) { hwMat.map = asphaltMat.map.clone(); hwMat.map.repeat.set(len / 4.8, 2); hwMat.map.needsUpdate = true; }   // its own texture, repeated along the stretch
        plane(len, 10, hwMat, cx, 0.045, HW_Z);                                                     // the carriageway, 10 m wide
        [-1, 1].forEach((s) => { box(len, 0.16, 1.4, paverMat, cx, 0.1, HW_Z + s * 5.7, undefined, false); box(len, 0.1, 0.34, mat(0x8d8a84), cx, 0.09, HW_Z + s * 5.05, undefined, false); });
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.22).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ map: canvasTex(64, 4, (x, w, h) => { x.clearRect(0, 0, w, h); x.fillStyle = '#e8e4d8'; x.fillRect(0, 0, w * 0.5, h); }, len / 6, 1), transparent: true, depthWrite: false })); dash.position.set(cx, 0.06, HW_Z); add(dash);
        for (let x = p0, i = 0; x < x1 - 8; x += 22, i++) { palmAt(x, HW_Z - 7.4, i + 120, 1.0); palmAt(x + 11, HW_Z + 7.4, i + 220, 1.0); }
      };
      hwSeg(84, WORLD.x1, 100); hwSeg(WORLD.x0, -84, WORLD.x0 + 12);
      [[CITY_X - 62, 58], [HILITE_X + 62, 44], [MANJERI_X + 62, 58], [CITY_X, 60], [MANJERI_X, 60], [CHURAM_X, 54]].forEach(([jx, jz]) => {   // each side road and main street runs on to the highway
        const l = HW_Z - 5 - jz; plane(8, l, asphaltMat, jx, 0.045, jz + l / 2); [-1, 1].forEach((s) => box(1.2, 0.16, l, paverMat, jx + s * 4.0, 0.1, jz + l / 2, undefined, false));
      });
      const wallMat = mat(0x8d8a84, { roughness: 0.95 }), wall = (a, b, c, d) => { solid(a, b, c, d, 'wall'); if (b - a > 1 && d - c > 0.5) { const h = 1.7, m = new THREE.Mesh(new THREE.BoxGeometry(b - a, h, 0.5), wallMat); m.position.set((a + b) / 2, h / 2, c >= 62 ? c + 0.25 : d - 0.25); /* the face towards the road */ m.castShadow = true; add(m); } else solid(a, b, c, d, 'wall'); };
      wall(84, CITY_X - 84, -72, 62.4); wall(CITY_X + 36, HILITE_X - 36, -72, 62.4); wall(HILITE_X + 84, MANJERI_X - 36, -72, 62.4);   // the ground between the areas, north of the highway
      wall(CITY_X - 84, CITY_X + 36, -72, -62.2); wall(HILITE_X - 36, HILITE_X + 84, -72, -62.2); wall(MANJERI_X - 36, MANJERI_X + 84, -72, -62.2);   // north of each area
      wall(84, WORLD.x1, 77, 104); wall(WORLD.x0, -84, 77, 104); wall(WAYANAD_X + 84, -84, -72, 62.4);                                                                      // south of the highway (the sand and the sea end at the beach town)
      solid(HILITE_X - 36, HILITE_X + 36.5, 47.3, 62.4, 'fence');                                       // the bypass lanes of HiLITE City are look-only
      solid(-92, 92, -73, -70, 'wall');                                                                // the north end of the beach town
    }
    /* an area's own frame: the area files draw in their own north-south coordinates (z from -62 to 62 along the main street) and this puts the area oz metres north or south in the one world.
       What they draw goes into a group moved by oz; everything that is data (colliders, spots, pickups, walkers, doors) is shifted by the helpers below, so an area file never needs to know where it stands. */
    const areaCtx = (ox, oz) => {
      oz = oz || 0; const ag = new THREE.Group(); ag.position.z = oz; ag.userData = { oz }; scene.add(ag);
      const spotsHere = oz ? { push: (...a) => { for (const s of a) { s.z += oz; spots.push(s); } return spots.length; } } : spots;
      return { THREE, scene: ag, ox, oz, door: (x, z, a, b, e) => door(x, z + oz, a, b, e), add: (o, p) => add(o, p || ag), box: (w, h, d, m, x, y, z, parent, sh) => box(w, h, d, m, x, y, z, parent || ag, sh),
        mat, solid: (x0, x1, z0, z1, tag, obj) => solid(x0, x1, z0 + oz, z1 + oz, tag, obj), post: (x, z, r, tag, obj) => post(x, z + oz, r, tag, obj),
        plane: (w, d, m, x, y, z) => { const p = plane(w, d, m, x, y, z); ag.add(p); return p; }, canvasTex, rr, pick,
        walker: (type, pts, sp, j) => walker(type, pts.map((q) => [q[0], q[1] + oz]), sp, j), stander: (type, x, z, yaw) => stander(type, x, z + oz, yaw), addPickup: (kind, id, x, z) => addPickup(kind, id, x, z + oz),
        cullables, staticGroups, noMerge, palmAt: (x, z, i, s) => palmAt(x, z + oz, i, s), building: (side, z0, z1, ox0, pair) => building(side, z0 + oz, z1 + oz, ox0, pair), buildingEW: (side, lx0, lx1, tz, ox0, pair) => buildingEW(side, lx0, lx1, tz + oz, ox0, pair),
        auto: (x, z, ry) => auto(x, z + oz, ry), scooter: (x, z, ry) => scooter(x, z + oz, ry), V, spots: spotsHere, marker: (x, z, color) => marker(x, z + oz, color), notes: NOTES, kit, earthMat, asphaltMat, paverMat, roofMat, onFrame: (fn) => frameHooks.push(fn), player: () => state, toast: (text) => toast(text), coin: (n) => cb.onCoin && cb.onCoin(n) };
    };
    if (window.RoboExplore && window.RoboExploreManjeri) window.RoboExploreManjeri.build(areaCtx(MANJERI_X));
    if (window.RoboExplore && window.RoboExploreCity && isActive('city')) window.RoboExploreCity.build(areaCtx(CITY_X));
    if (window.RoboExplore && window.RoboExploreHilite && isActive('hilite')) window.RoboExploreHilite.build(areaCtx(HILITE_X));
    if (window.RoboExplore && window.RoboExploreWayanad && isActive('wayanad')) window.RoboExploreWayanad.build(areaCtx(WAYANAD_X, 0));
    if (window.RoboExplore && window.RoboExploreMalappuram && isActive('malappuram')) window.RoboExploreMalappuram.build(areaCtx(MALAPPURAM_X, 0));
    if (ACTIVE && ACTIVE.indexOf('city') < 0) {   // not linked by the highway: each open town's roads out end in a red and white barrier with a board   // Manjeri alone: the four roads out (highway north and south, the east road, the bypass road) end in a red and white barrier with a board
      const red = mat(0xb8352a), white = mat(0xf4f1e8), post2 = mat(0x2a2a2a);
      const closed = (cx, cz, theta) => {   // a barrier across the road: a board facing the town, a rail of red and white bars and two posts, turned to square up to the road
        const g = new THREE.Group(); g.position.set(cx, 0, cz); g.rotation.y = theta; add(g);
        const board = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.2), new THREE.MeshStandardMaterial({ map: canvasTex(512, 134, (x, w, h) => { x.fillStyle = '#b8352a'; x.fillRect(0, 0, w, h); x.strokeStyle = '#f4f1e8'; x.lineWidth = 6; x.strokeRect(6, 6, w - 12, h - 12); x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = 'bold 50px sans-serif'; x.fillText('ROAD CLOSED', w / 2, 46); x.font = 'bold 30px sans-serif'; x.fillText('more of the map opens later', w / 2, 96); }), roughness: 0.8 }));
        board.position.set(0, 2.1, -0.2); g.add(board);
        const k = 10, len = 9.2, w = len / k; for (let i = 0; i < k; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.35, 0.3), i % 2 ? red : white); m.position.set(-len / 2 + (i + 0.5) * w, 0.95, 0); m.castShadow = true; g.add(m); }
        [-1, 1].forEach((s) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.3, 0.2), post2); m.position.set(s * len / 2, 0.65, 0); g.add(m); });
        for (let i = 0; i < 7; i++) post(cx + Math.cos(theta) * (-len / 2 + 0.6 + i * (len - 1.2) / 6), cz - Math.sin(theta) * (-len / 2 + 0.6 + i * (len - 1.2) / 6), 0.9, 'fence');   // round posts along the rail, so it holds at any angle
      };
      const exsOf = (id, X0, mod) => (mod && mod.shape && isActive(id) ? mod.shape.exits().map((e) => Object.assign({}, e, { wx: X0 + e.x })) : []);
      const exsAll = exsOf('manjeri', MANJERI_X, window.RoboExploreManjeri).concat(exsOf('malappuram', MALAPPURAM_X, window.RoboExploreMalappuram));
      const exs = exsAll.length ? exsAll : window.RoboExploreManjeri ? window.RoboExploreManjeri.shape.exits() : [{ x: 0, z: -135.2, tx: 0, tz: -1 }, { x: 0, z: 105.2, tx: 0, tz: 1 }, { x: 95.2, z: 0, tx: 1, tz: 0 }, { x: -95.2, z: 0, tx: -1, tz: 0 }];
      exs.forEach((e) => { const bx = (e.wx !== undefined ? e.wx : MANJERI_X + e.x) - e.tx * 1.5, bz = e.z - e.tz * 1.5; closed(bx, bz, Math.atan2(-e.tx, -e.tz)); });   // a metre and a half inside the edge
    }
    if (window.RoboExploreLife) window.RoboExploreLife.build({ THREE, scene, add, mat, rr, pick, kit, V, cullables, low, onFrame: (fn) => frameHooks.push(fn), addCollider: (q) => colliders.push(q), player: () => state, people: () => persons, X: { kozhikode: 0, city: CITY_X, hilite: HILITE_X, manjeri: MANJERI_X, wayanad: WAYANAD_X } });   // the town's own life: traffic, animals, birds, sky, boats
    if (window.RoboExploreSigns) window.RoboExploreSigns.build({ THREE, add, mat, solid, post, canvasTex, spots, marker, lampPos, cullables, laneZ: LANE_Z, notes: NOTES });
    /* ---------- scrap: old paper, plastic, tins, glass and iron lie about; the scrap dealers (one in each area) buy them by weight ---------- */
    const scrapModel = (id) => {
      const g = new THREE.Group(), m = (hex, o) => mat(hex, o), add1 = (geo, mt, x, y, z, rx, rz) => { const o = new THREE.Mesh(geo, mt); o.position.set(x, y, z); if (rx) o.rotation.x = rx; if (rz) o.rotation.z = rz; g.add(o); return o; };
      if (id === 'paper') { add1(new THREE.BoxGeometry(0.5, 0.28, 0.36), m(0xcfc3a0), 0, 0, 0); [-0.12, 0.12].forEach((x) => add1(new THREE.BoxGeometry(0.03, 0.3, 0.38), m(0x6a4a2a), x, 0, 0)); }
      else if (id === 'plastic') [[-0.15, 0.2], [0, -0.3], [0.16, 0.5]].forEach(([x, rz]) => add1(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 8), m(0x9fd0e8, { transparent: true, opacity: 0.8 }), x, -0.02, 0, 0, rz));
      else if (id === 'can') [[-0.1, 0], [0.12, 0.6]].forEach(([x, rz]) => add1(new THREE.CylinderGeometry(0.07, 0.07, 0.16, 10), m(0xb8bcc2, { metalness: 0.7, roughness: 0.4 }), x, -0.03, 0, 0, rz));
      else if (id === 'glass') { add1(new THREE.CylinderGeometry(0.08, 0.08, 0.22, 10), m(0x3f8a4a, { transparent: true, opacity: 0.85 }), 0, -0.04, 0, 0, 0.5); add1(new THREE.CylinderGeometry(0.03, 0.04, 0.12, 8), m(0x3f8a4a, { transparent: true, opacity: 0.85 }), 0.1, 0.1, 0, 0, 0.5); }
      else [[0, 0.1], [0.04, -0.5], [-0.03, 1.1]].forEach(([x, rz]) => add1(new THREE.BoxGeometry(0.5, 0.05, 0.05), m(0x6a4a3a, { roughness: 1 }), x, 0, 0.04 * rz, 0, rz));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.04, 6, 20).rotateX(PI / 2), new THREE.MeshBasicMaterial({ color: 0x9ab88a, transparent: true, opacity: 0.9 })); ring.position.y = -0.3; g.add(ring); g.scale.setScalar(1.7); return g;
    };
    const SCRAP_AT = [['plastic', -10, 93], ['plastic', 6, 95], ['plastic', 18, 91], ['plastic', -24, 95], ['can', -3, 71], ['paper', 14, 72], ['can', -12, LANE_Z + 2], ['paper', -7.5, LANE_Z - 1.4], ['paper', 9, LANE_Z + 1.2], ['glass', -2.5, -35], ['paper', 2.8, 12], ['can', -2.8, 30], ['iron', 2.2, 22], ['glass', 0, -18], ['plastic', 3, -48],
      ['paper', MANJERI_X - 3, -44], ['can', MANJERI_X + 3, -38], ['plastic', MANJERI_X - 2.6, 20], ['glass', MANJERI_X + 2.6, 30], ['plastic', MANJERI_X - 30, 38], ['iron', MANJERI_X + 18, 20], ['can', MANJERI_X + 12, 2.6], ['paper', MANJERI_X - 1, -60], ['glass', MANJERI_X + 1, 64], ['plastic', MANJERI_X - 2.4, -100], ['can', MANJERI_X + 40, -2.6], ['paper', MANJERI_X - 50, 2.4], ['glass', MANJERI_X + 2, 90]];
    SCRAP_AT.forEach(([id, x, z]) => addPickup('scrap', id, x, z));
    const scrapShed = (x, z, yaw) => {
      const g = new THREE.Group(), tin = mat(0x8a8f94, { metalness: 0.5, roughness: 0.6 });
      box(4.6, 2.4, 3.2, mat(0xb8a98a), 0, 1.2, 0, g, true); const roof = box(5.2, 0.1, 3.8, tin, 0, 2.55, 0, g, true); roof.rotation.z = 0.08;
      [[-1.3, 0.5, 0x6a4a3a], [0, 0.4, 0x3a5a7a], [1.3, 0.6, 0xcfc3a0]].forEach(([px, h, hex]) => box(1.0, h, 0.9, mat(hex), px, h / 2, 1.9, g));   // piles of iron, plastic and paper at the front
      box(1.1, 0.1, 0.7, mat(0x2a2a2a), 1.9, 0.9, 1.7, g); box(0.05, 0.6, 0.05, mat(0x2a2a2a), 1.9, 0.6, 1.7, g);                               // his weighing scale
      const sg = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.8), new THREE.MeshBasicMaterial({ map: canvasTex(512, 140, (cx, w, h) => { cx.fillStyle = '#3a4a2a'; cx.fillRect(0, 0, w, h); cx.strokeStyle = '#e8e0c0'; cx.lineWidth = 6; cx.strokeRect(5, 5, w - 10, h - 10); cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillStyle = '#f3ead0'; cx.font = 'bold 46px sans-serif'; cx.fillText('SCRAP · ♻', w / 2, 46); cx.font = 'bold 40px "Nirmala UI","Noto Sans Malayalam","Kartika",sans-serif'; cx.fillText('ആക്രിക്കട', w / 2, 100); }) })); sg.position.set(0, 2.1, 1.65); g.add(sg);
      g.position.set(x, 0, z); g.rotation.y = yaw; add(g); cullables.push(g); g.userData = { x, z };
      solid(x - 2.7, x + 2.7, z - 2.0, z + 2.0);   // 21.6 m2: big enough that the camera treats it as a building
    };
    scrapShed(-28, 82, PI); marker(-28, 77.2, 0xb8d89a); spots.push({ x: -28, z: 77.2, r: 2.2, kind: 'shop', arg: 'scrap', label: 'Scrap dealer', emoji: '♻️' }); stander('lungi', -26.4, 79.4, 0);
    scrapShed(MANJERI_X + 22, 60, 0); marker(MANJERI_X + 22, 64.2, 0xb8d89a); spots.push({ x: MANJERI_X + 22, z: 64.2, r: 2.2, kind: 'shop', arg: 'scrap', label: 'Scrap dealer', emoji: '♻️' }); stander('lungi', MANJERI_X + 23.6, 61.8, PI);
    /* ---------- public EV charging bays (KSEB is putting chargers up in Kozhikode and Malappuram): a painted slot, a charger unit with a screen and cable, a signboard ---------- */
    const evBay = (x, z) => {
      const g = new THREE.Group(), blue = mat(0x1f4a7a, { roughness: 0.5 });
      box(2.8, 0.02, 5, mat(0x2c2c2e), 0, 0.03, 1.2, g); [-1.35, 1.35].forEach((s) => box(0.08, 0.025, 5, mat(0xf3f0e8), s, 0.05, 1.2, g));        // the slot, with its white lines
      box(0.5, 1.7, 0.4, blue, 1.9, 0.85, 0, g, true); box(0.36, 0.5, 0.02, new THREE.MeshBasicMaterial({ color: 0x46e0ff }), 1.9, 1.3, 0.21, g); // the unit and its glowing screen
      box(0.05, 0.9, 0.05, mat(0x151515), 1.65, 0.55, 0.15, g); box(0.1, 0.18, 0.1, mat(0x151515), 1.65, 0.1, 0.15, g);                           // the cable and its plug
      const sg = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.8), new THREE.MeshBasicMaterial({ map: canvasTex(512, 160, (cx, w, h) => { cx.fillStyle = '#1f4a7a'; cx.fillRect(0, 0, w, h); cx.strokeStyle = '#ffffff'; cx.lineWidth = 6; cx.strokeRect(5, 5, w - 10, h - 10); cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillStyle = '#ffffff'; cx.font = 'bold 54px sans-serif'; cx.fillText('⚡ KSEB · EV', w / 2, 54); cx.font = 'bold 40px sans-serif'; cx.fillStyle = '#9fe8ff'; cx.fillText('CHARGING', w / 2, 112); }) })); sg.position.set(1.9, 2.5, 0); g.add(sg); box(0.06, 1.0, 0.06, mat(0x555555), 1.9, 1.8, -0.05, g);
      g.position.set(x, 0, z); add(g); cullables.push(g); g.userData = { x, z };
      solid(x + 1.4, x + 2.4, z - 0.4, z + 0.4, 'stall', g);
      marker(x + 1.9, z + 1.6, 0xffd27a); spots.push({ x: x + 1.9, z: z + 1.6, r: 2.1, kind: 'shop', arg: 'kseb', label: 'KSEB EV charging', emoji: '🔌' });
    };
    evBay(-9, 74); evBay(MANJERI_X + 55, 29); evBay(CITY_X + 19, 6);

    /* ---------- auto stands: a parked auto and its driver beside a ring; the fare is prepaid at the shop screen, then the auto takes you along the road (left lane) with the meter running ---------- */
    const RR = window.RoboExploreRides;
    const rideRig = (() => {   // the auto you ride in: taller canopy than the parked ones so the robot fits, and a driver at the handlebar
      if (!RR) return null;
      const g = new THREE.Group(), yel = mat(0xe8b81c, { roughness: 0.5 }), blk = mat(0x1d1d1d, { roughness: 0.6 }), wheel = new THREE.CylinderGeometry(0.28, 0.28, 0.16, 14).rotateZ(PI / 2);
      box(1.25, 0.55, 2.0, blk, 0, 0.62, 0.1, g, true); box(1.25, 0.1, 2.2, yel, 0, 2.3, 0.2, g, true); box(1.2, 0.08, 0.9, mat(0x3a3a3a), 0, 0.92, 0.5, g);
      [[-0.58, -0.8], [0.58, -0.8], [-0.58, 1.0], [0.58, 1.0]].forEach(([px2, pz2]) => box(0.05, 1.45, 0.05, yel, px2, 1.55, pz2, g)); box(0.5, 0.35, 0.5, blk, 0, 0.9, -1.1, g); box(0.18, 0.12, 0.05, mat(0xfff2c0), 0, 0.92, -1.37, g);
      [[-0.6, 0.28, 0.9], [0.6, 0.28, 0.9], [0, 0.28, -1.0]].forEach(([wx, wy, wz]) => { const w = new THREE.Mesh(wheel, blk); w.position.set(wx, wy, wz); g.add(w); });
      const driver = person('lungi', { stand: true }); driver.g.position.set(0, 0.35, -0.55); g.add(driver.g);
      g.visible = false; add(g); return { g, driver };
    })();
    if (RR) Object.keys(RR.STOPS).forEach((id) => {
      const s = RR.STOPS[id]; marker(s.x, s.z, 0xffd27a); spots.push({ x: s.x, z: s.z, r: 2.2, kind: 'shop', arg: 'auto_' + id, label: 'Auto stand', emoji: '🛺' });
      if (id !== 'kz_beach') auto(s.x - 2.0, s.z, 0.05);   // the beach stand uses the auto already parked there
      if (s.area === 'manjeri') {   // the shuttle's stop: a pole with a board on the east pavement, facing the road
        const pg = new THREE.Group(), bd = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.0), new THREE.MeshStandardMaterial({ map: canvasTex(384, 256, (x, w, h) => { x.fillStyle = '#e8b81c'; x.fillRect(0, 0, w, h); x.fillStyle = '#12373a'; x.fillRect(10, 10, w - 20, h - 20); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#ffc857'; x.font = 'bold 46px sans-serif'; x.fillText('SHUTTLE', w / 2, 62); x.fillStyle = '#fff'; x.font = 'bold 28px sans-serif'; x.fillText('Chaya Express', w / 2, 118); x.font = 'bold 30px "Nirmala UI","Noto Sans Malayalam",sans-serif'; x.fillStyle = '#ffe9b0'; x.fillText('ഷട്ടിൽ സ്റ്റോപ്പ്', w / 2, 178); }), roughness: 0.8, side: THREE.DoubleSide }));
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 3.0, 8), mat(0x55524c)); pole.position.y = 1.5; pg.add(pole); bd.position.set(0, 2.55, 0); bd.rotation.y = -PI / 2; pg.add(bd);
        pg.position.set(MANJERI_X + 4.0, 0, s.z + 2.4); add(pg); cullables.push(pg); staticGroups.push(pg); pg.userData = { x: pg.position.x, z: pg.position.z }; post(pg.position.x, pg.position.z, 0.18, 'pole', pg);
      }
      stander('lungi', s.x - 1.5, s.z + 2.2, PI * 0.5);
    });
    /* the characters of the story (story.js): each stands where the story says, with a ring to talk to them */
    /* the people of the story (story.js) stand in the world only in story mode: setStory(true) shows them and lets you talk to them, setStory(false) (free roam) hides them and removes their rings from the spots (and so from the map) */
    const storyCast = [];
    if (window.RoboStory) for (const [id, c] of Object.entries(window.RoboStory.npcs)) { const p = stander(c.look, c.at[0], c.at[1], c.face || 0), m = marker(c.at[0], c.at[1], 0xffb8d8), sp = { x: c.at[0], z: c.at[1], r: 1.9, kind: 'talk', arg: id, label: 'Talk to ' + c.name, emoji: c.emoji }; storyCast.push({ p, m, sp }); }
    const setStoryCast = (on) => { for (const k of storyCast) { k.p.off = !on; k.m.visible = !!on; const i = spots.indexOf(k.sp); if (on && i < 0) spots.push(k.sp); else if (!on && i >= 0) spots.splice(i, 1); } };
    setStoryCast(false);
    for (let i = 0; i < 26; i++) addPickup('coin', null, (rnd() < 0.5 ? -1 : 1) * rr(0.6, 3.0), -64 + i * 4.9 + rr(-1, 1));
    for (let i = 0; i < 10; i++) addPickup('coin', null, rr(-18, 18), rr(66, 92));
    const tableSpots = [[3.0, -62], [-3.1, -48], [3.2, -22], [-3.0, 2], [3.0, 30], [-3.0, 44], [0, 71], [-14, 71], [16, 71], [8, 80], [-20, 92], [20, 90]];
    tableSpots.forEach(([x, z], i) => addPickup('food', FOODS_TOWN[i % FOODS_TOWN.length], x, z));

    /* ---------- delivery jobs: take one at the desk by the promenade, walk into the yellow beam to collect, then the green beam to deliver ---------- */
    const JOB_POINTS = [
      { name: 'Auto stand', x: 0, z: -53 }, { name: 'Chaya Kada', x: 2.9, z: -44 }, { name: 'Pharmacy', x: -2.9, z: -12 }, { name: 'Hardware shop', x: 2.9, z: 18 }, { name: 'Textile shop', x: -2.9, z: 40 },
      { name: 'Spice stall, market lane', x: -9.8, z: LANE_Z }, { name: 'Flower stall, temple lane', x: 7.2, z: LANE_Z }, { name: 'Sweet stall, promenade', x: 0, z: 66.5 }, { name: 'Church square', x: 19.5, z: 63 }, { name: 'Fishing boats', x: -22, z: 82.5 }
    ];
    const DESK = { x: 0, z: 59.5 };
    marker(DESK.x, DESK.z, 0x8fc8ff); spots.push({ x: DESK.x, z: DESK.z, r: 2.2, kind: 'job', arg: 'kozhikode', label: 'Delivery job', emoji: '📦' });
    /* the other areas have their own desk and their own points (explore_jobs.js); a desk's spot names its area, and a job only uses that area's points */
    const JOB_AREAS = { kozhikode: { points: JOB_POINTS } }, DESKS = [DESK];
    if (window.RoboExploreJobs) for (const [k, s] of Object.entries(window.RoboExploreJobs.sets)) {
      const dk = { x: s.ox + s.desk[0], z: s.desk[1], name: 'desk (' + k + ')' }; DESKS.push(dk); JOB_AREAS[k] = { points: s.points.map(([name, lx, lz]) => ({ name, x: s.ox + lx, z: lz })) };
      marker(dk.x, dk.z, 0x8fc8ff); spots.push({ x: dk.x, z: dk.z, r: 2.2, kind: 'job', arg: k, label: 'Delivery job', emoji: '📦' });
    }
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 14, 20, 1, true).translate(0, 7, 0), new THREE.MeshBasicMaterial({ color: 0xffe14a, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    const beamRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.25, 28).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: 0xffe14a, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
    beam.visible = beamRing.visible = false; add(beam); add(beamRing);
    /* a waypoint: a cyan beam the map screen can put on any place in this area, cleared when you get there */
    const wpBeam = new THREE.Mesh(beam.geometry, new THREE.MeshBasicMaterial({ color: 0x6fd6ff, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    const wpRing = new THREE.Mesh(beamRing.geometry, new THREE.MeshBasicMaterial({ color: 0x6fd6ff, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
    wpBeam.visible = wpRing.visible = false; add(wpBeam); add(wpRing); const wp = { cur: null };
    /* the way to a destination: a walking grid per area (built the first time, the walls never change), the path found over it, and dots laid along the path on the ground */
    const navCache = {};
    const getGrid = () => { const b = state.bounds; if (!window.RoboNav || state.room || !b) return null; const k = 'world', e = navCache[k]; if (!e || e.n !== colliders.length) navCache[k] = { n: colliders.length, G: window.RoboNav.makeGrid(b, colliders, 0.55) }; return navCache[k].G; };
    const routeTo = (tx, tz) => { const G = getGrid(); return G ? window.RoboNav.route(G, state.x, state.z, tx, tz) : null; };
    const dotGeo = new THREE.CircleGeometry(0.28, 12).rotateX(-PI / 2), dotMat = new THREE.MeshBasicMaterial({ color: 0x118fd0, transparent: true, opacity: 0.95, depthWrite: false }), pathDots = [];
    for (let i = 0; i < 160; i++) { const m = new THREE.Mesh(dotGeo, dotMat); m.visible = false; add(m); pathDots.push(m); }
    const showPath = (pts) => { const p = window.RoboNav ? window.RoboNav.sample(pts, 2.2, pathDots.length) : []; pathDots.forEach((m, i) => { m.visible = i < p.length; if (i < p.length) m.position.set(p[i].x, 0.13, p[i].z); }); };
    const setWp = (x, z, name) => {
      const rt = routeTo(x, z); wp.cur = { x, z, name: name || 'the place', path: rt ? rt.points : null, length: rt ? rt.length : null, snapped: rt ? rt.snapped : false, r: rt ? Math.max(2.2, Math.hypot(rt.to.x - x, rt.to.z - z) + 1.6) : 2.2, routeT: 0.8 };
      wpBeam.position.set(x, 0, z); wpRing.position.set(x, 0.1, z); wpBeam.visible = wpRing.visible = true; showPath(wp.cur.path);
    };
    const clearWp = () => { wp.cur = null; wpBeam.visible = wpRing.visible = false; showPath(null); };
    /* the delivery bike: on a job you get a scooter (about twice walking speed) until the parcel is delivered or the job is cancelled */
    const bikeM = kit.ride('scooter'); bikeM.scale.setScalar(0.85); bikeM.visible = false; add(bikeM);
    const driveAuto = (() => {   // the auto you drive: the ride model's taller canopy, with a back seat for one passenger
      const g = new THREE.Group(), yel = mat(0xe8b81c, { roughness: 0.5 }), blk = mat(0x1d1d1d, { roughness: 0.6 }), wheel = new THREE.CylinderGeometry(0.28, 0.28, 0.16, 14).rotateZ(PI / 2);
      box(1.25, 0.55, 2.0, blk, 0, 0.62, 0.1, g, true); box(1.25, 0.1, 2.2, yel, 0, 2.3, 0.2, g, true); box(1.2, 0.08, 0.9, mat(0x3a3a3a), 0, 0.92, 0.55, g);
      [[-0.58, -0.8], [0.58, -0.8], [-0.58, 1.0], [0.58, 1.0]].forEach(([px2, pz2]) => box(0.05, 1.45, 0.05, yel, px2, 1.55, pz2, g)); box(0.5, 0.35, 0.5, blk, 0, 0.9, -1.1, g); box(0.18, 0.12, 0.05, mat(0xfff2c0), 0, 0.92, -1.37, g);
      [[-0.6, 0.28, 0.9], [0.6, 0.28, 0.9], [0, 0.28, -1.0]].forEach(([wx, wy, wz]) => { const w = new THREE.Mesh(wheel, blk); w.position.set(wx, wy, wz); g.add(w); });
      const pax = person('saree', { stand: true }); pax.g.position.set(0, 0.95, 0.55); pax.g.visible = false; g.add(pax.g);
      g.visible = false; add(g); return { g, pax };
    })();
    /* at the pickup: a passenger waits for a fare, a parcel sits on the ground for a delivery */
    const waiters = ['mundu', 'saree', 'lungi', 'thattam'].map((tp) => { const p = person(tp, { stand: true }); p.g.visible = false; add(p.g); return p; });
    const parcelBox = new THREE.Group(); box(0.6, 0.4, 0.5, mat(0xb38a52), 0, 0.2, 0, parcelBox, true); box(0.62, 0.42, 0.08, mat(0xe8dcc0), 0, 0.2, 0, parcelBox); parcelBox.visible = false; add(parcelBox);
    /* getting into a parked auto or scooter: the parked one is hidden (and its collider taken out) while you ride, and comes back when the ride ends */
    const takenVehicles = [], tipped = {};
    const returnVehicles = () => { for (const s of takenVehicles) { s.off = false; s.obj.visible = true; if (s.col && colliders.indexOf(s.col) < 0) colliders.push(s.col); } takenVehicles.length = 0; };
    const mountSpot = (sp) => {
      if (state.bike) { toast('Get off first.'); return; }
      const type = sp.arg === 'auto' ? 'auto' : 'bike', j = jobs.cur;
      if (j && (j.kind === 'ride') !== (type === 'auto')) { toast(j.kind === 'ride' ? 'You have a passenger job: take an auto.' : 'You have a parcel job: take the bike or a scooter.'); return; }
      sp.obj.visible = false; sp.off = true; const i = colliders.indexOf(sp.col); if (i >= 0) colliders.splice(i, 1); takenVehicles.push(sp);
      state.bike = true; state.vtype = type; bikePark = null; state.bs = 0; state.x = sp.x; state.z = sp.z; state.yaw = streetYaw(sp.x, sp.z, sp.yaw || 0); state.camYaw = state.yaw; state.vx = state.vz = 0;
      const first = !tipped[type]; tipped[type] = true;   // the first time, a longer tip; after that, a short line
      toast(type === 'auto' ? (first ? 'You are in the auto. Stick up to drive, sideways to steer, down to reverse. The bell is the horn. Get out with the button. For fares: stop at the delivery desk and take Get a passenger.' : 'In the auto. Stick up to drive, the bell is the horn.') : (first ? 'You are on the scooter. Stick up to ride, sideways to steer, down to reverse. The bell is the horn. Get off with the button; park it anywhere and get on again when you come near.' : 'On the scooter. Stick up to ride, the bell is the horn.'));
      if (first) jobs.msgT = 9;
    };
    let bikePark = null;   // where the bike or auto stands when you have got off it (null while you ride it or when there is no job)
    const jobs = { cur: null, msg: '', msgT: 0, done: 0, earned: 0 };
    /* the way to the job's target, as a waypoint that arrives silently: the path shows on the ground, the round map and the big map */
    const jobWp = (p, label) => { setWp(p.x, p.z, label); if (wp.cur) { wp.cur.silent = true; wp.cur.job = true; } };
    const endJobWp = () => { if (wp.cur && wp.cur.job) clearWp(); };
    const setBeam = (p, color) => { beam.visible = beamRing.visible = !!p; if (p) { beam.position.set(p.x, 0, p.z); beamRing.position.set(p.x, 0.1, p.z); beam.material.color.setHex(color); beamRing.material.color.setHex(color); } };
    const toast = (text) => { jobs.msg = text; jobs.msgT = 4; };
    const jobStep = (dt, near, act) => {
      if (jobs.msgT > 0) jobs.msgT -= dt;
      if (wp.cur && !state.room && Math.hypot(state.x - wp.cur.x, state.z - wp.cur.z) < (wp.cur.r || 2.2)) { const nm = wp.cur.name, quiet = wp.cur.silent; clearWp(); if (quiet) { /* a job target: the job itself says what happened */ } else if (cb.onArrive) cb.onArrive(nm); else { jobs.msg = 'You have arrived: ' + nm; jobs.msgT = 3; } }
      if (wp.cur && wp.cur.path && !state.room && window.RoboNav) { wp.cur.routeT -= dt; if (wp.cur.routeT <= 0) { wp.cur.routeT = 0.8; if (window.RoboNav.distanceTo(wp.cur.path, state.x, state.z) > 2.5) { const rt = routeTo(wp.cur.x, wp.cur.z); if (rt) { wp.cur.path = rt.points; wp.cur.length = rt.length; showPath(rt.points); } } } }   // you strayed from the path: find a new one
      const j = jobs.cur;
      if (act && near && near.kind === 'job') {
        if (j) { const ride = j.kind === 'ride'; jobs.cur = null; if (!ride) { state.bike = false; bikePark = null; returnVehicles(); } endJobWp(); setBeam(null); toast(ride ? 'Passenger trip cancelled.' : 'Delivery cancelled. Bike returned.'); }
        else { const pts = (JOB_AREAS[near.arg] || JOB_AREAS.kozhikode).points, sj = cb.storyJob && cb.storyJob(), isRide = state.bike && state.vtype === 'auto', n = (sj && sj.from && sj.to && (sj.mode || 'parcel') === (isRide ? 'ride' : 'parcel') && namedJob(pts, sj.from, sj.to)) || pickJob(pts, rnd); if (n && state.bike && state.vtype === 'auto') { jobs.cur = Object.assign(n, { kind: 'ride', phase: 'pickup', t0: time, drove: 0, meter: 30 }); setBeam(n.from, 0xffe14a); jobWp(n.from, 'Passenger at ' + n.from.name); toast('A passenger is waiting at ' + n.from.name + ', going to ' + n.to.name + '. Pull up beside them.'); } else if (n) { jobs.cur = Object.assign(n, { phase: 'pickup', t0: time }); state.bike = !state.ride; state.vtype = 'bike'; bikePark = null; setBeam(n.from, 0xffe14a); jobWp(n.from, 'Pick up: ' + n.from.name); toast('Parcel for ' + n.to.name + '. Collect it at ' + n.from.name + '. You are on the bike: F gets you off and on.'); } }
        return;
      }
      if (!j) return;
      const tgt = j.phase === 'pickup' ? j.from : j.to, ride = j.kind === 'ride';
      if (ride && j.phase === 'drop') { j.drove += Math.max(0, state.speed) * dt; j.meter = Math.round(30 + 15 * Math.max(0, (j.drove * 12) / 1000 - 1.5)); }   // the meter: Kerala's auto fare is Rs 30 for the first 1.5 km and Rs 15 a km after; the town is drawn at 1:12, so 12 m on the ground is 1 m here
      if (ride && !(state.bike && state.vtype === 'auto')) return;   // the passenger waits for you in the auto
      if (Math.hypot(state.x - tgt.x, state.z - tgt.z) < (ride ? 3.0 : 1.8) && (!ride || state.speed < 4.5)) {
        if (ride) {
          if (j.phase === 'pickup') { j.phase = 'drop'; j.t0 = time; setBeam(j.to, 0x4aff9a); jobWp(j.to, 'Take the passenger to ' + j.to.name); toast('Passenger on board. To ' + j.to.name + '. The meter is running.'); cb.onJob && cb.onJob('pickup'); }
          else { const t = tip(j.dist, time - j.t0), pay = j.meter + t; jobs.cur = null; endJobWp(); jobs.done++; jobs.earned += pay; setBeam(null); toast('Passenger dropped. Meter Rs ' + j.meter + (t ? ' + Rs ' + t + ' tip' : '') + '.'); cb.onCoin && cb.onCoin(pay); cb.onJob && cb.onJob('done', 'ride'); }
          return;
        }
        if (j.phase === 'pickup') { j.phase = 'drop'; j.t0 = time; setBeam(j.to, 0x4aff9a); jobWp(j.to, 'Deliver: ' + j.to.name); toast('Picked up. Deliver to ' + j.to.name + '.'); cb.onJob && cb.onJob('pickup'); }
        else { const t = tip(j.dist, time - j.t0), pay = j.fare + t; jobs.cur = null; state.bike = false; bikePark = null; returnVehicles(); endJobWp(); jobs.done++; jobs.earned += pay; setBeam(null); toast('Delivered! ₹' + j.fare + (t ? ' + ₹' + t + ' tip' : '')); cb.onCoin && cb.onCoin(pay); cb.onJob && cb.onJob('done'); }
      }
    };
    /* riding: the auto speeds up, slows down for the stop and drives the lane; you sit behind the driver */
    const rideMove = (dt) => {
      const r = state.ride; r.t += dt;
      const left = r.dist - r.s, sp = RR.SPEED * Math.min(1, 0.25 + r.t / 1.2) * Math.min(1, 0.2 + left / 10);
      r.s = Math.min(r.dist, r.s + sp * dt);
      const q = RR.pathAt(r.pts, r.s), ty = Math.atan2(-q.dx, -q.dz); let dy = ty - state.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); state.yaw += dy * Math.min(1, dt * 8);
      state.vx = state.vz = 0; state.camYaw += (Math.atan2(Math.sin(state.yaw - state.camYaw), Math.cos(state.yaw - state.camYaw))) * Math.min(1, dt * 2.2);
      rideRig.g.position.set(q.x, 0, q.z); rideRig.g.rotation.y = state.yaw; rideRig.driver.update(time, dt, false);
      state.x = q.x - q.dx * 0.4; state.z = q.z - q.dz * 0.4;
      if (r.s >= r.dist - 1e-6) {   // arrived: step out at the stand
        const s = RR.STOPS[r.to]; rideRig.g.visible = false; state.ride = null; state.x = s.x; state.z = s.z; state.vx = state.vz = 0; cb.onRideEnd && cb.onRideEnd({ to: r.to, name: r.name, fare: r.fare });
      }
      return { x: state.x, z: state.z };
    };
    const rideView = () => { const r = state.ride; return { phase: 'ride', label: '', fare: 0, secs: 0, msg: '🛺 ' + r.name + ' · meter ₹' + RR.meterAt(r.tripDist, r.s) + ' · ' + Math.max(0, Math.ceil((r.dist - r.s) / RR.SPEED)) + ' s', target: null, done: 0 }; };
    const jobView = () => { const j = jobs.cur, ride = j && j.kind === 'ride'; return { phase: j ? j.phase : '', label: j ? (ride ? (j.phase === 'pickup' ? 'Passenger at ' + j.from.name : 'Meter \u20b9' + j.meter + ' \u00b7 to ' + j.to.name) : j.phase === 'pickup' ? 'Collect at ' + j.from.name : 'Deliver to ' + j.to.name) : '', fare: j ? (ride ? j.meter : j.fare) : 0, secs: j && j.phase === 'drop' ? Math.max(0, Math.round(j.dist / 3.6 + 12 - (time - j.t0))) : 0, msg: jobs.msgT > 0 ? jobs.msg : '', target: j ? (j.phase === 'pickup' ? j.from : j.to) : null, done: jobs.done }; };

    /* ---------- what happens when you hit things: dust, speech bubbles, things that rock, a coconut that falls ---------- */
    const puffs = Array.from({ length: 8 }, () => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), new THREE.MeshBasicMaterial({ color: 0xd8cfc0, transparent: true, opacity: 0, depthWrite: false })); m.visible = false; add(m); return { m, t: 0 }; });
    let puffI = 0;
    const dust = (x, y, z) => { for (let k = 0; k < 3; k++) { const p = puffs[puffI++ % puffs.length]; p.m.position.set(x + rr(-0.3, 0.3), y + rr(0, 0.3), z + rr(-0.3, 0.3)); p.t = 0.55; p.m.visible = true; } };
    const wobbles = [], bubbles = [], bubbleTex = {};
    const wobble = (o, amp) => { if (!o) return; let w = wobbles.find((q) => q.o === o); if (!w) { w = { o, t: 0, amp: 0, r0: o.rotation.z }; wobbles.push(w); } w.t = 0.7; w.amp = amp; };
    const speak = (target, text, y, secs) => {
      const tex = bubbleTex[text] || (bubbleTex[text] = canvasTex(256, 72, (x, w, h) => { x.fillStyle = 'rgba(255,255,255,0.95)'; x.beginPath(); if (x.roundRect) x.roundRect(4, 4, w - 8, h - 22, 16); else x.rect(4, 4, w - 8, h - 22); x.fill(); x.beginPath(); x.moveTo(w / 2 - 10, h - 19); x.lineTo(w / 2, h - 4); x.lineTo(w / 2 + 10, h - 19); x.fill(); x.fillStyle = '#222'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = 'bold 30px "Nirmala UI","Noto Sans Malayalam","Kartika",sans-serif'; x.fillText(text, w / 2, (h - 22) / 2 + 4); }));
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })); s.scale.set(2.4, 0.675, 1); s.position.set(0, y || 2.5, 0); s.renderOrder = 10;
      const old = bubbles.find((b) => b.target === target); if (old) { target.remove(old.s); old.s.material.dispose(); bubbles.splice(bubbles.indexOf(old), 1); }
      target.add(s); bubbles.push({ s, target, t: secs || 1.8 });
    };
    const SORRY = ['Sorry!', 'Excuse me!', 'Aiyyo!', 'ക്ഷമിക്കണം!', 'അയ്യോ!', 'ശ്രദ്ധിച്ച്!'], CAREFUL = ['Careful!', 'ശ്രദ്ധിക്കൂ!'], HORN = ['Peep peep!', 'Horn OK please!'];
    /* each kind of thing answers a knock in its own way */
    const react = (b, vx, vz) => {
      const c = b.c, tag = b.kind, s = b.s, l = Math.hypot(vx, vz) || 1; dust(state.x + (vx / l) * 0.5, 0.25, state.z + (vz / l) * 0.5);
      if (tag === 'person' && c.who) { const p = c.who; p.wait = Math.max(p.wait || 0, 1.5); p.g.rotation.y = Math.atan2(-(state.x - p.g.position.x), -(state.z - p.g.position.z)); speak(p.g, pick(SORRY), 2.45, 1.8); }   // the person stops, turns round and says sorry
      else if (tag === 'vehicle') { wobble(c.obj, 0.04 + 0.05 * s); if (c.obj) speak(c.obj, pick(HORN), 3.2, 1.6); }                // the auto or bus rocks and honks
      else if (tag === 'furniture') wobble(c.obj, 0.02 + 0.02 * s);
      else if (tag === 'stall') { wobble(c.obj, 0.03 + 0.03 * s); if (c.obj) speak(c.obj, pick(CAREFUL), 3.0, 1.6); }              // the stall rattles
      else if (tag === 'pole') wobble(c.obj, 0.02 + 0.02 * s);
      else if (tag === 'palm' && c.obj) {                                                                                           // the palm shakes; now and then a coconut drops, once, as an ingredient
        c.obj.userData.shake = 0.8;
        if (time >= (c.obj.userData.nextDrop || 0)) { c.obj.userData.nextDrop = time + 120; const q = addPickup('food', 'coconut', c.x + rr(-1.2, 1.2), c.z + rr(1, 2)); q.once = true; speak(c.obj, 'A coconut fell!', 4.5, 2); }
      }
    };

    /* the light follows the clock: sun colour, strength and height, sky, fog, and the street lamps coming on after dusk */
    const SUN_H = new THREE.Vector3(-34, 0, 20).normalize();
    const applyLight = (h) => {
      const L = window.RoboClock.light(h), e = (L.sun.elev * PI) / 180;
      sun.color.setRGB(L.sun.color[0], L.sun.color[1], L.sun.color[2]); sun.intensity = L.sun.intensity;
      hemi.color.setRGB(L.hemi.sky[0], L.hemi.sky[1], L.hemi.sky[2]); hemi.groundColor.setRGB(L.hemi.ground[0], L.hemi.ground[1], L.hemi.ground[2]); hemi.intensity = L.hemi.intensity;
      scene.background.setRGB(L.bg[0], L.bg[1], L.bg[2]); scene.fog.color.setRGB(L.fog[0], L.fog[1], L.fog[2]);
      const night = clamp((0.55 - L.sky) / 0.3, 0, 1);
      sky.material.color.setScalar(L.sky); skyN.material.opacity = night;                                                          // the day sky dims, and the night dome with its stars fades in
      SUN_OFF.set(SUN_H.x * Math.cos(e) * 45, Math.max(2, Math.sin(e) * 45), SUN_H.z * Math.cos(e) * 45); SUN_DIR.copy(SUN_OFF).normalize();
      glow.material.opacity = clamp((L.sun.elev - 2) / 10, 0, 1) * (h > 5 && h < 19.5 ? 1 : 0);
      for (const m of lampSprites) m.opacity = 0.85 * L.lamps;
      if (rainK > 0) { const w = rainK; sun.intensity *= 1 - 0.55 * w; hemi.intensity *= 1 - 0.2 * w; scene.background.lerp(RAIN_GREY, 0.55 * w); scene.fog.color.lerp(RAIN_GREY, 0.55 * w); sky.material.color.lerp(RAIN_GREY, 0.85 * w).multiplyScalar(1 - 0.15 * w); glow.material.opacity *= 1 - w; }   // a grey, dimmer sky
    };
    const RAIN_GREY = new THREE.Color(0x7d848b);
    /* rain: slanted streaks (thin quads turned to the camera) falling in a box round the walker; none indoors */
    const RAIN_N = low ? 500 : 1200, rainPos = new Float32Array(RAIN_N * 12), rainDrops = Array.from({ length: RAIN_N }, () => [rr(-16, 16), rr(0, 14), rr(-16, 16), rr(24, 34)]);
    const rainIdx = new Uint16Array(RAIN_N * 6); for (let i = 0; i < RAIN_N; i++) rainIdx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 2, i * 4 + 1, i * 4 + 3], i * 6);
    const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3)); rainGeo.setIndex(new THREE.BufferAttribute(rainIdx, 1));
    const rainMesh = new THREE.Mesh(rainGeo, new THREE.MeshBasicMaterial({ color: 0xf2f6fa, transparent: true, opacity: 0, depthWrite: false, fog: false, side: THREE.DoubleSide })); rainMesh.frustumCulled = false; rainMesh.visible = false; scene.add(rainMesh);
    const rainStep = (dt) => {
      const on = rainK > 0.01 && !state.room; rainMesh.visible = on; if (!on) return;
      rainMesh.material.opacity = 0.6 * rainK;
      const rx = Math.cos(state.camYaw) * 0.022, rz = -Math.sin(state.camYaw) * 0.022;   // the streaks' half width, across the view
      for (let i = 0; i < RAIN_N; i++) {
        const d = rainDrops[i]; d[1] -= d[3] * dt; if (d[1] < 0) d[1] += 14;
        const x = state.x + d[0], z = state.z + d[2], y = d[1], j = i * 12;
        rainPos[j] = x - rx; rainPos[j + 1] = y; rainPos[j + 2] = z - rz; rainPos[j + 3] = x + rx; rainPos[j + 4] = y; rainPos[j + 5] = z + rz;
        rainPos[j + 6] = x + 0.18 - rx; rainPos[j + 7] = y + 1.2; rainPos[j + 8] = z - rz; rainPos[j + 9] = x + 0.18 + rx; rainPos[j + 10] = y + 1.2; rainPos[j + 11] = z + rz;
      }
      rainGeo.attributes.position.needsUpdate = true;
    };

    /* ---------- fewer draw calls: join the meshes of every static group (shopfronts, office blocks) that look the same ---------- */
    let mergeInfo = null;
    if (window.RoboMerge && !cb.noMerge) {
      const keep = new Set(fadeables.map((f) => f.m)), r = window.RoboMerge.groups(THREE, staticGroups, keep, 120);
      r.meshes.forEach((m) => { scene.add(m); });
      const gone = (g) => (g.isMesh ? !g.parent : !g.children.length);   // a group with nothing left, or a mesh that was joined into another
      for (const g of staticGroups) if (gone(g)) { scene.remove(g); const i = cullables.indexOf(g); if (i >= 0) cullables.splice(i, 1); }
      mergeInfo = { before: r.before, after: r.after + staticGroups.filter((g) => !gone(g)).length };
    }

    /* ---------- state and per-frame update ---------- */
    const bumps = bumpGate();
    const state = { bounds: BOUNDS, room: null, bike: false, vtype: 'bike', shake: 0, bump: null, area: 'kozhikode', moveYaw: 0, lookT: -9, x: 0, z: 56, vx: 0, vz: 0, yaw: 0, camYaw: 0, speed: 0, camX: 0, camZ: 0, init: false };
    const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), tmpV = new THREE.Vector3();
    let time = 0, lastNear = null, camBoxes = null;
    /* the props that wobble when bumped (stalls, carts, autos, buses): joined in place, so each still moves as one. Anything the builders' frame hooks move is found by running them for a few seconds first and left alone. */
    let propInfo = null;
    if (window.RoboMerge && !cb.noMerge) {
      try {
        const st = new Set(staticGroups), cr = new Set(crowns), cand = cullables.filter((g) => g.isGroup && !st.has(g) && !cr.has(g) && !noMerge.has(g) && g.parent && (g.parent === scene || (g.parent.userData && g.parent.userData.oz !== undefined)));
        const sig = (g) => { const a = []; g.traverse((o) => { if (o === g) return; a.push(o.position.x, o.position.y, o.position.z, o.rotation.x, o.rotation.y, o.rotation.z, o.scale.x, o.visible ? 1 : 0); }); return a; };
        const before = cand.map(sig); for (let k = 0; k < 10; k++) for (const f of frameHooks) f(0.5);
        const keep = new Set(fadeables.map((f) => f.m)); let a0 = 0, a1 = 0, moved = 0;
        cand.forEach((g, i) => { const s2 = sig(g); if (s2.length !== before[i].length || s2.some((v, j) => Math.abs(v - before[i][j]) > 1e-6)) { moved++; return; } const r = window.RoboMerge.inPlace(THREE, g, keep); a0 += r.before; a1 += r.after; });
        propInfo = { groups: cand.length, left: moved, before: a0, after: a1 };
      } catch (err) { propInfo = { error: String(err && err.message || err) }; }
    }
    const api = {
      scene, state, hemi, sun, sky, pickups, persons, spots,
      /* walking into a building and back out */
      enterRoom(id, from) { const R = rooms[id]; if (!R) return; if (state.bike) { bikePark = { x: state.x, z: state.z, yaw: state.yaw, type: state.vtype }; state.bike = false; state.bs = 0; } state.doorFrom = from && from.kind === 'door' ? { area: areaOf(from.x), x: from.x, z: from.z } : null; state.room = R; state.area = 'interior'; state.bounds = R.bounds; state.x = R.spawn[0]; state.z = R.spawn[1]; state.vx = state.vz = 0; state.camYaw = 0; state.init = false; jobs.cur = null; setBeam(null); cb.onFade && cb.onFade(R.title); },
      exitRoom() { const R = state.room, E = R && (state.doorFrom || exits[R.id]); if (!E) return;   // back out of the door you came in by (Robo's dock has one in Manjeri and one on the beach)
        state.area = E.area; state.bounds = walkBounds(state.area); state.room = null; state.x = E.x; state.z = E.z; state.vx = state.vz = 0; state.camYaw = 0; state.init = false; cb.onFade && cb.onFade(''); },
      /* a KSRTC ride to another area: the walker appears at that area's bus station */
      /* an auto ride from one stand to another along the road, in the left lane: the meter starts at the base fare and ticks up to the prepaid fare */
      startRide(fromId, toId) {
        if (!RR || !rideRig || state.ride || state.room) return false;
        const tr = RR.tripsFrom(fromId).find((x) => x.to === toId); if (!tr) return false;
        const pts = RR.laneOffset(tr.points, 1.0); jobs.cur = null; state.bike = false; bikePark = null; returnVehicles(); endJobWp(); setBeam(null);
        state.ride = { pts, dist: RR.length(pts), s: 0, t: 0, name: tr.name, fare: tr.fare, tripDist: tr.dist, to: toId }; rideRig.g.visible = true; return true;
      },
      /* a bus (or any) trip between towns: arrive at the given point, or at the area's spawn */
      /* a test helper: stand at (x, z) in the same area, keeping the job, the vehicle and the room as they are */
      carCircles() { return colliders.filter((q) => q.dyn && q.tag === 'vehicle').map((q) => [q.x, q.z, q.r]); },   /* a test helper: where the moving vehicles are solid */
      moveTo(x, z) { state.x = x; state.z = z; state.vx = state.vz = 0; state.bs = 0; },
      travelTo(id, ax, az) { const a = AREAS[id]; if (!a) return; if (!isActive(id)) { cb.onNote && cb.onNote({ title: 'Not open yet', emoji: '🚧', body: a.name + ' opens in a later version. For now the game is Manjeri.', src: '' }); return; } clearWp(); state.bike = false; bikePark = null; returnVehicles(); state.ride = null; if (rideRig) rideRig.g.visible = false; state.area = id; state.bounds = walkBounds(state.area); state.room = null; state.x = ax !== undefined ? ax : a.spawn[0]; state.z = az !== undefined ? az : a.spawn[1]; state.vx = state.vz = 0; state.camYaw = 0; state.init = false; jobs.cur = null; setBeam(null); cb.onTravel && cb.onTravel(a.name); },
      /* self-check for tests: pickups a walker cannot stand on, and walker waypoints inside walls */
      audit() {
        const solids = colliders.filter((q) => !q.dyn), hit = (x, z, r) => solids.some((q) => pushOut(x, z, r, q));
        const badPickups = pickups.filter((q) => hit(q.x, q.z, 0.45)).map((q) => [q.kind, q.id, Math.round(q.x * 10) / 10, Math.round(q.z * 10) / 10]);
        const badSpots = spots.filter((p) => !p.quiet && hit(p.x, p.z, 0.45)).map((p) => p.label + ' @' + Math.round(p.x) + ',' + Math.round(p.z)); const badJobPoints = Object.values(JOB_AREAS).reduce((a, s) => a.concat(s.points), []).concat(DESKS).filter((p) => hit(p.x, p.z, 0.45)).map((p) => p.name || 'desk'); const badRoutes = []; persons.forEach((p, i) => { if (!p.route) return; const R = p.route; for (let k = 0; k < R.length; k++) { const a = R[k], b = R[(k + 1) % R.length], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]))); for (let j = 0; j <= n; j++) { const x = a[0] + ((b[0] - a[0]) * j) / n, z = a[1] + ((b[1] - a[1]) * j) / n; const bc = solids.find((q) => pushOut(x, z, 0.3, q)); if (bc) { badRoutes.push([i + ' from ' + R[0].map(Math.round) + ' to ' + R[1].map(Math.round), [Math.round(x * 10) / 10, Math.round(z * 10) / 10], bc.tag, bc.t === 'box' ? [bc.x0, bc.x1, bc.z0, bc.z1] : [bc.x, bc.z, bc.r]]); break; } } } });
        return { pickups: pickups.length, people: persons.length, solids: solids.length, badPickups, badRoutes, badJobPoints, badSpots };
      },
      /* the player's character is added to the town scene by the engine; place it at the south end of the street, facing north */
      setWaypoint(x, z, name) { setWp(x, z, name); },
      clearWaypoint() { clearWp(); },
      setStory(on) { setStoryCast(!!on); if (!on && wp.cur && storyCast.some((k) => Math.hypot(k.sp.x - wp.cur.x, k.sp.z - wp.cur.z) < 0.5)) clearWp(); },
      getWaypoint() { return wp.cur; },
      /* the bike's horn (H, or by itself when someone is right ahead): people within 9 m in front stop and say sorry; returns true when it honked */
      horn() { if (!state.bike) return false; state.lastHorn = time; const cy2 = Math.cos(state.yaw), sy2 = Math.sin(state.yaw); for (const q of persons) { const dx = q.g.position.x - state.x, dz = q.g.position.z - state.z, ahead = -dx * sy2 - dz * cy2; if (q.g.visible && ahead > 0 && ahead < 9 && Math.abs(dx * cy2 - dz * sy2) < 3) { q.wait = Math.max(q.wait || 0, 2.2); speak(q.g, pick(SORRY), 2.45, 1.6); } } cb.onHorn && cb.onHorn(); return true; },
      route(x, z) { return routeTo(x, z); },   // the path from where you stand to a spot (for the map's preview)
      setRain(k) { rainK = clamp(Number(k) || 0, 0, 1); },
      rainInfo() { return { k: rainK, visible: rainMesh.visible, opacity: rainMesh.material.opacity, lit: lastWet, sun: sun.intensity }; },
      enter() { clearWp(); state.ride = null; if (rideRig) rideRig.g.visible = false; state.area = 'manjeri'; state.bounds = walkBounds(state.area); state.room = null; state.x = MANJERI_X; state.z = 14;   // the game starts in Manjeri, the central town, at the KSRTC station end of the main road
        state.vx = state.vz = 0; state.yaw = 0; state.camYaw = 0; state.init = false; pickups.forEach((p) => { if (!p.on) { p.on = true; p.o.visible = true; } }); },
      /* inp: { x, y: stick -1..1, act: edge-triggered, look: camera yaw change in radians } */
      step(dt, inp) {
        time += dt; state.camYaw += (inp.look || 0); if (inp.look) state.lookT = time;
        if (!(inp.x || inp.y) || inp.look) state.moveYaw = inFollowZone(state.x, state.z) ? snapYaw(state.camYaw) : state.camYaw;   // where the camera follows the walker, "forward" is a straight street direction even if the camera is still turning   // the stick keeps the direction it was pressed in while the follow camera swings round
        const sv = stick(inp.x || 0, inp.y || 0, state.moveYaw), d = snapAxis(sv.x, sv.z), mag = Math.min(1, Math.hypot(inp.x || 0, inp.y || 0)), tv = (inp.run ? 6.6 : 4.2) * (inp.mul || 1) * mag * (state.bike ? 2.1 : 1), k = 1 - Math.exp(-(state.bike ? 4.5 : 12) * dt);   // on the bike it speeds up and slows down more slowly: it has weight
        if (state.bike && !state.room && !state.ride) {   // on the bike: throttle and steering; the camera swings round behind it
          const bd = bikeDrive(state.bs || 0, Math.max(-1, Math.min(1, inp.y || 0)), Math.max(-1, Math.min(1, inp.x || 0)), dt, (state.vtype === 'auto' ? (inp.run ? 9 : 7.2) : (inp.run ? 13 : 9.5)) * (inp.mul || 1), state.vtype === 'auto' ? 0.7 : 1);
          state.bs = bd.v; state.yaw += bd.turn * dt; state.vx = -Math.sin(state.yaw) * state.bs; state.vz = -Math.cos(state.yaw) * state.bs;
          if (!inp.look && time - state.lookT > 0.8) { let dc = (inFollowZone(state.x, state.z) ? snapYaw(state.yaw) : state.yaw) - state.camYaw;   /* in a street the camera lines up with the street, not with a heading that may point at the shop fronts */
           dc = Math.atan2(Math.sin(dc), Math.cos(dc)); state.camYaw += dc * Math.min(1, dt * 3.2); }
        } else { state.bs = 0; state.vx += (d.x * tv - state.vx) * k; state.vz += (d.z * tv - state.vz) * k; }
        let i = 0; for (const p of persons) if (p.route) { const c = npcCircles[i++]; c.x = p.g.position.x; c.z = p.g.position.z; }
        const p = state.ride ? rideMove(dt) : move({ x: state.x, z: state.z }, state.vx, state.vz, dt, state.bike && state.vtype === 'auto' ? 0.85 : 0.45, colliders, state.bounds);
        const bumped = state.ride ? null : bumps.step(dt, p); if (bumped) { state.shake = Math.max(state.shake, 0.06 + 0.18 * bumped.s); state.bump = { kind: bumped.kind, s: bumped.s }; react(bumped, state.vx, state.vz); }
        const dx = p.x - state.x, dz = p.z - state.z; state.x = p.x; state.z = p.z; state.speed = Math.hypot(dx, dz) / Math.max(dt, 1e-4);
        if (!state.room && !state.ride) { const a = areaOf(state.x); if (a !== state.area) state.area = a; }   // walking from one area into the next changes the area
        if (!state.bike && Math.hypot(state.vx, state.vz) > 0.4) { const ty = Math.atan2(-state.vx, -state.vz); let dy = ty - state.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); state.yaw += dy * Math.min(1, dt * 11); }
        {
          const here = !state.room && !state.ride, vt = state.bike ? state.vtype : bikePark ? bikePark.type : null, px = state.bike ? state.x : bikePark ? bikePark.x : 0, pz = state.bike ? state.z : bikePark ? bikePark.z : 0, py = state.bike ? state.yaw : bikePark ? bikePark.yaw : 0;
          bikeM.visible = !!(here && vt === 'bike'); if (bikeM.visible) { bikeM.position.set(px, 0, pz); bikeM.rotation.y = py; }
          driveAuto.g.visible = !!(here && vt === 'auto'); if (driveAuto.g.visible) { driveAuto.g.position.set(px + Math.sin(py) * 0.55, 0, pz + Math.cos(py) * 0.55); driveAuto.g.rotation.y = py; }   // the robot sits at the handlebar, a little ahead of the middle
          const jc = jobs.cur, atPick = !!(jc && jc.phase === 'pickup' && !state.room), wi = jc ? (Math.floor(jc.dist) % waiters.length) : 0;
          waiters.forEach((p, i) => { p.g.visible = !!(atPick && jc.kind === 'ride' && i === wi); }); if (atPick && jc.kind === 'ride') { const w = waiters[wi]; w.g.position.set(jc.from.x + 0.9, 0.05, jc.from.z + 0.4); w.g.rotation.y = Math.atan2(-(state.x - jc.from.x), -(state.z - jc.from.z)); w.update(time, dt, false); }
          parcelBox.visible = !!(atPick && jc.kind !== 'ride'); if (parcelBox.visible) parcelBox.position.set(jc.from.x + 0.7, 0, jc.from.z + 0.3);
          const jr = jobs.cur; driveAuto.pax.g.visible = !!(jr && jr.kind === 'ride' && jr.phase === 'drop'); if (driveAuto.pax.g.visible) driveAuto.pax.update(time, dt, false);
        }
        if (state.bike && state.speed > 3 && time - (state.lastHorn || -9) > 2.2) { const cy2 = Math.cos(state.yaw), sy2 = Math.sin(state.yaw); if (persons.some((q) => { const dx = q.g.position.x - state.x, dz = q.g.position.z - state.z, ahead = -dx * sy2 - dz * cy2; return q.g.visible && ahead > 0.5 && ahead < 6 && Math.abs(dx * cy2 - dz * sy2) < 1.6; })) api.horn(); }   // a person right ahead: the bike honks by itself
        const fy = state.bike ? null : followYaw(state.x, state.z, state.vx, state.vz);
        if (fy !== null && time - state.lookT > 1.5) { let dy = fy - state.camYaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); state.camYaw += dy * Math.min(1, dt * 2.4); }
        // people
        for (const q of persons) {
          const near = Math.abs(q.g.position.x - state.x) < 58 && Math.abs(q.g.position.z - state.z) < 58; q.g.visible = near && !q.off; if (!near) continue;
          if (q.lod) { const pd = Math.hypot(q.g.position.x - state.x, q.g.position.z - state.z); q.lod(q.isFar === undefined ? pd > 16 : q.isFar ? pd > 14.5 : pd > 17.5); }   /* a person swaps between the full model and the joined one at about 16 m; the two limits differ by 3 m so a person (or you) hovering at the line does not flicker between them */
          if (q.ctrl) { q.update(time, dt, !!q.moving); continue; }   /* a footballer: the turf game moves him */
          if (q.route) {
            const tp = q.route[q.i], px2 = q.g.position.x, pz2 = q.g.position.z, ddx = tp[0] - px2, ddz = tp[1] - pz2, dist = Math.hypot(ddx, ddz);
            if (q.wait > 0) { q.wait -= dt; q.update(time, dt, false); continue; }
            if (dist < 0.3) { q.i = (q.i + 1) % q.route.length; q.wait = rnd() < 0.3 ? rr(1.5, 4) : 0; q.update(time, dt, false); continue; }
            q.g.position.x += (ddx / dist) * q.speed * dt; q.g.position.z += (ddz / dist) * q.speed * dt;
            let dy = Math.atan2(-ddx, -ddz) - q.g.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); q.g.rotation.y += dy * Math.min(1, dt * 6); q.update(time, dt, true);
          } else q.update(time, dt, false);
        }
        // pickups
        for (const q of pickups) {
          if (!q.on) { if (q.once) continue; q.t += dt; if (q.t > 90) { q.on = true; q.o.visible = true; } continue; }   // a fallen coconut is a one-off
          q.o.visible = Math.abs(q.x - state.x) < 52 && Math.abs(q.z - state.z) < 52; if (!q.o.visible) continue;   /* coins, food and scrap past 52 m are not drawn */
          q.o.rotation.y = time * 2.2 + q.x; q.o.position.y = 1.0 + Math.sin(time * 2.6 + q.z) * 0.1;
          if ((q.nextTry || 0) > time) continue;
          if (Math.hypot(q.x - state.x, q.z - state.z) < 1.05) {
            if (q.kind === 'scrap' && cb.onScrap && !cb.onScrap(q.id)) { q.nextTry = time + 2.5; continue; }   // the scrap bag is full: it stays where it is
            q.on = false; q.t = 0; q.o.visible = false; if (q.kind === 'coin') cb.onCoin && cb.onCoin(1); else if (q.kind === 'food') cb.onFood && cb.onFood(q.id);
          }
        }
        const near0 = state.ride ? null : nearest(state, spots); jobStep(dt, near0, inp.act);
        let near = near0; if (!near && !state.ride && !state.room) { const vn = (state.bike ? state.vtype : bikePark && bikePark.type) === 'auto' ? 'auto' : 'bike'; if (state.bike) near = { kind: 'bike', label: 'Get off the ' + vn, emoji: vn === 'auto' ? '🛺' : '🛵' }; else if (bikePark && Math.hypot(state.x - bikePark.x, state.z - bikePark.z) < (bikePark.type === 'auto' ? 3.4 : 2.6)) near = { kind: 'bike', label: 'Get on the ' + vn, emoji: vn === 'auto' ? '🛺' : '🛵' }; }
        lastNear = near;
        if (inp.act && near && near.kind === 'bike') { if (state.bike) { bikePark = { x: state.x, z: state.z, yaw: state.yaw, type: state.vtype }; state.bike = false; state.bs = 0; } else { state.bike = true; state.vtype = bikePark.type || 'bike'; bikePark = null; } }
        else if (inp.act && near && near.kind === 'drive' && near.obj) mountSpot(near);
        else if (inp.act && near && near.kind === 'drive') { if (jobs.cur || state.bike) toast('Finish the delivery first, or get off.'); else { state.bike = true; state.vtype = 'auto'; bikePark = null; state.bs = 0; toast('You have an auto. Take the desk to get a passenger.'); } }
        else if (inp.act && near) { if (near.kind === 'job') { /* handled by jobStep */ } else if (near.kind === 'note') cb.onNote && cb.onNote(NOTES[near.arg]); else if (near.kind === 'travel') api.travelTo(near.arg); else if (near.kind === 'door') api.enterRoom(near.arg, near); else if (near.kind === 'exit') api.exitRoom(); else if (near.kind === 'menu') cb.onMenu && cb.onMenu(near.arg); else if (near.kind === 'shop') cb.onShop && cb.onShop(near.arg); else if (near.kind === 'charge') cb.onCharge && cb.onCharge(near.arg); else if (near.kind === 'talk') cb.onTalk && cb.onTalk(near.arg); else if (near.kind === 'gate') cb.onGate && cb.onGate(); else if (near.kind === 'kick' && near.use) near.use(); }
        return { x: state.x, z: state.z, yaw: state.yaw, speed: state.speed, place: state.room ? state.room.title + ' · ' + state.room.local : placeName(state.x, state.z), area: state.area, camYaw: state.camYaw, climate: state.room ? (state.doorFrom ? state.doorFrom.area : exits[state.room.id] ? exits[state.room.id].area : 'kozhikode') : state.area, bump: (() => { const b = state.bump; state.bump = null; return b; })(), bike: !!(state.bike && !state.room && !state.ride), y: state.ride ? 0.32 : 0, job: state.ride ? rideView() : jobView(), near: near ? { kind: near.kind, label: near.kind === 'job' && jobs.cur ? (jobs.cur.kind === 'ride' ? 'Cancel the trip' : 'Cancel delivery') : near.kind === 'job' && state.bike && state.vtype === 'auto' ? 'Get a passenger' : near.label, emoji: near.emoji, arg: near.arg } : null };
      },
      /* third-person camera behind the walker; kept inside the street while between the shopfronts */
      visuals(camera, dt, aspect, hours) {
        rainStep(dt); if (water) water.step(dt, rainK, { x: state.x, z: state.z, speed: state.speed, bike: state.bike }, !!state.room);
        if (hours != null && window.RoboClock && (Math.abs(hours - lastLightH) > 0.004 || Math.abs(rainK - lastWet) > 0.02)) { applyLight(hours); lastLightH = hours; lastWet = rainK; }
        sky.position.copy(camera.position); skyN.position.copy(camera.position); glow.position.set(camera.position.x + SUN_DIR.x * 200, camera.position.y + SUN_DIR.y * 200, camera.position.z + SUN_DIR.z * 200);
        sun.position.set(state.x + SUN_OFF.x, SUN_OFF.y, state.z + SUN_OFF.z); sun.target.position.set(state.x, 0, state.z);
        const dist = (state.room ? (aspect < 0.8 ? 6.4 : 5.8) : aspect < 0.8 ? 9.5 : 7.4) + (state.bike && !state.room ? (state.vtype === 'auto' ? 3.4 : 2.4) : 0), h = (state.room ? (aspect < 0.8 ? 11.5 : 9.6) : aspect < 0.8 ? 4.6 : 3.7) + (state.bike && !state.room ? 0.7 : 0), cy = state.camYaw;
        let tx = state.x + Math.sin(cy) * dist, tz = Math.min(state.z + Math.cos(cy) * dist, 96);
        if (!camBoxes) camBoxes = colliders.filter((q) => q.t === 'box' && (q.x1 - q.x0) * (q.z1 - q.z0) >= 20);   // only buildings: the camera rides above stalls and low walls
        let hc = h; if (state.room) { /* above the walls, looking down into the room */ } else for (let t = 1; t >= 0.25; t -= 0.08) { const ox = state.x + (tx - state.x) * t, oz = state.z + (tz - state.z) * t; hc = h * (0.5 + 0.5 * t); if (camBoxes.every((q) => !pushOut(ox, oz, 1.5, q)) || t < 0.33) { tx = ox; tz = oz; break; } }   // pull the camera in along its line until it is clear of walls and shopfronts
        const k = state.init ? 1 - Math.exp(-6 * dt) : 1; state.init = true;
        camPos.x += (tx - camPos.x) * k; camPos.y += (hc - camPos.y) * k; camPos.z += (tz - camPos.z) * k;
        camera.position.copy(camPos); camLook.set(state.x, 1.5, state.z); camera.lookAt(camLook);
        if (state.shake > 0.002) { camera.position.x += (Math.random() - 0.5) * state.shake; camera.position.y += (Math.random() - 0.5) * state.shake * 0.7; state.shake *= Math.max(0, 1 - 9 * dt); }
        for (const f of fadeables) {   // an awning between the camera and the walker lets the walker show through
          const near = Math.abs(f.x0 - state.x) < 30 && Math.abs(f.z0 - state.z) < 30; if (!near && f.k >= 1) continue;
          const hide = near && segHitsRect(camera.position.x, camera.position.z, state.x, state.z, f.x0 - 0.2, f.x1 + 0.2, f.z0 - 0.2, f.z1 + 0.2);
          f.k += ((hide ? 0.18 : 1) - f.k) * Math.min(1, dt * 9); f.m.material.opacity = f.k; f.m.material.depthWrite = f.k > 0.95;
        }
        for (const g of cullables) { const u = g.userData, fz = (g.parent && g.parent.userData && g.parent.userData.oz) || 0; const R = u.crown ? 66 : 92;   /* a palm is three batches and tall: past 66 m the fog has taken most of it */
          g.visible = u.x === undefined || (inOpen(u.x, u.z + fz) && Math.abs(u.x - state.x) < R && Math.abs(u.z + fz - state.z) < R); }
        for (const f of frameHooks) f(dt);
        for (const p of puffs) if (p.t > 0) { p.t -= dt; const k = 1 - Math.max(0, p.t) / 0.55; p.m.scale.setScalar(0.3 + k * 1.2); p.m.material.opacity = 0.5 * (1 - k); if (p.t <= 0) p.m.visible = false; }
        for (const w of wobbles) if (w.t > 0) { w.t -= dt; w.o.rotation.z = w.r0 + Math.sin(w.t * 28) * w.amp * Math.max(0, w.t / 0.7); if (w.t <= 0) w.o.rotation.z = w.r0; }
        for (let i = bubbles.length - 1; i >= 0; i--) { const b = bubbles[i]; b.t -= dt; b.s.material.opacity = Math.min(1, b.t / 0.4); if (b.t <= 0) { b.target.remove(b.s); b.s.material.dispose(); bubbles.splice(i, 1); } }
        for (const p of crowns) if (p.visible) { const u = p.userData, sh = u.shake > 0 ? (u.shake -= dt) * 0.12 : 0; u.crown.rotation.set(Math.cos(time * 0.9 + u.phase) * 0.025 + sh * Math.sin(time * 25), 0, Math.sin(time * 1.1 + u.phase) * 0.03 + sh * Math.cos(time * 22)); }
        for (const m of sway) { const p = m.position; m.visible = Math.abs(p.x - state.x) < 48 && Math.abs(p.z - state.z) < 48; if (!m.visible) continue;   /* a marker past 48 m is lost in the fog: not drawn */
          m.userData.d.position.y = 2.9 + Math.sin(time * 2.4) * 0.12; m.userData.d.rotation.y = time * 1.6; m.userData.m.material.opacity = 0.55 + 0.25 * Math.sin(time * 3); }
        seaBump.offset.set(time * 0.01, time * 0.02); foam.material.opacity = 0.45 + 0.2 * Math.sin(time * 0.9); foam.position.z = 100.4 + Math.sin(time * 0.8) * 0.7;
      }
    };
    camPos.set(0, 4, 63);
    /* water: puddles, rings, drips and splashes (explore_water.js); built last, so the puddles keep clear of every wall, stall and parked vehicle */
    const water = (() => {
      if (!window.RoboExploreWater) return null;
      const Z = [['kozhikode', 0, [[-2.8, 2.8, -65, 58]], 20], ['city', CITY_X, [[CITY_X - 2.8, CITY_X + 2.8, -55, 55]], 20], ['hilite', HILITE_X, [[HILITE_X - 2.8, HILITE_X + 2.8, -55, 40]], 16], ['wayanad', WAYANAD_X, [[WAYANAD_X - 2.8, WAYANAD_X + 2.8, -50, 55]], 14],
        ['manjeri', MANJERI_X, [[MANJERI_X - 2.8, MANJERI_X + 2.8, -130, 100], [MANJERI_X + 8, MANJERI_X + 90, -2.8, 2.8], [MANJERI_X - 90, MANJERI_X - 8, -2.8, 2.8], [MANJERI_X + 37.2, MANJERI_X + 42.8, -125, -60]], 46],
        ['malappuram', MALAPPURAM_X, [[MALAPPURAM_X - 2.8, MALAPPURAM_X + 2.8, -90, 80], [MALAPPURAM_X + 8, MALAPPURAM_X + 90, -2.8, 2.8], [MALAPPURAM_X - 76, MALAPPURAM_X - 8, -2.8, 2.8]], 26]].filter((z) => isActive(z[0])).map((z) => ({ rects: z[2], n: z[3] }));
      return window.RoboExploreWater.build({ THREE, scene, colliders, fadeables, zones: Z, rnd, surfaces: [asphaltMat, paverMat], onSplash: () => { cb.onSplash && cb.onSplash(); }, onDrip: () => { cb.onDrip && cb.onDrip(); } });
    })();
    api.waterInfo = () => (water ? water.info() : null); api.setWet = (v) => { if (water) water.setWet(v); };
    api.mergeInfo = () => ({ statics: mergeInfo, props: propInfo });
    return api;
  }

  window.RoboExplore = { move, bumpGate, nearest, stick, snapAxis, snapYaw, placeName, AREAS, followYaw, fare, tip, pickJob, segHitsRect, bikeDrive, namedJob, inFollowZone, streetYaw, layout: { world: WORLD, hwZ: HW_Z, churamX: CHURAM_X, wayanadX: WAYANAD_X, bounds: BOUNDS, streetX: STREET_X, z0: STREET_Z0, z1: STREET_Z1, laneZ: LANE_Z, maps: ACTIVE && ACTIVE.indexOf('city') < 0 ? Object.assign({}, MAPS, { world: undefined }) : MAPS,   // Manjeri alone: the round map is Manjeri's own, not the whole world's
         manjeriX: MANJERI_X }, create };
})();
