/* Robo Run: the "world bend" that turns the straight three-lane track into the Wayanad Churam (Thamarassery ghat road): nine numbered bends and rolling climbs per Wayanad zone.
   Game logic stays a straight three-lane track; only what is drawn bends. Every vertex is moved sideways (and up) in the vertex shader by an amount that depends on its distance down the road,
   measured from the walker so the road under the character always points straight ahead (like a camera that follows the road).
   Exposes window.RoboBend = { R, H, hairpin, constants, install(THREE), update(dist) }. The GLSL below mirrors R and H exactly (tests/bend.test.js checks the JS side).
   Real road, for reference: NH 766, about 14 km from Adivaram (Thamarassery) up to the Lakkidi view point, with nine hairpin bends. At game scale each Wayanad zone is 750 m, one bend about every 83 m. */
(function () {
  'use strict';
  if (window.RoboBend && window.RoboBend.shared) return;   // the page's template runtime can load every script a second time: keep the first instance, so the engine's install and its per-frame updates reach the same uniforms
  const ZL = 750, N = 9, A = 16, AH = 8, EDGE = 60, ZN = 2, ZW = 1, P = (2 * ZL) / N;   // zone length, bends per zone, sideways amplitude (m), hill height (m), ease-in at the zone ends, zones in the loop, index of the Wayanad zone
  const TAU = Math.PI * 2, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const env = (d) => { if (d < 0) return 0; const zi = Math.floor(d / ZL); if (zi % ZN !== ZW) return 0; const loc = d - zi * ZL; return sstep(0, EDGE, loc) * sstep(0, EDGE, ZL - loc); };
  const loc = (d) => d - Math.floor(d / ZL) * ZL;
  const R = (d) => env(d) * A * Math.sin((TAU * loc(d)) / P);                 // sideways position of the road (m), positive = to the right
  const H = (d) => env(d) * AH * (1 - Math.cos((2 * TAU * loc(d)) / ZL));      // height of the road (m): two rolling climbs per zone, matching the zone's uphill and downhill speed changes
  /* which hairpin (1..9) the walker is at, or 0: the apex of bend n sits at P/4 + (n - 1) * P/2 into the zone */
  const hairpin = (d) => {
    if (d < 0 || Math.floor(d / ZL) % ZN !== ZW) return 0;
    const l = loc(d), k = Math.round((l - P / 4) / (P / 2));
    return k >= 0 && k < N && Math.abs(l - (P / 4 + (k * P) / 2)) < 22 ? k + 1 : 0;
  };
  /* the bend number (1..9) when d is within tol metres of its apex, else 0: used to put a numbered board at each bend */
  const apexIndex = (d, tol) => {
    if (d < 0 || Math.floor(d / ZL) % ZN !== ZW) return 0;
    const l = loc(d), k = Math.round((l - P / 4) / (P / 2));
    return k >= 0 && k < N && Math.abs(l - (P / 4 + (k * P) / 2)) <= tol ? k + 1 : 0;
  };
  /* 'adivaram' near the foot of the climb (the start of the zone), 'lakkidi' near the top (the view point), else '' */
  const gantryAt = (d, tol) => { if (d < 0 || Math.floor(d / ZL) % ZN !== ZW) return ''; const l = loc(d); return Math.abs(l - 30) <= tol ? 'adivaram' : Math.abs(l - (ZL - 30)) <= tol ? 'lakkidi' : ''; };
  const apex = (n) => P / 4 + ((n - 1) * P) / 2;   // metres into the zone

  const HEADER = [
    'uniform vec4 uBk; uniform vec4 uBh;',
    'float bendEnv(float d){ if (d < 0.0) return 0.0; float zi = floor(d / ' + ZL.toFixed(1) + '); if (abs(mod(zi, ' + ZN.toFixed(1) + ') - ' + ZW.toFixed(1) + ') > 0.5) return 0.0; float l = d - zi * ' + ZL.toFixed(1) + '; return smoothstep(0.0, ' + EDGE.toFixed(1) + ', l) * smoothstep(0.0, ' + EDGE.toFixed(1) + ', ' + ZL.toFixed(1) + ' - l); }',
    'float bendLoc(float d){ return d - floor(d / ' + ZL.toFixed(1) + ') * ' + ZL.toFixed(1) + '; }',
    'float bendR(float d){ return bendEnv(d) * ' + A.toFixed(2) + ' * sin(' + TAU.toFixed(7) + ' * bendLoc(d) / ' + P.toFixed(4) + '); }',
    'float bendH(float d){ return bendEnv(d) * ' + AH.toFixed(2) + ' * (1.0 - cos(' + (2 * TAU).toFixed(7) + ' * bendLoc(d) / ' + ZL.toFixed(1) + ')); }',
    'vec4 bendWorld(vec4 wp){ if (uBk.x > 0.0) { float d = -wp.z; float dd = d - uBk.y; float fade = 1.0 - smoothstep(220.0, 380.0, abs(dd)); wp.x += fade * (bendR(d) - uBk.z - uBk.w * dd); wp.y += fade * (bendH(d) - uBh.x - uBh.y * dd); } return wp; }'
  ].join('\n') + '\n';

  const vec4 = () => ({ x: 0, y: 0, z: 0, w: 0, set(x, y, z, w) { this.x = x; this.y = y; this.z = z; this.w = w; return this; } });   // plain vec4: any copy of three.js can upload it
  const BK = { value: vec4() }, BH = { value: vec4() };
  let installed = 0;
  const install = (THREE) => {
    if (THREE.__bendInstalled) return; THREE.__bendInstalled = true; installed++;
    const C = THREE.ShaderChunk;
    C.project_vertex = C.project_vertex.replace('mvPosition = modelViewMatrix * mvPosition;', 'mvPosition = viewMatrix * bendWorld(modelMatrix * mvPosition);');
    C.worldpos_vertex = C.worldpos_vertex.replace('worldPosition = modelMatrix * worldPosition;', 'worldPosition = bendWorld(modelMatrix * worldPosition);');   // shadows are looked up at the bent position too
    THREE.Material.prototype.onBeforeCompile = function (shader) { shader.uniforms.uBk = BK; shader.uniforms.uBh = BH; shader.vertexShader = HEADER + shader.vertexShader; };
  };
  /* dist = the walker's distance down the road in metres, or a negative number to switch the bend off (title, Classic world, the walkable town) */
  const update = (dist) => {
    if (dist < 0) { BK.value.set(0, 0, 0, 0); return; }
    BK.value.set(1, dist, R(dist), (R(dist + 1) - R(dist - 1)) / 2); BH.value.set(H(dist), (H(dist + 1) - H(dist - 1)) / 2, 0, 0);
  };

  window.RoboBend = { R, H, hairpin, apex, apexIndex, gantryAt, install, update, shared: true, probe: () => ({ installed, bk: [BK.value.x, BK.value.y, BK.value.z, BK.value.w], bh: [BH.value.x, BH.value.y] }), constants: { ZL, N, A, AH, P, EDGE, ZN, ZW } };
})();
