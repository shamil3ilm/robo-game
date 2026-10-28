/* Robo Run: road vehicles for the walkable town (explore.js): KSRTC and private buses, a lorry, an ice-cream cart. Exposes window.RoboExploreVehicles = { bus, lorry, iceCream }.
   Colours follow what could be checked: a KSRTC "Fast" bus has a bright yellow front (a "Super Fast" a lighter red one, a Swift orange stripes); private buses are colour-coded by service
   (city green, rural blue, limited-stop maroon) with three off-white lines just above the floor. Every vehicle is built facing -z at the origin, wheels on the ground. */
(function () {
  'use strict';
  const PI = Math.PI;
  const FONT_ML = '"Nirmala UI","Noto Sans Malayalam","Kartika",sans-serif';

  function make(THREE, canvasTex) {
    const mat = (hex, o) => new THREE.MeshStandardMaterial(Object.assign({ color: hex, roughness: 0.65 }, o));
    const part = (g, geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; g.add(o); return o; };
    const box = (g, w, h, d, m, x, y, z) => part(g, new THREE.BoxGeometry(w, h, d), m, x, y, z);
    const plane = (g, w, h, tex, x, y, z, ry) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex })); p.position.set(x, y, z); p.rotation.y = ry || 0; g.add(p); return p; };
    const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.35, 16).rotateZ(PI / 2), tyre = mat(0x151515, { roughness: 0.95 }), glass = mat(0x1d2a30, { roughness: 0.2, metalness: 0.3 });
    const label = (w, h, draw) => canvasTex(w, h, draw);
    const text = (x, t, px, py, font, col) => { x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = col; x.font = font; x.fillText(t, px, py); };

    /* kind: 'ksrtc' (cream body, yellow Fast front), 'private-blue' (rural), 'private-green' (city), 'private-maroon' (limited stop); dest: the destination board, English and Malayalam */
    const bus = (kind, dest) => {
      const g = new THREE.Group(), ksrtc = kind === 'ksrtc';
      const body = mat(ksrtc ? 0xf1ede0 : kind === 'private-green' ? 0x2f8a4a : kind === 'private-maroon' ? 0x7a1f2a : 0x2f6fb0), front = mat(ksrtc ? 0xf2c230 : 0xf4f1e6), line = mat(0xf1ede0);
      box(g, 2.5, 2.6, 10.4, body, 0, 1.9, 0);                                   // main body
      box(g, 2.52, 0.28, 10.2, ksrtc ? mat(0x8a1f2b) : line, 0, 0.78, 0);           // KSRTC: maroon skirt band; private: the lower off-white line
      if (!ksrtc) { box(g, 2.52, 0.08, 10.2, line, 0, 1.0, 0); box(g, 2.52, 0.08, 10.2, line, 0, 1.2, 0); }   // three off-white lines above the floor
      box(g, 2.52, 0.9, 9.4, glass, 0, 2.55, -0.1);                              // window band
      box(g, 2.5, 2.4, 0.12, front, 0, 1.9, -5.2);                               // front panel (yellow for a Fast)
      box(g, 2.2, 0.9, 0.08, glass, 0, 2.65, -5.27);                             // windscreen
      box(g, 2.6, 0.12, 10.5, mat(0xe8e4d8), 0, 3.25, 0);                        // roof
      [-0.85, 0.85].forEach((x) => box(g, 0.3, 0.2, 0.08, mat(0xfff2c0), x, 1.0, -5.3));   // headlamps
      [[-1.25, -3.4], [1.25, -3.4], [-1.25, 2.6], [1.25, 2.6], [-1.25, 3.7], [1.25, 3.7]].forEach(([x, z]) => part(g, wheelGeo, tyre, x, 0.5, z));
      const dst = label(512, 96, (x, w, h) => { x.fillStyle = '#111'; x.fillRect(0, 0, w, h); text(x, dest[0].toUpperCase(), w * 0.32, h * 0.5, 'bold 40px sans-serif', '#ffb53a'); text(x, dest[1], w * 0.74, h * 0.5, 'bold 34px ' + FONT_ML, '#ffb53a'); });
      plane(g, 2.1, 0.4, dst, 0, 3.0, -5.28, PI);                                // destination board over the windscreen (faces forward)
      const side = label(1024, 160, (x, w, h) => { x.clearRect(0, 0, w, h); text(x, ksrtc ? 'KSRTC' : 'Private bus', w * 0.15, h * 0.5, 'bold 58px sans-serif', ksrtc ? '#8a1f2b' : '#f1ede0'); text(x, ksrtc ? 'കെ.എസ്.ആർ.ടി.സി · FAST PASSENGER' : dest[1] + ' · ' + dest[0], w * 0.64, h * 0.5, 'bold 38px ' + FONT_ML, ksrtc ? '#8a1f2b' : '#f1ede0'); });
      [-1, 1].forEach((s) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 0.78), new THREE.MeshBasicMaterial({ map: side, transparent: true, alphaTest: 0.2 })); p.position.set(s * 1.27, 1.55, 0.2); p.rotation.y = s * PI / 2; g.add(p); });
      g.userData.length = 10.4; g.userData.width = 2.5; return g;
    };

    /* a lorry with a covered load; trucks in Kerala are painted bright and say HORN OK PLEASE on the tailgate */
    const lorry = (hex) => {
      const g = new THREE.Group(), cab = mat(hex || 0xd9792a), load = mat(0x3a6ea0);
      box(g, 2.4, 2.2, 2.2, cab, 0, 1.7, -3.3); box(g, 2.2, 0.8, 0.08, glass, 0, 2.2, -4.43); box(g, 2.4, 0.5, 8.4, mat(0x2a2a2a), 0, 0.85, 0.9);
      box(g, 2.4, 2.2, 5.6, load, 0, 2.1, 1.7); box(g, 2.5, 0.2, 5.8, mat(0x6a4a2a), 0, 1.1, 1.7);
      [[-1.2, -3.2], [1.2, -3.2], [-1.2, 2.4], [1.2, 2.4], [-1.2, 3.5], [1.2, 3.5]].forEach(([x, z]) => part(g, wheelGeo, tyre, x, 0.5, z));
      const tail = label(512, 128, (x, w, h) => { x.fillStyle = '#d9792a'; x.fillRect(0, 0, w, h); x.strokeStyle = '#1a1a1a'; x.lineWidth = 6; x.strokeRect(5, 5, w - 10, h - 10); text(x, 'HORN OK PLEASE', w / 2, h / 2, 'bold 54px sans-serif', '#1a1a1a'); });
      plane(g, 2.2, 0.55, tail, 0, 2.4, 4.52, 0); g.userData.length = 8.8; g.userData.width = 2.5; return g;
    };

    /* a push cart with a striped parasol and a board: ice cream and cold drinks */
    const iceCream = () => {
      const g = new THREE.Group();
      box(g, 1.3, 0.8, 0.9, mat(0xf4efe2), 0, 0.85, 0); box(g, 1.36, 0.1, 0.96, mat(0x2f8ab0), 0, 1.3, 0); [-0.5, 0.5].forEach((x) => part(g, new THREE.CylinderGeometry(0.22, 0.22, 0.08, 14).rotateZ(PI / 2), tyre, x, 0.25, 0.5));
      part(g, new THREE.CylinderGeometry(0.03, 0.03, 2.2, 6), mat(0x6a4a2a), 0, 2.2, 0);
      const stripes = label(128, 8, (x, w, h) => { for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#fff' : '#e8527a'; x.fillRect((i * w) / 8, 0, w / 8, h); } });
      part(g, new THREE.ConeGeometry(1.2, 0.5, 8), new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.8, side: THREE.DoubleSide }), 0, 3.2, 0);
      const board = label(256, 100, (x, w, h) => { x.fillStyle = '#e8527a'; x.fillRect(0, 0, w, h); text(x, 'ICE CREAM', w / 2, h * 0.36, 'bold 36px sans-serif', '#fff'); text(x, 'ഐസ്ക്രീം', w / 2, h * 0.74, 'bold 34px ' + FONT_ML, '#fff'); });
      plane(g, 1.2, 0.47, board, 0, 1.05, -0.5, PI);
      g.userData.length = 1.8; g.userData.width = 1.3; return g;
    };
    return { bus, lorry, iceCream };
  }
  window.RoboExploreVehicles = { make };
})();
