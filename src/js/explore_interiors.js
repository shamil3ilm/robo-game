/* Robo Run: the rooms you can walk into in the town (explore.js): Robo's own home dock, two hotels, a coffee store, the Zil Money office and a hospital OPD.
   Exposes window.RoboExploreInteriors = { ROOM_X0, build(ctx) }. Every room is a cut-away "doll house" (walls, no ceiling, so the camera can see in), built far from the streets at x = ROOM_X0 + 50 * n.
   A door outside leads in, an exit mat inside leads back out. Counters inside use the shop screen; boards use the notes; the home's wardrobe and stove open the Characters and Kitchen screens.
   Real places keep their real names and nothing else of theirs is claimed: menus show only dishes their notes name, prices are the game's. */
(function () {
  'use strict';
  const PI = Math.PI, ROOM_X0 = 2000, ML = '"Nirmala UI","Noto Sans Malayalam","Kartika",sans-serif';

  function build(c) {
    const { THREE, add, mat, solid, canvasTex, rr, pick, stander, spots, marker, notes, onFrame, cullables, rooms, fadeable } = c;
    const NOTES = notes || {};
    let idx = 0;
    const txt = (x, t, px, py, font, col) => { x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = col; x.font = font; x.fillText(t, px, py); };
    const panel = (w, h, tw, th, draw) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: canvasTex(tw, th, draw), roughness: 0.9, side: THREE.DoubleSide })); return m; };
    /* the look of a room: a tiled floor (two tones with grout), a painted wall (a darker band below a trim line) and a soft pool of light; colours come from the room's own two hex values */
    const rgb = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255], css = (c, k) => 'rgb(' + c.map((v) => Math.max(0, Math.min(255, Math.round(v * k)))).join(',') + ')';
    const floorTex = (hex, w, d) => canvasTex(256, 256, (x, s) => { const c = rgb(hex); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.fillStyle = css(c, (i + j) % 2 ? 0.62 : 0.9); x.fillRect(i * 64, j * 64, 64, 64); } for (let k = 0; k < 900; k++) { x.fillStyle = 'rgba(0,0,0,' + (Math.random() * 0.05) + ')'; x.fillRect(Math.random() * s, Math.random() * s, 2, 2); } x.fillStyle = 'rgba(40,30,20,0.35)'; for (let i = 0; i <= 4; i++) { x.fillRect(i * 64 - 1, 0, 2, s); x.fillRect(0, i * 64 - 1, s, 2); } }, w / 2.6, d / 2.6);
    const wallTex = (hex) => canvasTex(64, 256, (x, w, h) => { const c = rgb(hex); x.fillStyle = css(c, 0.96); x.fillRect(0, 0, w, h * 0.66); x.fillStyle = css(c, 0.52); x.fillRect(0, h * 0.68, w, h * 0.32); x.fillStyle = css(c, 1.12); x.fillRect(0, h * 0.655, w, h * 0.028); x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, h * 0.683, w, 2); for (let k = 0; k < 160; k++) { x.fillStyle = 'rgba(0,0,0,' + (Math.random() * 0.05) + ')'; x.fillRect(Math.random() * w, Math.random() * h, 3, 3); } });
    const poolTex = canvasTex(64, 64, (x, s) => { const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); g.addColorStop(0, 'rgba(255,214,150,0.55)'); g.addColorStop(1, 'rgba(255,214,150,0)'); x.fillStyle = g; x.fillRect(0, 0, s, s); });
    const winTex = canvasTex(64, 128, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#bfe0ff'); g.addColorStop(0.6, '#e8f4ff'); g.addColorStop(1, '#fff6dc'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
    const wood = mat(0x7a5a38, { roughness: 0.85 }), wood2 = mat(0xb8895a, { roughness: 0.8 }), steel = mat(0xb8bcc0, { metalness: 0.6, roughness: 0.4 }), white = mat(0xf4f1e8), dark = mat(0x2a2a2a);

    /* one room: a floor, four walls with a doorway in the south one, a rug, two ceiling fans; furnish(R, h) adds the contents. Local coordinates (lx, lz) are measured from the room's centre; north is -z. */
    const room = (id, title, local, w, d, floorHex, wallHex, furnish) => {
      const ox = ROOM_X0 + idx++ * 50, g = new THREE.Group(); g.userData = { x: ox, z: 0 }; add(g); cullables.push(g);
      const R = { id, title, local, ox, bounds: { x0: ox - w / 2 + 0.25, x1: ox + w / 2 - 0.25, z0: -d / 2 + 0.25, z1: d / 2 - 0.25 }, spawn: [ox, d / 2 - 1.8] };
      rooms[id] = R;
      const mesh = (geo, m, x, y, z, shadow) => { const o = new THREE.Mesh(geo, m); o.position.set(ox + x, y, z); o.receiveShadow = true; o.castShadow = !!shadow; g.add(o); return o; };
      const bx = (bw, bh, bd, m, x, y, z, tag) => { const o = mesh(new THREE.BoxGeometry(bw, bh, bd), m, x, y, z, true); if (tag) solid(ox + x - bw / 2, ox + x + bw / 2, z - bd / 2, z + bd / 2, tag, o); return o; };
      const floor = mesh(new THREE.PlaneGeometry(w, d).rotateX(-PI / 2), (() => { const m = mat(0xd6cdbf, { roughness: 0.85 }); m.map = floorTex(floorHex, w, d); return m; })(), 0, 0.05, 0); floor.castShadow = false;
      mesh(new THREE.PlaneGeometry(220, 220).rotateX(-PI / 2), mat(0x2b2f2c, { roughness: 1 }), 0, -0.02, 0);
      const wm = mat(0xc4c0b8, { roughness: 0.95 }), H = 3.6, T = 0.3; wm.map = wallTex(wallHex);
      bx(w, H, T, wm, 0, H / 2, -d / 2, 'wall'); bx(T, H, d, wm, -w / 2, H / 2, 0, 'wall'); bx(T, H, d, wm, w / 2, H / 2, 0, 'wall');
      const half = (w - 3.2) / 2; [-1, 1].forEach((s) => bx(half, H, T, wm, s * (1.6 + half / 2), H / 2, d / 2, 'wall'));      // the south wall, with a doorway 3.2 m wide
      bx(w - 0.4, 0.14, 0.08, mat(0xe8e0cc), 0, 0.12, -d / 2 + 0.2);                                                          // skirting
      mesh(new THREE.PlaneGeometry(Math.min(6, w - 3), Math.min(4, d - 3)).rotateX(-PI / 2), mat(pick([0x8a3a2a, 0x2f5a6a, 0x6a4a2a]), { roughness: 1 }), 0, 0.07, 0.3);   // a rug
      [-w / 4, w / 4].forEach((fx, i) => {                                                                                   // ceiling fans, turning
        const fan = new THREE.Group(); fan.position.set(ox + fx, 3.0, -d / 6); g.add(fan);
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6), steel); rod.position.y = 0.25; fan.add(rod); const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 10), steel); fan.add(hub);
        for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.02, 0.16), mat(0xe8e0cc)); b.position.set(Math.cos((k * 2 * PI) / 3) * 0.5, 0, Math.sin((k * 2 * PI) / 3) * 0.5); b.rotation.y = -(k * 2 * PI) / 3; fan.add(b); }
        onFrame((dt) => { fan.rotation.y += dt * (7 + i); });
      });
      /* windows with daylight, a wall clock, light pools under the fans, and skirting along the side walls */
      const winM = new THREE.MeshBasicMaterial({ map: winTex }), frameM = mat(0x5a4630, { roughness: 0.8 });
      [-1, 1].forEach((s) => { const wx = s * w * 0.32, wy = 2.15; const gl = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.3), winM); gl.position.set(ox + wx, wy, -d / 2 + 0.17); g.add(gl); bx(1.62, 0.07, 0.1, frameM, wx, wy + 0.68, -d / 2 + 0.2); bx(1.62, 0.07, 0.1, frameM, wx, wy - 0.68, -d / 2 + 0.2); bx(0.07, 1.4, 0.1, frameM, wx - 0.78, wy, -d / 2 + 0.2); bx(0.07, 1.4, 0.1, frameM, wx + 0.78, wy, -d / 2 + 0.2); bx(0.05, 1.3, 0.08, frameM, wx, wy, -d / 2 + 0.2); bx(1.5, 0.05, 0.08, frameM, wx, wy, -d / 2 + 0.2); });
      { const ck = new THREE.Mesh(new THREE.CircleGeometry(0.34, 20), new THREE.MeshBasicMaterial({ map: canvasTex(128, 128, (x, s) => { x.fillStyle = '#f6f2e6'; x.beginPath(); x.arc(s / 2, s / 2, s / 2 - 2, 0, 6.3); x.fill(); x.strokeStyle = '#3a2a1a'; x.lineWidth = 8; x.stroke(); x.lineWidth = 6; x.beginPath(); x.moveTo(s / 2, s / 2); x.lineTo(s / 2, s * 0.2); x.moveTo(s / 2, s / 2); x.lineTo(s * 0.7, s * 0.58); x.stroke(); }) })); ck.position.set(ox - w * 0.2, 2.85, -d / 2 + 0.17); g.add(ck); }
      [-1, 1].forEach((s) => { bx(0.08, 0.14, d - 0.4, mat(0xe8e0cc), s * (w / 2 - 0.2), 0.12, 0); });
      [-w / 4, w / 4].forEach((fx) => { const pl = new THREE.Mesh(new THREE.CircleGeometry(3.2, 24).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.3 })); pl.position.set(ox + fx, 0.095, -d / 6); g.add(pl); });
      [-1, 1].forEach((s) => { const tx = s * w * 0.2; bx(1.4, 0.07, 0.1, mat(0xdedede, { roughness: 0.6 }), tx, 3.2, -d / 2 + 0.2); const tb = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.05, 0.06), new THREE.MeshBasicMaterial({ color: 0xfff6e0 })); tb.position.set(ox + tx, 3.15, -d / 2 + 0.26); g.add(tb); const gl = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.3), new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 })); gl.position.set(ox + tx, 2.75, -d / 2 + 0.18); g.add(gl); });   // tube lights
      // the exit mat inside the doorway
      marker(ox, d / 2 - 0.8, 0xffd27a); spots.push({ x: ox, z: d / 2 - 0.8, r: 1.9, kind: 'exit', arg: id, label: 'Leave ' + title, emoji: '🚪' });
      const spot = (lx, lz, kind, arg, label, emoji, r) => { marker(ox + lx, lz, kind === 'shop' ? 0xffd27a : 0xcfe8ff); spots.push({ x: ox + lx, z: lz, r: r || 1.9, kind, arg, label, emoji }); };
      const noteSpot = (lx, lz, key) => { const n = NOTES[key]; if (n) spot(lx, lz, 'note', key, n.title.split(' · ')[0], n.emoji); };
      const sign = (pw, ph, tw, th, draw, x, y, z, ry) => { const p = panel(pw, ph, tw, th, draw); p.position.set(ox + x, y, z); p.rotation.y = ry || 0; g.add(p); return p; };
      const person = (type, lx, lz, yaw) => stander(type, ox + lx, lz, yaw || 0);
      const block = (lx, lz, bw, bd, tag) => solid(ox + lx - bw / 2, ox + lx + bw / 2, lz - bd / 2, lz + bd / 2, tag || 'furniture', g);   // an invisible collider for furniture made of several thin parts
      furnish(R, { ox, g, mesh, bx, spot, noteSpot, sign, person, txt, w, d, block });
      return R;
    };
    const plateM = mat(0xf6f3ea, { roughness: 0.4 }), curryM = mat(0xc8742a, { roughness: 0.7 }), riceM = mat(0xf4efe0, { roughness: 0.9 }), leafM = mat(0x3f8a3a, { roughness: 0.8 }), cloth = mat(0xf0e8d0, { roughness: 1 });
    const chair = (h, lx, lz, faceX) => { h.bx(0.46, 0.06, 0.46, wood, lx, 0.48, lz); [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]].forEach(([a, b]) => h.bx(0.05, 0.46, 0.05, wood, lx + a, 0.23, lz + b)); h.bx(faceX ? 0.05 : 0.46, 0.5, faceX ? 0.46 : 0.05, wood, lx + (faceX ? -faceX * 0.21 : 0), 0.78, lz + (faceX ? 0 : -0.21)); };
    const table = (h, lx, lz) => {
      h.bx(1.3, 0.07, 0.9, wood2, lx, 0.8, lz); h.bx(1.34, 0.02, 0.94, cloth, lx, 0.845, lz); [[-0.55, -0.35], [0.55, -0.35], [-0.55, 0.35], [0.55, 0.35]].forEach(([a, b]) => h.bx(0.08, 0.78, 0.08, wood, lx + a, 0.39, lz + b)); h.block(lx, lz, 1.3, 0.9);
      [-0.38, 0.38].forEach((s, i) => { const p = h.mesh(new THREE.CylinderGeometry(0.19, 0.16, 0.03, 14), plateM, lx + s, 0.875, lz + 0.12, true); if (i === 0) { h.mesh(new THREE.CylinderGeometry(0.11, 0.1, 0.05, 12), riceM, lx + s, 0.91, lz + 0.12, true); h.mesh(new THREE.SphereGeometry(0.07, 8, 6), curryM, lx + s + 0.08, 0.93, lz + 0.14, true); } else h.mesh(new THREE.BoxGeometry(0.22, 0.015, 0.2), leafM, lx + s, 0.89, lz + 0.12, true); });
      h.mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.12, 10), steel, lx - 0.1, 0.92, lz - 0.2, true); h.mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.12, 10), steel, lx + 0.1, 0.92, lz - 0.24, true);
      chair(h, lx - 1.0, lz, 0); chair(h, lx + 1.0, lz, 0);
    };
    /* a hotel's counter: a glass case of snacks, rows of steel vessels, a tea station with a kettle and glasses, and a stack of plates */
    const hotelCounter = (h, lz, len) => {
      const gl = mat(0xbfe0e8, { transparent: true, opacity: 0.35, roughness: 0.1 }); h.bx(len * 0.5, 0.5, 0.6, gl, -len * 0.18, 1.3, lz + 0.05); h.bx(len * 0.5, 0.04, 0.62, steel, -len * 0.18, 1.56, lz + 0.05);
      [0, 1].forEach((r) => [-1.1, -0.45, 0.2].forEach((a, i) => { h.mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 12), plateM, -len * 0.18 + a + 0.7, 1.1 + r * 0.22 + 0.2, lz + 0.05, true); [0, 1, 2].forEach((k) => h.mesh(new THREE.SphereGeometry(0.06, 8, 6), pick([curryM, mat(0xd9a03a), mat(0x8a4a1c)]), -len * 0.18 + a + 0.7 + (k - 1) * 0.1, 1.17 + r * 0.22 + 0.2 - (r ? 0.0 : 0), lz + 0.05 + (k % 2) * 0.03, true)); }));
      [0, 1, 2].forEach((i) => { h.mesh(new THREE.CylinderGeometry(0.2 - i * 0.02, 0.22 - i * 0.02, 0.32, 14), steel, len * 0.28 + i * 0.42, 1.16, lz - 0.05, true); h.mesh(new THREE.CylinderGeometry(0.21 - i * 0.02, 0.21 - i * 0.02, 0.03, 14), steel, len * 0.28 + i * 0.42, 1.34, lz - 0.05, true); });
      h.mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.34, 12), steel, -len * 0.45, 1.19, lz - 0.15, true); h.mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 6), steel, -len * 0.45 + 0.2, 1.3, lz - 0.15, true);
      [0, 1, 2, 3, 4].forEach((i) => h.mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.09, 8), mat(0xe8f0f4, { transparent: true, opacity: 0.7 }), -len * 0.3 + i * 0.1, 1.07, lz + 0.3, true));
      [0, 1, 2, 3].forEach((i) => h.mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.025, 14), plateM, len * 0.05, 1.04 + i * 0.03, lz + 0.3, true));
    };
    const counter = (h, lx, lz, len, hex) => h.bx(len, 1.0, 0.9, mat(hex || 0x6a4a2a), lx, 0.5, lz, 'furniture');
    const hotel = (menu, shopKind, noteKey, keeper) => (R, h) => {
      counter(h, 0, -d2(R) + 1.1, 6); h.bx(6.2, 0.08, 1.0, wood2, 0, 1.02, -d2(R) + 1.1); hotelCounter(h, -d2(R) + 1.1, 6);
      h.person(keeper, 0, -d2(R) + 0.2, 0); h.spot(0, -d2(R) + 2.2, 'shop', shopKind, R.title, '🍛');
      [-3.6, 0.3, 4.2].forEach((x) => [0.1, 2.0].forEach((z) => table(h, x, z)));
      h.person('mundu', -4, 1.6, PI / 2); h.person('lungi', 4, 3.7, -PI / 2);
      h.sign(3.4, 1.5, 512, 220, (x, w, hh) => { x.fillStyle = '#1f3a2a'; x.fillRect(0, 0, w, hh); x.strokeStyle = '#d9b86a'; x.lineWidth = 6; x.strokeRect(6, 6, w - 12, hh - 12); txt(x, R.title.toUpperCase(), w / 2, 40, 'bold 38px sans-serif', '#f3e6cf'); menu.forEach((m, i) => txt(x, m, w / 2, 92 + i * 38, 'bold 26px ' + ML, '#ffe9b0')); }, 0, 2.4, -d2(R) + 0.2);
      h.sign(1.6, 1.1, 256, 170, (x, w, hh) => { x.fillStyle = '#f4efdc'; x.fillRect(0, 0, w, hh); x.strokeStyle = '#8a5a2a'; x.lineWidth = 8; x.strokeRect(4, 4, w - 8, hh - 8); txt(x, '📜', w / 2, 56, '52px sans-serif', '#000'); txt(x, 'Read the board', w / 2, 120, 'bold 26px sans-serif', '#5a3a1a'); }, R.bounds.x1 - R.ox - 0.3, 1.8, 0, -PI / 2);
      h.noteSpot(R.bounds.x1 - R.ox - 0.7, 0, noteKey);
      const fr = (pw, ph, z, y, draw) => { h.bx(0.06, ph + 0.14, pw + 0.14, wood, -h.w / 2 + 0.22, y, z); h.sign(pw, ph, 256, Math.round(256 * ph / pw), draw, -h.w / 2 + 0.26, y, z, PI / 2); };
      fr(1.1, 0.8, -2.6, 2.1, (x, w, hh) => { const g2 = x.createLinearGradient(0, 0, 0, hh); g2.addColorStop(0, '#f2c27a'); g2.addColorStop(1, '#2f7a86'); x.fillStyle = g2; x.fillRect(0, 0, w, hh); x.fillStyle = '#1f3a2a'; for (let k = 0; k < 4; k++) { x.beginPath(); x.moveTo(w * (0.15 + k * 0.22), hh * 0.8); x.lineTo(w * (0.22 + k * 0.22), hh * 0.35); x.lineTo(w * (0.29 + k * 0.22), hh * 0.8); x.fill(); } x.fillStyle = '#fbe8b0'; x.beginPath(); x.arc(w * 0.78, hh * 0.25, 18, 0, 6.3); x.fill(); });   // a coast at sunset
      fr(0.8, 1.0, 2.2, 2.1, (x, w, hh) => { x.fillStyle = '#f6f0dc'; x.fillRect(0, 0, w, hh); x.fillStyle = '#a82a1c'; x.fillRect(0, 0, w, hh * 0.22); x.fillStyle = '#fff'; x.font = 'bold 30px sans-serif'; x.textAlign = 'center'; x.fillText('OCT', w / 2, hh * 0.17); x.fillStyle = '#3a2a1a'; x.font = 'bold 96px sans-serif'; x.fillText('28', w / 2, hh * 0.62); x.font = '24px sans-serif'; x.fillText('Wed', w / 2, hh * 0.84); });   // a calendar
    };
    const d2 = (R) => (R.bounds.z1 - R.bounds.z0 + 0.5) / 2;   // half the room's depth

    /* Robo's home dock */
    room('home', "Robo's dock", 'റോബോയുടെ വീട്', 14, 10, 0x3e6a70, 0xe8e2d0, (R, h) => {
      const cradle = new THREE.Group(); cradle.position.set(h.ox - 4, 0.08, -1.2); h.g.add(cradle);
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.2, 24), steel); pad.position.y = 0.1; cradle.add(pad);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.05, 8, 32).rotateX(PI / 2), new THREE.MeshBasicMaterial({ color: 0x46e0ff })); ring.position.y = 0.25; cradle.add(ring);
      [-1, 1].forEach((s) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.4, 0.16), steel); p.position.set(s * 1.0, 0.8, -0.5); cradle.add(p); });
      h.spot(-4, 1.3, 'charge', 'home', 'Charging cradle · free', '🔌');
      solid(h.ox - 5.3, h.ox - 2.7, -2.5, 0.1, 'furniture', cradle); onFrame((dt) => { ring.material.color.setHSL(0.5, 1, 0.5 + 0.15 * Math.sin(performance.now() / 400)); });
      h.bx(2.6, 2.6, 0.8, wood, 4.4, 1.3, -d2(R) + 0.5, 'furniture'); [-0.6, 0.6].forEach((s) => h.bx(0.04, 2.3, 0.04, mat(0x3a2a1a), 4.4 + s * 0.02 + s * 0.0, 1.3, -d2(R) + 0.93));   // the wardrobe and its door line
      h.spot(4.4, -d2(R) + 1.9, 'menu', 'garage', 'Wardrobe · Characters', '👕');
      h.bx(2.4, 0.95, 0.8, mat(0xc9c2b0), -0.2, 0.48, -d2(R) + 0.5, 'furniture'); h.bx(1.0, 0.12, 0.7, dark, -0.2, 1.0, -d2(R) + 0.5); const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.3, 14), steel); pot.position.set(h.ox - 0.2, 1.2, -d2(R) + 0.5); h.g.add(pot);
      h.spot(-0.2, -d2(R) + 1.9, 'menu', 'kitchen', 'Stove · Kitchen', '🍳');
      h.bx(1.0, 0.4, 2.0, mat(0x3a5a7a), 5.4, 0.25, 2.2, 'furniture'); h.bx(0.9, 0.12, 0.5, white, 5.4, 0.5, 1.6);      // a bed to rest on
      h.sign(2.6, 1.7, 400, 260, (x, w, hh) => { x.fillStyle = '#14201c'; x.fillRect(0, 0, w, hh); x.strokeStyle = '#46e0ff'; x.lineWidth = 6; x.strokeRect(8, 8, w - 16, hh - 16); txt(x, '🤖', w / 2, 72, '64px sans-serif', '#000'); txt(x, "ROBO'S DOCK", w / 2, 140, 'bold 36px sans-serif', '#46e0ff'); txt(x, 'റോബോയുടെ വീട്', w / 2, 190, 'bold 32px ' + ML, '#ffe9b0'); }, -4, 2.3, -d2(R) + 0.2);
      h.noteSpot(-5.6, 2.4, 'home');
    });
    /* hotels */
    room('farsa', 'Hotel Farsa', 'ഹോട്ടൽ ഫർസ', 13, 9, 0xb8a98a, 0xe9dfc4, hotel(['Porotta · പൊറോട്ട', 'Biryani · ബിരിയാണി', 'Chaya · ചായ'], 'farsa', 'farsa', 'mundu'));
    room('oottupura', 'Hotel Oottupura', 'ഹോട്ടൽ ഊട്ടുപുര', 13, 9, 0xb09a72, 0xeadfc0, hotel(['Dosa · ദോശ', 'Puttu · പുട്ട്', 'Chaya · ചായ'], 'oottupura', 'oottupura', 'lungi'));
    room('zindagi', 'Hotel Zindagi', 'ഹോട്ടൽ സിന്ദഗി', 13, 9, 0xa8a088, 0xe8dec2, hotel(['Porotta · പൊറോട്ട', 'Pazhampori · പഴംപൊരി', 'Chaya · ചായ'], 'zindagi', 'zindagi', 'mundu'));
    room('vanitha', 'Vanitha Mess', 'വനിത മെസ്', 13, 9, 0xb4a584, 0xece2c6, hotel(['Meals · ഊണ്', 'Fish fry · മീൻ വറുത്തത്', 'Chaya · ചായ'], 'vanitha', 'vanitha', 'saree'));
    room('rayadhan', 'Al Rayadhan Kuzhi Mandhi', 'അൽ റയാദാൻ കുഴിമന്തി', 13, 9, 0x9a8a66, 0xe6d8b6, hotel(['Kuzhi mandi · കുഴിമന്തി', 'Mandi half · മന്തി ഹാഫ്', 'Lime juice · ലൈം ജ്യൂസ്'], 'rayadhan', 'kuzhimandi', 'lungi'));
    /* Budget Hyper Market: a counter, aisles of shelves and a board; it sells what the other supermarket sells */
    room('budget', 'Budget Hyper Market', 'ബജറ്റ് ഹൈപ്പർ മാർക്കറ്റ്', 16, 11, 0xd6d2c8, 0xf2f0ea, (R, h) => {
      counter(h, -3.4, -d2(R) + 1.2, 5.4, 0x2f6a3a); h.bx(5.6, 0.08, 1.0, white, -3.4, 1.02, -d2(R) + 1.2);
      h.person('saree', -3.4, -d2(R) + 0.3, 0); h.spot(-3.4, -d2(R) + 2.3, 'shop', 'budget', 'Budget Hyper Market', '🛒');
      [[-5.0, 0.8], [-1.0, 0.8], [3.0, 0.8], [6.0, 0.8], [-5.0, 3.2], [-1.0, 3.2], [3.0, 3.2]].forEach(([x, z]) => { h.bx(3.0, 1.7, 0.7, wood2, x, 0.85, z, 'furniture'); for (let k = 0; k < 5; k++) h.bx(0.4, 0.3, 0.5, mat(pick([0xc8532a, 0x2f8a5a, 0xe8b81c, 0x3a6ab8, 0xf4f1e8])), x - 1.2 + k * 0.6, 1.0 + (k % 2) * 0.6, z + 0.38); });
      h.person('mundu', 5.4, 4.6, -PI / 2); h.person('saree', -2.2, 4.8, PI / 2);
      h.sign(3.6, 1.5, 512, 220, (x, w, hh) => { x.fillStyle = '#1f5a3a'; x.fillRect(0, 0, w, hh); x.strokeStyle = '#f3d9a8'; x.lineWidth = 6; x.strokeRect(6, 6, w - 12, hh - 12); txt(x, 'BUDGET', w / 2, 70, 'bold 64px sans-serif', '#fff'); txt(x, 'SUPERMARKET · ബജറ്റ്', w / 2, 140, 'bold 36px ' + ML, '#ffe9b0'); }, 3.4, 2.4, -d2(R) + 0.2);
      h.noteSpot(R.bounds.x1 - R.ox - 0.8, 2.2, 'budget');
      [[-5.0, 0.8], [-1.0, 0.8], [3.0, 0.8], [6.0, 0.8], [-5.0, 3.2], [-1.0, 3.2], [3.0, 3.2]].forEach(([x, z]) => {   // tins, bottles and packets along the shelf tops, and a price strip on the front edge
        for (let k = 0; k < 9; k++) { const col = mat(pick([0xc8532a, 0x2f8a5a, 0xe8b81c, 0x3a6ab8, 0xf4f1e8, 0x8a2a5a])); h.mesh(k % 3 ? new THREE.CylinderGeometry(0.1, 0.1, 0.24, 10) : new THREE.BoxGeometry(0.22, 0.3, 0.14), col, x - 1.2 + k * 0.3, 1.82, z - 0.05, true); }
        h.bx(2.9, 0.1, 0.02, mat(0xfff2a8), x, 0.36, z + 0.37);
      });
      h.bx(1.0, 1.9, 3.2, mat(0x9ec8e0, { transparent: true, opacity: 0.55, roughness: 0.1 }), -h.w / 2 + 1.0, 1.0, 0.6, 'furniture'); h.bx(1.04, 0.1, 3.24, steel, -h.w / 2 + 1.0, 2.0, 0.6);   // the chiller
      [0, 1, 2].forEach((r) => [0, 1, 2, 3].forEach((k) => h.mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.28, 8), mat(pick([0xe8f0f4, 0xd94a2a, 0x2f8a5a, 0xe8b81c])), -h.w / 2 + 0.75 + (r % 2) * 0.1, 0.4 + r * 0.55, -0.5 + k * 0.5, true)));
      const glow2 = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 3.4).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: 0x9ad8ff, transparent: true, opacity: 0.18, depthWrite: false })); glow2.position.set(h.ox - h.w / 2 + 1.7, 0.1, 0.6); h.g.add(glow2);
      [0, 1, 2, 3].forEach((k) => { h.bx(0.46, 0.3, 0.34, mat(0xd94a2a, { roughness: 0.6 }), h.w / 2 - 1.0 - 0.0, 0.15 + k * 0.17, d2(R) - 1.0); });   // a stack of red baskets by the door
      h.bx(0.7, 0.04, 1.1, steel, h.w / 2 - 2.2, 0.8, d2(R) - 1.4); h.bx(0.7, 0.4, 0.04, steel, h.w / 2 - 2.2, 1.0, d2(R) - 1.95); [[-0.3, -0.5], [0.3, -0.5], [-0.3, 0.5], [0.3, 0.5]].forEach(([a, b]) => h.mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 8).rotateZ(PI / 2), dark, h.w / 2 - 2.2 + a, 0.08, d2(R) - 1.4 + b, true));   // a trolley
      h.sign(3.0, 0.7, 512, 120, (x, w, hh) => { x.fillStyle = '#d9382a'; x.fillRect(0, 0, w, hh); x.fillStyle = '#ffe14a'; x.font = 'bold 54px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('BIG SAVINGS · \u20b9 OFFERS', w / 2, hh / 2); }, 5.2, 2.5, -d2(R) + 0.2);
    });
    room('bombay', 'Bombay Hotel', 'ബോംബെ ഹോട്ടൽ', 13, 9, 0xa89a7a, 0xe6d6b4, hotel(['Dum biryani', 'Chattippathiri · ചട്ടിപ്പത്തിരി', 'Elanchi'], 'bombay', 'bombay', 'lungi'));
    /* Swamy & Sons, a coffee store */
    room('swamy', 'Swamy & Sons', 'സ്വാമി ആൻഡ് സൺസ്', 9, 7, 0x6a4a2a, 0xe9dfc4, (R, h) => {
      counter(h, 0, -d2(R) + 1.2, 4.4, 0x4a2a18); h.bx(4.6, 0.08, 1.0, wood2, 0, 1.02, -d2(R) + 1.2);
      const grinder = h.bx(0.5, 0.7, 0.5, steel, -1.4, 1.4, -d2(R) + 1.2); h.bx(0.4, 0.3, 0.4, mat(0x4a2a18), -1.4, 1.9, -d2(R) + 1.2);
      h.person('mundu', 0.4, -d2(R) + 0.3, 0); h.spot(0, -d2(R) + 2.3, 'shop', 'swamy', R.title, '☕');
      [-1, 1].forEach((s) => { for (let r = 0; r < 4; r++) { h.bx(0.7, 0.05, 3.2, wood, s * 3.9, 0.5 + r * 0.6, 0.4); for (let k = 0; k < 6; k++) h.bx(0.3, 0.3, 0.4, mat(pick([0x4a2a18, 0x6a3a1c, 0x8a5a2c, 0xc9a56a])), s * 3.9, 0.7 + r * 0.6, -1.0 + k * 0.55); } solid(R.ox + s * 3.9 - 0.4, R.ox + s * 3.9 + 0.4, -1.2, 2.0, 'furniture'); });
      [-1.6, 1.6].forEach((x) => { const sack = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.9, 10), mat(0xb8955a)); sack.position.set(h.ox + x, 0.5, d2(R) - 1.6); h.g.add(sack); });
      h.sign(2.8, 1.2, 512, 200, (x, w, hh) => { x.fillStyle = '#4a2a18'; x.fillRect(0, 0, w, hh); x.strokeStyle = '#e8c88a'; x.lineWidth = 6; x.strokeRect(6, 6, w - 12, hh - 12); txt(x, 'SWAMY & SONS', w / 2, 70, 'bold 54px sans-serif', '#f6e6c4'); txt(x, 'കാപ്പി · COFFEE', w / 2, 140, 'bold 40px ' + ML, '#e8c88a'); }, 0, 2.5, -d2(R) + 0.2);
      h.noteSpot(3.0, d2(R) - 1.6, 'swamy');
    });
    /* HiLITE Mall: a supermarket along the north wall, a food court counter, aisles of shelves, and a board */
    room('hilitemall', 'HiLITE Mall', 'ഹൈലൈറ്റ് മാൾ', 18, 12, 0xd8d4cc, 0xf2f0ea, (R, h) => {
      counter(h, -3.6, -d2(R) + 1.2, 5.4, 0x3a5a7a); h.bx(5.6, 0.08, 1.0, white, -3.6, 1.02, -d2(R) + 1.2);
      h.person('saree', -3.6, -d2(R) + 0.3, 0); h.spot(-3.6, -d2(R) + 2.3, 'shop', 'supermarket', 'Supermarket', '🛒');
      counter(h, 4.8, -d2(R) + 1.2, 4, 0x7a3a2a); h.bx(4.2, 0.08, 1.0, wood2, 4.8, 1.02, -d2(R) + 1.2);
      h.person('mundu', 4.8, -d2(R) + 0.3, 0); h.spot(4.8, -d2(R) + 2.3, 'shop', 'snacks', 'Food court', '🍟');
      [[-5.5, 0.6], [-1.5, 0.6], [2.5, 0.6], [6.0, 0.6]].forEach(([x, z]) => { h.bx(3.0, 1.7, 0.7, wood2, x, 0.85, z, 'furniture'); for (let k = 0; k < 5; k++) h.bx(0.4, 0.3, 0.5, mat(pick([0xc8532a, 0x2f8a5a, 0xe8b81c, 0x3a6ab8, 0xf4f1e8])), x - 1.2 + k * 0.6, 1.0 + (k % 2) * 0.6, z + 0.38); });
      [-4, 4].forEach((x) => { h.bx(0.9, 0.5, 1.4, mat(0x8a5a2a), x, 0.25, 3.4); });
      h.person('techieF', -5.8, 3.4, PI / 2); h.person('techie', 2.2, 3.6, -PI / 2);
      h.sign(3.6, 1.5, 512, 220, (x, w, hh) => { x.fillStyle = '#7a1f3a'; x.fillRect(0, 0, w, hh); x.strokeStyle = '#f3d9a8'; x.lineWidth = 6; x.strokeRect(6, 6, w - 12, hh - 12); txt(x, 'HiLITE MALL', w / 2, 78, 'bold 62px sans-serif', '#fff'); txt(x, 'ഹൈലൈറ്റ് മാൾ · Palazhi', w / 2, 150, 'bold 38px ' + ML, '#ffe9b0'); }, 0, 2.6, -d2(R) + 0.2);
      h.noteSpot(R.bounds.x1 - R.ox - 0.8, 2.2, 'hilitemall');
    });
    /* the Zilla Money office: a parody of the real Zil Money office (own name, coin logo and colours) */
    room('zilmoney', 'Zilla Money', 'സില്ല മണി', 16, 12, 0x6a7a86, 0xeef0f2, (R, h) => {
      const screen = (code) => canvasTex(128, 80, (x, w, hh) => { x.fillStyle = '#0d1b26'; x.fillRect(0, 0, w, hh); for (let i = 0; i < 9; i++) { x.fillStyle = ['#4fd1c5', '#f6ad55', '#9f7aea', '#68d391'][(i + code) % 4]; x.fillRect(8 + ((i * 7 + code * 5) % 20), 8 + i * 8, 20 + ((i * 13 + code * 11) % 60), 4); } });
      [-5.2, -1.7, 1.8, 5.2].forEach((x, ci) => [-0.6, 3.0].forEach((z, ri) => {
        h.bx(2.2, 0.08, 1.0, mat(0xe8e0d0), x, 0.78, z); h.bx(0.08, 0.75, 0.8, steel, x - 1.0, 0.4, z); h.bx(0.08, 0.75, 0.8, steel, x + 1.0, 0.4, z); h.block(x, z, 2.2, 1.0);
        h.bx(0.7, 0.45, 0.05, dark, x, 1.2, z - 0.25); const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.38), new THREE.MeshBasicMaterial({ map: screen(ci * 3 + ri) })); sc.position.set(h.ox + x, 1.2, z - 0.21); h.g.add(sc);
        h.bx(0.45, 0.05, 0.16, dark, x, 0.84, z + 0.1); h.bx(0.5, 0.08, 0.5, mat(0x2a3a4a), x, 0.5, z + 0.9);
      }));
      ['techie', 'techieF', 'techie', 'techieF'].forEach((t, i) => h.person(t, [-5.2, -1.7, 1.8, 5.2][i] + 0.9, i % 2 ? 4.0 : 0.4, i % 2 ? PI : 0));
      h.person('techie', 2.5, -4.2, PI / 2);
      h.bx(3.4, 1.0, 0.9, mat(0x2a3a4a), 5.2, 0.5, d2(R) - 1.4, 'furniture'); h.person('techieF', 5.2, d2(R) - 2.3, PI);
      h.sign(5.6, 2.0, 1024, 360, (x, w, hh) => { x.fillStyle = '#f7f1df'; x.fillRect(0, 0, w, hh); x.strokeStyle = '#12373a'; x.lineWidth = 10; x.strokeRect(10, 10, w - 20, hh - 20); x.fillStyle = '#ffc857'; x.beginPath(); x.arc(150, 120, 62, 0, 6.3); x.fill(); x.fillStyle = '#12373a'; x.font = 'bold 80px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('Z', 150, 124); txt(x, 'SILICON JERI', w * 0.6, 100, 'bold 90px sans-serif', '#12373a'); txt(x, 'ZILLA MONEY · a parody', w * 0.6, 190, 'bold 40px sans-serif', '#8a5a14'); txt(x, 'മഞ്ചേരിയിൽ നിർമ്മിച്ചത്', w / 2, 280, 'bold 52px ' + ML, '#12373a'); }, 0, 2.2, -d2(R) + 0.2);
      h.sign(1.3, 1.8, 260, 360, (x, w, hh) => { x.fillStyle = '#14201c'; x.fillRect(0, 0, w, hh); x.strokeStyle = '#46e0ff'; x.lineWidth = 6; x.strokeRect(8, 8, w - 16, hh - 16); txt(x, '🤖', w / 2, 110, '80px sans-serif', '#000'); txt(x, 'ROBO RUN', w / 2, 200, 'bold 34px sans-serif', '#46e0ff'); txt(x, 'ഓടാൻ പോകാം', w / 2, 260, 'bold 30px ' + ML, '#ffe9b0'); }, -R.bounds.x1 + R.ox + 0.3 - 0.3, 1.8, 0, PI / 2);
      h.noteSpot(0, -d2(R) + 1.8, 'zilmoney');
      /* the product wall (what the company does, from its public site), the ZilCubator corner and a co-working bench: the Manjeri site is described as a development centre with co-working space and an accelerator */
      const wx1 = R.bounds.x1 - R.ox - 0.3, wx0 = R.bounds.x0 - R.ox + 0.3;
      h.sign(3.6, 2.4, 512, 340, (x, w, hh) => { x.fillStyle = '#10243b'; x.fillRect(0, 0, w, hh); x.strokeStyle = '#8fc8ff'; x.lineWidth = 6; x.strokeRect(6, 6, w - 12, hh - 12); txt(x, 'WHAT WE BUILD', w / 2, 46, 'bold 38px sans-serif', '#ffffff'); ['One wallet for every payment', 'Checks · printed and mailed', 'ACH · wire · cards', 'Virtual cards · bill pay', 'API for other software'].forEach((t, i) => txt(x, t, w / 2, 100 + i * 46, 'bold 28px sans-serif', i % 2 ? '#8fc8ff' : '#ffe9b0')); }, wx1, 2.2, -2.5, -PI / 2);
      h.noteSpot(wx1 - 0.5, -2.5, 'zilwhat');
      h.sign(2.8, 1.3, 512, 240, (x, w, hh) => { x.fillStyle = '#1f4a3a'; x.fillRect(0, 0, w, hh); x.strokeStyle = '#ffe9b0'; x.lineWidth = 6; x.strokeRect(6, 6, w - 12, hh - 12); txt(x, 'ZILLACUBATOR', w / 2, 90, 'bold 60px sans-serif', '#fff'); txt(x, 'ഇൻകുബേറ്റർ · Silicon Jeri', w / 2, 168, 'bold 36px ' + ML, '#ffe9b0'); }, wx0, 2.2, 1.0, PI / 2);
      h.bx(0.9, 0.08, 4.4, mat(0xe8e0d0), wx0 + 0.9, 0.8, 1.0, 'furniture'); [-1.9, 1.9].forEach((dz) => h.bx(0.8, 0.75, 0.08, steel, wx0 + 0.9, 0.4, 1.0 + dz));
      [-1.4, 0, 1.4].forEach((dz) => { h.bx(0.35, 0.03, 0.5, dark, wx0 + 0.9, 0.86, 1.0 + dz); h.bx(0.4, 0.4, 0.4, mat(0x2a3a4a), wx0 + 1.9, 0.3, 1.0 + dz); });
      h.noteSpot(wx0 + 1.2, -2.8, 'zilcubator'); h.noteSpot(-3.2, -d2(R) + 1.8, 'zilsite');
      { const fx = h.w / 2 - 1.0; h.bx(0.06, 2.6, 0.06, steel, fx, 1.3, -d2(R) + 0.9); h.sign(1.1, 0.74, 96, 64, (x, ww, hh) => { x.fillStyle = '#ff9933'; x.fillRect(0, 0, ww, hh / 3); x.fillStyle = '#fff'; x.fillRect(0, hh / 3, ww, hh / 3); x.fillStyle = '#138808'; x.fillRect(0, 2 * hh / 3, ww, hh / 3); x.strokeStyle = '#000080'; x.lineWidth = 2; x.beginPath(); x.arc(ww / 2, hh / 2, hh / 7, 0, 6.3); x.stroke(); }, fx - 0.6, 2.2, -d2(R) + 0.9); }   // a flag on a pole in the corner
      h.sign(1.2, 0.8, 256, 170, (x, ww, hh) => { x.fillStyle = '#12373a'; x.fillRect(0, 0, ww, hh); x.fillStyle = '#ffc857'; x.font = 'bold 34px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('SHIP IT', ww / 2, hh * 0.38); x.fillStyle = '#fff'; x.font = '22px sans-serif'; x.fillText('small steps, every day', ww / 2, hh * 0.72); }, wx0 - 0.0 + 0.0, 2.1, -4.6, PI / 2);   // a poster
      [-7, 7].forEach((x) => { const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.3, 0.7, 10), mat(0x8a6a4a)); pl.position.set(h.ox + x, 0.35, -d2(R) + 0.6); h.g.add(pl); const lf = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), mat(0x3f7a30, { flatShading: true })); lf.position.set(h.ox + x, 1.15, -d2(R) + 0.6); h.g.add(lf); });
    });
    /* the hospital OPD, with a pharmacy counter */
    room('mcmanjeri', 'Government Medical College OPD', 'മെഡിക്കൽ കോളേജ് ഒ.പി', 14, 10, 0xc9d3cf, 0xeff3f1, (R, h) => {
      h.bx(3.6, 1.0, 0.9, mat(0xdfe6e3), -3.5, 0.5, -d2(R) + 1.2, 'furniture'); h.person('doctor', -3.5, -d2(R) + 0.3, 0);
      h.sign(3.4, 1.0, 512, 150, (x, w, hh) => { x.fillStyle = '#0f4a8a'; x.fillRect(0, 0, w, hh); txt(x, 'OPD · REGISTRATION', w / 2, 52, 'bold 40px sans-serif', '#fff'); txt(x, 'ഒ.പി · രജിസ്ട്രേഷൻ', w / 2, 108, 'bold 34px ' + ML, '#ffe9b0'); }, -3.5, 2.5, -d2(R) + 0.2);
      h.bx(3.0, 1.0, 0.9, mat(0x2f6a3a), 4.0, 0.5, -d2(R) + 1.2, 'furniture'); h.person('thattam', 4.0, -d2(R) + 0.3, 0); h.spot(4.0, -d2(R) + 2.3, 'shop', 'pharmacy', 'Pharmacy · ഫാർമസി', '💊');
      h.sign(3.0, 1.0, 512, 150, (x, w, hh) => { x.fillStyle = '#2f6a3a'; x.fillRect(0, 0, w, hh); txt(x, 'PHARMACY', w / 2, 52, 'bold 44px sans-serif', '#fff'); txt(x, 'ഫാർമസി', w / 2, 108, 'bold 40px ' + ML, '#ffe9b0'); }, 4.0, 2.5, -d2(R) + 0.2);
      [-4, -1.2].forEach((x) => [0.6, 2.2].forEach((z) => { h.bx(2.2, 0.45, 0.6, mat(0x3a6a8a), x, 0.25, z, 'furniture'); }));
      h.person('mundu', -4.6, 0.3, PI / 2); h.person('saree', -1.8, 2.0, -PI / 2); h.person('thattam', 2.4, 3.0, PI);
      h.noteSpot(5.6, 1.6, 'mcmanjeri');
    });
    return rooms;
  }

  window.RoboExploreInteriors = { ROOM_X0, build };
})();
