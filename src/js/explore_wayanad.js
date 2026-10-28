/* Robo Run: the Thamarassery Churam road and Wayanad's gateway, Lakkidi. Exposes window.RoboExploreWayanad = { build(ctx), layout(cx, wx), carve, hillMapRects }.
   The road leaves the highway east of Manjeri and climbs in nine hairpin bends (NH 766 has nine; explore_notes.js names the source); at the top the Lakkidi gate opens on a small hill town.
   Everything off the road is hillside: layout() lists the open ground (roads, street, view point, tea estate) and carve() turns "the region minus the open ground" into solid blocks, so the walls match the map exactly.
   Real names only where a public source confirms them; shop names are product words. Look-only: nothing here has a door. The 2024 landslide area is not part of this world. */
(function () {
  'use strict';
  if (window.RoboExploreWayanad) return;   // the page loads its scripts twice
  const PI = Math.PI, FONT_ML = '"Nirmala UI","Noto Sans Malayalam","Kartika",sans-serif';
  const Z_LAST = 62.4;   // the north edge of the highway ground; the hills start here

  /* cx: the x of the road's west edge column (the junction with the highway); wx: the x of the Lakkidi street. Rectangles are [x0, x1, z0, z1]. */
  function layout(cx, wx) {
    const N = 9, STEP = 13, Z0 = 54, SPAN = 80, H = 4;
    const legs = [], roads = [], bends = [];
    for (let i = 0; i < N; i++) { const z = Z0 - STEP * i; legs.push(z); roads.push([cx - H, cx + SPAN + H, z - H, z + H]); }
    for (let i = 0; i < N - 1; i++) { const east = i % 2 === 0, x = east ? cx + SPAN : cx; roads.push([x - H, x + H, legs[i + 1] - H, legs[i] + H]); bends.push({ n: i + 1, x, z: (legs[i] + legs[i + 1]) / 2, east }); }
    roads.push([cx - H, cx + H, Z0 - H, Z_LAST]);                                    // the junction with the highway
    const zTop = legs[N - 1], gateX = cx + SPAN + H + 36;                              // the top bend ends in a straight road to the Lakkidi gate
    roads.push([cx + SPAN + H, wx, zTop - H, zTop + H]);
    const town = [
      [wx - 4.6, wx + 4.6, -54, 58],                  // the street with its pavements
      [wx - 32, wx + 32, 42, 60],                     // the bus-stop square at the south end
      [wx - 74, wx - 4, 10, 26],                      // the lane to the view point and the deck itself
      [wx + 4, wx + 16, 12, 26],                      // the lane into the tea estate
      [wx + 16, wx + 80, -44, 44]                     // the tea estate
    ];
    const hill1 = [cx - 16, wx - 84, -72, Z_LAST], hill2 = [wx - 84, wx + 84, -72, Z_LAST];
    return { N, legs, bends, roads, town, hill1, hill2, gateX, zTop, open: roads.concat(town) };
  }

  /* region minus open rectangles, as a short list of solid blocks (cut on every edge, merged along x) */
  function carve(region, open) {
    const [rx0, rx1, rz0, rz1] = region, xs = new Set([rx0, rx1]), zs = new Set([rz0, rz1]);
    const hit = open.filter((o) => o[1] > rx0 && o[0] < rx1 && o[3] > rz0 && o[2] < rz1);
    for (const o of hit) { xs.add(Math.max(rx0, Math.min(rx1, o[0]))); xs.add(Math.max(rx0, Math.min(rx1, o[1]))); zs.add(Math.max(rz0, Math.min(rz1, o[2]))); zs.add(Math.max(rz0, Math.min(rz1, o[3]))); }
    const X = [...xs].sort((a, b) => a - b), Z = [...zs].sort((a, b) => a - b), out = [];
    for (let j = 0; j < Z.length - 1; j++) {
      let run = null;
      for (let i = 0; i < X.length - 1; i++) {
        const mx = (X[i] + X[i + 1]) / 2, mz = (Z[j] + Z[j + 1]) / 2, isOpen = hit.some((o) => mx > o[0] && mx < o[1] && mz > o[2] && mz < o[3]);
        if (!isOpen) { if (run) run[1] = X[i + 1]; else run = [X[i], X[i + 1], Z[j], Z[j + 1]]; } else if (run) { out.push(run); run = null; }
      }
      if (run) out.push(run);
    }
    return out;
  }

  const pure = { layout, carve };

  function build(c) {
    const { THREE, add, box, mat, solid, post, plane, canvasTex, rr, pick, walker, addPickup, cullables, staticGroups, building, marker, spots, notes, ox, asphaltMat, paverMat } = c;
    const CX = ox - 200, WX = ox, L = layout(CX, WX), NOTES = notes || {};
    const stone = mat(0x8d8a84, { roughness: 0.95 }), asphalt = asphaltMat;
    const sign = (w, h, tw, th, draw) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: canvasTex(tw, th, draw), roughness: 0.85, side: THREE.DoubleSide }));
    const txt = (x, t, px, py, font, col) => { x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = col; x.font = font; x.fillText(t, px, py); };
    const noteSpot = (x, z, key) => { const n = NOTES[key]; if (!n) return; marker(x, z, 0xcfe8ff); spots.push({ x, z, r: 2.0, kind: 'note', arg: key, label: n.title.split(' · ')[0], emoji: n.emoji }); };
    const put = (m, x, z, y) => { m.position.set(x, y, z); add(m); cullables.push(m); staticGroups.push(m); m.userData = Object.assign(m.userData || {}, { x, z }); return m; };

    /* ground: green hills over the sea-coloured edge of the world, and the roads */
    plane(180, 140, mat(0x5b7a3a, { roughness: 1 }), CX + 90, 0.03, -10);
    plane(176, 140, mat(0x5f8040, { roughness: 1 }), WX, 0.032, -10);
    L.roads.forEach(([x0, x1, z0, z1]) => plane(x1 - x0, z1 - z0, asphalt, (x0 + x1) / 2, 0.045, (z0 + z1) / 2));
    plane(8, 112, asphalt, WX, 0.045, 2);                                                                                       // the Lakkidi street
    [-1, 1].forEach((s) => { box(1.2, 0.16, 112, paverMat, WX + s * 4.0, 0.1, 2, undefined, false); box(0.34, 0.1, 112, stone, WX + s * 3.5, 0.09, 2, undefined, false); });
    plane(64, 18, mat(0x948d80, { roughness: 0.95 }), WX, 0.06, 51);                                                          // the bus-stop square
    plane(12, 14, mat(0x8a7a5a, { roughness: 1 }), WX + 10, 0.05, 19); plane(70, 14, mat(0x8a7a5a, { roughness: 1 }), WX - 39, 0.05, 18);   // earth lanes to the tea estate and the view point
    plane(64, 88, mat(0x6f9a3c, { roughness: 1 }), WX + 48, 0.05, 0);                                                         // the tea estate floor
    L.legs.forEach((z, i) => { const dash = new THREE.Mesh(new THREE.PlaneGeometry(76, 0.2).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: 0xe8e4d8 })); dash.position.set(CX + 40, 0.06, z); add(dash); });   // the centre line of each leg

    /* hillsides: the solid blocks beside the road, taller the higher the bend (it is one flat map, so the banks do the climbing) */
    const trunkMat = mat(0x5a3d22), leafMats = [mat(0x2f6a2c, { flatShading: true }), mat(0x3b7a30, { flatShading: true }), mat(0x28592a, { flatShading: true })];
    const coneG = new THREE.ConeGeometry(1.5, 4.6, 7), trunkG = new THREE.CylinderGeometry(0.22, 0.3, 1.6, 6), blockMats = [mat(0x4f7a38, { roughness: 1 }), mat(0x466f33, { roughness: 1 })];
    const tree = (x, y, z, s) => { const g = new THREE.Group(), t = new THREE.Mesh(trunkG, trunkMat), k = new THREE.Mesh(coneG, pick(leafMats)); t.position.y = 0.8; k.position.y = 3.6; g.add(t, k); g.scale.setScalar(s); g.position.set(x, y, z); add(g); cullables.push(g); staticGroups.push(g); g.userData = { x, z }; };
    let nTrees = 0;
    const hill = (r, town) => {
      const [x0, x1, z0, z1] = r, w = x1 - x0, d = z1 - z0, climb = Math.max(0, Math.min(1, (Z0_ROAD - (z0 + z1) / 2) / 110)), far = z1 <= -54 || x0 >= WX + 80;
      const h = town ? (far ? 5 : 1.0) : 2.6 + climb * 7 + (w * d > 900 ? 1.5 : 0), nearStreet = town && x1 > WX - 16 && x0 < WX + 16 && !far;
      solid(x0, x1, z0, z1, 'wall');
      const m = box(w, h, d, pick(blockMats), (x0 + x1) / 2, h / 2, (z0 + z1) / 2, undefined, true); put(m, (x0 + x1) / 2, (z0 + z1) / 2, h / 2);
      const cap = box(w + 0.1, 0.35, d + 0.1, stone, (x0 + x1) / 2, h + 0.02, (z0 + z1) / 2); put(cap, (x0 + x1) / 2, (z0 + z1) / 2, h + 0.02);
      const n = nearStreet ? 0 : Math.min(14, Math.floor(w * d / 55)); for (let i = 0; i < n && nTrees < 260; i++, nTrees++) tree(x0 + 1 + rr(0, Math.max(0.1, w - 2)), h + 0.2, z0 + 1 + rr(0, Math.max(0.1, d - 2)), rr(0.8, 1.5));
    };
    const Z0_ROAD = L.legs[0];
    carve(L.hill1, L.open).forEach((r) => hill(r, false)); carve(L.hill2, L.open).forEach((r) => hill(r, true));

    /* crash barrier posts on the outside of each hairpin, and a board for each bend */
    const rail = mat(0xe8e4d8), redRail = mat(0xb8352a);
    L.bends.forEach((b) => {
      const out = b.east ? b.x + 3.6 : b.x - 3.6, inn = b.east ? b.x - 4.5 : b.x + 4.5, z0 = b.z - 6.5, z1 = b.z + 6.5;
      for (let z = z0, i = 0; z <= z1; z += 1.6, i++) box(0.16, 0.9, 0.16, i % 2 ? rail : redRail, out, 0.5, z, undefined, false);
      box(0.12, 0.12, z1 - z0, rail, out, 0.95, b.z, undefined, false);
      const bd = sign(3.4, 2.1, 512, 320, (x, w, h) => { x.fillStyle = '#f4c31c'; x.fillRect(0, 0, w, h); x.strokeStyle = '#1b1b1b'; x.lineWidth = 12; x.strokeRect(10, 10, w - 20, h - 20); txt(x, 'HAIRPIN', w / 2, h * 0.2, 'bold 62px sans-serif', '#1b1b1b'); txt(x, b.n + ' / 9', w / 2, h * 0.52, 'bold 120px sans-serif', '#1b1b1b'); txt(x, 'ഹെയർപിൻ വളവ്', w / 2, h * 0.84, 'bold 50px ' + FONT_ML, '#1b1b1b'); });
      bd.rotation.y = b.east ? PI / 2 : -PI / 2;                                                                                    // faces the climbing traffic from the bank
      put(bd, inn + (b.east ? -0.3 : 0.3), b.z, 7.4 + b.n * 0.5);
      const pole = box(0.14, 7.8 + b.n * 0.5, 0.14, mat(0x55524c), inn + (b.east ? -0.3 : 0.3), (7.8 + b.n * 0.5) / 2 - 0.4, b.z); cullables.push(pole); pole.userData = { x: inn, z: b.z };
    });
    /* mist on the upper bends */
    const mistMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide });
    for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(16, 3.2), mistMat); m.rotation.x = -PI / 2; put(m, CX + 8 + rr(0, 64), L.legs[3 + (i % 6)] + rr(-3, 3), 2.0 + rr(0, 1.2)); }

    /* the Adivaram junction: where the highway meets the ghat road, with a board and a note */
    (() => {
      const bd = sign(7, 1.4, 1024, 200, (x, w, h) => { x.fillStyle = '#1f5a3a'; x.fillRect(0, 0, w, h); x.strokeStyle = '#f3e6cf'; x.lineWidth = 6; x.strokeRect(6, 6, w - 12, h - 12); txt(x, 'NH 766 · THAMARASSERY CHURAM', w / 2, h * 0.36, 'bold 56px sans-serif', '#fff'); txt(x, 'താമരശ്ശേരി ചുരം · വയനാട്', w / 2, h * 0.74, 'bold 56px ' + FONT_ML, '#ffe9b0'); });
      put(bd, CX, 49, 5.6);
      [-3.2, 3.2].forEach((dx) => box(0.2, 5.6, 0.2, mat(0x2a2a2a), CX + dx, 2.8, 49, undefined, true));
      noteSpot(CX + 2.6, 56, 'churam');
    })();

    /* the Lakkidi gate */
    (() => {
      const gx = L.gateX, gz = L.zTop;
      [-1, 1].forEach((s) => { const p = box(1.1, 6.2, 1.1, mat(0xd9cfb4), gx, 3.1, gz + s * 5.2, undefined, true); put(p, gx, gz + s * 5.2, 3.1); box(1.5, 0.5, 1.5, stone, gx, 0.25, gz + s * 5.2); });
      const beam = box(1.1, 0.9, 11.6, mat(0xb8352a), gx, 6.4, gz, undefined, true); put(beam, gx, gz, 6.4);
      const bd = sign(9, 2.1, 1024, 240, (x, w, h) => { x.fillStyle = '#1f4a2a'; x.fillRect(0, 0, w, h); x.strokeStyle = '#ffe9b0'; x.lineWidth = 7; x.strokeRect(7, 7, w - 14, h - 14); txt(x, 'LAKKIDI · GATEWAY OF WAYANAD', w / 2, h * 0.36, 'bold 64px sans-serif', '#fff'); txt(x, 'ലക്കിടി · വയനാട്ടിലേക്ക് സ്വാഗതം', w / 2, h * 0.74, 'bold 60px ' + FONT_ML, '#ffe9b0'); });
      bd.rotation.y = -PI / 2; bd.scale.setScalar(1.0); put(bd, gx - 0.65, gz, 4.8); const b2 = bd.clone(); b2.rotation.y = PI / 2; put(b2, gx + 0.65, gz, 4.8);
    })();

    /* the Lakkidi street: shopfronts, a tea stall, a spice shop, a homestay */
    const P = (a, b) => [a, b];
    building(-1, -46, -34, WX); building(-1, -34, -24, WX, P('Spice Corner', 'സുഗന്ധവ്യഞ്ജനം')); building(-1, -24, -12, WX); building(-1, -12, -2, WX, P('Hill Homestay', 'ഹോംസ്റ്റേ')); building(-1, -2, 6, WX);
    building(-1, 30, 42, WX);
    building(1, -46, -34, WX); building(1, -34, -22, WX, P('Chaya Kada', 'ചായക്കട')); building(1, -22, -10, WX); building(1, -10, 0, WX, P('Pepper & Honey', 'കുരുമുളക് · തേൻ')); building(1, 0, 10, WX);
    building(1, 28, 42, WX);

    /* the bus stop on the square: a shelter, a KSRTC bus waiting, and the ticket counter */
    (() => {
      const sx = WX + 9.5, red = mat(0x8a1f2b), dark = mat(0x2a2a2a);
      box(3.6, 0.12, 2.2, red, sx, 2.6, 49, undefined, true); [-1.6, 1.6].forEach((dx) => box(0.1, 2.6, 0.1, dark, sx + dx, 1.3, 49, undefined, true)); box(3.0, 0.1, 0.5, mat(0x6a4a2a), sx, 0.5, 49.7); solid(sx - 1.8, sx + 1.8, 48.6, 50.2);
      marker(sx, 51.6, 0xffd27a); spots.push({ x: sx, z: 51.6, r: 2.2, kind: 'shop', arg: 'bus_wy_ksrtc', label: 'KSRTC tickets', emoji: '🎫' });
      if (c.V) { const b = c.V.bus('ksrtc', ['Mananthavady', 'മാനന്തവാടി']); b.position.set(WX - 12, 0, 54); add(b); cullables.push(b); b.userData.x = WX - 12; b.userData.z = 54; solid(WX - 12 - 1.6, WX - 12 + 1.6, 54 - b.userData.length / 2, 54 + b.userData.length / 2, 'vehicle', b); }
    })();

    /* the view point: a timber deck with a rail, binoculars-free but with the whole valley in front (mist and a note) */
    (() => {
      const x0 = WX - 74, x1 = WX - 50, z0 = 10, z1 = 26;
      plane(x1 - x0, z1 - z0, mat(0x8a6a44, { roughness: 0.9 }), (x0 + x1) / 2, 0.07, (z0 + z1) / 2);
      const rl = mat(0x6a4a2a);
      box(0.22, 1.1, z1 - z0, rl, x0 + 0.3, 0.55, (z0 + z1) / 2, undefined, true); box(x1 - x0 - 6, 1.1, 0.22, rl, (x0 + x1) / 2 - 3, 0.55, z0 + 0.2, undefined, true); box(x1 - x0 - 6, 1.1, 0.22, rl, (x0 + x1) / 2 - 3, 0.55, z1 - 0.2, undefined, true);
      for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(10, 3), mistMat); m.rotation.x = -PI / 2; put(m, x0 + 3 + rr(0, 6), z0 + rr(0, z1 - z0), 1.4 + rr(0, 1.5)); }
      const bd = sign(5, 1.2, 1024, 240, (x, w, h) => { x.fillStyle = '#3a2a1a'; x.fillRect(0, 0, w, h); x.strokeStyle = '#ffe9b0'; x.lineWidth = 6; x.strokeRect(6, 6, w - 12, h - 12); txt(x, 'LAKKIDI VIEW POINT', w / 2, h * 0.38, 'bold 66px sans-serif', '#fff'); txt(x, 'ലക്കിടി വ്യൂ പോയിന്റ്', w / 2, h * 0.74, 'bold 58px ' + FONT_ML, '#ffe9b0'); });
      bd.rotation.y = PI / 2; put(bd, x0 + 1.6, (z0 + z1) / 2, 3.2);
      noteSpot(x0 + 5, (z0 + z1) / 2, 'lakkidi');
    })();

    /* the tea estate: rows of tea bushes with an aisle between each pair and a cross lane through the middle */
    {
      const rowMat = mat(0x2f6a22, { roughness: 1, flatShading: true }), topMat = mat(0x4f8a2a, { roughness: 1, flatShading: true });
      for (let k = 0; k < 15; k++) {
        const x = WX + 22 + k * 4;
        [[-40, -4], [4, 40]].forEach(([a, b]) => { const m = box(1.4, 0.8, b - a, rowMat, x, 0.4, (a + b) / 2, undefined, true); put(m, x, (a + b) / 2, 0.4); const t = box(1.1, 0.25, b - a - 0.2, topMat, x, 0.85, (a + b) / 2); put(t, x, (a + b) / 2, 0.85); solid(x - 0.7, x + 0.7, a, b, 'stall'); });
      }
      walker('mundu', [[WX + 20, -2], [WX + 78, -2]], 0.8, 0);
    }

    /* people, a few coins along the climb and in the street */
    walker('lungi', [[WX + 1.2, 50], [WX + 1.2, -48]], 1.0, 3); walker('schoolgirl', [[WX - 1.5, -48], [WX - 1.5, 50]], 1.1, 3); walker('mundu', [[WX - 1.5, 18], [WX - 46, 18]], 0.9, 1);
    L.legs.forEach((z, i) => { if (i % 2) return; addPickup('coin', null, CX + 14 + rr(0, 50), z + rr(-1, 1)); });
    for (let i = 0; i < 5; i++) addPickup('coin', null, WX + rr(-1.5, 1.5), -40 + i * 18);
  }

  /* rectangles for the world map ([x0, x1, z0, z1, colour, 'hatch'?]) so the map shows the same roads and walls */
  function hillMapRects(cx, wx, asphaltCol, hatchCol, townCols) {
    const L = layout(cx, wx), out = [[cx - 16, wx + 84, -72, Z_LAST, '#3b4630']];
    carve(L.hill1, L.open).concat(carve(L.hill2, L.open)).forEach((r) => out.push([r[0], r[1], r[2], r[3], hatchCol, 'hatch']));
    L.roads.forEach((r) => out.push([r[0], r[1], r[2], r[3], asphaltCol]));
    L.town.forEach((r, i) => out.push([r[0], r[1], r[2], r[3], townCols[i] || asphaltCol]));
    return out;
  }

  window.RoboExploreWayanad = { build, layout, carve, hillMapRects, pure };
})();
