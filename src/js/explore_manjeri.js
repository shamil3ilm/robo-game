/* Robo Run: the Manjeri (Malappuram) area of the walkable town. Exposes window.RoboExploreManjeri = { build(ctx) }.
   Coordinates here are local (lx, lz): x = ctx.ox is the north-south highway, z = 0 is Manjeri Junction; north is -z, east is +x. The layout follows the real town read from a map (at 1:12): the highway runs north-south through the junction, Manjeri-Pandikkad Road goes east, the bypass road west; the bus stand is on the east road, the medical college south on the east side, Zil Money (the game's parody of it) far north. Real names only where a public source confirms them (explore_notes.js): Zil Money (engineering operations in Manjeri,
   the "Silicon Jeri" idea), Hotel Farsa (Pandikkad Road, Kuthukal), the KSRTC station, Government Medical College Manjeri, the Payyanad stadium, Hotel Oottupura (a restaurant on the Manjeri bypass; placed on the main road here), Hotel Zindagi (Nelliparambu), Vanitha Mess (Karuvambram), Al Rayadhan Kuzhi Mandhi and Budget Hyper Market (all placed on the main road here). Everything else is a product word. */
(function () {
  'use strict';
  const PI = Math.PI, FONT_ML = '"Nirmala UI","Noto Sans Malayalam","Kartika",sans-serif';

  /* ---------------- the shape of the walkable town ----------------
     Not a rectangle: an irregular outline (a wobbly ellipse) round the junction. The edge is a ring of dense jungle that cannot be walked through; the four roads leave through gaps in it and end in a barrier. Pure, and tested in tests/manjeri.test.js.
     Coordinates are local (x east of the highway, z south of the junction). */
  const AX = 124, AZ = 158, CZ = -16;
  const wob = (t) => 1 + 0.09 * Math.sin(3 * t + 1) + 0.06 * Math.sin(5 * t + 2) + 0.035 * Math.sin(9 * t + 0.5);
  const inside = (x, z, m) => { const dx = x / AX, dz = (z - CZ) / AZ; return Math.hypot(dx, dz) < wob(Math.atan2(dz, dx)) - (m || 0); };
  const loopPoints = (n) => { const out = []; for (let k = 0; k < n; k++) { const t = (k / n) * Math.PI * 2, w = wob(t); out.push({ x: AX * w * Math.cos(t), z: CZ + AZ * w * Math.sin(t), t }); } return out; };
  /* the four roads leave the shop rows straight and then bend away: the highway north bends west and south bends east (as on the real map), the east road bends north and the bypass road south. t is the distance beyond the last shop. */
  const BEND = 0.0055, TAILS = [
    { name: 'north', sx: 0, sz: -135, ux: 0, uz: -1, px: -1, pz: 0 }, { name: 'south', sx: 0, sz: 105, ux: 0, uz: 1, px: 1, pz: 0 },
    { name: 'east', sx: 95, sz: 0, ux: 1, uz: 0, px: 0, pz: -1 }, { name: 'west', sx: -95, sz: 0, ux: -1, uz: 0, px: 0, pz: 1 }];
  const tailPoint = (d, t) => ({ x: d.sx + d.ux * t + d.px * BEND * t * t, z: d.sz + d.uz * t + d.pz * BEND * t * t });
  const tailDir = (d, t) => { const tx = d.ux + d.px * 2 * BEND * t, tz = d.uz + d.pz * 2 * BEND * t, l = Math.hypot(tx, tz); return { tx: tx / l, tz: tz / l }; };
  /* where each road leaves the town: the last point of its bent tail that is still inside the outline */
  const exits = () => TAILS.map((d) => { let t = 0; for (; t < 300 && inside(tailPoint(d, t + 0.5).x, tailPoint(d, t + 0.5).z, 0); t += 0.5); const p = tailPoint(d, t), v = tailDir(d, t); return Object.assign(p, v, { t, name: d.name, def: d }); });
  /* the road surface of the tails as short straight pieces: [{ x, z, len, yaw }] (a piece every 6 m, centred on the bent path, turned to follow it), up to each exit */
  const tailPieces = () => { const out = []; for (const e of exits()) for (let t = 0; t < e.t; t += 6) { const m = Math.min(t + 3, e.t - 0.01), p = tailPoint(e.def, m), v = tailDir(e.def, m); out.push({ x: p.x, z: p.z, len: Math.min(6.6, e.t - t + 0.6), yaw: Math.atan2(-v.tz, v.tx), name: e.name }); } return out; };
  /* the town on the map: the land as strips (so the outline shows), and the jungle ring along its edge. Returns [x0, x1, z0, z1, colour] in world x (ox added) */
  const mapRects = (ox) => {
    const out = [];
    for (let z = -190; z < 160; z += 5) {
      let xl = null, xr = null; for (let x = -150; x <= 150; x += 1) if (inside(x, z + 2.5, 0)) { if (xl === null) xl = x; xr = x; }
      if (xl === null) continue;
      out.push([ox + xl, ox + xr, z, z + 5.8, '#6f7a44']);   // a little taller than the step, so the strips overlap and show no seams
      out.push([ox + xl, ox + xl + 11, z, z + 5.8, '#2f4a2c'], [ox + xr - 11, ox + xr, z, z + 5.8, '#2f4a2c']);
    }
    for (const q of tailPieces()) out.push([ox + q.x - 4, ox + q.x + 4, q.z - 4, q.z + 4, '#9a968e']);   // the bent roads
    return out;
  };

  function build(c) {
    const { THREE, add, box, mat, solid, post, plane, canvasTex, rr, pick, walker, stander, addPickup, cullables, palmAt, building, buildingEW, auto, scooter, V, spots, marker, notes, ox, kit, earthMat, asphaltMat, paverMat, roofMat } = c;
    const X = (lx) => ox + lx;
    const NOTES = notes || {};
    const glass = mat(0x24405a, { roughness: 0.15, metalness: 0.5 }), white = mat(0xf4f1e8), dark = mat(0x2a2a2a);
    const mesh = (geo, m, x, y, z, parent) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; (parent || c.scene).add(o); return o; };
    const sign = (w, h, tw, th, draw) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: canvasTex(tw, th, draw), roughness: 0.85, side: THREE.DoubleSide })); return m; };
    const txt = (x, t, px, py, font, col) => { x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = col; x.font = font; x.fillText(t, px, py); };
    const both = (m, g) => { const back = m.clone(); back.rotation.y = m.rotation.y + PI; back.position.z += Math.cos(m.rotation.y) * -0.04; (g || c.scene).add(back); return back; };   // a sign readable from both sides: a second copy turned round (a plane seen from behind would read mirrored)
    const noteSpot = (lx, lz, key) => { const n = NOTES[key]; if (!n) return; marker(X(lx), lz, 0xcfe8ff); spots.push({ x: X(lx), z: lz, r: 2.0, kind: 'note', arg: key, label: n.title.split(' · ')[0], emoji: n.emoji }); };

    /* Zilla Money, the game's parody of the real development centre in Manjeri (own name, own coin logo, own colours; no original brand assets). Built from the owner's photos: a four-storey block of white floors between dark-grey bands, a glass ground floor with planters, a planter ledge on the second floor, a wide white sign board, and solar panels on the roof */
    (() => {
      const g = new THREE.Group(), zx = 4.6, w = 17, d = 12, zc = -126, bandH = 0.75, bandMat = mat(0x3a3d42, { roughness: 0.8 }), floorH = [4.4, 3.5, 3.5, 3.3];
      let y = 0; const tops = [];
      floorH.forEach((fh, i) => {
        if (i === 0) mesh(new THREE.BoxGeometry(d, fh, w), mat(0xe9e6df), X(zx + d / 2), fh / 2, zc, g);                            // the ground floor body
        else mesh(new THREE.BoxGeometry(d, fh, w), white, X(zx + d / 2), y + fh / 2, zc, g);                                       // a white floor
        y += fh; mesh(new THREE.BoxGeometry(d + 0.5, bandH, w + 0.4), bandMat, X(zx + d / 2 - 0.1), y + bandH / 2, zc, g); tops.push(y); y += bandH;   // the dark band above it
      });
      const h = y;
      mesh(new THREE.BoxGeometry(0.14, floorH[0] - 0.9, w - 1.2), glass, X(zx - 0.07), (floorH[0] - 0.9) / 2 + 0.1, zc, g);        // the glass ground floor
      mesh(new THREE.BoxGeometry(0.14, 3.0, 0.14), dark, X(zx - 0.1), 1.6, zc - 2.2, g); mesh(new THREE.BoxGeometry(0.14, 3.0, 0.14), dark, X(zx - 0.1), 1.6, zc + 2.2, g);
      mesh(new THREE.BoxGeometry(2.0, 0.22, w - 1.4), dark, X(zx - 0.9), floorH[0] - 0.55, zc, g);                                  // the entrance canopy
      mesh(new THREE.BoxGeometry(0.12, 2.6, 3.6), mat(0x1b2a38, { roughness: 0.2, metalness: 0.4 }), X(zx - 0.12), 1.3, zc, g);   // glass doors
      for (let i = 1; i < 4; i++) { const yy = tops[i - 1] + bandH + floorH[i] * 0.55; mesh(new THREE.BoxGeometry(0.1, 1.6, w - 3.0), glass, X(zx - 0.04), yy, zc, g); }   // a glass strip on each upper floor
      /* the planter ledge on the second floor: a row of shrubs along the band, as in the photo */
      const ledgeY = tops[1] + bandH; mesh(new THREE.BoxGeometry(1.0, 0.5, w - 1.0), bandMat, X(zx - 0.45), ledgeY + 0.25, zc, g);
      for (let i = 0; i < 9; i++) { const zz = zc - w / 2 + 1.2 + i * ((w - 2.4) / 8); mesh(new THREE.CylinderGeometry(0.3, 0.24, 0.35, 8), mat(0xb5532e), X(zx - 0.5), ledgeY + 0.68, zz, g); mesh(new THREE.SphereGeometry(0.46, 8, 6), mat(0x3f7a30, { flatShading: true }), X(zx - 0.5), ledgeY + 1.2, zz, g); }
      /* the sign board: white, wide, on the first upper floor; coin mark, name, and that it is a parody */
      const name = sign(12.5, 3.0, 1024, 250, (x, w2, h2) => { x.fillStyle = '#f4f2ec'; x.fillRect(0, 0, w2, h2); x.strokeStyle = '#12373a'; x.lineWidth = 8; x.strokeRect(8, 8, w2 - 16, h2 - 16); x.fillStyle = '#ffc857'; x.beginPath(); x.arc(140, h2 / 2, 76, 0, 6.3); x.fill(); x.strokeStyle = '#12373a'; x.lineWidth = 7; x.beginPath(); x.arc(140, h2 / 2, 60, 0, 6.3); x.stroke(); x.fillStyle = '#12373a'; x.font = 'bold 96px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('Z', 140, h2 / 2 + 4); x.fillRect(138, h2 / 2 - 98, 4, 24); x.beginPath(); x.arc(140, h2 / 2 - 102, 8, 0, 6.3); x.fill(); txt(x, 'ZILLA MONEY', w2 * 0.6, h2 * 0.36, 'bold 100px sans-serif', '#12373a'); txt(x, 'Development Center · Silicon Jeri · a parody', w2 * 0.6, h2 * 0.72, 'bold 40px sans-serif', '#8a5a14'); });
      name.rotation.y = -PI / 2; name.position.set(X(zx - 0.34), tops[0] + bandH + 1.9, zc); g.add(name);
      /* the roof: a parapet and rows of solar panels, tilted to the south */
      mesh(new THREE.BoxGeometry(d + 0.2, 0.7, 0.3), bandMat, X(zx + d / 2), h + 0.35, zc - w / 2 + 0.15, g); mesh(new THREE.BoxGeometry(d + 0.2, 0.7, 0.3), bandMat, X(zx + d / 2), h + 0.35, zc + w / 2 - 0.15, g);
      const panel = mat(0x1d2f4a, { roughness: 0.25, metalness: 0.5 });
      for (let r = 0; r < 3; r++) for (let k = 0; k < 6; k++) { const p = mesh(new THREE.BoxGeometry(1.5, 0.06, 2.2), panel, X(zx + 2.2 + r * 3.0), h + 1.1, zc - w / 2 + 2.0 + k * 2.4, g); p.rotation.x = -0.35; }
      add(g); g.userData = { x: X(zx + d / 2), z: zc }; cullables.push(g); if (c.staticGroups) c.staticGroups.push(g); solid(X(zx), X(zx + d), zc - w / 2, zc + w / 2);
      c.door(X(2.9), zc, 'zilmoney', 'Enter Zilla Money', '💼');
      /* the garden at the front: planters in white pots either side of the door (a low dark fence stands behind them in the photo) */
      for (let i = 0; i < 6; i++) { const zz = zc + (i - 2.5) * 2.6; if (Math.abs(zz - zc) < 1.9) continue; mesh(new THREE.CylinderGeometry(0.4, 0.3, 0.7, 10), mat(0xf1eee6), X(zx - 1.3), 0.35, zz, g); mesh(new THREE.SphereGeometry(0.62, 8, 6), mat(0x3f7a30, { flatShading: true }), X(zx - 1.3), 1.15, zz, g); }
    })();

    /* ground and the roads: the highway runs north-south (x = ox) from z = -135 to 105; Manjeri Junction is at z = 0; Manjeri-Pandikkad Road runs east and the bypass road west */
    const EX = exits(), zMid = -15, zLen = 240;
    plane(1500, 1500, mat(0x6b7a46, { roughness: 1 }), ox, -0.06, -15);   // the ground goes on far beyond the town
    const road = (x0, x1, z0, z1) => plane(x1 - x0, z1 - z0, asphaltMat, X((x0 + x1) / 2), 0.04, (z0 + z1) / 2);
    road(-4, 4, -135, 105); road(4, 95, -4, 4); road(-95, -4, -4, 4);
    tailPieces().forEach((q) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(8.4, q.len).rotateX(-PI / 2), asphaltMat); m.position.set(X(q.x), 0.041, q.z); m.rotation.y = q.name === 'north' || q.name === 'south' ? q.yaw + PI / 2 : q.yaw + PI / 2; m.receiveShadow = true; add(m); });
    [-1, 1].forEach((s) => {
      box(1.2, 0.16, 240, paverMat, X(s * 4.0), 0.1, -15, undefined, false); box(0.34, 0.1, 240, mat(0x8d8a84), X(s * 3.5), 0.09, -15, undefined, false);   // the highway's pavements
      box(90, 0.16, 1.2, paverMat, X(50), 0.1, s * 4.0, undefined, false); box(90, 0.16, 1.2, paverMat, X(-50), 0.1, s * 4.0, undefined, false);               // the east and west roads' pavements
    });
    const dashM = new THREE.Mesh(new THREE.PlaneGeometry(0.2, zLen).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: 0xe8e4d8 })); dashM.position.set(ox, 0.06, zMid); add(dashM);   // the highway's centre line

    /* the shop rows: product-word signs, and the real places on their real stretches */
    const run = (side, a, b) => { const n = Math.max(1, Math.round((b - a) / 7.5)), w = (b - a) / n; for (let i = 0; i < n; i++) building(side, a + i * w, a + (i + 1) * w, ox); };
    const runEW = (side, a, b) => { const n = Math.max(1, Math.round((b - a) / 7.5)), w = (b - a) / n; for (let i = 0; i < n; i++) buildingEW(side, a + i * w, a + (i + 1) * w, 0, ox); };
    /* the highway, east side (Zil Money's block fills z -134.5 to -117.5): Vanitha Mess, shops, the medical college drive at z 26 to 52, the scrap dealer's passage at 56 to 66, Budget Hyper Market at the south end */
    run(1, -117.5, -104); run(1, -96, -92); building(1, -92, -81, ox, ['Vanitha Mess', 'വനിത മെസ്']); run(1, -81, -9); run(1, 9, 26); run(1, 52, 56); run(1, 66, 86); building(1, 86, 102, ox, ['Budget Hyper Market', 'ബജറ്റ് ഹൈപ്പർ മാർക്കറ്റ്', { wall: 0xcfd3d6, awning: 0x1f5a3a, bg: '#12301f', fg: '#ffffff', h: 15.5, signW: 8 }]);
    /* the highway, west side: Al Rayadhan and Hotel Zindagi in the north, Robo's dock by the junction, the football turf at z 30 to 58 */
    run(-1, -135, -125); building(-1, -125, -113, ox, ['Al Rayadhan', 'കുഴിമന്തി']); run(-1, -113, -109); building(-1, -109, -97, ox, ['Hotel Zindagi', 'ഹോട്ടൽ സിന്ദഗി', { wall: 0xe6dcc4, awning: 0xb99a6a, bg: '#6a4a2a', fg: '#fff1cf', h: 5.4 }]); run(-1, -97, -9);
    building(-1, 9, 19, ox, ["Robo's Dock", 'റോബോയുടെ വീട്']); run(-1, 19, 28); run(-1, 60, 104);
    /* Manjeri-Pandikkad Road (east): the software studio and the repair shop of the story on the north side, Hotel Farsa on the south side, the bus stand yard at x 28 to 58 */
    runEW(1, 14, 62); buildingEW(1, 62, 73, 0, ox, ['Software Studio', 'സോഫ്റ്റ്‌വെയർ സ്റ്റുഡിയോ']); runEW(1, 73, 76); buildingEW(1, 76, 88, 0, ox, ['EV & Electronics Repair', 'ഇലക്ട്രോണിക്സ് റിപ്പയർ']); runEW(1, 88, 94);
    buildingEW(-1, 14, 26, 0, ox, ['Hotel Farsa', 'ഹോട്ടൽ ഫർസ', { wall: 0xd8c8a2, awning: 0xc2a46a, bg: '#5a4630', fg: '#f0d896', h: 9.5, signW: 6 }]); runEW(-1, 60, 94);
    /* the bypass road (west): Hotel Oottupura far out, shops either side */
    runEW(1, -94, -14); runEW(-1, -94, -81); buildingEW(-1, -81, -69, 0, ox, ['Hotel Oottupura', 'ഹോട്ടൽ ഊട്ടുപുര', { wall: 0x2b2826, awning: 0x3a3430, bg: '#16110d', fg: '#ffd23a', h: 6.2, signW: 6 }]); runEW(-1, -69, -14);
    /* Cherani Cross Road runs north-south 40 m east of the highway (z -135 to -58) and Happy Road joins it to the highway at z -100, as on the map; shops on both, a stone wall at each end (the real roads go on) */
    plane(8, 77, asphaltMat, X(40), 0.045, -96.5); plane(26, 8, asphaltMat, X(22), 0.045, -100);
    [-1, 1].forEach((s) => { box(1.2, 0.16, 77, paverMat, X(40 + s * 4.0), 0.1, -96.5, undefined, false); box(26, 0.16, 1.2, paverMat, X(22), 0.1, -100 + s * 4.0, undefined, false); });
    const wallM = mat(0x8d8a84, { roughness: 0.95 }); [-135.4, -57.6].forEach((wz) => { box(9.4, 2.4, 0.6, wallM, X(40), 1.2, wz, undefined, true); solid(X(40) - 4.7, X(40) + 4.7, wz - 0.4, wz + 0.4, 'wall'); });
    const runX = (side, a, b) => { const n = Math.max(1, Math.round((b - a) / 7.5)), w = (b - a) / n; for (let i = 0; i < n; i++) building(side, a + i * w, a + (i + 1) * w, ox + 40); };
    runX(-1, -134, -106); runX(-1, -94, -60); runX(1, -134, -106); runX(1, -94, -60);
    for (let i = 0; i < 3; i++) { buildingEW(1, 15 + i * 6, 21 + i * 6, -100, ox); buildingEW(-1, 15 + i * 6, 21 + i * 6, -100, ox); }
    for (let i = 0; i < 6; i++) addPickup('coin', null, X(40 + (i % 2 ? -1 : 1) * rr(0.4, 2)), -130 + i * 12);
    walker('schoolgirl', [[X(41.2), -130], [X(41.2), -64]], 1.2, 2); walker('mundu', [[X(18), -98.4], [X(36), -98.4]], 1.0, 1);
    c.door(X(20), 3.0, 'farsa', 'Enter Hotel Farsa', '🍛'); c.door(X(-75), 3.0, 'oottupura', 'Enter Hotel Oottupura', '🍽️');
    c.door(X(-3.0), -103, 'zindagi', 'Enter Hotel Zindagi', '🍽️'); c.door(X(3.0), -86.5, 'vanitha', 'Enter Vanitha Mess', '🍛'); c.door(X(-3.0), -119, 'rayadhan', 'Enter Al Rayadhan Kuzhi Mandhi', '🍖');
    c.door(X(3.0), 94, 'budget', 'Enter Budget Hyper Market', '🛒'); c.door(X(-3.0), 14, 'home', "Enter Robo's dock", '🤖');   // Robo's home is by the junction: you start here


    /* bunting and a wire across the road: a sagging line of small flags between the two shop rows, and a dark cable above it */
    const buntLine = (zz, y, lx0, lx1, alongX) => {
      const cols = [0xd9382a, 0xf2b01c, 0x2f8a5a, 0x3a6ab8, 0xf4f1e8].map((hx) => mat(hx, { side: THREE.DoubleSide })), n = 18, len = lx1 - lx0, grp = new THREE.Group();
      for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, sag = Math.sin(t * PI) * 0.7, p = lx0 + len * t; const f = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.38), cols[i % 5]); f.position.set(alongX ? X(p) : X(lx0), y - sag - 0.19, alongX ? zz : zz + (p - lx0)); f.rotation.y = alongX ? 0 : PI / 2; grp.add(f); }
      const cord = new THREE.Mesh(new THREE.BoxGeometry(alongX ? len : 0.03, 0.03, alongX ? 0.03 : len), mat(0x2a2a2a)); cord.position.set(alongX ? X((lx0 + lx1) / 2) : X(lx0), y - 0.25, alongX ? zz : zz + len / 2); grp.add(cord);
      c.add(grp); grp.userData = { x: X((lx0 + lx1) / 2), z: alongX ? zz : zz + len / 2 }; cullables.push(grp); if (c.staticGroups) c.staticGroups.push(grp);
    };
    [-100, -62, -24, 22, 62, 90].forEach((zz) => buntLine(zz, 6.4, -4.4, 4.4, true));
    /* name boards: the junction, the two roads, and the locality in the north */
    const board = (w, h, bg, l1, l2, x, y, z, ry) => { const b = sign(w, h, 1024, Math.round(1024 * h / w), (cx, w2, h2) => { cx.fillStyle = bg; cx.fillRect(0, 0, w2, h2); cx.strokeStyle = '#f3e6cf'; cx.lineWidth = 6; cx.strokeRect(6, 6, w2 - 12, h2 - 12); txt(cx, l1, w2 / 2, h2 * 0.38, 'bold 72px sans-serif', '#fff'); txt(cx, l2, w2 / 2, h2 * 0.76, 'bold 46px ' + FONT_ML, '#ffe9b0'); }); b.position.set(x, y, z); b.rotation.y = ry || 0; add(b); both(b); cullables.push(b); b.userData = { x, z }; return b; };
    board(7.4, 1.5, '#1f5a3a', 'MANJERI JUNCTION', 'മഞ്ചേരി ജങ്ഷൻ', X(0), 6.2, -8);
    board(7.4, 1.5, '#3a3a3a', 'MANJERI-PANDIKKAD ROAD', 'മഞ്ചേരി - പാണ്ടിക്കാട് റോഡ്', X(30), 5.2, -3, PI / 2);
    board(7.4, 1.5, '#3a3a3a', 'BYPASS ROAD', 'ബൈപ്പാസ് റോഡ്', X(-30), 5.2, -3, PI / 2);
    board(7.4, 1.5, '#3a3a3a', 'CHERANI CROSS ROAD', 'ചേരാണി ക്രോസ് റോഡ്', X(40), 5.4, -82, PI / 2);

    /* the KSRTC station: on the east road's south side (x 28 to 58, z 5 to 33): a Fast Passenger and a private bus, a lorry, a shelter, and the bus to Kozhikode */
    (() => {
      plane(30, 28, mat(0x948d80, { roughness: 0.95 }), X(43), 0.06, 19);
      const station = sign(7, 1.4, 1024, 200, (x, w, h) => { x.fillStyle = '#8a1f2b'; x.fillRect(0, 0, w, h); x.strokeStyle = '#f3e6cf'; x.lineWidth = 6; x.strokeRect(6, 6, w - 12, h - 12); txt(x, 'MANJERI KSRTC', w / 2, h * 0.38, 'bold 84px sans-serif', '#fff'); txt(x, 'മഞ്ചേരി · ബസ് സ്റ്റേഷൻ', w / 2, h * 0.76, 'bold 52px ' + FONT_ML, '#ffe9b0'); });
      station.position.set(X(43), 4.6, 6.4); add(station); both(station); cullables.push(station); station.userData = { x: X(43), z: 6.4 };
      [-3.3, 3.3].forEach((dx) => { box(0.2, 4.6, 0.2, dark, X(43 + dx), 2.3, 6.4, undefined, true); post(X(43 + dx), 6.4, 0.2); });
      if (V) {
        const b1 = V.bus('ksrtc', ['Kozhikode', 'കോഴിക്കോട്']), b2 = V.bus('private-blue', ['Perinthalmanna', 'പെരിന്തൽമണ്ണ']), lo = V.lorry(0xd9792a);
        [[b1, 41, 21], [b2, 47, 25], [lo, 53, 15]].forEach(([m, lx, lz]) => { m.position.set(X(lx), 0, lz); add(m); cullables.push(m); m.userData.x = X(lx); m.userData.z = lz; solid(X(lx) - 1.6, X(lx) + 1.6, lz - m.userData.length / 2, lz + m.userData.length / 2, 'vehicle', m); });
      }
      const sx = 32, sz = 11; box(3.6, 0.12, 2.2, mat(0x8a1f2b), X(sx), 2.6, sz, undefined, true); [-1.6, 1.6].forEach((dx) => box(0.1, 2.6, 0.1, dark, X(sx + dx), 1.3, sz, undefined, true)); box(3.0, 0.1, 0.5, mat(0x6a4a2a), X(sx), 0.5, sz + 0.7); solid(X(sx) - 1.8, X(sx) + 1.8, sz - 0.4, sz + 1.2);
      marker(X(32.5), 8.6, 0xffd27a); spots.push({ x: X(32.5), z: 8.6, r: 2.2, kind: 'shop', arg: 'bus_mj_ksrtc', label: 'KSRTC tickets', emoji: '🎫' });
      noteSpot(30, 15, 'ksrtc');
    })();

    /* the football turf (west, south end): Malappuram is football country */
    (() => {
      const cx = -21, cz = 44, w = 26, d = 28, g = new THREE.Group();
      const tex = canvasTex(256, 280, (x, w2, h2) => { x.fillStyle = '#2f8a3a'; x.fillRect(0, 0, w2, h2); for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'; x.fillRect(0, (i * h2) / 8, w2, h2 / 8); } x.strokeStyle = 'rgba(255,255,255,0.9)'; x.lineWidth = 4; x.strokeRect(12, 12, w2 - 24, h2 - 24); x.beginPath(); x.moveTo(12, h2 / 2); x.lineTo(w2 - 12, h2 / 2); x.stroke(); x.beginPath(); x.arc(w2 / 2, h2 / 2, 32, 0, 6.3); x.stroke(); x.strokeRect(w2 / 2 - 44, 12, 88, 36); x.strokeRect(w2 / 2 - 44, h2 - 48, 88, 36); });
      const turf = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-PI / 2), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 })); turf.position.set(X(cx), 0.07, cz); turf.receiveShadow = true; add(turf);
      [-1, 1].forEach((s) => { const gz = cz + s * (d / 2 - 1.4); box(0.12, 2.2, 0.12, white, X(cx - 3), 1.1, gz, undefined, true); box(0.12, 2.2, 0.12, white, X(cx + 3), 1.1, gz, undefined, true); box(6.1, 0.12, 0.12, white, X(cx), 2.2, gz, undefined, true); });
      // mesh fence on three sides, a gap on the road side; floodlights at the corners
      const fenceTex = canvasTex(64, 64, (x, w2, h2) => { x.clearRect(0, 0, w2, h2); x.strokeStyle = 'rgba(30,30,30,0.85)'; x.lineWidth = 2; for (let i = 0; i <= 8; i++) { x.beginPath(); x.moveTo(i * 8, 0); x.lineTo(i * 8, h2); x.moveTo(0, i * 8); x.lineTo(w2, i * 8); x.stroke(); } }, 6, 1);
      const fm = new THREE.MeshBasicMaterial({ map: fenceTex, transparent: true, side: THREE.DoubleSide, alphaTest: 0.3 });
      [[cx, cz - d / 2, w, 0], [cx, cz + d / 2, w, 0], [cx - w / 2, cz, d, PI / 2]].forEach(([fx, fz, len, ry]) => { const f = new THREE.Mesh(new THREE.PlaneGeometry(len, 1.8), fm); f.position.set(X(fx), 0.9, fz);   /* low enough for the camera to see over when it stands behind the fence */ f.rotation.y = ry; add(f); });
      solid(X(cx - w / 2) - 0.3, X(cx + w / 2), cz - d / 2 - 0.2, cz - d / 2 + 0.2); solid(X(cx - w / 2) - 0.3, X(cx + w / 2), cz + d / 2 - 0.2, cz + d / 2 + 0.2); solid(X(cx - w / 2) - 0.3, X(cx - w / 2) + 0.3, cz - d / 2, cz + d / 2);
      solid(X(cx + w / 2) - 0.2, X(cx + w / 2) + 0.2, cz - d / 2, cz + d / 2 - 6); solid(X(cx + w / 2) - 0.2, X(cx + w / 2) + 0.2, cz + d / 2 - 3, cz + d / 2);   // the gate gap is on the road side
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx2, sz2]) => { const px = X(cx + sx2 * (w / 2 + 0.5)), pz = cz + sz2 * (d / 2 + 0.5); box(0.2, 8, 0.2, dark, px, 4, pz, undefined, true); mesh(new THREE.BoxGeometry(1.2, 0.5, 0.4), new THREE.MeshBasicMaterial({ color: 0xfff2c0 }), px, 8.1, pz, g); post(px, pz, 0.3); });
      const board = sign(5.5, 1.1, 1024, 200, (x, w2, h2) => { x.fillStyle = '#12482a'; x.fillRect(0, 0, w2, h2); x.strokeStyle = '#fff'; x.lineWidth = 6; x.strokeRect(6, 6, w2 - 12, h2 - 12); txt(x, 'FOOTBALL TURF', w2 / 2, h2 * 0.38, 'bold 84px sans-serif', '#fff'); txt(x, 'ഫുട്ബോൾ ടർഫ്', w2 / 2, h2 * 0.76, 'bold 56px ' + FONT_ML, '#ffe9b0'); });
      board.position.set(X(cx), 5, cz - d / 2); g.add(board); both(board, g); add(g); g.userData = { x: X(cx), z: cz }; cullables.push(g);
      noteSpot(-6.5, 40, 'payyanad');
      // the game: you and two schoolboys play north (home) against three men who play south (away); walk into the ball to dribble, the action button shoots, run into a dribbler's ball to steal it
      const TU = window.RoboTurf, pitch = TU.rect(X(cx), cz, w, d), ball = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), mat(0xf4f1e8));
      ball.castShadow = true; add(ball);
      const mk = (type, team, lx, lz) => { const p = walker(type, [[X(lx), lz], [X(lx), lz]], 0, 0); p.ctrl = true; return { p, s: { x: X(lx), z: lz, team, hx: X(lx), hz: lz, moving: false, yaw: team === 'home' ? 0 : PI } }; };
      const team = [mk('schoolboy', 'home', cx - 5, cz + 7), mk('schoolboy', 'home', cx + 5, cz + 3), mk('fisher', 'away', cx - 5, cz - 7), mk('lungi', 'away', cx + 5, cz - 3), mk('mundu', 'away', cx, cz - 9)];
      const fresh = () => ({ x: X(cx), z: cz, vx: 0, vz: 0, hop: 0, last: -9 });
      let b = fresh(), now = 0, home = 0, away = 0, pause = 0, told = false, paid = 0, wins = 0;   /* ₹10 for each of your first five goals since the page was opened, so goals cannot be farmed */
      const shot = { x: b.x, z: b.z, r: 1.9, kind: 'kick', label: 'Shoot', emoji: '⚽', quiet: true, off: true, use: () => { const pl = c.player(); b = TU.shoot(b, pl, -Math.sin(pl.yaw), -Math.cos(pl.yaw), now); } };
      c.spots.push(shot);
      c.onFrame((dt) => {
        now += dt; const pl = c.player && c.player(); if (!pl || Math.abs(pl.x - b.x) > 70 || Math.abs(pl.z - b.z) > 70) return;
        const playing = !pl.room && !pl.ride && !pl.bike; shot.off = !playing || pause > 0;
        if (pause > 0) pause -= dt;
        else {
          if (playing) { if (!told && Math.hypot(pl.x - b.x, pl.z - b.z) < 5) { told = true; c.toast && c.toast('Walk into the ball to dribble. The action button shoots. You play north with two schoolboys.'); } b = TU.kick(b, pl, now); }
          const r = TU.ai(team.map((q) => q.s), b, pitch, Math.min(dt, 0.1), now, playing ? pl : null); b = TU.step(r.ball, Math.min(dt, 0.1), pitch);
          r.players.forEach((s2, i) => { team[i].s = s2; const g2 = team[i].p.g; g2.position.x = s2.x; g2.position.z = s2.z; let dy = s2.yaw - g2.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); g2.rotation.y += dy * Math.min(1, dt * 8); team[i].p.moving = s2.moving; });
          const gl = TU.goal(b, pitch);
          if (gl) { if (gl === 'north') home++; else away++; const pay = gl === 'north' && paid < 5 && c.coin; if (pay) { paid++; c.coin(10); } const won = TU.result(home, away), line = home + ' - ' + away;
          if (won) { const bonus = won === 'home' && wins < 2 && c.coin; if (bonus) { wins++; c.coin(30); } c.toast && c.toast(won === 'home' ? 'FULL TIME! You win ' + line + (bonus ? '   +₹30' : '') : 'FULL TIME. They win ' + line + '. Try again.'); home = away = 0; pause = 4.5; }
          else { c.toast && c.toast(gl === 'north' ? 'GOAL for you! ⚽  ' + line + (pay ? '   +₹10' : '') : 'Goal for them.  ' + line); pause = 1.6; } b = fresh(); team.forEach((q) => { q.s = Object.assign({}, q.s, { x: q.s.hx, z: q.s.hz }); q.p.g.position.x = q.s.hx; q.p.g.position.z = q.s.hz; }); }
        }
        ball.position.set(b.x, 0.25 + b.hop, b.z); ball.rotation.x += b.vz * dt * 4; ball.rotation.z -= b.vx * dt * 4; shot.x = b.x; shot.z = b.z;
      });
    })();

    /* the Government Medical College: south of the junction on the east side of the highway, a gate and a drive (z 36) leading to the OPD building at the back */
    (() => {
      const g = new THREE.Group(), stone = mat(0xd8d0bc, { roughness: 0.95 }), gz = 38;
      [-1, 1].forEach((s) => box(0.9, 6.0, 0.9, stone, X(8), 3.0, gz + s * 3.3, g, true)); box(1.0, 1.7, 8.2, stone, X(8), 6.4, gz, g, true);
      const nm = sign(7.6, 1.5, 1024, 200, (x, w, h) => { x.fillStyle = '#0f4a8a'; x.fillRect(0, 0, w, h); x.strokeStyle = '#fff'; x.lineWidth = 6; x.strokeRect(6, 6, w - 12, h - 12); txt(x, 'GOVERNMENT MEDICAL COLLEGE · MANJERI', w / 2, h * 0.36, 'bold 50px sans-serif', '#fff'); txt(x, 'ഗവൺമെന്റ് മെഡിക്കൽ കോളേജ് · മഞ്ചേരി', w / 2, h * 0.74, 'bold 44px ' + FONT_ML, '#ffe9b0'); });
      nm.rotation.y = -PI / 2; nm.position.set(X(7.45), 6.4, gz); g.add(nm); both(nm, g); add(g); g.userData = { x: X(8), z: gz }; cullables.push(g); if (c.staticGroups) c.staticGroups.push(g);
      plane(30, 24, mat(0x7a9a52, { roughness: 1 }), X(25), 0.06, gz);                                                           // the lawn
      plane(20, 5, mat(0xb9b2a4, { roughness: 0.95 }), X(18), 0.08, gz);                                                         // the drive
      box(0.6, 3, 11.4, mat(0xe9e2d0), X(8), 1.5, 31.7, undefined, true); box(0.6, 3, 11.4, mat(0xe9e2d0), X(8), 1.5, 44.3, undefined, true); solid(X(8) - 0.3, X(8) + 0.3, 26, 34.6); solid(X(8) - 0.3, X(8) + 0.3, 41.4, 50);   // the compound wall either side of the gate
      box(10, 9, 22, mat(0xe9e2d0), X(35), 4.5, gz, undefined, true); box(10.4, 0.7, 22.4, mat(0x3a3d42), X(35), 9.2, gz, undefined, true); solid(X(30), X(40), gz - 11, gz + 11);   // the OPD block
      for (let i = 0; i < 3; i++) box(0.1, 1.6, 18, mat(0x24405a, { roughness: 0.2, metalness: 0.4 }), X(29.9), 2.5 + i * 2.7, gz);
      const amb = new THREE.Group(); box(1.9, 1.9, 4.4, white, 0, 1.3, 0, amb); box(1.92, 0.3, 4.42, mat(0xb8352a), 0, 1.0, 0, amb); box(1.8, 0.5, 0.06, glass, 0, 2.0, -2.2, amb); box(0.2, 0.9, 0.9, mat(0xb8352a), 0, 2.45, 0, amb);
      [[-0.9, -1.4], [0.9, -1.4], [-0.9, 1.4], [0.9, 1.4]].forEach(([wx, wz]) => { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.25, 12).rotateZ(PI / 2), mat(0x151515)); wh.position.set(wx, 0.38, wz); amb.add(wh); });
      amb.position.set(X(22), 0, gz - 8); amb.rotation.y = PI / 2 + 0.2; add(amb); cullables.push(amb); amb.userData = { x: X(22), z: gz - 8 }; solid(X(22) - 2.4, X(22) + 2.4, gz - 9.3, gz - 6.7);
      c.door(X(27), gz, 'mcmanjeri', 'Enter the medical college OPD', '🏥');
    })();

    /* tea stalls, an ice-cream cart, autos at their stands, scooters, the KSEB transformer, palms, and people */
    const st = kit.stall(); st.position.set(X(3.1), 0, 20); st.rotation.y = -PI / 2; st.scale.setScalar(1.1); add(st); cullables.push(st); st.userData = { x: X(3.1), z: 20 }; solid(X(3.1) - 0.9, X(3.1) + 0.9, 18.6, 21.4, 'stall', st);
    if (V) { const ic = V.iceCream(); ic.position.set(X(-3.2), 0, 26); ic.rotation.y = PI / 2; add(ic); cullables.push(ic); ic.userData = { x: X(-3.2), z: 26 }; post(X(-3.2), 26, 0.9, 'stall', ic); stander('thattam', X(-2.2), 26.8, PI / 2); }
    stander('mundu', X(2.2), 20.8, PI / 2);
    auto(X(3.2), -108, PI); auto(X(-3.2), -111, 0.05); auto(X(3.2), -12, PI); auto(X(-3.2), -13, 0.05); auto(X(3.2), 33, PI); scooter(X(3.9), -30, PI / 2 - 0.1); scooter(X(-3.9), 46, -PI / 2); scooter(X(3.9), 76, PI / 2);
    (() => { const g = new THREE.Group(); box(0.26, 8, 0.26, mat(0x9a968c), 0, 4, 0, g, true); mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.9, 12), mat(0x4a5a6a, { metalness: 0.4 }), 0.0, 6.4, 0.7, g); const pl = sign(0.9, 0.5, 256, 140, (x, w, h) => { x.fillStyle = '#f4f1e8'; x.fillRect(0, 0, w, h); x.strokeStyle = '#17458a'; x.lineWidth = 8; x.strokeRect(4, 4, w - 8, h - 8); txt(x, 'KSEB', w / 2, h / 2, 'bold 72px sans-serif', '#17458a'); }); pl.position.set(-0.35, 5.6, 0); pl.rotation.y = -PI / 2; g.add(pl); g.position.set(X(4.4), 0, -6); add(g); cullables.push(g); g.userData = { x: X(4.4), z: -6 }; post(X(4.4), -6, 0.3); })();
    /* palms in the open ground only: never on the turf, the bus yard, the medical college, the side roads or any shop row (these rectangles are [x0, x1, z0, z1] in local metres) */
    const NO_PALM = [[-38, -4, 26, 62], [24, 62, 2, 37], [4, 46, 20, 56], [-8, 8, -140, 108], [-100, 100, -16, 16], [28, 52, -138, -54], [2, 46, -110, -90], [4, 20, -136, -116]];
    for (let i = 0, tries = 0; i < 16 && tries < 400; tries++) { const s = (i % 2 ? 1 : -1), x = s * rr(16, 40), z = rr(-120, 100); if (NO_PALM.some(([a, b, c0, d]) => x > a - 2 && x < b + 2 && z > c0 - 2 && z < d + 2)) continue; palmAt(X(x), z, i, rr(1.0, 1.5)); i++; }
    [['mundu', [[X(1.2), 30], [X(1.2), -60]], 1.2], ['lungi', [[X(-0.5), -104], [X(-0.5), 20]], 1.1], ['thattam', [[X(0.4), 40], [X(0.4), -40]], 1.0], ['schoolgirl', [[X(1.8), 60], [X(1.8), 2]], 1.3], ['saree', [[X(0.0), 20], [X(0.0), -100]], 0.95], ['schoolboy', [[X(-1.0), -120], [X(-1.0), -80]], 1.2], ['lungi', [[X(18), 2.6], [X(90), 2.6]], 1.1], ['schoolgirl', [[X(-90), -2.6], [X(-14), -2.6]], 1.2], ['mundu', [[X(60), -2.4], [X(30), -2.4]], 1.0]].forEach(([type, pts, sp]) => walker(type, pts, sp, 2));
    for (let i = 0; i < 24; i++) addPickup('coin', null, X(i % 2 ? -rr(0.6, 1.0) : rr(0.6, 3.0)), -128 + i * 10 + rr(-1, 1));   // coins along the highway, kept clear of the parked stand autos
    for (let i = 0; i < 8; i++) addPickup('coin', null, X(20 + i * 10), (i % 2 ? 1 : -1) * rr(0.6, 2.6)); for (let i = 0; i < 8; i++) addPickup('coin', null, X(-20 - i * 10), (i % 2 ? 1 : -1) * rr(0.6, 2.6));
    [['tea', X(3.2), 22.6], ['spice', X(-3.0), 38], ['rice', X(3.0), -20], ['banana', X(-3.0), -70], ['coconut', X(3.0), 44], ['jaggery', X(-3.1), 80]].forEach(([id, x, z]) => addPickup('food', id, x, z));
    noteSpot(-6, -6, 'manjeri');

    /* the edge of the town: an irregular ring of dense jungle (round colliders you cannot walk through) with a gap where each road leaves, plus trees out beyond it; the trees are two instanced meshes, so the whole forest costs two draw calls */
    (() => {
      const pts = loopPoints(132), nearExit = (x, z, r) => EX.some((e) => Math.hypot(x - e.x, z - e.z) < r);
      let seed = 11; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
      const trees = [];
      pts.forEach((p) => {
        if (!nearExit(p.x, p.z, 10.5)) post(X(p.x), p.z, 6.4, 'wall');
        const k = nearExit(p.x, p.z, 10.5) ? 1 : 4;
        for (let i = 0; i < k; i++) trees.push([p.x + (rnd() - 0.5) * 7, p.z + (rnd() - 0.5) * 7, 1.5 + rnd() * 1.0, 0.95 + rnd() * 0.25]);
        for (const f of [1.07, 1.16, 1.27]) { const q = { x: AX * f * (p.x / AX) * 1, z: CZ + (p.z - CZ) * f }; for (let i = 0; i < 2; i++) { const tx = q.x + (rnd() - 0.5) * 8, tz = q.z + (rnd() - 0.5) * 8; if (!nearExit(tx, tz, 7)) trees.push([tx, tz, 1.4 + rnd() * 1.1, 0.9 + rnd() * 0.3]); } }
      });
      const n = trees.length, cone = new THREE.InstancedMesh(new THREE.ConeGeometry(1.5, 4.6, 7), mat(0xffffff, { flatShading: true }), n), trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.3, 1.8, 6), mat(0x5a3d22), n), d = new THREE.Object3D(), col = new THREE.Color();
      trees.forEach(([x, z, s, v], i) => {
        d.position.set(X(x), 0.9 * s, z); d.scale.set(s, s, s); d.rotation.set(0, rnd() * 6.3, 0); d.updateMatrix(); trunk.setMatrixAt(i, d.matrix);
        d.position.y = 1.8 * s + 2.3 * s; d.updateMatrix(); cone.setMatrixAt(i, d.matrix); col.setRGB(0.17 * v, 0.40 * v, 0.17 * v); cone.setColorAt(i, col);
      });
      /* about 45 percent of the trees have a round crown (mango, jackfruit) instead of a cone: the first 55 percent stay cones, the rest get this one more instanced mesh of round crowns on the same trunks */
    const nc = Math.floor(n * 0.55); cone.count = nc; const crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(2.0, 1), mat(0xffffff, { flatShading: true }), Math.max(1, n - nc));
    trees.forEach(([x, z, s, v], i) => { if (i < nc) return; d.position.set(X(x), 3.2 * s, z); d.scale.set(s * 1.05, s * 0.85, s * 1.05); d.rotation.set(0, i, 0); d.updateMatrix(); crown.setMatrixAt(i - nc, d.matrix); col.setRGB(0.24 * v, 0.47 * v, 0.14 * v); crown.setColorAt(i - nc, col); }); crown.frustumCulled = false; add(crown);
    cone.frustumCulled = false; trunk.frustumCulled = false; cone.castShadow = false; add(cone); add(trunk);
    })();
    /* rolling hills beyond the jungle: big soft domes on a ring (one instanced mesh); the fog fades them, so they read as far hills. The ground inside the ring stays flat. */
    (() => {
      let seed = 29; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
      const hills = [], K = 34;
      for (let k = 0; k < K; k++) {
        const a = (k / K) * PI * 2 + rnd() * 0.12, f = 1.3 + rnd() * 0.4, w = wob(a), r = 26 + rnd() * 30, hgt = 14 + rnd() * 26;
        const x = AX * w * f * Math.cos(a), z = CZ + AZ * w * f * Math.sin(a); if (EX.some((e) => Math.hypot(x - e.x, z - e.z) < r + 14)) continue;
        hills.push([x, z, r, hgt, 0.85 + rnd() * 0.3]);
      }
      const hm = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 8, 0, PI * 2, 0, PI / 2), mat(0xffffff, { roughness: 1, flatShading: true }), hills.length), d = new THREE.Object3D(), col = new THREE.Color();
      hills.forEach(([x, z, r, hgt, v], i) => { d.position.set(X(x), -1, z); d.scale.set(r, hgt, r); d.rotation.set(0, rnd() * 6.3, 0); d.updateMatrix(); hm.setMatrixAt(i, d.matrix); col.setRGB(0.30 * v, 0.46 * v, 0.24 * v); hm.setColorAt(i, col); });
      hm.frustumCulled = false; add(hm);
    })();
  }

  window.RoboExploreManjeri = { build, shape: { AX, AZ, CZ, inside, loopPoints, exits, mapRects, tailPieces, BEND } };
})();
