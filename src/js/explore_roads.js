/* Robo Run: a second street for an area of the walkable town. Exposes window.RoboExploreRoads = { sideRoad(c, o) }.
   c is the area context that explore.js hands to each area file (explore_city.js and the others); the street is built with the same shopfronts as the main road.
   o = { lx, z0, z1, name: [English, Malayalam], nameZ, runs: [[side, a, b, pair?]], yard: { x0, x1, z0, z1 }, coins, walkers, scooter, auto, palms: { x0, x1, z0, z1, n } }
     lx: where the street runs, as an offset from the area's centre; side +1 is the building row on its east, -1 on its west.
     runs: building rows from z a to b; with a `pair` ([English, Malayalam] product words) it is one named building, without one it is cut into shopfronts with random product-word signs.
   Names are product words, never real businesses. Look-only: nothing here has a door. */
(function () {
  'use strict';
  if (window.RoboExploreRoads) return;   // the page loads its scripts twice
  const PI = Math.PI, FONT_ML = '"Nirmala UI","Noto Sans Malayalam","Kartika",sans-serif';

  function sideRoad(c, o) {
    const { THREE, add, box, mat, plane, canvasTex, rr, walker, addPickup, cullables, palmAt, building, auto, scooter, ox, asphaltMat, paverMat } = c;
    const px = ox + o.lx, zc = (o.z0 + o.z1) / 2, len = o.z1 - o.z0;
    plane(8, len, asphaltMat, px, 0.04, zc);
    [-1, 1].forEach((s) => { box(1.2, 0.16, len, paverMat, px + s * 4.0, 0.1, zc, undefined, false); box(0.34, 0.1, len, mat(0x8d8a84), px + s * 3.5, 0.09, zc, undefined, false); });
    if (o.yard) plane(o.yard.x1 - o.yard.x0, o.yard.z1 - o.yard.z0, mat(0x948d80, { roughness: 0.95 }), ox + (o.yard.x0 + o.yard.x1) / 2, 0.06, (o.yard.z0 + o.yard.z1) / 2);
    for (const [side, a, b, pair] of o.runs) {
      if (pair) { building(side, a, b, px, pair); continue; }
      const n = Math.max(1, Math.round((b - a) / 7.5)), w = (b - a) / n; for (let i = 0; i < n; i++) building(side, a + i * w, a + (i + 1) * w, px);
    }
    if (o.name) {   // the street's name board, readable from both ends
      const tx = (x, t, py, font, col) => { x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = col; x.font = font; x.fillText(t, 512, py); };
      const bd = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.4), new THREE.MeshStandardMaterial({ map: canvasTex(1024, 200, (x, w, h) => { x.fillStyle = '#3a3a3a'; x.fillRect(0, 0, w, h); x.strokeStyle = '#f3e6cf'; x.lineWidth = 6; x.strokeRect(6, 6, w - 12, h - 12); tx(x, o.name[0].toUpperCase(), h * 0.38, 'bold 80px sans-serif', '#fff'); tx(x, o.name[1], h * 0.76, 'bold 52px ' + FONT_ML, '#ffe9b0'); }), roughness: 0.85, side: THREE.DoubleSide }));
      bd.position.set(px, 5.2, o.nameZ === undefined ? o.z1 - 8 : o.nameZ); add(bd); cullables.push(bd); bd.userData = { x: px, z: bd.position.z };
    }
    for (let i = 0; i < (o.coins || 0); i++) addPickup('coin', null, px + (i % 2 ? -rr(0.4, 1.2) : rr(0.4, 2.5)), o.z0 + 4 + i * ((len - 8) / Math.max(1, o.coins - 1)) + rr(-1, 1));
    if (o.palms) for (let i = 0; i < o.palms.n; i++) palmAt(ox + rr(o.palms.x0, o.palms.x1), rr(o.palms.z0, o.palms.z1), i + 60, rr(1.0, 1.5));
    const wz0 = o.z0 + 6, wz1 = o.z1 - 6;
    [['lungi', [[px + 1.2, wz1], [px + 1.2, wz0]], 1.1], ['schoolgirl', [[px - 1.5, wz0], [px - 1.5, wz1]], 1.2], ['mundu', [[px + 0.4, wz0 + (wz1 - wz0) * 0.3], [px + 0.4, wz1]], 1.0]].forEach(([type, pts, sp]) => walker(type, pts, sp, 3));
    if (o.scooter !== undefined) scooter(px + 3.6, o.scooter, PI / 2);
    if (o.auto !== undefined) auto(px - 3.2, o.auto, 0.05);
  }

  window.RoboExploreRoads = { sideRoad };
})();
