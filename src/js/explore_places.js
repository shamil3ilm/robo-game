/* Robo Run: the places off the main street in the walkable town (explore.js): the temple lane and courtyard (east), the market lane and a Malabar mosque (west), and the church square on the promenade.
   Exposes window.RoboExplorePlaces = { build(ctx) }; explore.js passes the helpers it builds the street with, so everything shares its materials, colliders, people and pickups.
   Real-world rules (DESIGN - Malabar World.md section 3a): Kerala temples have a square sanctum under stacked tiled roofs, a lamp pillar and a peepal tree in a walled courtyard; old Malabar mosques have
   whitewashed walls under tiered tile roofs and a slender minaret; Kerala churches are whitewashed with a front tower, a cross and a roadside cross shrine; markets are crowded wooden stalls under awnings.
   These are respectful scenery only: nobody is shown worshipping, and nothing is for sale that a place of worship would not allow. */
(function () {
  'use strict';
  const PI = Math.PI;

  function build(c) {
    const { THREE, add, mat, solid, post, plane, rr, pick, walker, stander, addPickup, cullables, staticGroups, palmAt, roofMat, laneZ: LZ } = c;
    /* a low gate across a courtyard entrance: you can look in, but the walker stays outside (these are places of worship, not play areas) */
    const gateBar = (g, ox, oz, x, z0, z1) => { bx(g, 0.1, 0.1, z1 - z0, wood, x - ox, 1.0, (z0 + z1) / 2 - oz); bx(g, 0.1, 0.1, z1 - z0, wood, x - ox, 0.45, (z0 + z1) / 2 - oz); [z0, z1].forEach((z) => bx(g, 0.16, 1.2, 0.16, wood, x - ox, 0.6, z - oz)); solid(x - 0.2, x + 0.2, z0, z1); };
    const cream = mat(0xf7f1e2), wallM = mat(0xefe2c4), band = mat(0xb8402a), laterite = mat(0x9a5a3a), brass = mat(0xd9a93a, { metalness: 0.6, roughness: 0.35 }), dark = mat(0x2a1c14), wood = mat(0x6a4a2a), green = mat(0x2f7a4a), blue = mat(0x3a5f9a);
    const lamp = new THREE.MeshBasicMaterial({ color: 0xffc860 });
    const mesh = (geo, m, x, y, z, parent) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o; };
    const place = (x, z) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.userData = { x, z }; add(g); cullables.push(g); if (staticGroups) staticGroups.push(g); return g; };   // a place never moves: its meshes are joined into a few
    const bx = (g, w, h, d, m, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), m, x, y, z, g);
    const cyl = (g, r0, r1, h, m, x, y, z, seg) => mesh(new THREE.CylinderGeometry(r0, r1, h, seg || 14), m, x, y, z, g);
    /* a wall in world coordinates (x0 < x1, z0 < z1) that also blocks the walker; an optional red band along the top */
    const wall = (g, ox, oz, x0, z0, x1, z1, h, m, withBand) => {
      bx(g, x1 - x0, h, z1 - z0, m, (x0 + x1) / 2 - ox, h / 2, (z0 + z1) / 2 - oz);
      if (withBand) bx(g, x1 - x0 + 0.08, 0.26, z1 - z0 + 0.08, band, (x0 + x1) / 2 - ox, h - 0.1, (z0 + z1) / 2 - oz);
      solid(x0, x1, z0, z1);
    };
    /* a tiled gable roof: ridge along 'x' or 'z', total span 2 * half, starting at baseY */
    const gable = (g, x, baseY, z, len, half, ridge, th) => {
      th = th || 0.45; const bl = half / Math.cos(th);
      [-1, 1].forEach((k) => {
        const r = ridge === 'z' ? bx(g, bl, 0.14, len, roofMat, x + (k * half) / 2, baseY + (half / 2) * Math.tan(th), z) : bx(g, len, 0.14, bl, roofMat, x, baseY + (half / 2) * Math.tan(th), z + (k * half) / 2);
        if (ridge === 'z') r.rotation.z = -k * th; else r.rotation.x = k * th;
      });
      return baseY + half * Math.tan(th);
    };
    const pyramid = (g, x, y, z, side, h) => { const o = mesh(new THREE.ConeGeometry(side / Math.SQRT2, h, 4).rotateY(PI / 4), roofMat, x, y + h / 2, z, g); return o; };
    const tree = (g, x, z, s) => {
      cyl(g, 0.5 * s, 0.75 * s, 4.2 * s, mat(0x5a4632), x, 2.1 * s, z, 9);
      [[0, 5.6, 0, 2.5], [1.8, 5.0, 0.8, 2.0], [-1.7, 5.2, -0.6, 2.1], [0.4, 6.4, -1.2, 1.7], [-0.6, 4.8, 1.6, 1.8]].forEach(([dx, dy, dz, r]) => { const o = mesh(new THREE.IcosahedronGeometry(r * s, 1), mat(0x4f7a3a, { flatShading: true }), x + dx * s, dy * s, z + dz * s, g); o.scale.y = 0.8; });
      post(x, z, 0.8 * s);
    };

    /* ---------- the lanes: roads and walls from the main street to each courtyard ---------- */
    const laneMat = mat(0x57534e, { roughness: 0.95 });
    [-1, 1].forEach((s) => {
      plane(12, 8, laneMat, s * 10.6, 0.005, LZ);
      const g = place(s * 11, LZ);
      wall(g, s * 11, LZ, Math.min(s * 4.6, s * 16), LZ - 4.35, Math.max(s * 4.6, s * 16), LZ - 4.05, 2.3, wallM, true);
      wall(g, s * 11, LZ, Math.min(s * 4.6, s * 16), LZ + 4.05, Math.max(s * 4.6, s * 16), LZ + 4.35, 2.3, wallM, true);
    });

    /* ---------- market and flower stalls ---------- */
    const heap = (g, geo, m, x, y, z) => mesh(geo, m, x, y, z, g);
    const GOODS = {
      veg: (g) => { const gs = new THREE.SphereGeometry(0.15, 8, 6); [0xc8321e, 0x4f8a2a, 0xe08a1a, 0x7a3a8a, 0x4f8a2a, 0xc8321e].forEach((hex, i) => heap(g, gs, mat(hex), -0.8 + i * 0.32, 1.0, (i % 2) * 0.18 - 0.05)); cyl(g, 0.3, 0.24, 0.3, mat(0x9a7a4a), 0.65, 0.95, 0.32, 10); },
      fruit: (g) => { const b = new THREE.CapsuleGeometry(0.07, 0.4, 3, 6); for (let i = 0; i < 6; i++) { const o = heap(g, b, mat(i % 2 ? 0xe8c23a : 0xd9b92f), -0.7 + i * 0.28, 1.85, 0.1); o.rotation.z = 0.2 * (i % 2 ? 1 : -1); } const s = new THREE.SphereGeometry(0.14, 8, 6); for (let i = 0; i < 8; i++) heap(g, s, mat(0xe8821a), -0.7 + (i % 4) * 0.3, 1.0, 0.0 + ((i / 4) | 0) * 0.28); },
      fish: (g) => { bx(g, 1.5, 0.06, 0.65, mat(0xb8bcc0, { metalness: 0.5, roughness: 0.35 }), 0, 0.93, 0); const f = new THREE.SphereGeometry(0.2, 8, 6).scale(1.5, 0.35, 0.6); for (let i = 0; i < 6; i++) { const o = heap(g, f, mat(i % 2 ? 0x8fa6b4 : 0xb0c0c8, { metalness: 0.3, roughness: 0.4 }), -0.55 + (i % 3) * 0.55, 1.02, -0.15 + ((i / 3) | 0) * 0.32); o.rotation.y = i * 0.5; } },
      spice: (g) => { [0xe0a020, 0xb82a1a, 0x2a2a2a, 0x6f9a3a, 0x8a5a2a].forEach((hex, i) => { cyl(g, 0.24, 0.24, 0.05, mat(0xd8c8a8), -0.8 + i * 0.4, 0.92, 0, 10); heap(g, new THREE.ConeGeometry(0.2, 0.3, 10), mat(hex, { roughness: 1 }), -0.8 + i * 0.4, 1.09, 0); }); },
      coconut: (g) => { const s = new THREE.SphereGeometry(0.2, 8, 6); for (let i = 0; i < 9; i++) heap(g, s, mat(i % 3 ? 0x6b4a2a : 0x4f8a2a), -0.6 + (i % 4) * 0.4, 1.02 + ((i / 5) | 0) * 0.3, ((i * 7) % 5) * 0.1 - 0.1); },
      flowers: (g) => { const s = new THREE.SphereGeometry(0.11, 6, 5); for (let i = 0; i < 12; i++) heap(g, s, mat(i % 3 === 0 ? 0xfaf6e8 : 0xf2a020), -0.8 + (i % 6) * 0.3, 1.0 + ((i / 6) | 0) * 0.14, 0); for (let i = 0; i < 5; i++) { const t = heap(g, new THREE.TorusGeometry(0.2, 0.035, 5, 12), mat(i % 2 ? 0xfaf6e8 : 0xf2a020), -0.7 + i * 0.35, 1.7, 0.2); t.rotation.x = 0.2; } }
    };
    /* a stall at world (x, z) whose front faces `face` along z (+1 or -1) */
    const stall = (x, z, face, kind, awn) => {
      const g = place(x, z); g.rotation.y = face > 0 ? 0 : PI;
      bx(g, 2.3, 0.85, 1.0, wood, 0, 0.42, 0); bx(g, 2.4, 0.07, 1.1, mat(0xb8895a), 0, 0.88, 0);
      bx(g, 2.3, 2.3, 0.08, mat(0xc9b896), 0, 1.15, -0.55);
      [-1.1, 1.1].forEach((px) => bx(g, 0.07, 2.3, 0.07, wood, px, 1.15, 0.5));
      const a = bx(g, 2.6, 0.06, 1.7, mat(awn || pick([0xb8352a, 0x2f6a4a, 0xc89a2a, 0x2b4a7a, 0x8a3a6a])), 0, 2.3, 0.1); a.rotation.x = 0.16; c.fadeable(a, x, z + face * 0.1, 1.3, 0.85);
      (GOODS[kind] || GOODS.veg)(g);
      solid(x - 1.2, x + 1.2, z - 0.7, z + 0.7, 'stall', g);
      return g;
    };

    /* ---------- the temple lane and courtyard (east) ---------- */
    (() => {
      const cx = 24, cz = LZ, g = place(cx, cz);
      plane(16, 16, mat(0xb98a5a, { roughness: 1 }), cx, 0.03, cz);
      wall(g, cx, cz, cx - 8.2, cz - 8.2, cx + 8.2, cz - 7.8, 2.0, wallM, true); wall(g, cx, cz, cx - 8.2, cz + 7.8, cx + 8.2, cz + 8.2, 2.0, wallM, true); wall(g, cx, cz, cx + 7.8, cz - 8, cx + 8.2, cz + 8, 2.0, wallM, true);
      wall(g, cx, cz, cx - 8.2, cz - 8, cx - 7.8, cz - 2.6, 2.0, wallM, true); wall(g, cx, cz, cx - 8.2, cz + 2.6, cx - 7.8, cz + 8, 2.0, wallM, true);
      [-2.9, 2.9].forEach((dz) => { bx(g, 0.7, 3.4, 0.7, cream, -8, 1.7, dz); post(cx - 8, cz + dz, 0.4); });                     // gate pillars
      gable(g, -8, 3.4, 0, 1.6, 3.4, 'x');                                                                                           // small tiled roof over the gate
      // the sanctum: a square building on a laterite plinth, under two stacked tiled roofs with a brass finial
      bx(g, 7, 0.7, 7, laterite, 1, 0.35, 0); bx(g, 5, 3.4, 5, cream, 1, 2.4, 0); bx(g, 0.1, 2.3, 1.3, dark, -1.52, 1.85, 0);
      pyramid(g, 1, 4.1, 0, 7.4, 2.6); bx(g, 1.6, 0.9, 1.6, cream, 1, 6.9, 0); pyramid(g, 1, 7.3, 0, 3.8, 2.0);
      cyl(g, 0.06, 0.06, 0.6, brass, 1, 9.6, 0, 6); mesh(new THREE.SphereGeometry(0.18, 10, 8), brass, 1, 9.3, 0, g);
      solid(cx - 2.5, cx + 4.5, cz - 3.5, cz + 3.5);
      // the lamp pillar (deepastambham): brass tiers of tiny flames, lit at dusk
      cyl(g, 0.1, 0.14, 3.2, brass, -4.2, 1.6, 0, 8); [0.9, 1.6, 2.3, 3.0].forEach((y, i) => { cyl(g, 0.55 - i * 0.05, 0.55 - i * 0.05, 0.05, brass, -4.2, y, 0, 14); for (let k = 0; k < 8; k++) { const a = (k / 8) * PI * 2, r = 0.5 - i * 0.05; mesh(new THREE.SphereGeometry(0.05, 5, 4), lamp, -4.2 + Math.cos(a) * r, y + 0.07, Math.sin(a) * r, g); } });
      post(cx - 4.2, cz, 0.6); gateBar(g, cx, cz, cx - 8, cz - 2.6, cz + 2.6);
      tree(g, 5.2, -5.2, 1.0);                                                                                                       // peepal tree
      palmAt(cx + 11.5, cz - 4, 2, 1.1); palmAt(cx + 11.5, cz + 5, 4, 1.2); palmAt(cx - 11, cz - 10, 1, 1.0);
      // marigold and jasmine garlands, coconuts and a little camphor: the stalls of the temple lane
      stall(7.2, LZ - 3.2, 1, 'flowers', 0xf2a020); stall(10.4, LZ + 3.2, -1, 'coconut', 0x2f6a4a);
      stander('mundu', 8.7, LZ - 3.2, PI); stander('saree', 11.9, LZ + 3.2, 0);
      addPickup('food', 'coconut', 9.2, LZ - 1.6); addPickup('food', 'banana', 11.4, LZ + 1.6); addPickup('coin', null, 13.5, LZ);
      walker('saree', [[8, LZ + 0.5], [14.2, LZ + 0.5]], 0.9); walker('mundu', [[cx - 6, cz - 5.2], [cx + 3, cz - 5.2], [cx - 6, cz - 5.2]], 0.8); walker('thattam', [[13, LZ - 0.8], [6, LZ - 0.8]], 1.0);
    })();

    /* ---------- the market lane (west), ending at a Malabar mosque ---------- */
    (() => {
      const cx = -24, cz = LZ, g = place(cx, cz);
      plane(16, 16, mat(0xddd0b4, { roughness: 0.95 }), cx, 0.03, cz);
      wall(g, cx, cz, cx - 8.2, cz - 8.2, cx + 8.2, cz - 7.8, 2.0, wallM, true); wall(g, cx, cz, cx - 8.2, cz + 7.8, cx + 8.2, cz + 8.2, 2.0, wallM, true); wall(g, cx, cz, cx - 8.2, cz - 8, cx - 7.8, cz + 8, 2.0, wallM, true);
      wall(g, cx, cz, cx + 7.8, cz - 8, cx + 8.2, cz - 2.6, 2.0, wallM, true); wall(g, cx, cz, cx + 7.8, cz + 2.6, cx + 8.2, cz + 8, 2.0, wallM, true);
      // the prayer hall: whitewashed walls, a green band, arched windows, two tiers of tile roof
      const hx = -2.5;
      bx(g, 7, 3.6, 11, mat(0xfaf7ee), hx, 1.8, 0); bx(g, 7.1, 0.3, 11.1, green, hx, 3.45, 0);
      for (let i = -2; i <= 2; i++) { bx(g, 0.1, 1.5, 0.8, mat(0x1d2a30), hx + 3.52, 1.9, i * 1.9); bx(g, 0.12, 0.3, 1.0, green, hx + 3.54, 2.75, i * 1.9); }
      bx(g, 0.1, 2.4, 1.4, dark, hx + 3.52, 1.2, 0.0);
      const top = gable(g, hx, 3.6, 0, 11.8, 4.1, 'z'); bx(g, 4.2, 1.4, 9, mat(0xfaf7ee), hx, top + 0.7 - 0.9, 0); gable(g, hx, top + 0.5, 0, 9.6, 2.7, 'z');
      solid(cx - 6, cx + 1, cz - 5.7, cz + 5.7);
      // the minaret: slim tower, balcony, green cap, brass finial
      const mx = 3.4, mz = -6.2; cyl(g, 0.8, 0.62, 8.4, mat(0xfaf7ee), mx, 4.2, mz, 14); cyl(g, 0.65, 0.65, 0.3, green, mx, 6.2, mz, 14); cyl(g, 1.05, 1.05, 0.22, mat(0xfaf7ee), mx, 7.3, mz, 14);
      mesh(new THREE.ConeGeometry(0.85, 1.8, 14), green, mx, 9.3, mz, g); mesh(new THREE.SphereGeometry(0.14, 8, 6), brass, mx, 10.3, mz, g); post(cx + mx, cz + mz, 0.9);
      // the lane's stalls: vegetables, fruit, fish, spices and coconuts, with vendors
      [['veg', -6.8], ['spice', -9.8], ['fish', -12.8]].forEach(([k, x]) => { stall(x, LZ - 3.2, 1, k); stander(k === 'fish' ? 'lungi' : 'thattam', x + 1.5, LZ - 3.2, PI); });
      [['fruit', -6.8], ['coconut', -9.8], ['veg', -12.8]].forEach(([k, x]) => { stall(x, LZ + 3.2, -1, k); stander(k === 'coconut' ? 'mundu' : 'saree', x + 1.5, LZ + 3.2, 0); });
      addPickup('food', 'pepper', -9.8, LZ - 1.6); addPickup('food', 'cardamom', -8.4, LZ - 1.4); addPickup('food', 'spice', -11.2, LZ + 1.6); addPickup('food', 'banana', -6.8, LZ + 1.6); addPickup('food', 'jaggery', -12.8, LZ + 1.6);
      gateBar(g, cx, cz, cx + 8, cz - 2.6, cz + 2.6); addPickup('food', 'tea', -14.6, LZ + 1.6); addPickup('coin', null, -14.5, LZ); addPickup('coin', null, -8, LZ);
      walker('lungi', [[-6, LZ + 0.4], [-14.2, LZ + 0.4]], 0.9); walker('thattam', [[-14, LZ - 0.4], [-5.5, LZ - 0.4]], 0.85); walker('mundu', [[-7, LZ], [-12, LZ + 0.2]], 0.7); walker('saree', [[-5.5, LZ + 1], [-13, LZ - 1]], 0.8);
    })();

    /* ---------- the church square (promenade, east end) ---------- */
    (() => {
      const cx = 27, cz = 64, g = place(cx, cz), tw = 3.4;
      // nave (ridge along x) and the front tower facing the street
      bx(g, 9, 4.6, 6.2, cream, 4.5, 2.3, 0); bx(g, 9.1, 0.25, 6.3, blue, 4.5, 0.15, 0); gable(g, 4.5, 4.6, 0, 9.8, 3.6, 'x', 0.42);
      bx(g, tw, 8.2, tw, cream, -1.2, 4.1, 0); bx(g, tw + 0.1, 0.25, tw + 0.1, blue, -1.2, 0.15, 0); bx(g, 0.1, 2.5, 1.4, dark, -2.93, 1.25, 0); bx(g, 0.1, 1.6, 1.0, mat(0x1d2a30), -2.93, 6.5, 0); bx(g, 2.2, 0.25, 2.2, mat(0xd8d0c0), -3.5, 0.12, 0);
      mesh(new THREE.ConeGeometry(tw * 0.78, 3.6, 4).rotateY(PI / 4), roofMat, -1.2, 8.2 + 1.8, 0, g);
      bx(g, 0.14, 1.1, 0.14, cream, -1.2, 12.4, 0); bx(g, 0.6, 0.14, 0.14, cream, -1.2, 12.65, 0);
      mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.12, 16).rotateZ(PI / 2), blue, -2.98, 5.2, 0, g);                                    // round window above the door
      for (let i = 0; i < 3; i++) [-1, 1].forEach((s) => bx(g, 0.9, 1.6, 0.1, mat(0x3a5f9a), 2.2 + i * 2.6, 2.6, s * 3.12));
      solid(cx - 2.9, cx + 9, cz - 3.2, cz + 3.2);
      // the roadside cross shrine, a common sight in Kerala
      const sx = -7.5, sz = 5; bx(g, 1.2, 1.1, 1.2, cream, sx, 0.55, sz); bx(g, 0.9, 0.2, 0.9, blue, sx, 1.2, sz); bx(g, 0.16, 2.0, 0.16, cream, sx, 2.2, sz); bx(g, 0.7, 0.16, 0.16, cream, sx, 2.7, sz); solid(cx + sx - 0.7, cx + sx + 0.7, cz + sz - 0.7, cz + sz + 0.7);
      palmAt(cx + 12, cz - 2, 5, 1.2); palmAt(cx + 8, cz + 8, 3, 1.1); palmAt(cx - 7, cz - 7, 0, 1.0);
      stander('saree', cx - 9, cz + 1.5, PI / 2); addPickup('food', 'rice', cx - 6.5, cz + 1.8); addPickup('coin', null, cx - 9, cz - 3);
      walker('saree', [[cx - 10, cz - 3], [cx - 10, cz + 3]], 0.8); walker('mundu', [[cx - 6, cz + 9], [cx - 12, cz + 9], [cx - 12, cz + 3], [cx - 6, cz + 3]], 0.7);
    })();
  }

  window.RoboExplorePlaces = { build };
})();
