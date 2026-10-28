/* Robo Run: the HiLITE City area (Palazhi, on the NH 66 bypass) of the walkable town. Exposes window.RoboExploreHilite = { build(ctx) }.
   Coordinates here are local (lx, lz) with the area centred on x = ctx.ox; north is -z. Real names only where a public source confirms them (explore_notes.js): HiLITE Mall (NH 66 near Palazhi, opened 10 April 2015),
   HiLITE Business Park (twin office towers in HiLITE City) and UL Cyberpark (near the bypass). The mall has a room you can walk into (supermarket and food court). The bypass is look-only: a railing keeps you off it. */
(function () {
  'use strict';
  const PI = Math.PI, FONT_ML = '"Nirmala UI","Noto Sans Malayalam","Kartika",sans-serif';

  function build(c) {
    const { THREE, add, box, mat, solid, post, plane, canvasTex, rr, walker, stander, addPickup, cullables, palmAt, V, spots, marker, notes, ox, onFrame, asphaltMat, paverMat } = c;
    const X = (lx) => ox + lx;
    const NOTES = notes || {};
    const glass = mat(0x2a4a68, { roughness: 0.12, metalness: 0.55 }), white = mat(0xf4f1e8), dark = mat(0x2a2a2a), stone = mat(0xd8d0bc, { roughness: 0.95 });
    const mesh = (geo, m, x, y, z, parent) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; (parent || c.scene).add(o); return o; };
    const sign = (w, h, tw, th, draw) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: canvasTex(tw, th, draw), roughness: 0.85, side: THREE.DoubleSide }));
    const txt = (x, t, px, py, font, col) => { x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = col; x.font = font; x.fillText(t, px, py); };
    const board = (w, h, bg, edge, en, ml, enCol, mlCol) => sign(w, h, 1024, 200, (x, w2, h2) => { x.fillStyle = bg; x.fillRect(0, 0, w2, h2); x.strokeStyle = edge; x.lineWidth = 6; x.strokeRect(6, 6, w2 - 12, h2 - 12); txt(x, en, w2 / 2, h2 * 0.36, 'bold ' + (en.length > 22 ? 52 : 80) + 'px sans-serif', enCol || '#fff'); txt(x, ml, w2 / 2, h2 * 0.74, 'bold ' + (ml.length > 26 ? 32 : ml.length > 18 ? 38 : 46) + 'px ' + FONT_ML, mlCol || '#ffe9b0'); });
    const both = (m) => { const back = m.clone(); back.rotation.y = m.rotation.y + PI; back.position.z += Math.cos(m.rotation.y) * -0.04; back.position.x += Math.sin(m.rotation.y) * -0.04; c.scene.add(back); return back; };   // readable from both sides: a second copy turned round
    const noteSpot = (lx, lz, key) => { const n = NOTES[key]; if (!n) return; marker(X(lx), lz, 0xcfe8ff); spots.push({ x: X(lx), z: lz, r: 2.0, kind: 'note', arg: key, label: n.title.split(' · ')[0], emoji: n.emoji }); };
    const cull = (g, lx, lz) => { add(g); g.userData = { x: X(lx), z: lz }; cullables.push(g); };

    /* ground, the access road, and the bypass beyond a railing (look-only) */
    plane(200, 400, mat(0x8f8a7c, { roughness: 1 }), ox, 0.03, 0);
    plane(8, 100, asphaltMat, ox, 0.04, -6);
    [-1, 1].forEach((s) => { box(1.2, 0.16, 100, paverMat, X(s * 4.0), 0.1, -6, undefined, false); box(0.34, 0.1, 100, mat(0x8d8a84), X(s * 3.5), 0.09, -6, undefined, false); });
    plane(110, 16, asphaltMat, ox, 0.04, 56);
    box(110, 0.12, 0.5, mat(0xc8c4b8), X(0), 0.12, 56, undefined, false);                                   // the median
    [53, 59].forEach((z) => box(110, 0.02, 0.12, mat(0xf4f1e8), X(0), 0.06, z, undefined, false));            // lane lines
    for (let i = -5; i <= 5; i++) { box(0.2, 1.1, 0.2, mat(0x8a8f94), X(i * 7), 0.55, 47.6, undefined, true); }
    box(72, 0.12, 0.1, mat(0x8a8f94), X(0), 1.05, 47.6, undefined, true); box(72, 0.12, 0.1, mat(0x8a8f94), X(0), 0.6, 47.6, undefined, true); solid(X(-36), X(36), 47.3, 47.9, 'fence');
    const sgn = board(7, 1.4, '#0d5a2a', '#ffffff', 'NH 66 · KOZHIKODE BYPASS', 'എൻഎച്ച് 66 · കോഴിക്കോട് ബൈപ്പാസ്'); sgn.position.set(X(-22), 4.2, 47.0); cull(sgn, -22, 47); both(sgn); box(0.15, 4.2, 0.15, dark, X(-25), 2.1, 47.0, undefined, true); box(0.15, 4.2, 0.15, dark, X(-19), 2.1, 47.0, undefined, true);
    /* traffic on the bypass, keeping left: eastbound in the north lanes, westbound in the south ones */
    if (V) {
      const lanes = [[V.lorry(0xd9792a), 51.5, 1, 9, -50], [V.bus('private-maroon', ['Vadakara', 'വടകര']), 54.5, 1, 11, 10], [V.lorry(0x4a7a3a), 57.5, -1, 8, 40], [V.bus('ksrtc', ['Kozhikode', 'കോഴിക്കോട്']), 60, -1, 10, -20]];
      const live = lanes.map(([m, z, dir, sp, x0]) => { m.position.set(X(x0), 0, z); m.rotation.y = dir > 0 ? -PI / 2 : PI / 2; add(m); return { m, z, dir, sp, x: x0 }; });
      onFrame((dt) => { for (const v of live) { v.x += v.dir * v.sp * dt; if (v.x > 70) v.x = -70; if (v.x < -70) v.x = 70; v.m.position.x = X(v.x); } });
    }

    /* a block with a glass face towards the road, a sign, an entrance canopy; look-only unless it has a door */
    const block = (side, x0, x1, z0, z1, h, wall, en, ml, bg, signY) => {
      const g = new THREE.Group(), w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, face = side > 0 ? x0 : x1, ry = side > 0 ? -PI / 2 : PI / 2;
      mesh(new THREE.BoxGeometry(w, h, d), wall, X(cx), h / 2, cz, g);
      for (let i = 0; i < Math.floor(h / 3.4); i++) mesh(new THREE.BoxGeometry(0.12, 1.9, d - 1.6), glass, X(face - side * 0.05), 2.6 + i * 3.4, cz, g);
      const nm = board(Math.min(d - 1, 13), 2.2, bg, '#ffffff', en, ml); nm.position.set(X(face - side * 0.25), signY || 5.6, cz); nm.rotation.y = ry; g.add(nm);
      mesh(new THREE.BoxGeometry(1.6, 0.2, 6), dark, X(face - side * 0.9), 3.6, cz, g);
      cull(g, cx, cz); solid(X(x0), X(x1), z0, z1); return g;
    };

    /* HiLITE Mall (east): a long glass-and-cream block, a forecourt with parked cars, a door into the mall */
    block(1, 14, 34, -44, 4, 15, mat(0xece4d2, { roughness: 0.9 }), 'HiLITE MALL', 'ഹൈലൈറ്റ് മാൾ · പാലാഴി', '#7a1f3a', 6.2);
    c.door(X(10.5), -20, 'hilitemall', 'Enter HiLITE Mall', '🛍️');
    const car = (lx, lz, ry, hex) => { const g = new THREE.Group(); box(1.8, 0.8, 4.2, mat(hex), 0, 0.7, 0, g, true); box(1.6, 0.7, 2.2, glass, 0, 1.4, -0.1, g); [[-0.9, 1.3], [0.9, 1.3], [-0.9, -1.3], [0.9, -1.3]].forEach(([wx, wz]) => { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.22, 12).rotateZ(PI / 2), mat(0x151515)); w.position.set(wx, 0.32, wz); g.add(w); }); g.position.set(X(lx), 0, lz); g.rotation.y = ry; cull(g, lx, lz); solid(X(lx) - 2.2, X(lx) + 2.2, lz - 1, lz + 1, 'vehicle', g); };
    [[-42, 0xb8bcc2], [-39, 0xd9d4c8], [-36, 0x2f4a7a], [-33, 0xa8352a], [-30, 0x3a3a3c], [-10, 0xe8e4da], [-7, 0x6a7a5a], [-4, 0xb8bcc2], [-1, 0x8a2a2a], [2, 0x2a2a2c]].forEach(([z, hex], i) => car(10.8, z, i % 2 ? PI / 2 : -PI / 2, hex));
    noteSpot(5.6, -14, 'hilitemall');

    /* HiLITE Business Park (west): a low podium and twin office towers; look-only */
    (() => {
      const g = new THREE.Group();
      mesh(new THREE.BoxGeometry(26, 5, 46), mat(0xcfd2d4, { roughness: 0.9 }), X(-21), 2.5, -21, g);
      [[-38, -22], [-14, 2]].forEach(([a, b]) => { mesh(new THREE.BoxGeometry(16, 31, b - a - 2), mat(0xe9edf0, { roughness: 0.8 }), X(-24), 20.5, (a + b) / 2, g); for (let i = 0; i < 9; i++) mesh(new THREE.BoxGeometry(0.14, 2.0, b - a - 3), glass, X(-15.9), 7.4 + i * 3.1, (a + b) / 2, g); });
      const nm = board(13, 2.2, '#17303f', '#8fc8ff', 'HiLITE BUSINESS PARK', 'ഹൈലൈറ്റ് ബിസിനസ് പാർക്ക്', '#ffffff', '#cfe6ff'); nm.position.set(X(-7.9), 4.2, -21); nm.rotation.y = PI / 2; g.add(nm);   // the podium is on the west side, so its sign faces east, to the road
      cull(g, -21, -21); solid(X(-34), X(-8), -44, 2);
      noteSpot(-5.6, -21, 'hilitepark');
      [['techie', [[-5.4, -34], [-5.4, -8]], 0.9], ['techieF', [[-6.6, -8], [-6.6, -34]], 1.0]].forEach(([type, pts, sp]) => walker(type, pts.map(([lx, lz]) => [X(lx), lz]), sp, 0));
    })();

    /* UL Cyberpark (west, south): a stepped block with green terraces; look-only */
    (() => {
      const g = new THREE.Group(), x0 = -32, x1 = -9;
      [[23, 12, 6], [19, 6, 15], [15, 6, 21]].forEach(([tw, th, cy]) => mesh(new THREE.BoxGeometry(tw, th, 24), mat(0xe3e8e4, { roughness: 0.85 }), X((x0 + x1) / 2 - (23 - tw) / 2), cy, 22, g));   // three steps, each set back from the road
      for (let i = 0; i < 4; i++) mesh(new THREE.BoxGeometry(0.14, 1.9, 22), glass, X(x1 + 0.05), 2.6 + i * 3.4, 22, g);
      [[x1 - 1, 12.3], [x1 - 3, 18.3], [x1 - 5, 24.3]].forEach(([tx, ty]) => mesh(new THREE.BoxGeometry(2, 0.6, 22), mat(0x4a7a3a, { roughness: 1 }), X(tx), ty, 22, g));   // a planted strip on each step
      const nm = board(10, 1.9, '#1f5a3a', '#ffffff', 'UL CYBERPARK', 'യു.എൽ. സൈബർപാർക്ക്'); nm.position.set(X(x1 + 0.25), 5.0, 22); nm.rotation.y = PI / 2; g.add(nm);
      cull(g, (x0 + x1) / 2, 22); solid(X(x0), X(x1), 10, 34);
      noteSpot(-5.6, 22, 'ulcyberpark');
    })();

    /* the bus stop on the bypass side: a shelter and the ticket counter */
    (() => {
      const sx = 9.5, sz = 42; box(3.6, 0.12, 2.2, mat(0x8a1f2b), X(sx), 2.6, sz, undefined, true); [-1.6, 1.6].forEach((dx) => box(0.1, 2.6, 0.1, dark, X(sx + dx), 1.3, sz, undefined, true)); box(3.0, 0.1, 0.5, mat(0x6a4a2a), X(sx), 0.5, sz + 0.7); solid(X(sx) - 1.8, X(sx) + 1.8, sz - 0.4, sz + 1.2);
      const bs = board(4.4, 0.9, '#8a1f2b', '#f3e6cf', 'BUS STOP', 'ബസ് സ്റ്റോപ്പ്'); bs.position.set(X(sx), 3.4, sz); cull(bs, sx, sz); both(bs);
      marker(X(sx), 39.5, 0xffd27a); spots.push({ x: X(sx), z: 39.5, r: 2.2, kind: 'shop', arg: 'bus_hl_ksrtc', label: 'KSRTC tickets', emoji: '🎫' });
    })();

    /* Palazhi Link Road: a second street 62 m east of the main road, reached across the open ground between the mall and the bypass */
    window.RoboExploreRoads.sideRoad(c, { lx: 62, z0: -50, z1: 44, name: ['Link Road', 'ലിങ്ക് റോഡ്'], nameZ: 38, yard: { x0: 34, x1: 58, z0: 8, z1: 44 }, coins: 10, scooter: -14, auto: 20, palms: { x0: 38, x1: 54, z0: 10, z1: 40, n: 5 },
      runs: [[-1, -50, -30], [-1, -30, -22, ['Electronics', 'ഇലക്ട്രോണിക്സ്']], [-1, -22, 8], [1, -50, -20], [1, -20, -12, ['Mobile Shop', 'മൊബൈൽ ഷോപ്പ്']], [1, -12, 40]] });

    /* people, palms, coins and food */
    stander('techie', X(2.2), 26, PI / 2); stander('techieF', X(-2.2), -28, -PI / 2);
    for (let i = 0; i < 8; i++) { const s = i % 2 ? 1 : -1; palmAt(X(s * rr(5.5, 9)), -46 + i * 12 + rr(-2, 2), i, rr(0.9, 1.2)); }
    [['mundu', [[X(1.2), 36], [X(1.2), -40]], 1.2], ['techie', [[X(-0.5), -42], [X(-0.5), 34]], 1.1], ['schoolgirl', [[X(1.8), 36], [X(1.8), 4]], 1.3], ['techieF', [[X(0.0), 30], [X(0.0), -38]], 1.0], ['saree', [[X(0.4), 34], [X(0.4), -30]], 0.95]].forEach(([type, pts, sp]) => walker(type, pts, sp, 3));
    for (let i = 0; i < 12; i++) addPickup('coin', null, X(i % 2 ? -rr(0.6, 1.0) : rr(0.6, 3.0)), -40 + i * 6.5 + rr(-1, 1));   // west-side coins keep clear of the parked stand autos
    [['tea', X(3.2), -6], ['spice', X(-3.0), 8], ['rice', X(3.0), 22], ['coconut', X(-3.0), -24], ['banana', X(3.0), -34], ['coffee', X(-3.1), 30]].forEach(([id, x, z]) => addPickup('food', id, x, z));
  }

  window.RoboExploreHilite = { build };
})();
