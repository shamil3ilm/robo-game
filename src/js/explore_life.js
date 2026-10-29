/* Robo Run: the life of the walkable town. Exposes window.RoboExploreLife = { build(c), registerTrain(onFrame, group, x0), pure }.
   Everything that moves by itself and is not a person walking a route (those are in explore.js): traffic on the side roads, animals that wander, birds, butterflies, crabs, an aeroplane now and then, clouds, boats on the sea, and the train that comes and goes at the city station.
   The rules are pure functions (`pure`, tested in Node by tests/life.test.js); the rest builds small low-poly models and calls the rules every frame. Far things are not updated, so the cost stays low on a phone.
   c is the town context from explore.js: { THREE, scene, add, mat, box, rr, pick, kit, V, cullables, onFrame, player(), people(), circle(), low, X: { area: x of its centre } } */
(function () {
  'use strict';
  if (window.RoboExploreLife) return;   // the page loads its scripts twice
  const PI = Math.PI, TAU = PI * 2;

  /* ---------------- pure rules ---------------- */
  /* a vehicle on a straight street: v = { x: lane, pos: along the street (z), dir: +1 or -1, speed, cur, lo, hi }; `ahead` is the free road in front of it in metres.
     It slows to a stop for anything within 9 m, speeds up again when the road is clear, and starts again at the other end of the street. */
  const stepVehicle = (v, dt, ahead) => {
    const want = ahead < 4 ? 0 : ahead < 9 ? v.speed * (ahead - 4) / 5 : v.speed, k = 1 - Math.exp(-(want < v.cur ? 5 : 1.5) * dt);
    v.cur += (want - v.cur) * k; if (v.cur < 0.05) v.cur = 0;
    v.pos += v.dir * v.cur * dt; if (v.pos > v.hi) v.pos = v.lo; else if (v.pos < v.lo) v.pos = v.hi;
    return v;
  };
  /* free road in front of v given things at (x, z) with a radius: the distance to the nearest one in the lane ahead, or Infinity */
  const freeAhead = (v, things) => {
    let best = Infinity;
    for (const t of things) { const along = (t.z - v.pos) * v.dir - (t.r || 0.4) - 1.6, side = Math.abs(t.x - v.x); if (along > -1.6 && side < 1.15 + (t.r || 0.4) && along < best) best = Math.max(0, along); }
    return best;
  };
  /* an animal that wanders around its home: a = { x, z, home: {x, z}, range: {x, z}, speed, wait, tx, tz }; returns true while it is walking. rnd: 0..1 */
  const stepAnimal = (a, dt, rnd) => {
    if (a.wait > 0) { a.wait -= dt; return false; }
    if (a.tx === undefined) { a.tx = a.home.x + (rnd() * 2 - 1) * a.range.x; a.tz = a.home.z + (rnd() * 2 - 1) * a.range.z; }
    const dx = a.tx - a.x, dz = a.tz - a.z, d = Math.hypot(dx, dz);
    if (d < 0.25) { a.wait = 1.5 + rnd() * 5; a.tx = undefined; return false; }
    const s = Math.min(d, a.speed * dt); a.x += dx / d * s; a.z += dz / d * s; a.yaw = Math.atan2(dx, dz); return true;
  };
  /* the aeroplane: waits 30 to 70 s, then crosses the sky in `dur` seconds, alternating direction. p = { wait, u, dir, dur }; returns p */
  const stepPlane = (p, dt, rnd) => {
    if (p.u > 0) { p.u += dt / p.dur; if (p.u >= 1) { p.u = 0; p.wait = 30 + rnd() * 40; p.dir = -p.dir; } }
    else if (p.wait > 0) p.wait -= dt; else p.u = 1e-6;
    return p;
  };
  /* the train: parked 25 s, pulls out (speeding up to 14 m/s) until it is 110 m away, is away 30 s, then rolls in from the other side and brakes to a stop at x = 0. t = { state, x, v, wait } */
  const stepTrain = (t, dt) => {
    if (t.state === 'parked') { t.wait -= dt; if (t.wait <= 0) { t.state = 'leaving'; t.v = 0; } }
    else if (t.state === 'leaving') { t.v = Math.min(14, t.v + 1.6 * dt); t.x += t.v * dt; if (t.x > 110) { t.state = 'away'; t.wait = 30; } }
    else if (t.state === 'away') { t.wait -= dt; if (t.wait <= 0) { t.state = 'arriving'; t.x = -110; } }
    else { const d = -t.x; t.v = Math.max(0.6, Math.min(14, Math.sqrt(2 * 2.4 * d))); t.x = Math.min(0, t.x + t.v * dt); if (t.x >= 0) { t.x = 0; t.v = 0; t.state = 'parked'; t.wait = 25; } }
    return t;
  };
  /* a flock bird circling a centre: position at time t */
  const circle = (cx, cz, r, w, t, ph) => ({ x: cx + Math.cos(t * w + ph) * r, z: cz + Math.sin(t * w + ph) * r, yaw: -(t * w + ph) });
  /* a moving vehicle is solid: a few circles along its length, [distance along it, radius] (the player is 0.45 m wide). Where circle i stands, given the vehicle's place: an 'x' axis vehicle drives east-west, its `pos` is its x and its `x` is its lane's z. */
  const BODY = { car: [[-1.05, 0.95], [1.05, 0.95]], auto: [[-0.45, 0.7], [0.45, 0.7]], scooter: [[0, 0.5]], bus: [[-3.6, 1.35], [0, 1.35], [3.6, 1.35]], lorry: [[-3, 1.3], [0, 1.3], [3, 1.3]] };
  const body = (kind) => BODY[kind] || BODY.car;
  const bodyAt = (v, i) => { const off = body(v.kind)[i][0]; return v.axis === 'x' ? { x: v.pos + off, z: v.x } : { x: v.x, z: v.pos + off }; };
  const pure = { stepVehicle, freeAhead, stepAnimal, stepPlane, stepTrain, circle, body, bodyAt };

  /* ---------------- the models ---------------- */
  function build(c) {
    const { THREE, add, mat, rr, pick, kit, V, cullables, onFrame, player, people, X, addCollider } = c;
    const near = (x, z, d) => { const p = player(); return Math.abs(p.x - x) < d && Math.abs(p.z - z) < d; };
    const bx = (w, h, d, m, x, y, z, parent) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; (parent || c.scene).add(o); return o; };
    let T = 0;
    const sprite = (draw, w, h, sc) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h); const t = new THREE.CanvasTexture(cv); return new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, fog: false }); };
    const dark = mat(0x1d1d1d, { roughness: 0.6 });

    /* ---- traffic on the side roads: autos, scooters, cars, keeping left (east lane south, west lane north), stopping for people and parked things ---- */
    const makeAuto = () => { const g = new THREE.Group(), yel = mat(0xe8b81c, { roughness: 0.5 }), wheel = new THREE.CylinderGeometry(0.28, 0.28, 0.16, 14).rotateZ(PI / 2);
      bx(1.25, 0.55, 2.0, dark, 0, 0.62, 0.1, g); bx(1.25, 0.12, 2.1, yel, 0, 1.3, 0.12, g); bx(0.5, 0.35, 0.5, dark, 0, 0.9, -1.1, g); bx(0.18, 0.12, 0.05, mat(0xfff2c0), 0, 0.92, -1.37, g);
      [-0.58, 0.58].forEach((px) => { bx(0.05, 0.7, 0.05, yel, px, 0.95, -0.85, g); bx(0.05, 0.7, 0.05, yel, px, 0.95, 1.1, g); });
      [[-0.6, 0.28, 0.9], [0.6, 0.28, 0.9], [0, 0.28, -1.0]].forEach(([wx, wy, wz]) => { const w = new THREE.Mesh(wheel, dark); w.position.set(wx, wy, wz); g.add(w); }); return g; };
    const makeCar = (col) => { const g = new THREE.Group(), wheel = new THREE.CylinderGeometry(0.34, 0.34, 0.2, 14).rotateZ(PI / 2);
      bx(1.8, 0.7, 4.0, mat(col, { roughness: 0.4, metalness: 0.3 }), 0, 0.7, 0, g); bx(1.6, 0.6, 2.0, mat(0x24405a, { roughness: 0.2, metalness: 0.4 }), 0, 1.3, -0.1, g);
      [[-0.9, 1.3], [0.9, 1.3], [-0.9, -1.3], [0.9, -1.3]].forEach(([wx, wz]) => { const w = new THREE.Mesh(wheel, dark); w.position.set(wx, 0.34, wz); g.add(w); }); return g; };
    const traffic = [];
    const track = (v) => { v.cs = body(v.kind).map(([, r], i) => { const p = bodyAt(v, i), c = { t: 'circle', x: p.x, z: p.z, r, tag: 'vehicle', obj: v.m, dyn: true }; addCollider(c); return c; }); };   /* solid: you cannot walk through a moving car */
    const road = (ox, lx, z0, z1, kinds) => {
      kinds.forEach((kind, i) => {
        const dir = i % 2 ? -1 : 1, m = kind === 'auto' ? makeAuto() : kind === 'scooter' ? (() => { const s = kit.ride('scooter'); s.scale.setScalar(0.85); return s; })() : makeCar(pick([0xb8352a, 0x2b4a7a, 0xe8e4da, 0x4a6a4a]));
        const v = { x: ox + lx + dir * -1.35, pos: z0 + (z1 - z0) * (i / kinds.length) + rr(-3, 3), dir, speed: kind === 'scooter' ? 6 : kind === 'car' ? 7 : 5, cur: 0, lo: z0, hi: z1, m, kind };   // east lane (dir +1, south) is at +x
        v.x = ox + lx + (dir > 0 ? 1.35 : -1.35);
        m.rotation.y = dir > 0 ? PI : 0; m.position.set(v.x, 0, v.pos); m.userData = { x: v.x, z: v.pos }; add(m); cullables.push(m); traffic.push(v); track(v);
      });
    };
    /* the highway (NH 66) runs east to west along z = hz: keeping left, the east-going lane is the north one. A vehicle there has axis 'x': its `pos` is its x and its `x` is its lane's z, so the same stepping rules apply. */
    const highway = (xa, xb, hz, kinds) => {
      kinds.forEach((kind, i) => {
        const dir = i % 2 ? -1 : 1, lane = hz + (dir > 0 ? -2.6 : 2.6);
        const m = kind === 'auto' ? makeAuto() : kind === 'scooter' ? (() => { const s = kit.ride('scooter'); s.scale.setScalar(0.85); return s; })() : kind === 'bus' && V ? V.bus(pick(['ksrtc', 'private-blue']), pick([['Kozhikode', 'കോഴിക്കോട്'], ['Manjeri', 'മഞ്ചേരി'], ['Mananthavady', 'മാനന്തവാടി']])) : kind === 'lorry' && V ? V.lorry(pick([0xd9792a, 0x2f6a8a, 0xb8352a])) : makeCar(pick([0xb8352a, 0x2b4a7a, 0xe8e4da, 0x4a6a4a, 0x3a3a3a]));
        const v = { axis: 'x', x: lane, pos: xa + (xb - xa) * ((i + 0.5) / kinds.length) + rr(-12, 12), dir, speed: { car: 11, auto: 6.5, scooter: 8.5, bus: 9, lorry: 8 }[kind] || 9, cur: 0, lo: xa + 6, hi: xb - 6, m, kind };
        m.rotation.y = dir > 0 ? -PI / 2 : PI / 2; m.position.set(v.pos, 0, v.x); m.userData = Object.assign(m.userData || {}, { x: v.pos, z: v.x }); add(m); cullables.push(m); traffic.push(v); track(v);
      });
    };
    highway(84, X.manjeri + 84, 69, ['car', 'lorry', 'auto', 'car', 'bus', 'scooter', 'car', 'lorry', 'car', 'auto', 'bus', 'car', 'scooter', 'car']); highway(X.wayanad - 84, -84, 69, ['car', 'bus', 'auto', 'lorry', 'car', 'scooter']);
    road(X.city, -62, -48, 54, ['auto', 'scooter', 'car', 'auto']); road(X.hilite, 62, -46, 40, ['scooter', 'car', 'auto']); road(X.manjeri, 0, -125, 98, ['auto', 'scooter', 'car', 'auto', 'car', 'scooter', 'car']);
    onFrame((dt) => {
      T += dt; const pl = player(), ppl = people().map((q) => ({ x: q.g.position.x, z: q.g.position.z, r: 0.4 }));
      for (const v of traffic) {
        const ax = v.axis === 'x', lanePl = ax ? pl.z : pl.x, alongPl = ax ? pl.x : pl.z;   // an east-west vehicle sees the world turned: its lane is z and its way along is x
        if (Math.abs(v.x - lanePl) > 150 || Math.abs(v.pos - alongPl) > 150) continue;   // far away: not updated
        const things = (ax ? ppl.map((t) => ({ x: t.z, z: t.x, r: t.r })) : ppl).concat([{ x: lanePl, z: alongPl, r: 0.45 }]).filter((t) => Math.abs(t.z - v.pos) < 16);
        for (const o of traffic) if (o !== v && o.axis === v.axis && o.x === v.x) things.push({ x: o.x, z: o.pos, r: 1.2 });
        stepVehicle(v, dt, freeAhead(v, things));
        if (ax) { v.m.position.set(v.pos, 0, v.x); v.m.userData.x = v.pos; v.m.userData.z = v.x; } else { v.m.position.set(v.x, 0, v.pos); v.m.userData.x = v.x; v.m.userData.z = v.pos; }
        v.cs.forEach((c, i) => { const p = bodyAt(v, i); c.x = p.x; c.z = p.z; });
      }
    });

    /* ---- the train at the city station: see registerTrain, called by explore_city.js ---- */

    /* ---- animals: goats, cows, dogs, cats and crabs wander near where they live ---- */
    const makeAnimal = (kind) => {
      const g = new THREE.Group(), legs = [], S = { cow: 1.5, goat: 0.85, dog: 0.7, cat: 0.5, crab: 0.3 }[kind], col = { cow: 0xf2eee4, goat: 0xb99870, dog: 0x8a5a32, cat: 0x77706a, crab: 0xc8442e }[kind], m = mat(col, { roughness: 0.9 });
      if (kind === 'crab') { bx(0.34, 0.12, 0.26, m, 0, 0.1, 0, g); [-1, 1].forEach((s) => { bx(0.1, 0.08, 0.1, m, s * 0.24, 0.16, 0.14, g); [0, 1, 2].forEach((i) => { const l = new THREE.Group(); l.position.set(s * 0.17, 0.08, -0.08 + i * 0.07); bx(0.2, 0.03, 0.03, m, s * 0.1, -0.02, 0, l); g.add(l); legs.push(l); }); }); }
      else {
        const L = S * 0.9, H = S * 0.5; bx(S * 0.45, H, L, m, 0, S * 0.62, 0, g);
        if (kind === 'cow') { bx(S * 0.47, H * 0.5, L * 0.3, mat(0x6a4a30), 0, S * 0.7, -L * 0.1, g); [-1, 1].forEach((s) => bx(0.05, 0.16, 0.05, mat(0xe8dcc0), s * 0.2, S * 1.0, L * 0.52, g)); }
        const head = bx(S * 0.28, S * 0.3, S * 0.4, m, 0, S * 0.85, L * 0.55, g); if (kind === 'goat') bx(0.05, 0.16, 0.05, mat(0xe8dcc0), 0, S * 0.66, L * 0.78, g);
        bx(0.05, S * 0.4, 0.05, m, 0, S * 0.66, -L * 0.58, g).rotation.x = kind === 'dog' ? -0.9 : 0.2;   // tail
        [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sz]) => { const l = new THREE.Group(); l.position.set(sx * S * 0.16, S * 0.4, sz * L * 0.36); bx(0.08 * S + 0.04, S * 0.42, 0.08 * S + 0.04, m, 0, -S * 0.2, 0, l); g.add(l); legs.push(l); });
        g.userData.head = head;
      }
      g.userData.legs = legs; return g;
    };
    const animals = [];
    const herd = (kind, x, z, rx, rz, n) => { for (let i = 0; i < n; i++) { const g = makeAnimal(kind), a = { kind, g, x: x + rr(-rx, rx), z: z + rr(-rz, rz), home: { x, z }, range: { x: rx, z: rz }, speed: kind === 'crab' ? 0.9 : kind === 'cow' ? 0.6 : 1.1, wait: rr(0, 4), yaw: rr(0, TAU) }; g.position.set(a.x, kind === 'crab' ? 0.0 : 0.04, a.z); g.userData.x = a.x; g.userData.z = a.z; add(g); cullables.push(g); animals.push(a); } };
    herd('goat', X.manjeri + 44, 40, 10, 8, 3); herd('dog', X.manjeri + 60, 12, 3, 20, 1); herd('cow', X.manjeri + 28, -8, 6, 10, 1); herd('dog', X.city - 56, 2, 3, 24, 1); herd('cat', X.city - 40, -22, 3, 6, 1); herd('goat', X.city - 42, 44, 7, 6, 2);
    herd('dog', X.hilite + 50, 20, 6, 12, 1); herd('cow', X.hilite + 46, 26, 5, 6, 1); herd('dog', -30, 84, 20, 6, 2); herd('crab', 0, 96, 40, 2, 7); herd('crab', 60, 96, 20, 2, 4); herd('crab', -60, 96, 20, 2, 4); herd('goat', 72, 64, 6, 3, 2);
    onFrame((dt) => {
      const pl = player();
      for (const a of animals) {
        if (Math.abs(a.x - pl.x) > 120 || Math.abs(a.z - pl.z) > 120) continue;
        const dp = Math.hypot(a.x - pl.x, a.z - pl.z); if (a.kind === 'dog' || a.kind === 'cat' || a.kind === 'crab') { if (dp < 3.2) { a.tx = a.x + (a.x - pl.x) * 2; a.tz = a.z + (a.z - pl.z) * 2; a.wait = 0; } }   // they shy away from you
        const was = a.speed; if (a.tx !== undefined && dp < 3.2 && a.kind !== 'cow' && a.kind !== 'goat') a.speed = was * 2.4;
        const walking = stepAnimal(a, dt, Math.random); a.speed = was;
        const g = a.g; g.position.x = a.x; g.position.z = a.z; g.userData.x = a.x; g.userData.z = a.z; const dy = Math.atan2(Math.sin((a.yaw || 0) - g.rotation.y), Math.cos((a.yaw || 0) - g.rotation.y)); g.rotation.y += dy * Math.min(1, dt * 6);
        const sw = walking ? Math.sin(T * (a.kind === 'crab' ? 16 : 7) + a.x) * (a.kind === 'crab' ? 0.5 : 0.55) : 0, legs = g.userData.legs; for (let i = 0; i < legs.length; i++) legs[i].rotation[a.kind === 'crab' ? 'y' : 'x'] = sw * (i % 2 ? -1 : 1);
        if (g.userData.head) g.userData.head.rotation.x = walking ? 0 : Math.sin(T * 1.3 + a.z) * 0.25;   // grazing and looking about
        if (a.kind === 'crab') g.position.y = walking ? Math.abs(Math.sin(T * 16)) * 0.02 : 0;
      }
    });

    /* ---- birds: crows over the streets, white gulls and kites over the beach; wings flap ---- */
    const bird = (col, s) => { const g = new THREE.Group(), m = mat(col, { roughness: 0.8 }); bx(0.14 * s, 0.1 * s, 0.34 * s, m, 0, 0, 0, g); const wings = [-1, 1].map((k) => { const w = new THREE.Group(); const p = bx(0.34 * s, 0.02, 0.16 * s, m, k * 0.17 * s, 0, 0, w); w.position.set(0, 0.04, 0); g.add(w); return { w, k }; }); g.userData.wings = wings; g.castShadow = false; return g; };
    const flocks = [];
    const flock = (cx, cz, r, y, n, col, s, w) => { const birds = []; for (let i = 0; i < n; i++) { const g = bird(col, s); add(g); birds.push({ g, ph: (i / n) * TAU + rr(-0.3, 0.3), r: r * rr(0.7, 1.2), y: y + rr(-2, 3), w: w * rr(0.85, 1.15) }); } flocks.push({ cx, cz, birds }); };
    [X.city, X.hilite, X.manjeri].forEach((ox) => flock(ox, 0, 22, 14, 6, 0x1a1a1a, 2.2, 0.35)); flock(0, 20, 30, 12, 5, 0x1a1a1a, 2.2, 0.3); flock(0, 85, 40, 20, 7, 0xf4f1e8, 2.4, 0.25); flock(40, 80, 30, 30, 2, 0x6a4a2a, 5, 0.12);
    onFrame((dt) => {
      const pl = player();
      for (const f of flocks) {
        if (Math.abs(f.cx - pl.x) > 130 || Math.abs(f.cz - pl.z) > 130) { for (const b of f.birds) b.g.visible = false; continue; }
        for (const b of f.birds) { const q = circle(f.cx, f.cz, b.r, b.w, T, b.ph); b.g.visible = true; b.g.position.set(q.x, b.y + Math.sin(T * 1.7 + b.ph) * 0.8, q.z); b.g.rotation.y = q.yaw - PI / 2 + PI; const flap = Math.sin(T * 11 + b.ph * 3); for (const wg of b.g.userData.wings) wg.w.rotation.z = wg.k * flap * 0.7; }
      }
    });

    /* ---- butterflies near the palms ---- */
    const flies = [];
    if (!c.low) [[X.manjeri + 36, 10], [X.city - 40, 0], [X.hilite + 46, 24], [-50, 80], [50, 80]].forEach(([cx, cz]) => { for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.14), new THREE.MeshBasicMaterial({ color: pick([0xffd24a, 0xff8a4a, 0xf4f1e8, 0x8ac8ff]), side: THREE.DoubleSide })); add(m); flies.push({ m, cx, cz, ph: rr(0, TAU), sp: rr(0.5, 0.9) }); } });
    onFrame(() => { const pl = player(); for (const f of flies) { if (Math.abs(f.cx - pl.x) > 90) { f.m.visible = false; continue; } f.m.visible = true; f.m.position.set(f.cx + Math.sin(T * f.sp + f.ph) * 4, 1.2 + Math.sin(T * 1.3 + f.ph * 2) * 0.5, f.cz + Math.cos(T * f.sp * 0.8 + f.ph) * 4); f.m.rotation.set(0.6, T * 2, 0); f.m.scale.x = 0.4 + Math.abs(Math.sin(T * 14 + f.ph)) * 0.8; } });

    /* ---- sky: an aeroplane now and then, and clouds that drift ---- */
    const plane = new THREE.Group(), white = new THREE.MeshBasicMaterial({ color: 0xf4f6f8, fog: false });
    { const f = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.8, 16, 10).rotateZ(PI / 2), white); plane.add(f); const wing = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.2, 18), white); wing.position.set(0.5, -0.2, 0); plane.add(wing); const tail = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3, 0.2), white); tail.position.set(-7.4, 1.6, 0); plane.add(tail); const tp = new THREE.Mesh(new THREE.BoxGeometry(2, 0.2, 6), white); tp.position.set(-7.4, 0.5, 0); plane.add(tp); const lamp = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xff3030, fog: false })); lamp.scale.set(1.6, 1.6, 1); lamp.position.set(0, 0.2, 9); plane.add(lamp); plane.userData.lamp = lamp; const trail = new THREE.Mesh(new THREE.BoxGeometry(70, 0.5, 0.5), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, fog: false })); trail.position.set(-43, 0, 0); plane.add(trail); }
    plane.visible = false; add(plane); const pl8 = { wait: 6, u: 0, dir: 1, dur: 26 };
    const cloudMat = sprite((x, w, h) => { for (let i = 0; i < 7; i++) { const g = x.createRadialGradient(w * (0.2 + i * 0.1), h * (0.5 + Math.sin(i * 2) * 0.12), 2, w * (0.2 + i * 0.1), h * 0.5, h * 0.42); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); } }, 256, 96);
    const clouds = []; for (let i = 0; i < (c.low ? 5 : 9); i++) { const s = new THREE.Sprite(cloudMat); s.scale.set(rr(60, 110), rr(22, 36), 1); add(s); clouds.push({ s, ox: rr(-260, 260), oz: rr(-260, -60), y: rr(55, 85), sp: rr(0.8, 1.8) }); }
    onFrame((dt) => {
      const pl = player(); stepPlane(pl8, dt, Math.random);
      if (pl8.u > 0) { plane.visible = true; plane.position.set(pl.x + pl8.dir * (-260 + 520 * pl8.u), 62, pl.z - 110); plane.rotation.y = pl8.dir > 0 ? 0 : PI; plane.userData.lamp.visible = Math.sin(T * 6) > 0; } else plane.visible = false;
      for (const cl of clouds) { cl.ox += cl.sp * dt; if (cl.ox > 270) cl.ox = -270; cl.s.position.set(pl.x + cl.ox, cl.y, pl.z + cl.oz); }
    });

    /* ---- boats on the sea off the beach ---- */
    const boats = [];
    if (kit && kit.boat) [[-60, 118, 2.2], [40, 132, -1.6], [10, 160, 1.2]].forEach(([x, z, sp], i) => { const b = kit.boat(i + 3); b.scale.setScalar(2.2); b.position.set(x, 0.1, z); b.rotation.y = sp > 0 ? PI / 2 : -PI / 2; add(b); b.userData = { x, z }; cullables.push(b); boats.push({ b, x, z, sp, ph: rr(0, TAU) }); });
    onFrame((dt) => { for (const o of boats) { o.x += o.sp * dt; if (o.x > 110) o.x = -110; if (o.x < -110) o.x = 110; o.b.position.set(o.x, 0.1 + Math.sin(T * 1.1 + o.ph) * 0.12, o.z); o.b.rotation.z = Math.sin(T * 0.9 + o.ph) * 0.05; o.b.userData.x = o.x; } });
  }

  /* the train of the city station: explore_city.js calls this with its train group; it pulls out and rolls in again */
  function registerTrain(onFrame, group, x0) {
    const t = { state: 'parked', x: 0, v: 0, wait: 12 };
    onFrame((dt) => { stepTrain(t, dt); group.position.x = x0 + t.x; if (group.userData) group.userData.x = x0 + t.x; group.visible = Math.abs(t.x) < 105; });
  }

  window.RoboExploreLife = { build, registerTrain, pure };
})();
