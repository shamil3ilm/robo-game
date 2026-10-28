/* Robo Run: fewer draw calls. Exposes window.RoboMerge = { concat, matKey, groups }.
   A phone draws one call per mesh, and a shopfront is about forty meshes. groups() takes the groups that never move (marked userData.static), bakes every mesh in them into world space,
   and joins the meshes that look the same (same colour, texture and flags) and stand in the same 64 m cell into one mesh. Meshes that must stay separate (the awnings that fade) are left where they are.
   concat() is pure (typed arrays in, typed arrays out) and is tested in Node (tests/merge.test.js); groups() needs three.js and is checked in the browser by the draw-call count. */
(function () {
  'use strict';
  if (window.RoboMerge) return;   // the page loads its scripts twice

  /* join pieces { position, normal, uv, index? } (Float32Array, Float32Array, Float32Array, array or null) into one; a piece with no index is a plain triangle list */
  const concat = (parts) => {
    let nv = 0, ni = 0;
    for (const p of parts) { const v = p.position.length / 3; nv += v; ni += p.index ? p.index.length : v; }
    const withColor = parts.some((p) => p.color), color = withColor ? new Float32Array(nv * 3).fill(1) : null;
    const position = new Float32Array(nv * 3), normal = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), index = new (nv > 65535 ? Uint32Array : Uint16Array)(ni);
    let vo = 0, io = 0;
    for (const p of parts) {
      const v = p.position.length / 3;
      position.set(p.position, vo * 3);
      if (p.normal) normal.set(p.normal, vo * 3);
      if (p.uv) uv.set(p.uv, vo * 2);
      if (p.color) color.set(p.color, vo * 3);
      if (p.index) for (let i = 0; i < p.index.length; i++) index[io++] = p.index[i] + vo; else for (let i = 0; i < v; i++) index[io++] = vo + i;
      vo += v;
    }
    return { position, normal, uv, index, color, vertices: nv };
  };

  /* a plain-colour standard material (no texture, no glow) is merged by its surface (roughness, metal, flat shading, side, opacity) and its colour is baked into the vertices, so every colour shares one material */
  const plainKey = (m) => (m.type === 'MeshStandardMaterial' && !m.map && !m.normalMap && !m.roughnessMap && !m.vertexColors && !m.alphaTest && (!m.emissive || m.emissive.getHex() === 0) ? ['vc', m.roughness, m.metalness, m.flatShading ? 1 : 0, m.side, m.opacity, m.transparent ? 1 : 0, m.depthWrite ? 1 : 0].join('|') : null);
  const plainMats = new Map();
  const plainMat = (THREE, m, key) => { let p = plainMats.get(key); if (!p) { p = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: m.roughness, metalness: m.metalness, flatShading: !!m.flatShading, side: m.side, opacity: m.opacity, transparent: !!m.transparent, depthWrite: !!m.depthWrite }); plainMats.set(key, p); } return p; };
  /* what makes two materials look the same */
  const matKey = (m) => [m.type, m.color ? m.color.getHex() : '', m.roughness, m.metalness, m.flatShading ? 1 : 0, m.map ? m.map.uuid : '', m.side, m.emissive ? m.emissive.getHex() : '', m.emissiveIntensity, m.opacity, m.transparent ? 1 : 0, m.depthWrite ? 1 : 0, m.alphaTest, m.normalMap ? m.normalMap.uuid : '', m.roughnessMap ? m.roughnessMap.uuid : '', m.vertexColors ? 1 : 0].join('|');

  /* groups: the static groups; keep: a Set of meshes that must stay as they are; cell: the size of one merge cell in metres. Returns { before, after } mesh counts. */
  const groups = (THREE, list, keep, cell) => {
    cell = cell || 64; keep = keep || new Set();
    const buckets = new Map(); let before = 0;
    const v = new THREE.Vector3();
    for (const g of list) {
      g.updateWorldMatrix(true, true);
      const meshes = []; g.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && !o.isSkinnedMesh) meshes.push(o); });
      for (const o of meshes) {
        before++;
        const m = o.material; if (Array.isArray(m) || !m || keep.has(o) || !o.visible || (o.geometry.attributes.color)) continue;
        const geo = o.geometry.clone(); geo.applyMatrix4(o.matrixWorld);
        v.setFromMatrixPosition(o.matrixWorld);
        const pk = plainKey(m), key = (pk || matKey(m)) + '|' + (o.castShadow ? 1 : 0) + (o.receiveShadow ? 1 : 0) + '|' + Math.floor(v.x / cell) + ',' + Math.floor(v.z / cell);
        let b = buckets.get(key); if (!b) { b = { mat: pk ? plainMat(THREE, m, pk) : m, cast: o.castShadow, recv: o.receiveShadow, parts: [] }; buckets.set(key, b); }
        const part = { position: geo.attributes.position.array, normal: geo.attributes.normal ? geo.attributes.normal.array : null, uv: geo.attributes.uv ? geo.attributes.uv.array : null, index: geo.index ? geo.index.array : null };
        if (pk) { const nv = part.position.length / 3, col = new Float32Array(nv * 3); for (let i = 0; i < nv; i++) { col[i * 3] = m.color.r; col[i * 3 + 1] = m.color.g; col[i * 3 + 2] = m.color.b; } part.color = col; }
        b.parts.push(part);
        o.parent.remove(o); o.geometry.dispose();
      }
    }
    const out = [];
    for (const b of buckets.values()) {
      const c = concat(b.parts), geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(c.position, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(c.normal, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(c.uv, 2)); geo.setIndex(new THREE.BufferAttribute(c.index, 1));
      if (c.color) geo.setAttribute('color', new THREE.BufferAttribute(c.color, 3));
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, b.mat); mesh.castShadow = b.cast; mesh.receiveShadow = b.recv; mesh.matrixAutoUpdate = false; out.push(mesh);
    }
    return { meshes: out, before, after: out.length };
  };

  /* join a list of { geo (already in the target space), mat, cast, recv } into one mesh per look */
  const joinLooks = (THREE, items) => {
    const buckets = new Map();
    for (const it of items) {
      const pk = plainKey(it.mat), key = (pk || matKey(it.mat)) + '|' + (it.cast ? 1 : 0) + (it.recv ? 1 : 0); let b = buckets.get(key); if (!b) { b = { mat: pk ? plainMat(THREE, it.mat, pk) : it.mat, cast: it.cast, recv: it.recv, parts: [] }; buckets.set(key, b); }
      const g = it.geo, part = { position: g.attributes.position.array, normal: g.attributes.normal ? g.attributes.normal.array : null, uv: g.attributes.uv ? g.attributes.uv.array : null, index: g.index ? g.index.array : null };
      if (pk) { const nv = part.position.length / 3, col = new Float32Array(nv * 3); for (let i = 0; i < nv; i++) { col[i * 3] = it.mat.color.r; col[i * 3 + 1] = it.mat.color.g; col[i * 3 + 2] = it.mat.color.b; } part.color = col; }
      b.parts.push(part);
    }
    const out = [];
    for (const b of buckets.values()) {
      const c = concat(b.parts), geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(c.position, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(c.normal, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(c.uv, 2)); geo.setIndex(new THREE.BufferAttribute(c.index, 1)); if (c.color) geo.setAttribute('color', new THREE.BufferAttribute(c.color, 3)); geo.computeBoundingSphere();
      const m = new THREE.Mesh(geo, b.mat); m.castShadow = b.cast; m.receiveShadow = b.recv; out.push(m);
    }
    return out;
  };
  const mergeable = (o, keep) => o.isMesh && !o.isInstancedMesh && !o.isSkinnedMesh && !Array.isArray(o.material) && o.material && !keep.has(o) && o.visible && !o.geometry.attributes.color && !o.children.length;

  /* merge in place: inside every group, the direct meshes that look the same become one mesh in that group's own space. Every group keeps its own movement (a wobble, a turn), so bumpable props still wobble. */
  const inPlace = (THREE, root, keep) => {
    keep = keep || new Set(); let before = 0, after = 0;
    const walk = (grp) => {
      const kids = grp.children.slice(), items = [], gone = [];
      for (const o of kids) { if (o.isMesh) { before++; if (mergeable(o, keep)) { o.updateMatrix(); const geo = o.geometry.clone(); geo.applyMatrix4(o.matrix); items.push({ geo, mat: o.material, cast: o.castShadow, recv: o.receiveShadow }); gone.push(o); } else after++; } }
      for (const o of gone) { grp.remove(o); o.geometry.dispose(); }
      for (const m of joinLooks(THREE, items)) { grp.add(m); after++; }
      for (const o of kids) if (!o.isMesh && o.children && o.children.length) walk(o);
    };
    walk(root); return { before, after };
  };

  /* a merged copy of a group (for a far-away version of a person): returns a new Group of joined meshes in the root's own space; the original is not touched */
  const bakeCopy = (THREE, root) => {
    root.updateWorldMatrix(true, true); const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), items = [];
    root.traverse((o) => { if (!mergeable(o, new Set())) return; const geo = o.geometry.clone(); geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)); items.push({ geo, mat: o.material, cast: false, recv: false }); });
    const g = new THREE.Group(); for (const m of joinLooks(THREE, items)) g.add(m); return g;
  };

  window.RoboMerge = { concat, matKey, plainKey, groups, inPlace, bakeCopy };
})();
