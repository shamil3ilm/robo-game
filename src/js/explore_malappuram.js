/* Robo Run: Malappuram, the district town 14 km from Manjeri, reached by KSRTC bus. Exposes window.RoboExploreMalappuram = { build(ctx), shape, mapRects(ox) }.
   Local coordinates: x = ctx.ox is the north-south road, z = 0 is the KSRTC junction (where Malappuram-Perinthalmanna Road meets Kottakkunnu Road); north is -z, east is +x. Laid out at 1:12 from Google Maps (reference only, redrawn in the game's own style).
   Real names only where Google Maps shows them (KSRTC Bus Terminal, Civil Station, Collectorate, Town Hall, Mariyamman Kovil, Hotel Delicia, the roads); every other shop has a product-word sign. */
(function () {
  'use strict';
  if (window.RoboExploreMalappuram) return;   // the page loads its scripts twice
  const PI = Math.PI, FONT_ML = '"Nirmala UI","Noto Sans Malayalam","Kartika",sans-serif';
  const Edge = window.RoboExploreEdge;
  const shape = Edge ? Edge.make({ AX: 118, AZ: 124, CZ: 0, phase: 0.7, tails: [
    { name: 'north', sx: 0, sz: -95, ux: 0, uz: -1, px: 1, pz: 0 }, { name: 'south', sx: 0, sz: 85, ux: 0, uz: 1, px: -1, pz: 0 },
    { name: 'east', sx: 95, sz: 0, ux: 1, uz: 0, px: 0, pz: -1 }, { name: 'west', sx: -80, sz: 0, ux: -1, uz: 0, px: 0, pz: 1 }] }) : null;

  /* the town on the map: the outline, the bent roads and the junction roads in the town */
  const mapRects = (ox) => shape.mapRects(ox).concat([
    [ox - 4.6, ox + 4.6, -95, 85, '#cfc3a4'], [ox - 80, ox + 95, -4.6, 4.6, '#cfc3a4'], [ox - 4, ox + 4, -95, 85, '#9a968e'], [ox - 80, ox + 95, -4, 4, '#9a968e'],
    [ox - 52, ox - 22, -30, -6, '#b9b2a4'], [ox + 10, ox + 26, -14, -4.6, '#e3e8e4'], [ox - 13.6, ox - 4.6, 4, 22, '#e9e5da']]);

  function build(c) {
    const { THREE, add, box, mat, solid, post, plane, canvasTex, rr, walker, addPickup, cullables, staticGroups, palmAt, building, buildingEW, V, spots, marker, notes, ox, kit, asphaltMat, paverMat } = c;
    const X = (lx) => ox + lx, NOTES = notes || {};
    const dark = mat(0x2a2a2a);
    const sign = (w, h, tw, th, draw) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: canvasTex(tw, th, draw), roughness: 0.85, side: THREE.DoubleSide }));
    const txt = (x, t, px, py, font, col) => { x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = col; x.font = font; x.fillText(t, px, py); };
    const noteSpot = (lx, lz, key) => { const n = NOTES[key]; if (!n) return; marker(X(lx), lz, 0xcfe8ff); spots.push({ x: X(lx), z: lz, r: 2.0, kind: 'note', arg: key, label: n.title.split(' · ')[0], emoji: n.emoji }); };
    const board = (w, h, bg, l1, l2, x, y, z, ry) => { const b = sign(w, h, 1024, Math.round(1024 * h / w), (cx, w2, h2) => { cx.fillStyle = bg; cx.fillRect(0, 0, w2, h2); cx.strokeStyle = '#f3e6cf'; cx.lineWidth = 6; cx.strokeRect(6, 6, w2 - 12, h2 - 12); txt(cx, l1, w2 / 2, h2 * 0.38, 'bold 66px sans-serif', '#fff'); txt(cx, l2, w2 / 2, h2 * 0.76, 'bold 44px ' + FONT_ML, '#ffe9b0'); }); b.position.set(x, y, z); b.rotation.y = ry || 0; add(b); cullables.push(b); b.userData = { x, z }; return b; };

    /* roads: the north-south road (Kottakkunnu Road north, Civil Station Road south) and the east-west Malappuram-Perinthalmanna Road (Kozhikode Road to the west), then the bent tails to each exit */
    const road = (x0, x1, z0, z1) => plane(x1 - x0, z1 - z0, asphaltMat, X((x0 + x1) / 2), 0.04, (z0 + z1) / 2);
    road(-4, 4, -95, 85); road(4, 95, -4, 4); road(-80, -4, -4, 4);
    [-1, 1].forEach((s) => { box(1.2, 0.16, 180, paverMat, X(s * 4.0), 0.1, -5, undefined, false); box(175, 0.16, 1.2, paverMat, X(7.5), 0.1, s * 4.0, undefined, false); });
    shape.tailPieces().forEach((q) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(8.4, q.len).rotateX(-PI / 2), asphaltMat); m.position.set(X(q.x), 0.041, q.z); m.rotation.y = q.yaw + PI / 2; m.receiveShadow = true; add(m); });
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 180).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: 0xe8e4d8 })); dash.position.set(ox, 0.06, -5); add(dash);

    /* shop rows. North road: Hotel Delicia on the west side, the bus terminal yard behind the gap at the junction. South road: the Civil Station and the Collectorate on the west side, Mariyamman Kovil on the east. East road: the Town Hall on the north side. */
    const run = (side, a, b) => { const n = Math.max(1, Math.round((b - a) / 7.5)), w = (b - a) / n; for (let i = 0; i < n; i++) building(side, a + i * w, a + (i + 1) * w, ox); };
    const runEW = (side, a, b) => { const n = Math.max(1, Math.round((b - a) / 7.5)), w = (b - a) / n; for (let i = 0; i < n; i++) buildingEW(side, a + i * w, a + (i + 1) * w, 0, ox); };
    run(1, -95, -10); run(-1, -95, -36); building(-1, -36, -24, ox, ['Hotel Delicia', 'ഹോട്ടൽ ഡെലീഷ്യ', { wall: 0xe0d2b4, awning: 0x9a3a2a, bg: '#4a1f18', fg: '#ffe9b0', h: 7.5 }]);
    building(-1, 4, 22, ox, ['Civil Station', 'സിവിൽ സ്റ്റേഷൻ', { wall: 0xe9e4d6, awning: 0x3a5a7a, bg: '#1f3a5a', fg: '#ffffff', h: 11, signW: 5 }]);
    building(-1, 24, 44, ox, ['Collectorate', 'കളക്ടറേറ്റ്', { wall: 0xe4dcc6, awning: 0x3a5a7a, bg: '#1f3a5a', fg: '#ffffff', h: 9, signW: 5 }]); run(-1, 44, 85);
    run(1, 4, 12); building(1, 12, 22, ox, ['Mariyamman Kovil', 'മാരിയമ്മൻ കോവിൽ', { wall: 0xdccaa6, awning: 0xb8352a, bg: '#7a2a1c', fg: '#ffe9b0', h: 6 }]); run(1, 22, 85);
    buildingEW(1, 10, 26, 0, ox, ['Town Hall', 'ടൗൺ ഹാൾ', { wall: 0xeae2cc, awning: 0x8a3a2a, bg: '#3a2a1a', fg: '#ffe9b0', h: 8.5, signW: 5 }]); runEW(1, 26, 94); runEW(-1, 14, 94);
    runEW(1, -80, -54); runEW(-1, -80, -14);

    /* the KSRTC Bus Terminal Malappuram: a yard behind the junction on the north side of the west road (x -52 to -22, z -30 to -6), buses, a shelter and the ticket counter */
    (() => {
      plane(30, 24, mat(0x948d80, { roughness: 0.95 }), X(-37), 0.06, -18);
      const st = sign(7, 1.4, 1024, 200, (x, w, h) => { x.fillStyle = '#8a1f2b'; x.fillRect(0, 0, w, h); x.strokeStyle = '#f3e6cf'; x.lineWidth = 6; x.strokeRect(6, 6, w - 12, h - 12); txt(x, 'MALAPPURAM KSRTC', w / 2, h * 0.38, 'bold 76px sans-serif', '#fff'); txt(x, 'മലപ്പുറം · ബസ് ടെർമിനൽ', w / 2, h * 0.76, 'bold 50px ' + FONT_ML, '#ffe9b0'); });
      st.position.set(X(-37), 4.6, -6.4); add(st); cullables.push(st); st.userData = { x: X(-37), z: -6.4 };
      [-3.3, 3.3].forEach((dx) => { box(0.2, 4.6, 0.2, dark, X(-37 + dx), 2.3, -6.4, undefined, true); post(X(-37 + dx), -6.4, 0.2); });
      if (V) {
        const b1 = V.bus('ksrtc', ['Kozhikode', 'കോഴിക്കോട്']), b2 = V.bus('ksrtc', ['Manjeri', 'മഞ്ചേരി']), b3 = V.bus('private-blue', ['Perinthalmanna', 'പെരിന്തൽമണ്ണ']);
        [[b1, -46, -18], [b2, -40, -22], [b3, -33, -16]].forEach(([m, lx, lz]) => { m.position.set(X(lx), 0, lz); add(m); cullables.push(m); m.userData.x = X(lx); m.userData.z = lz; solid(X(lx) - 1.6, X(lx) + 1.6, lz - m.userData.length / 2, lz + m.userData.length / 2, 'vehicle', m); });
      }
      const sx = -26, sz = -9; box(3.6, 0.12, 2.2, mat(0x8a1f2b), X(sx), 2.6, sz, undefined, true); [-1.6, 1.6].forEach((dx) => box(0.1, 2.6, 0.1, dark, X(sx + dx), 1.3, sz, undefined, true)); box(3.0, 0.1, 0.5, mat(0x6a4a2a), X(sx), 0.5, sz + 0.7); solid(X(sx) - 1.8, X(sx) + 1.8, sz - 0.4, sz + 1.2);
      marker(X(-30), -7.8, 0xffd27a); spots.push({ x: X(-30), z: -7.8, r: 2.2, kind: 'shop', arg: 'bus_mp_ksrtc', label: 'KSRTC tickets', emoji: '🎫' });
      noteSpot(-44, -9, 'malappuram');
    })();

    /* name boards */
    board(7.4, 1.5, '#1f5a3a', 'MALAPPURAM', 'മലപ്പുറം · കെഎസ്ആർടിസി ജങ്ഷൻ', X(0), 6.2, -8);
    board(7.8, 1.5, '#3a3a3a', 'MALAPPURAM-PERINTHALMANNA ROAD', 'മലപ്പുറം - പെരിന്തൽമണ്ണ റോഡ്', X(36), 5.2, -3, PI / 2);
    board(7.4, 1.5, '#3a3a3a', 'CIVIL STATION ROAD', 'സിവിൽ സ്റ്റേഷൻ റോഡ്', X(2), 5.2, 52, PI);

    /* life: autos at a stand, a scooter or two, palms, walkers, coins, a bit of food */
    c.auto(X(3.2), -14, PI); c.auto(X(-3.2), 14, 0.05); c.scooter(X(3.9), 30, PI / 2 - 0.1); c.scooter(X(-3.9), -60, -PI / 2);
    const NO_PALM = [[-56, -18, -34, -2], [-100, 100, -16, 16], [-8, 8, -100, 90], [4, 30, -18, 0]];   // the bus yard, the east-west road's shop rows, the north-south road, the Town Hall
    for (let i = 0, tries = 0; i < 10 && tries < 300; tries++) { const s = (i % 2 ? 1 : -1), x = s * rr(18, 44), z = rr(-80, 70); if (NO_PALM.some(([a, b, c0, d]) => x > a - 2 && x < b + 2 && z > c0 - 2 && z < d + 2)) continue; palmAt(X(x), z, i + 60, rr(1.0, 1.5)); i++; }
    [['mundu', [[X(1.2), 60], [X(1.2), -70]], 1.1], ['saree', [[X(-0.5), -80], [X(-0.5), 50]], 1.0], ['schoolgirl', [[X(-1.5), 70], [X(-1.5), 6]], 1.2], ['lungi', [[X(8), 2.6], [X(80), 2.6]], 1.1], ['thattam', [[X(-70), -2.6], [X(-8), -2.6]], 1.0]].forEach(([type, pts, sp]) => walker(type, pts, sp, 2));
    for (let i = 0; i < 16; i++) addPickup('coin', null, X(i % 2 ? -rr(0.6, 1.0) : rr(0.6, 3.0)), -86 + i * 10.5 + rr(-1, 1));
    for (let i = 0; i < 8; i++) addPickup('coin', null, X(14 + i * 10), (i % 2 ? 1 : -1) * rr(0.6, 2.6));
    [['tea', X(3.2), 18], ['banana', X(-3.0), -50], ['coconut', X(3.0), 60]].forEach(([id, x, z]) => addPickup('food', id, x, z));

    if (Edge) Edge.dress(c, shape, X, 23);   // the jungle ring, the trees and the hills
  }

  window.RoboExploreMalappuram = { build, shape, mapRects };
})();
