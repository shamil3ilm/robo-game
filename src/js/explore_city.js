/* Robo Run: the Kozhikode city area (Mavoor Road) of the walkable town. Exposes window.RoboExploreCity = { build(ctx) }.
   Coordinates here are local (lx, lz) with the area centred on x = ctx.ox; north is -z. Real names only where a public source confirms them (explore_notes.js): the KSRTC Bus Stand and the Mofussil Bus Stand
   (Mavoor Road), Kozhikode railway station, the EMS Corporation Stadium (Rajaji Road), Baby Memorial Hospital (Arayidathupalam) and Aster MIMS (Govindapuram). Everything else is a product word.
   Hospitals, the school and the stadium are look-only scenery. Elections: plain bunting and a neutral ward-election board, no party, flag or leader. */
(function () {
  'use strict';
  const PI = Math.PI, FONT_ML = '"Nirmala UI","Noto Sans Malayalam","Kartika",sans-serif';

  function build(c) {
    const { THREE, add, box, mat, solid, post, plane, canvasTex, rr, walker, stander, addPickup, cullables, palmAt, building, V, spots, marker, notes, ox, kit, asphaltMat, paverMat } = c;
    const X = (lx) => ox + lx;
    const NOTES = notes || {};
    const glass = mat(0x24405a, { roughness: 0.15, metalness: 0.5 }), white = mat(0xf4f1e8), dark = mat(0x2a2a2a), stone = mat(0xd8d0bc, { roughness: 0.95 }), concrete = mat(0xb9b5ab, { roughness: 0.95 });
    const mesh = (geo, m, x, y, z, parent) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; (parent || c.scene).add(o); return o; };
    const sign = (w, h, tw, th, draw) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: canvasTex(tw, th, draw), roughness: 0.85, side: THREE.DoubleSide }));
    const txt = (x, t, px, py, font, col) => { x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = col; x.font = font; x.fillText(t, px, py); };
    const both = (m, g) => { const back = m.clone(); back.rotation.y = m.rotation.y + PI; back.position.z += Math.cos(m.rotation.y) * -0.04; back.position.x += Math.sin(m.rotation.y) * -0.04; (g || c.scene).add(back); return back; };
    const board = (w, h, bg, edge, en, ml, enCol, mlCol) => sign(w, h, 1024, 200, (x, w2, h2) => { x.fillStyle = bg; x.fillRect(0, 0, w2, h2); x.strokeStyle = edge; x.lineWidth = 6; x.strokeRect(6, 6, w2 - 12, h2 - 12); txt(x, en, w2 / 2, h2 * 0.36, 'bold ' + (en.length > 22 ? 46 : 70) + 'px sans-serif', enCol || '#fff'); txt(x, ml, w2 / 2, h2 * 0.74, 'bold ' + (ml.length > 26 ? 32 : ml.length > 18 ? 38 : 46) + 'px ' + FONT_ML, mlCol || '#ffe9b0'); });
    const noteSpot = (lx, lz, key) => { const n = NOTES[key]; if (!n) return; marker(X(lx), lz, 0xcfe8ff); spots.push({ x: X(lx), z: lz, r: 2.0, kind: 'note', arg: key, label: n.title.split(' · ')[0], emoji: n.emoji }); };
    const cull = (g, lx, lz) => { add(g); g.userData = { x: X(lx), z: lz }; cullables.push(g); };

    /* ground and the road: Mavoor Road, paved */
    plane(200, 400, mat(0x8d8776, { roughness: 1 }), ox, 0.03, 0);
    plane(8, 124, asphaltMat, ox, 0.04, 0);
    [-1, 1].forEach((s) => { box(1.2, 0.16, 124, paverMat, X(s * 4.0), 0.1, 0, undefined, false); box(0.34, 0.1, 124, mat(0x8d8a84), X(s * 3.5), 0.09, 0, undefined, false); });

    /* shop rows: product words only */
    building(-1, -44, -38, ox, ['Hotel', 'ഹോട്ടൽ']); building(-1, -38, -32, ox, ['Tea & Coffee', 'ചായ · കാപ്പി']); building(-1, -32, -26, ox, ['Ice cream', 'ഐസ്ക്രീം']); building(-1, -26, -20, ox, ['Supermarket', 'സൂപ്പർമാർക്കറ്റ്']);
    building(1, 17, 22, ox, ['Pharmacy', 'ഫാർമസി']); building(1, 22, 28, ox, ['Clinic', 'ക്ലിനിക്']); building(-1, 20, 24, ox, ['Hotel', 'ഹോട്ടൽ']); building(-1, 24, 29, ox, ['Tea & Coffee', 'ചായ · കാപ്പി']);

    /* a big block set back from the road: a wall, a band of glass, a sign over the door; look-only */
    const block = (side, x0, x1, z0, z1, h, wall, en, ml, bg) => {
      const g = new THREE.Group(), w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, face = side > 0 ? x0 : x1, ry = side > 0 ? -PI / 2 : PI / 2;
      mesh(new THREE.BoxGeometry(w, h, d), wall, X(cx), h / 2, cz, g);
      for (let i = 0; i < Math.floor(h / 3.2); i++) mesh(new THREE.BoxGeometry(0.12, 1.7, d - 1.6), glass, X(face - side * 0.05), 2.4 + i * 3.2, cz, g);
      const nm = board(Math.min(d - 1, 11), 1.9, bg, '#ffffff', en, ml); nm.position.set(X(face - side * 0.2), 5.2, cz); nm.rotation.y = ry; g.add(nm);
      mesh(new THREE.BoxGeometry(1.2, 0.2, 5), dark, X(face - side * 0.8), 3.4, cz, g);   // entrance canopy
      cull(g, cx, cz); solid(X(x0), X(x1), z0, z1); return g;
    };

    /* Kozhikode railway station (north end): a frontage across the road end with a gate, the sign, a platform with a roof, and a train */
    (() => {
      const g = new THREE.Group();
      [[-34, -4.6], [4.6, 34]].forEach(([a, b]) => { mesh(new THREE.BoxGeometry(b - a, 6.4, 3), stone, X((a + b) / 2), 3.2, -48.5, g); solid(X(a), X(b), -50, -47); });
      mesh(new THREE.BoxGeometry(9.4, 2.4, 3), stone, X(0), 7.2, -48.5, g);
      const nm = board(9, 2.0, '#1a3a6a', '#ffffff', 'KOZHIKODE RAILWAY STATION', 'കോഴിക്കോട് റെയിൽവേ സ്റ്റേഷൻ'); nm.position.set(X(0), 7.3, -46.95); g.add(nm); both(nm, g);
      cull(g, 0, -48.5);
      plane(70, 14, mat(0x6a655c, { roughness: 1 }), X(0), 0.05, -56);                                    // the track bed
      box(68, 0.3, 5.6, mat(0xa8a39a), X(0), 0.15, -52.6, undefined, false);                               // the platform
      [-0.75, 0.75].forEach((s) => box(68, 0.08, 0.1, mat(0x8a8f94, { metalness: 0.6 }), X(0), 0.12, -58.5 + s));   // the rails
      const roof = new THREE.Group(); mesh(new THREE.BoxGeometry(62, 0.15, 5.0), mat(0x7a8a8f), X(0), 4.6, -52.6, roof); cull(roof, 0, -52.6);
      for (let i = -4; i <= 3; i++) { box(0.2, 4.6, 0.2, dark, X(i * 9 + 4.5), 2.3, -50.6, undefined, true); post(X(i * 9 + 4.5), -50.6, 0.25); }   // not in the middle: the gate is there
      const train = new THREE.Group(), blue = mat(0x2a4f86, { roughness: 0.55 }), band = mat(0xf4f1e8), roofM = mat(0x8a8f94), tyre = mat(0x151515);
      [[-21, mat(0xc8532a)], [-7, blue], [7, blue], [21, blue]].forEach(([tx, m], i) => {   // an engine and three coaches, facing east
        mesh(new THREE.BoxGeometry(i ? 13.4 : 11, 3.3, 2.8), m, tx, 2.3, 0, train); mesh(new THREE.BoxGeometry(i ? 13.4 : 11, 0.5, 2.82), band, tx, 2.0, 0, train); mesh(new THREE.BoxGeometry(i ? 13.4 : 11, 0.12, 2.4), roofM, tx, 4.0, 0, train);
        if (i) for (let k = -2; k <= 2; k++) mesh(new THREE.BoxGeometry(1.5, 0.8, 2.86), glass, tx + k * 2.4, 2.9, 0, train);
        [-1, 1].forEach((s) => mesh(new THREE.BoxGeometry(2.4, 0.7, 2.2), tyre, tx + s * 4, 0.6, 0, train));
      });
      train.position.set(X(0), 0, -58.5); cull(train, 0, -58.5); if (window.RoboExploreLife) window.RoboExploreLife.registerTrain(c.onFrame, train, X(0)); if (c.noMerge) c.noMerge.add(train);   // it pulls out, is away, and rolls in again solid(X(-28), X(28), -60.2, -56.8, 'vehicle', train);
      noteSpot(-3.0, -52, 'ckstation');
    })();

    /* the EMS Corporation Stadium (east, north): a frontage with arches, a roof of stands and floodlights behind; look-only */
    (() => {
      const g = new THREE.Group(), x0 = 8, x1 = 18, z0 = -44, z1 = -22;
      mesh(new THREE.BoxGeometry(x1 - x0, 8, z1 - z0), mat(0xc9c4b6, { roughness: 0.95 }), X((x0 + x1) / 2), 4, (z0 + z1) / 2, g);
      for (let i = 0; i < 5; i++) mesh(new THREE.BoxGeometry(0.3, 4.2, 2.6), mat(0x3a3a38), X(x0 - 0.1), 2.1, z0 + 2.4 + i * 4.3, g);   // the arches of the gates
      mesh(new THREE.BoxGeometry(9, 5, z1 - z0 - 2).rotateZ(-0.35), mat(0xa9a59a), X(x1 + 3.5), 8, (z0 + z1) / 2, g);                     // the upper stands behind
      [z0, z1].forEach((pz) => { box(0.3, 15, 0.3, dark, X(x1 + 6), 7.5, pz, g, true); mesh(new THREE.BoxGeometry(0.5, 1.6, 2.4), new THREE.MeshBasicMaterial({ color: 0xfff2c0 }), X(x1 + 5.6), 15.2, pz, g); });
      const nm = board(10, 1.9, '#12482a', '#ffffff', 'EMS CORPORATION STADIUM', 'ഇ.എം.എസ്. കോർപ്പറേഷൻ സ്റ്റേഡിയം'); nm.position.set(X(x0 - 0.2), 6.4, (z0 + z1) / 2); nm.rotation.y = -PI / 2; g.add(nm);
      cull(g, (x0 + x1) / 2, (z0 + z1) / 2); solid(X(x0), X(x1 + 9), z0, z1);
      noteSpot(5.4, -33, 'emsstadium');
    })();

    /* the two hospitals: Baby Memorial (east) and Aster MIMS (west), each with a forecourt; an ambulance at the first */
    block(1, 9, 23, -18, -2, 13, mat(0xe9e5da, { roughness: 0.9 }), 'BABY MEMORIAL HOSPITAL', 'ബേബി മെമ്മോറിയൽ ഹോസ്പിറ്റൽ', '#0f4a8a');
    block(-1, -22, -9, -18, -2, 15, mat(0xe3e8ea, { roughness: 0.9 }), 'ASTER MIMS', 'ആസ്റ്റർ മിംസ്', '#1f6a5a');
    (() => {
      const amb = new THREE.Group(); box(1.9, 1.9, 4.4, white, 0, 1.3, 0, amb); box(1.92, 0.3, 4.42, mat(0xb8352a), 0, 1.0, 0, amb); box(1.8, 0.5, 0.06, glass, 0, 2.0, -2.2, amb); box(0.2, 0.9, 0.9, mat(0xb8352a), 0, 2.45, 0, amb);
      [[-0.9, -1.4], [0.9, -1.4], [-0.9, 1.4], [0.9, 1.4]].forEach(([wx, wz]) => { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.25, 12).rotateZ(PI / 2), mat(0x151515)); wh.position.set(wx, 0.38, wz); amb.add(wh); });
      amb.position.set(X(6.6), 0, -12); amb.rotation.y = PI / 2; add(amb); cullables.push(amb); amb.userData = { x: X(6.6), z: -12 }; solid(X(6.6) - 2.4, X(6.6) + 2.4, -13.3, -10.7, 'vehicle', amb);
      noteSpot(5.4, -5, 'babymemorial'); noteSpot(-5.6, -5, 'mims');
    })();

    /* KSEB (east): a small office, a yard transformer, and the public chargers (explore.js puts the bay beside it) */
    (() => {
      const g = new THREE.Group();
      mesh(new THREE.BoxGeometry(7, 4.6, 9), mat(0xe3dcc8, { roughness: 0.9 }), X(12.5), 2.3, 8, g);
      const nm = board(5.6, 1.3, '#17458a', '#ffffff', 'KSEB', 'കെ.എസ്.ഇ.ബി', '#fff', '#cfe6ff'); nm.position.set(X(8.9), 5.2, 8); nm.rotation.y = -PI / 2; g.add(nm);
      cull(g, 12.5, 8); solid(X(9), X(16), 3.5, 12.5);
      const tr = new THREE.Group(); box(0.26, 8, 0.26, mat(0x9a968c), 0, 4, 0, tr, true); mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.9, 12), mat(0x4a5a6a, { metalness: 0.4 }), 0, 6.4, 0.7, tr);
      tr.position.set(X(-4.4), 0, 14); cull(tr, -4.4, 14); post(X(-4.4), 14, 0.3);
      noteSpot(6.0, 11, 'kcitykseb');
    })();

    /* a school (west): a low wall with a gate, a two-storey building, a flagpole, children in the yard; look-only */
    (() => {
      const g = new THREE.Group();
      mesh(new THREE.BoxGeometry(9, 7, 14), mat(0xf0e2b8, { roughness: 0.9 }), X(-17), 3.5, 9, g); mesh(new THREE.BoxGeometry(9.2, 0.7, 14.2), mat(0x2f6fa0), X(-17), 6.9, 9, g);
      [[0, 7], [11, 18]].forEach(([a, b]) => { mesh(new THREE.BoxGeometry(0.3, 1.5, b - a), stone, X(-7), 0.75, (a + b) / 2, g); solid(X(-7.2), X(-6.8), a, b); });
      mesh(new THREE.BoxGeometry(0.4, 2.8, 0.4), stone, X(-7), 1.4, 7.2, g); mesh(new THREE.BoxGeometry(0.4, 2.8, 0.4), stone, X(-7), 1.4, 10.8, g);
      const nm = board(6, 1.2, '#2f6fa0', '#ffffff', 'SCHOOL', 'സ്കൂൾ'); nm.position.set(X(-7.2), 3.4, 9); nm.rotation.y = PI / 2; g.add(nm);
      box(0.1, 6, 0.1, mat(0xcfcfcf), X(-10), 3, 4, g, true);
      cull(g, -17, 9); solid(X(-21.5), X(-12.5), 2, 16);
      [['schoolgirl', [[-10, 12], [-10, 15]], 0.9], ['schoolboy', [[-9, 3], [-11, 3]], 1.2], ['schoolgirl', [[-9.5, 6.5], [-9.5, 11]], 1.0]].forEach(([type, pts, sp]) => walker(type, pts.map(([lx, lz]) => [X(lx), lz]), sp, 0));
    })();

    /* the KSRTC Bus Stand (east, south): the biggest in Kerala; a Fast Passenger, a second bus, a lorry, a shelter and the ticket counter */
    (() => {
      plane(28, 30, mat(0x948d80, { roughness: 0.95 }), X(19), 0.06, 44);
      const st = board(7, 1.4, '#8a1f2b', '#f3e6cf', 'KOZHIKODE KSRTC', 'കോഴിക്കോട് · കെഎസ്ആർടിസി ബസ് സ്റ്റാൻഡ്'); st.position.set(X(13), 4.6, 31); add(st); both(st); cullables.push(st); st.userData = { x: X(13), z: 31 };
      [-3.3, 3.3].forEach((dx) => { box(0.2, 4.6, 0.2, dark, X(13 + dx), 2.3, 31, undefined, true); post(X(13 + dx), 31, 0.2); });
      if (V) {
        const bs = [[V.bus('ksrtc', ['Manjeri', 'മഞ്ചേരി']), 18, 46], [V.bus('ksrtc', ['Kannur', 'കണ്ണൂർ']), 24, 50], [V.lorry(0x4a7a3a), 29, 40]];
        bs.forEach(([m, lx, lz]) => { m.position.set(X(lx), 0, lz); add(m); cullables.push(m); m.userData.x = X(lx); m.userData.z = lz; solid(X(lx) - 1.6, X(lx) + 1.6, lz - m.userData.length / 2, lz + m.userData.length / 2, 'vehicle', m); });
      }
      const sx = 8, sz = 36; box(3.6, 0.12, 2.2, mat(0x8a1f2b), X(sx), 2.6, sz, undefined, true); [-1.6, 1.6].forEach((dx) => box(0.1, 2.6, 0.1, dark, X(sx + dx), 1.3, sz, undefined, true)); box(3.0, 0.1, 0.5, mat(0x6a4a2a), X(sx), 0.5, sz + 0.7); solid(X(sx) - 1.8, X(sx) + 1.8, sz - 0.4, sz + 1.2);
      marker(X(9.5), 33.6, 0xffd27a); spots.push({ x: X(9.5), z: 33.6, r: 2.2, kind: 'shop', arg: 'bus_cy_ksrtc', label: 'KSRTC tickets', emoji: '🎫' });
      noteSpot(5.6, 41, 'citybusstands');
    })();

    /* the Mofussil Bus Stand (west, south): the private buses, each coloured by service, with route boards */
    (() => {
      plane(28, 30, mat(0x948d80, { roughness: 0.95 }), X(-19), 0.06, 44);
      const st = board(7.6, 1.4, '#1f5a3a', '#f3e6cf', 'MOFUSSIL BUS STAND', 'മൊഫ്യൂസിൽ ബസ് സ്റ്റാൻഡ്'); st.position.set(X(-13), 4.6, 31); add(st); both(st); cullables.push(st); st.userData = { x: X(-13), z: 31 };
      [-3.3, 3.3].forEach((dx) => { box(0.2, 4.6, 0.2, dark, X(-13 + dx), 2.3, 31, undefined, true); post(X(-13 + dx), 31, 0.2); });
      if (V) {
        const bs = [[V.bus('private-green', ['Mavoor', 'മാവൂർ']), -17, 44], [V.bus('private-blue', ['Thamarassery', 'താമരശ്ശേരി']), -23, 48], [V.bus('private-maroon', ['Vadakara', 'വടകര']), -29, 42]];
        bs.forEach(([m, lx, lz]) => { m.position.set(X(lx), 0, lz); add(m); cullables.push(m); m.userData.x = X(lx); m.userData.z = lz; solid(X(lx) - 1.6, X(lx) + 1.6, lz - m.userData.length / 2, lz + m.userData.length / 2, 'vehicle', m); });
      }
    })();

    /* Station Lane: a second street 62 m west of Mavoor Road, reached across the Mofussil bus stand yard */
    window.RoboExploreRoads.sideRoad(c, { lx: -62, z0: -52, z1: 58, name: ['Station Lane', 'സ്റ്റേഷൻ ലെയ്ൻ'], nameZ: 50, yard: { x0: -58, x1: -33, z0: 29, z1: 59 }, coins: 12, scooter: 4, auto: 22, palms: { x0: -48, x1: -26, z0: -46, z1: 22, n: 8 },
      runs: [[1, -52, -20], [1, -20, -12, ['Mobile Repair', 'മൊബൈൽ റിപ്പയർ']], [1, -12, 6], [1, 6, 14, ['Cycle Shop', 'സൈക്കിൾ ഷോപ്പ്']], [1, 14, 26], [-1, -52, -34], [-1, -34, -26, ['Internet Cafe', 'ഇന്റർനെറ്റ് കഫേ']], [-1, -26, 14], [-1, 14, 22, ['Stationery', 'സ്റ്റേഷനറി']], [-1, 22, 56]] });

    /* an election board: plain bunting and a neutral ward-election notice (no party, flag or leader), a tea stall, an ice-cream cart, palms and people */
    (() => {
      const g = new THREE.Group(); [-1, 1].forEach((s) => { box(0.12, 6, 0.12, dark, X(s * 4.1), 3, -30, g, true); post(X(s * 4.1), -30, 0.15); });
      const cols = [0xe8b81c, 0x2f8a5a, 0x3a6ab8, 0xd9582a, 0xf4f1e8, 0x8a3a8a]; for (let i = 0; i < 16; i++) { const f = mesh(new THREE.BoxGeometry(0.5, 0.55, 0.03), mat(cols[i % cols.length]), X(-3.8 + i * 0.5), 5.2 - 0.5 * Math.sin((i / 15) * PI), -30, g); f.rotation.z = PI / 4; }
      cull(g, 0, -30);
      const bd = new THREE.Group(); box(0.1, 2.4, 0.1, dark, -0.8, 1.2, 0, bd, true); box(0.1, 2.4, 0.1, dark, 0.8, 1.2, 0, bd, true);
      const pb = board(1.9, 1.4, '#f4f1e8', '#17458a', 'WARD ELECTION', 'വാർഡ് തിരഞ്ഞെടുപ്പ് · വോട്ട് ചെയ്യൂ', '#17458a', '#1f3a5a'); pb.position.set(0, 1.9, 0); bd.add(pb); both(pb, bd);
      bd.position.set(X(-3.4), 0, -16); bd.rotation.y = PI / 2; cull(bd, -3.4, -16); post(X(-3.4), -16, 0.9, 'stall', bd);
    })();
    const stall = kit.stall(); stall.position.set(X(3.1), 0, -6); stall.rotation.y = -PI / 2; stall.scale.setScalar(1.1); add(stall); cullables.push(stall); stall.userData = { x: X(3.1), z: -6 }; solid(X(3.1) - 0.9, X(3.1) + 0.9, -7.4, -4.6, 'stall', stall);
    if (V) { const ic = V.iceCream(); ic.position.set(X(-3.2), 0, 22); ic.rotation.y = PI / 2; add(ic); cullables.push(ic); ic.userData = { x: X(-3.2), z: 22 }; post(X(-3.2), 22, 0.9, 'stall', ic); stander('thattam', X(-2.2), 22.8, PI / 2); }
    stander('mundu', X(2.2), -5.2, PI / 2);
    for (let i = 0; i < 10; i++) { const s = i % 2 ? 1 : -1; palmAt(X(s * rr(24, 33)), rr(-30, 24), i, rr(1.0, 1.5)); }
    [['mundu', [[X(1.2), 26], [X(1.2), -40]], 1.2], ['lungi', [[X(-0.5), -42], [X(-0.5), 24]], 1.1], ['thattam', [[X(0.4), 28], [X(0.4), -34]], 1.0], ['schoolgirl', [[X(1.8), 26], [X(1.8), 4]], 1.3], ['saree', [[X(0.0), 22], [X(0.0), -38]], 0.95], ['schoolboy', [[X(1.4), 26], [X(1.4), 2]], 1.5]].forEach(([type, pts, sp]) => walker(type, pts, sp, 3));
    for (let i = 0; i < 12; i++) addPickup('coin', null, X(i % 2 ? -rr(0.6, 1.0) : rr(0.6, 3.0)), -42 + i * 6.5 + rr(-1, 1));   // west-side coins keep clear of the parked stand autos
    [['tea', X(3.2), -3], ['spice', X(-3.0), 6], ['rice', X(3.0), 16], ['banana', X(-3.0), -22], ['coconut', X(3.0), -26], ['jaggery', X(-3.1), 28]].forEach(([id, x, z]) => addPickup('food', id, x, z));
  }

  window.RoboExploreCity = { build };
})();
