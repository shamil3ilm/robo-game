/* Robo Run: the edge of a walkable town. Exposes window.RoboExploreEdge = { make(opts), dress(c, shape, X) }.
   make() builds the pure shape of one town: an irregular outline (a wobbly ellipse), the four roads that bend away to their exits, and the map strips.
   dress() puts the jungle ring (round colliders with a gap at each exit, trees as instanced meshes) and a ring of far hills round it.
   Used by explore_malappuram.js (explore_manjeri.js has its own copy of the same code, from before this file existed). Tested in tests/edge.test.js. */
(function () {
  'use strict';
  if (window.RoboExploreEdge) return;   // the page loads its scripts twice
  const PI = Math.PI;

  /* opts: { AX, AZ, CZ, phase, bend, tails: [{ name, sx, sz, ux, uz, px, pz }] }: the half-widths of the outline, its centre (z), a phase for the wobble, the bend of the roads, and where each road starts leaving the shops (start, outward direction, bend direction) */
  function make(opts) {
    const AX = opts.AX, AZ = opts.AZ, CZ = opts.CZ || 0, ph = opts.phase || 0, BEND = opts.bend === undefined ? 0.0055 : opts.bend, TAILS = opts.tails;
    const wob = (t) => 1 + 0.09 * Math.sin(3 * t + 1 + ph) + 0.06 * Math.sin(5 * t + 2 + ph) + 0.035 * Math.sin(9 * t + 0.5 + ph);
    const inside = (x, z, m) => { const dx = x / AX, dz = (z - CZ) / AZ; return Math.hypot(dx, dz) < wob(Math.atan2(dz, dx)) - (m || 0); };
    const loopPoints = (n) => { const out = []; for (let k = 0; k < n; k++) { const t = (k / n) * PI * 2, w = wob(t); out.push({ x: AX * w * Math.cos(t), z: CZ + AZ * w * Math.sin(t), t }); } return out; };
    const tailPoint = (d, t) => ({ x: d.sx + d.ux * t + d.px * BEND * t * t, z: d.sz + d.uz * t + d.pz * BEND * t * t });
    const tailDir = (d, t) => { const tx = d.ux + d.px * 2 * BEND * t, tz = d.uz + d.pz * 2 * BEND * t, l = Math.hypot(tx, tz); return { tx: tx / l, tz: tz / l }; };
    const exits = () => TAILS.map((d) => { let t = 0; for (; t < 300 && inside(tailPoint(d, t + 0.5).x, tailPoint(d, t + 0.5).z, 0); t += 0.5); const p = tailPoint(d, t), v = tailDir(d, t); return Object.assign(p, v, { t, name: d.name, def: d }); });
    const tailPieces = () => { const out = []; for (const e of exits()) for (let t = 0; t < e.t; t += 6) { const m = Math.min(t + 3, e.t - 0.01), p = tailPoint(e.def, m), v = tailDir(e.def, m); out.push({ x: p.x, z: p.z, len: Math.min(6.6, e.t - t + 0.6), yaw: Math.atan2(-v.tz, v.tx), name: e.name }); } return out; };
    /* the town on the map as strips of land (overlapping a little so there are no seams), a jungle band at both ends of each strip, and the bent roads; world x = ox + x */
    const mapRects = (ox) => {
      const out = [], zr = AZ * 1.25, xr = AX * 1.3;
      for (let z = Math.floor(CZ - zr); z < CZ + zr; z += 5) {
        let xl = null, xr2 = null; for (let x = -xr; x <= xr; x += 1) if (inside(x, z + 2.5, 0)) { if (xl === null) xl = x; xr2 = x; }
        if (xl === null) continue;
        out.push([ox + xl, ox + xr2, z, z + 5.8, '#6f7a44'], [ox + xl, ox + xl + 11, z, z + 5.8, '#2f4a2c'], [ox + xr2 - 11, ox + xr2, z, z + 5.8, '#2f4a2c']);
      }
      for (const q of tailPieces()) out.push([ox + q.x - 4, ox + q.x + 4, q.z - 4, q.z + 4, '#9a968e']);
      return out;
    };
    return { AX, AZ, CZ, wob, inside, loopPoints, exits, tailPieces, tailPoint, tailDir, mapRects, BEND };
  }

  /* the jungle ring and the hills. c: the area context (THREE, add, mat, post); X(x): local x to world x; seed: for the trees */
  function dress(c, shape, X, seed) {
    const { THREE, add, mat, post } = c, EX = shape.exits(), { AX, AZ, CZ, wob } = shape;
    let s = seed || 11; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const nearExit = (x, z, r) => EX.some((e) => Math.hypot(x - e.x, z - e.z) < r);
    const pts = shape.loopPoints(120), trees = [];
    pts.forEach((p) => {
      if (!nearExit(p.x, p.z, 10.5)) post(X(p.x), p.z, 6.4, 'wall');
      for (let i = 0, k = nearExit(p.x, p.z, 10.5) ? 1 : 4; i < k; i++) trees.push([p.x + (rnd() - 0.5) * 7, p.z + (rnd() - 0.5) * 7, 1.5 + rnd(), 0.95 + rnd() * 0.25]);
      for (const f of [1.07, 1.16, 1.27]) for (let i = 0; i < 2; i++) { const tx = p.x * f + (rnd() - 0.5) * 8, tz = CZ + (p.z - CZ) * f + (rnd() - 0.5) * 8; if (!nearExit(tx, tz, 7)) trees.push([tx, tz, 1.4 + rnd() * 1.1, 0.9 + rnd() * 0.3]); }
    });
    const n = trees.length, cone = new THREE.InstancedMesh(new THREE.ConeGeometry(1.5, 4.6, 7), mat(0xffffff, { flatShading: true }), n), trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.3, 1.8, 6), mat(0x5a3d22), n), d = new THREE.Object3D(), col = new THREE.Color();
    trees.forEach(([x, z, sc, v], i) => { d.position.set(X(x), 0.9 * sc, z); d.scale.set(sc, sc, sc); d.rotation.set(0, rnd() * 6.3, 0); d.updateMatrix(); trunk.setMatrixAt(i, d.matrix); d.position.y = 4.1 * sc; d.updateMatrix(); cone.setMatrixAt(i, d.matrix); col.setRGB(0.17 * v, 0.40 * v, 0.17 * v); cone.setColorAt(i, col); });
    /* about 45 percent of the trees have a round crown (mango, jackfruit) instead of a cone: the first 55 percent stay cones, the rest get this one more instanced mesh of round crowns on the same trunks */
    const nc = Math.floor(n * 0.55); cone.count = nc; const crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(2.0, 1), mat(0xffffff, { flatShading: true }), Math.max(1, n - nc));
    trees.forEach(([x, z, s, v], i) => { if (i < nc) return; d.position.set(X(x), 3.2 * s, z); d.scale.set(s * 1.05, s * 0.85, s * 1.05); d.rotation.set(0, i, 0); d.updateMatrix(); crown.setMatrixAt(i - nc, d.matrix); col.setRGB(0.24 * v, 0.47 * v, 0.14 * v); crown.setColorAt(i - nc, col); }); crown.frustumCulled = false; add(crown);
    cone.frustumCulled = false; trunk.frustumCulled = false; add(cone); add(trunk);
    const hills = [], K = 34;
    for (let k = 0; k < K; k++) {
      const a = (k / K) * PI * 2 + rnd() * 0.12, f = 1.3 + rnd() * 0.4, w = wob(a), r = 26 + rnd() * 30, hgt = 14 + rnd() * 26, x = AX * w * f * Math.cos(a), z = CZ + AZ * w * f * Math.sin(a);
      if (EX.some((e) => Math.hypot(x - e.x, z - e.z) < r + 14)) continue; hills.push([x, z, r, hgt, 0.85 + rnd() * 0.3]);
    }
    const hm = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 8, 0, PI * 2, 0, PI / 2), mat(0xffffff, { roughness: 1, flatShading: true }), hills.length);
    hills.forEach(([x, z, r, hgt, v], i) => { d.position.set(X(x), -1, z); d.scale.set(r, hgt, r); d.rotation.set(0, rnd() * 6.3, 0); d.updateMatrix(); hm.setMatrixAt(i, d.matrix); col.setRGB(0.30 * v, 0.46 * v, 0.24 * v); hm.setColorAt(i, col); });
    hm.frustumCulled = false; add(hm);
  }

  window.RoboExploreEdge = { make, dress };
})();
