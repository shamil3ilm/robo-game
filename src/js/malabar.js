/* Robo Run — Malabar world: the Kerala coast. Stage 1 = Kozhikode Beach at golden hour.
   Loaded before engine.js. Exposes window.MalabarWorld = { zones, kinds, init(ctx) }.
   zones: same shape as the engine's CLASSIC_ZONES, plus name / enter (spoken line) / sunPos (light offset from the player).
   init(ctx) builds this world's scenery on the engine's scene and returns the hooks the engine calls:
   slotItems(group, i), decorate(slot, side, placeItem, lowQ), theme(obstacle, kind), frame(dt, time, px, pz, fx). */
(function () {
  'use strict';

  const zones = [
    { kind: 'beach', name: 'Kozhikode Beach', enter: 'Entering Kozhikode beach. Sunset ahead.', music: 'kozhikode-beach', food: ['coconut', 'banana', 'jaggery', 'rice', 'ghee', 'spice', 'tea'], herbs: ['aloe', 'tulsi'], shops: ['snacks', 'pharmacy', 'tools', 'clothes'], rides: ['scooter', 'buffalo'],
      fog: 0xf0b48c, density: 0.012, sun: 2.2, sunColor: 0xffa862, sunPos: [-12, 6, -4], sky: 0xffcfa0, ground: 0x7a6650, hemi: 0.8, head: 0, env: 0.9,
      track: 0xe8d6b2, floor: 0xd9c291, floorEm: 0x000000, dust: 0xffd9a0, dustOp: 0.35 },
    /* grade: [slope waves per zone, speed change]: uphill slows the robot, downhill speeds it up (engine reads it) */
    { kind: 'wayanad', name: 'Wayanad Ghat Road', enter: 'Entering the Wayanad ghat road. Mist ahead.', music: 'wayanad-ghat', food: ['coffee', 'pepper', 'cardamom', 'tea', 'rice', 'banana', 'jaggery'], grade: [2, 0.12], road: true, webs: true, shops: ['snacks', 'pharmacy', 'tools', 'clothes'], herbs: ['turmeric', 'tulsi'], rides: ['scooter', 'buffalo'],
      fog: 0xc9d6c4, density: 0.02, sun: 1.5, sunColor: 0xfff0cf, sunPos: [6, 14, -4], sky: 0xdfe9d8, ground: 0x4a5a3a, hemi: 0.9, head: 0, env: 1,
      track: 0xb9b9b3, floor: 0x8fae78, floorEm: 0x000000, dust: 0xffffff, dustOp: 0.6 }
  ];

  function init(c) {
    const { THREE, scene, M, std, mkTex, rng, lerp, clamp, PI, TRACK_L } = c;
    const { BUSH, FERN, ROCKS } = c.geo;
    const DS = THREE.DoubleSide;

    /* ---------- geometry helpers ---------- */
    const col = (g, hex) => { const n = g.attributes.position.count, k = new THREE.Color(hex), a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = k.r; a[i * 3 + 1] = k.g; a[i * 3 + 2] = k.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
    const merge = (parts) => {
      const ps = parts.map((g) => (g.index ? g.toNonIndexed() : g)), out = new THREE.BufferGeometry();
      for (const [k, n] of [['position', 3], ['normal', 3], ['uv', 2], ['color', 3]]) {
        if (!ps.every((g) => g.attributes[k])) continue;
        let len = 0; ps.forEach((g) => (len += g.attributes[k].array.length));
        const arr = new Float32Array(len); let o = 0; ps.forEach((g) => { arr.set(g.attributes[k].array, o); o += g.attributes[k].array.length; });
        out.setAttribute(k, new THREE.BufferAttribute(arr, n));
      }
      return out;
    };
    const mesh = (geo, mat, parent) => { const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; parent.add(m); return m; };
    const hide = (o) => { o.visible = false; return o; };
    const canvasTex = (w, h, draw) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h); const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t; };
    const rep = (t, u, v) => { const k = t.clone(); k.needsUpdate = true; k.repeat.set(u, v); return k; };
    const wrap = (s, fn) => { for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) fn(ox, oy); };   // draw 9 copies so a blob cut by the edge continues on the other side

    /* ---------- textures ---------- */
    const sandTex = mkTex(512, (x, s) => {
      x.fillStyle = '#d8c293'; x.fillRect(0, 0, s, s);
      for (let i = 0; i < 9000; i++) { x.fillStyle = `hsla(${rng(32, 42)},${rng(30, 45)}%,${rng(55, 85)}%,${rng(0.15, 0.4)})`; x.fillRect(Math.random() * s, Math.random() * s, rng(1, 3), rng(1, 3)); }
      x.strokeStyle = 'rgba(120,92,56,.12)'; x.lineWidth = 2;
      for (let r = 0; r < 14; r++) { x.beginPath(); const y0 = r * s / 14 + rng(-5, 5); x.moveTo(0, y0); for (let px = 32; px < s; px += 32) x.lineTo(px, y0 + Math.sin(px * PI * 8 / s + r) * 5 + rng(-2, 2)); x.lineTo(s, y0); x.stroke(); }
      for (let i = 0; i < 14; i++) { x.fillStyle = 'rgba(255,248,235,.55)'; x.beginPath(); x.ellipse(Math.random() * s, Math.random() * s, rng(2, 5), rng(1, 2.5), Math.random() * PI, 0, PI * 2); x.fill(); }
    });
    const seaBump = mkTex(256, (x, s) => {
      x.fillStyle = '#808080'; x.fillRect(0, 0, s, s);
      for (let i = 0; i < 220; i++) {
        const cx = Math.random() * s, cy = Math.random() * s, r = rng(14, 40), dark = Math.random() < 0.5, sx = rng(1.8, 3.2);
        wrap(s, (ox, oy) => { x.save(); x.translate(cx + ox, cy + oy); x.scale(sx, 1); const g = x.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, dark ? 'rgba(0,0,0,.32)' : 'rgba(255,255,255,.32)'); g.addColorStop(1, 'rgba(128,128,128,0)'); x.fillStyle = g; x.beginPath(); x.arc(0, 0, r, 0, PI * 2); x.fill(); x.restore(); });
      }
    });
    const foamTex = mkTex(256, (x, s) => {
      const g = x.createLinearGradient(0, 0, s, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.55, 'rgba(255,255,255,.18)'); g.addColorStop(0.86, 'rgba(255,255,255,.75)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, s, s);
      for (let i = 0; i < 260; i++) { const px = rng(0.4, 0.97) * s, py = Math.random() * s, r = rng(2, 7); wrap(s, (ox, oy) => { x.strokeStyle = `rgba(255,255,255,${rng(0.15, 0.5)})`; x.lineWidth = rng(1, 2); x.beginPath(); x.arc(px + ox, py + oy, r, 0, PI * 2); x.stroke(); }); }
    });
    const barkTex = mkTex(64, (x, s) => {
      x.fillStyle = '#8a7358'; x.fillRect(0, 0, s, s);
      for (let i = 0; i < s; i += 8) { x.fillStyle = 'rgba(40,28,16,.6)'; x.fillRect(0, i, s, 2); x.fillStyle = 'rgba(255,240,210,.12)'; x.fillRect(0, i + 3, s, 1); }
      for (let i = 0; i < 160; i++) { x.fillStyle = Math.random() < 0.5 ? 'rgba(30,20,10,.18)' : 'rgba(230,210,170,.14)'; x.fillRect(Math.random() * s, Math.random() * s, 1, rng(2, 7)); }
    });
    const plankTex = (paint) => mkTex(512, (x, s) => {   // horizontal planks; `paint` = [h, s, l] of a boat-paint coat that has chipped in places
      const rows = 8, h = s / rows;
      for (let r = 0; r < rows; r++) {
        x.fillStyle = paint ? `hsl(${paint[0]},${paint[1]}%,${paint[2] + rng(-6, 6)}%)` : `hsl(${rng(24, 34)},${rng(35, 50)}%,${rng(42, 58)}%)`; x.fillRect(0, r * h, s, h);
        for (let i = 0; i < 26; i++) { x.strokeStyle = `rgba(60,36,16,${rng(0.06, 0.2)})`; x.lineWidth = rng(1, 2); const y = r * h + rng(3, h - 3); x.beginPath(); x.moveTo(0, y); x.bezierCurveTo(s * 0.3, y + rng(-3, 3), s * 0.6, y + rng(-3, 3), s, y); x.stroke(); }
        x.fillStyle = 'rgba(20,12,6,.7)'; x.fillRect(0, r * h, s, 3);
      }
      if (paint) for (let i = 0; i < 40; i++) { x.fillStyle = `hsla(${rng(24, 34)},${rng(35, 50)}%,${rng(36, 50)}%,${rng(0.5, 0.9)})`; x.beginPath(); x.ellipse(Math.random() * s, Math.random() * s, rng(3, 14), rng(2, 5), rng(-0.3, 0.3), 0, PI * 2); x.fill(); }
    });
    const woodTex = plankTex(null), blueTex = plankTex([205, 48, 46]);
    const paveTex = mkTex(512, (x, s) => {
      x.fillStyle = '#8a7a66'; x.fillRect(0, 0, s, s);
      const cols = 6, rows = 12, w = s / cols, h = s / rows;
      for (let r = 0; r < rows; r++) for (let q = -1; q < cols; q++) {
        const ox = (r % 2) * w / 2; x.fillStyle = `hsl(${rng(16, 30)},${rng(18, 32)}%,${rng(50, 66)}%)`; x.fillRect(q * w + ox + 2, r * h + 2, w - 4, h - 4);
      }
      for (let i = 0; i < 5000; i++) { x.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,.07)' : 'rgba(255,245,225,.07)'; x.fillRect(Math.random() * s, Math.random() * s, rng(1, 3), rng(1, 3)); }
    });
    const stripeTex = mkTex(64, (x, s) => { for (let i = 0; i < 4; i++) { x.fillStyle = i % 2 ? '#f3e6cf' : '#c8372d'; x.fillRect(i * s / 4, 0, s / 4, s); } });
    const frondTex = canvasTex(1024, 256, (x, w, h) => {
      const mid = h / 2;
      for (let i = 0; i < 70; i++) {
        const f = 0.03 + (i / 70) * 0.95, bx = f * w, len = 104 * Math.min(1, 0.3 + f * 2.4) * (1 - f * f * 0.8) * rng(0.9, 1.08);
        for (const sg of [-1, 1]) {
          const tipx = bx + len * 0.7 + rng(-6, 6), tipy = mid + sg * len * rng(0.92, 1.02), w0 = rng(7, 10);
          const g = x.createLinearGradient(bx, mid, tipx, tipy); g.addColorStop(0, `hsl(${rng(92, 104)},55%,${rng(19, 25)}%)`); g.addColorStop(1, `hsl(${rng(86, 98)},58%,${rng(34, 44)}%)`);
          x.fillStyle = g; x.beginPath(); x.moveTo(bx - w0 * 0.5, mid);
          x.quadraticCurveTo(bx + len * 0.3, mid + sg * len * 0.55, tipx, tipy); x.quadraticCurveTo(bx + len * 0.3 + w0, mid + sg * len * 0.5, bx + w0 * 0.5, mid); x.closePath(); x.fill();
        }
      }
      x.strokeStyle = '#5b6a2a'; x.lineWidth = 5; x.beginPath(); x.moveTo(0, mid); x.lineTo(w - 12, mid); x.stroke();
    });
    const sunTex = canvasTex(256, 256, (x, s) => {
      const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      [[0, 'rgba(255,246,220,1)'], [0.07, 'rgba(255,232,170,1)'], [0.17, 'rgba(255,196,118,.85)'], [0.4, 'rgba(255,150,84,.34)'], [1, 'rgba(255,120,60,0)']].forEach(([t, k]) => g.addColorStop(t, k));
      x.fillStyle = g; x.fillRect(0, 0, s, s);
    });
    const cloudTex = canvasTex(512, 256, (x, w, h) => {
      for (let i = 0; i < 46; i++) {
        const cx = rng(60, w - 60), cy = h / 2 + rng(-22, 22), r = rng(26, 62), g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.beginPath(); x.ellipse(cx, cy, r * 1.5, r * 0.62, 0, 0, PI * 2); x.fill();
      }
      x.globalCompositeOperation = 'source-atop';
      const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,224,206,1)'); g.addColorStop(0.55, 'rgba(255,170,120,1)'); g.addColorStop(1, 'rgba(238,110,84,1)');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
    });

    /* ---------- materials ---------- */
    Object.assign(M, {
      palmBark: std({ map: rep(barkTex, 2, 10), color: 0xc9b08a, roughness: 1 }),
      palmLog: std({ map: rep(barkTex, 2, 2), color: 0xc9b08a, roughness: 1 }),
      palmLeaf: std({ map: frondTex, side: DS, alphaTest: 0.4, roughness: 0.7, vertexColors: true }),
      coconut: std({ color: 0x5e4426, roughness: 0.85 }),
      wood: std({ map: woodTex, color: 0xcaa078, roughness: 0.9 }),
      crateBlue: std({ map: blueTex, roughness: 0.85 }),
      laterite: std({ color: 0x5a2f20, roughness: 1, flatShading: true }),
      concrete: std({ color: 0xb9b1a2, roughness: 0.95 }),
      vcol: std({ vertexColors: true, roughness: 0.8 }),
      awning: std({ map: stripeTex, side: DS, roughness: 0.9 }),
      bulb: new THREE.MeshBasicMaterial({ color: 0xffe2a0 }),
      white: std({ color: 0xf1ece0, roughness: 0.7 }),
      beachGrass: std({ color: 0x8a9a4a, roughness: 0.85, flatShading: true, side: DS }),
      beachBush: std({ color: 0x5f7a3a, roughness: 0.85, flatShading: true })
    });
    const HULLS = [0x2f6fa0, 0xc8372d, 0x2f8a78, 0xe0a42e].map((h) => std({ color: h, roughness: 0.7, side: DS }));

    /* ---------- ground: sand, wet sand, sea, foam ---------- */
    const SHORE = -27, T = 10;
    const plane = (w, mat, x, y) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, TRACK_L, 1, 80).rotateX(-PI / 2), mat); m.position.set(x, y, 0); m.receiveShadow = true; m.visible = false; scene.add(m); return m; };
    const sandMat = (w) => std({ map: rep(sandTex, w / T, TRACK_L / T), color: 0xc9a97a, roughness: 1, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const sandR = plane(85.4, sandMat(85.4), 47.3, -0.02), sandL = plane(-4.6 - SHORE, sandMat(-4.6 - SHORE), (SHORE - 4.6) / 2, -0.02);
    const wet = plane(3.4, std({ color: 0x6b573c, roughness: 0.4, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }), SHORE + 1.7, -0.01);
    const seaMap = rep(seaBump, 200 / 14, TRACK_L / 14);
    const sea = plane(200, std({ color: 0x1f7a80, roughness: 0.16, metalness: 0.15, bumpMap: seaMap, bumpScale: 1.4, envMapIntensity: 0.9, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), SHORE - 100, 0.02);
    {   // vertices bunched toward the shore; colour and texture coordinates follow distance from the shore, so the water deepens in colour as it goes out
      const g = new THREE.PlaneGeometry(200, TRACK_L, 64, 80).rotateX(-PI / 2), P = g.attributes.position, U = g.attributes.uv, cs = new Float32Array(P.count * 3), c0 = new THREE.Color(0x45bfb3), c1 = new THREE.Color(0x1d8596), c2 = new THREE.Color(0x0f4562), k = new THREE.Color();
      for (let i = 0; i < P.count; i++) {
        const t = (P.getX(i) + 100) / 200, d = 200 * Math.pow(1 - t, 2.2);   // d = metres from the shoreline
        P.setX(i, 100 - d); U.setX(i, d / 200);
        k.copy(c0).lerp(c1, clamp(d / 14, 0, 1)).lerp(c2, clamp((d - 14) / 90, 0, 1)); cs.set([k.r, k.g, k.b], i * 3);
      }
      g.setAttribute('color', new THREE.BufferAttribute(cs, 3)); sea.geometry.dispose(); sea.geometry = g; sea.material.vertexColors = true; sea.material.color.setHex(0xffffff); sea.material.needsUpdate = true;
    }
    const foamMap = rep(foamTex, 1, TRACK_L / 6);
    const foam = plane(3.6, new THREE.MeshBasicMaterial({ map: foamMap, color: 0xfff1dc, transparent: true, opacity: 0, depthWrite: false }), SHORE + 0.5, 0.03);
    const paveMap = rep(paveTex, 2, TRACK_L / 4.6), pave = plane(9.2, std({ map: paveMap, roughness: 0.92, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), 0, 0.003);
    pave.renderOrder = -1;
    const ground = [sandR, sandL, wet, sea, foam, pave], tiles = ground.slice(0, 2).map((m) => m.material.map);

    /* sun glitter: a path of twinkling light on the water toward the sun (additive, long axis along the sun's direction) */
    const glitterTex = mkTex(256, (x, s) => {
      for (let i = 0; i < 900; i++) {
        const gx = s / 2 + (Math.random() + Math.random() + Math.random() - 1.5) * s * 0.38, gy = Math.random() * s, r = rng(0.6, 2.2), g = x.createRadialGradient(gx, gy, 0, gx, gy, r * 2);
        g.addColorStop(0, 'rgba(255,240,200,' + rng(0.5, 1) + ')'); g.addColorStop(1, 'rgba(255,200,120,0)'); x.fillStyle = g; x.beginPath(); x.arc(gx, gy, r * 2, 0, PI * 2); x.fill();
      }
    });
    const glitterMap = rep(glitterTex, 1, 3);
    const glitter = new THREE.Mesh(new THREE.PlaneGeometry(16, 150).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ map: glitterMap, color: 0xffe0a8, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    glitter.visible = false; glitter.renderOrder = 1; scene.add(glitter);

    /* ---------- sky: gradient dome, sun, golden clouds (follows the player, never fogged) ---------- */
    const sky = new THREE.Group(); sky.visible = false; scene.add(sky);
    const sunDir = new THREE.Vector3(-0.48, 0.12, -0.87).normalize();
    const dome = (() => {
      const g = new THREE.SphereGeometry(200, 48, 24), p = g.attributes.position, cols = new Float32Array(p.count * 3), v = new THREE.Vector3(), k = new THREE.Color(), glow = new THREE.Color(0xffc27a);
      const stops = [[0, 0xf0b48c], [0.06, 0xf5a46e], [0.2, 0xe58f86], [0.42, 0xb87ea6], [0.7, 0x6f78b8], [1, 0x3b4a8c]].map(([t, h]) => [t, new THREE.Color(h)]);
      for (let i = 0; i < p.count; i++) {
        v.set(p.getX(i), p.getY(i), p.getZ(i)).divideScalar(200); const t = clamp(v.y, 0, 1);
        let j = 0; while (j < stops.length - 2 && t > stops[j + 1][0]) j++;
        k.copy(stops[j][1]).lerp(stops[j + 1][1], clamp((t - stops[j][0]) / (stops[j + 1][0] - stops[j][0]), 0, 1));
        k.lerp(glow, Math.pow(Math.max(0, v.dot(sunDir)), 6) * 0.8 * (1 - t));
        cols.set([k.r, k.g, k.b], i * 3);
      }
      g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false, transparent: true }));
      m.renderOrder = -3; sky.add(m); return m;
    })();
    const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true }));
    sunSprite.scale.setScalar(78); sunSprite.position.copy(sunDir).multiplyScalar(185); sunSprite.renderOrder = -1; sky.add(sunSprite);
    const clouds = new THREE.Group(); sky.add(clouds);
    for (let i = 0; i < 10; i++) {
      const a = rng(-1.9, 1.9), e = rng(0.06, 0.38), m = new THREE.Mesh(new THREE.PlaneGeometry(rng(90, 150), rng(26, 46)), new THREE.MeshBasicMaterial({ map: cloudTex, transparent: true, opacity: 0.85, depthWrite: false, fog: false, side: DS }));
      m.position.set(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)).multiplyScalar(170); m.lookAt(0, 0, 0); m.renderOrder = -2; m.userData.o = 0.85; clouds.add(m);
    }
    /* the sea reflects THIS sunset (the engine's default environment is the green jungle): the sky gradient plus a hot sun, prefiltered once */
    let beachEnv = null;
    try {
      const envScene = new THREE.Scene(), eg = dome.geometry.clone().scale(0.25, 0.25, 0.25);
      envScene.add(new THREE.Mesh(eg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
      const sunHot = new THREE.Mesh(new THREE.SphereGeometry(5, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(9, 6.5, 4) })); sunHot.position.copy(sunDir).multiplyScalar(44); envScene.add(sunHot);
      const pm = new THREE.PMREMGenerator(c.renderer); beachEnv = pm.fromScene(envScene, 0.03).texture; sea.material.envMap = beachEnv; pm.dispose();
      sea.material.userData.env = 1.0; sea.material.envMapIntensity = 1.0;
    } catch (e) { console.warn('[robo] sunset reflection unavailable', e); }
    const skyMats = [dome.material, ...clouds.children.map((m) => m.material), sunSprite.material];

    /* ---------- palms: arched fronds on a leaning, ringed trunk ---------- */
    /* a frond: arches up then droops, folds into a shallow V along its rib, twists a little; `tint` is a vertex colour (white = as drawn, brown = dry) */
    const frondGeo = (L, W, droop, pitch, yaw, tint, twist) => {
      const g = new THREE.PlaneGeometry(L, W, 14, 2).rotateX(-PI / 2), p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const t = (p.getX(i) + L / 2) / L, z = p.getZ(i), fold = Math.abs(z) * 0.32 * Math.min(1, t * 2.2);
        p.setXYZ(i, t * L, droop * (0.45 * t - t * t) - fold + z * (twist || 0) * t, z * Math.max(0.28, Math.pow(Math.sin(PI * Math.min(1, t * 0.92 + 0.04)), 0.55)));
      }
      g.computeVertexNormals(); g.rotateZ(pitch); g.rotateY(yaw); return col(g, tint === undefined ? 0xffffff : tint);
    };
    const palmVariant = () => {
      const h = rng(8, 13), b1 = rng(-1.6, 1.6) * (h / 10), b2 = rng(-0.5, 0.5), r0 = rng(0.26, 0.34), trunk = new THREE.CylinderGeometry(0.14, r0, h, 10, 16), tp = trunk.attributes.position;
      for (let i = 0; i < tp.count; i++) {
        const t = (tp.getY(i) + h / 2) / h, flare = 1 + 0.55 * Math.exp(-t * 16);   // swollen base
        tp.setXYZ(i, tp.getX(i) * flare + b1 * t * t + b2 * Math.sin(t * PI), tp.getY(i), tp.getZ(i) * flare);
      }
      trunk.translate(0, h / 2, 0); trunk.computeVertexNormals();
      const bx = b1 + 0, fr = [], off = Math.random() * PI, n = 15, n2 = 6, nd = 3;
      for (let k = 0; k < n; k++) fr.push(frondGeo(rng(4.4, 5.8), 1.9, rng(3.2, 4.4), rng(0.03, 0.5), off + (k / n) * PI * 2 + rng(-0.18, 0.18), 0xffffff, rng(-0.25, 0.25)));
      for (let k = 0; k < n2; k++) fr.push(frondGeo(rng(2.8, 3.8), 1.5, rng(1.3, 2), rng(0.9, 1.3), off + 0.4 + (k / n2) * PI * 2 + rng(-0.3, 0.3), 0xffffff, 0));
      for (let k = 0; k < nd; k++) fr.push(frondGeo(rng(3.6, 4.6), 1.5, rng(5.5, 7), rng(-0.55, -0.2), off + rng(0, PI * 2), 0xb4986a, rng(-0.2, 0.2)));   // old dry fronds hanging low
      const nuts = [];
      for (let k = 0; k < 7; k++) { const a = rng(0, PI * 2), r = rng(0.12, 0.17); nuts.push(new THREE.SphereGeometry(r, 8, 6).scale(1, 1.15, 1).translate(Math.cos(a) * 0.24, -0.42 + rng(-0.12, 0.12), Math.sin(a) * 0.24)); }
      return { trunk, crown: merge(fr), nuts: merge(nuts), top: [bx, h] };
    };
    const PALMS = Array.from({ length: 6 }, palmVariant), palms = [];
    const palmObj = (parent) => {
      const g = hide(new THREE.Group()), trunk = mesh(PALMS[0].trunk, M.palmBark, g), crown = mesh(PALMS[0].crown, M.palmLeaf, g), nuts = mesh(PALMS[0].nuts, M.coconut, crown);
      g.userData = { phase: Math.random() * 6.28, crown, set(i) { const v = PALMS[i]; trunk.geometry = v.trunk; crown.geometry = v.crown; nuts.geometry = v.nuts; crown.position.set(v.top[0], v.top[1], 0); } };
      g.userData.set(0); parent.add(g); palms.push(g); return g;
    };

    /* ---------- Thamarassery Churam signage: numbered hairpin boards (yellow, as warning signs are) and green gantries at the foot (Adivaram) and the top (Lakkidi) of the climb ---------- */
    const ML = '"Nirmala UI","Noto Sans Malayalam","Kartika",sans-serif', mid = (x, t, y, f, col, w) => { x.textAlign = 'center'; x.fillStyle = col; x.font = f; x.fillText(t, w / 2, y); };
    const HSIGN_TEX = Array.from({ length: 9 }, (_, i) => canvasTex(256, 192, (x, w, h) => { x.fillStyle = '#f2c230'; x.fillRect(0, 0, w, h); x.strokeStyle = '#111'; x.lineWidth = 8; x.strokeRect(6, 6, w - 12, h - 12); mid(x, 'HAIRPIN', 52, 'bold 40px sans-serif', '#111', w); mid(x, 'BEND', 92, 'bold 40px sans-serif', '#111', w); mid(x, String(i + 1) + ' / 9', 148, 'bold 58px sans-serif', '#111', w); mid(x, 'ചുരം · വളവ്', 180, 'bold 22px ' + ML, '#111', w); }));
    const GANTRY_TEX = { adivaram: canvasTex(1024, 220, (x, w, h) => { x.fillStyle = '#0f5a3a'; x.fillRect(0, 0, w, h); x.strokeStyle = '#fff'; x.lineWidth = 8; x.strokeRect(8, 8, w - 16, h - 16); mid(x, 'THAMARASSERY CHURAM', 80, 'bold 70px sans-serif', '#fff', w); mid(x, 'താമരശ്ശേരി ചുരം · അടിവാരം', 140, 'bold 48px ' + ML, '#ffe9b0', w); mid(x, 'NH 766 · 9 hairpin bends to Lakkidi · WAYANAD', 196, 'bold 34px sans-serif', '#fff', w); }),
      lakkidi: canvasTex(1024, 220, (x, w, h) => { x.fillStyle = '#0f5a3a'; x.fillRect(0, 0, w, h); x.strokeStyle = '#fff'; x.lineWidth = 8; x.strokeRect(8, 8, w - 16, h - 16); mid(x, 'LAKKIDI VIEW POINT', 80, 'bold 70px sans-serif', '#fff', w); mid(x, 'ലക്കിടി · വയനാട്', 140, 'bold 48px ' + ML, '#ffe9b0', w); mid(x, 'Welcome to Wayanad', 196, 'bold 34px sans-serif', '#fff', w); }) };
    const hsignObj = (parent) => {
      const g = hide(new THREE.Group()), pole = mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.7, 8), mat(0x2b2b2b), g); pole.position.y = 1.35;
      const face = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.12), new THREE.MeshStandardMaterial({ map: HSIGN_TEX[0], roughness: 0.8, side: DS })); face.position.set(0, 2.55, 0.08); g.add(face); g.userData.face = face; parent.add(g); return g;
    };
    const gantryObj = (parent) => {
      const g = hide(new THREE.Group()), conc = mat(0x9a968c, { roughness: 0.95 });
      [-1, 1].forEach((s) => { const p = mesh(new THREE.BoxGeometry(0.3, 6.6, 0.3), conc, g); p.position.set(s * 6.6, 3.3, 0); });
      const beam = mesh(new THREE.BoxGeometry(13.5, 0.35, 0.35), conc, g); beam.position.y = 6.5;
      const face = new THREE.Mesh(new THREE.PlaneGeometry(9.5, 2.06), new THREE.MeshStandardMaterial({ map: GANTRY_TEX.adivaram, roughness: 0.8, side: DS })); face.position.set(0, 5.35, 0.2); g.add(face); g.userData.face = face; parent.add(g); return g;
    };

    /* ---------- boats, stalls, pier ---------- */
    const boatGeo = (() => {
      const NU = 30, NV = 10, L = 2.7, W = 0.85, D = 0.62, pos = [], uv = [], idx = [], rail = [[], []];
      const prof = (u) => { const t = 1 - u * u; return { w: W * (0.1 + 0.9 * Math.pow(t, 0.62)), d: D * (0.3 + 0.7 * Math.pow(t, 0.85)), rim: 0.7 + 0.62 * Math.pow(Math.abs(u), 3.4) }; };   // half-width, depth, gunwale height: ends rise into a prow and stern
      for (let i = 0; i <= NU; i++) {
        const u = (i / NU) * 2 - 1, f = prof(u);
        for (let j = 0; j <= NV; j++) { const a = ((j / NV) * 2 - 1) * (PI / 2); pos.push(u * L, f.rim - Math.cos(a) * f.d, Math.sin(a) * f.w); uv.push(i / NU * 3, j / NV); }
        rail[0].push(new THREE.Vector3(u * L, f.rim, f.w)); rail[1].push(new THREE.Vector3(u * L, f.rim, -f.w));
      }
      for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) { const a = i * (NV + 1) + j, b = a + NV + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
      const hull = new THREE.BufferGeometry(); hull.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); hull.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); hull.setIndex(idx); hull.computeVertexNormals();
      const loop = rail[0].concat(rail[1].slice().reverse());
      const railG = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(loop, true), 90, 0.045, 5, true);
      const thwarts = [-1.1, -0.2, 0.7].map((x) => col(new THREE.BoxGeometry(0.16, 0.06, 1.3 * prof(x / L).w / W + 0.2).translate(x, 0.78 + 0.0, 0), 0xb8895a));
      const fit = merge([...thwarts, col(new THREE.BoxGeometry(0.35, 0.5, 0.3).translate(-2.0, 1.0, 0), 0x2a2a2e)]);   // thwarts (seats) and the outboard motor
      return { hull, rim: railG, fit };
    })();
    const boatObj = (parent) => {
      const g = hide(new THREE.Group()), hull = mesh(boatGeo.hull, HULLS[0], g); mesh(boatGeo.rim, M.white, g); mesh(boatGeo.fit, M.vcol, g); g.position.y = 0;
      g.userData.hull = hull; parent.add(g); return g;
    };
    const stallGeo = (() => {
      const halwa = [0xc8372d, 0xf0b030, 0x3a8a3a, 0xd9792a];
      const body = [
        col(new THREE.BoxGeometry(2.5, 0.95, 0.7).translate(0, 0.475, 0.35), 0x2f7f7a), col(new THREE.BoxGeometry(2.6, 0.07, 0.8).translate(0, 0.98, 0.35), 0xb8895a),
        col(new THREE.BoxGeometry(2.5, 2.0, 0.1).translate(0, 1.0, -0.55), 0x2f7f7a),
        ...[-1.2, 1.2].map((x) => col(new THREE.BoxGeometry(0.08, 2.3, 0.08).translate(x, 1.15, 0.7), 0x6a4a2a)),
        ...Array.from({ length: 6 }, (_, i) => col(new THREE.BoxGeometry(0.17, 0.12, 0.17).translate(-0.35 + (i % 3) * 0.22, 1.08 + ((i / 3) | 0) * 0.13, 0.4), halwa[i % 4])),
        col(new THREE.CylinderGeometry(0.16, 0.2, 0.34, 10).translate(-0.85, 1.19, 0.3), 0xb8bcc0),
        ...[0, 1, 2, 3].map((i) => col(new THREE.SphereGeometry(0.13, 8, 6).translate(0.75 + (i % 2) * 0.22, 1.15 + ((i / 2) | 0) * 0.2, 0.3 + (i % 2) * 0.1), i % 2 ? 0x6b4a2a : 0x6a8a3a))
      ];
      const awn = new THREE.BoxGeometry(2.9, 0.06, 1.9).rotateX(0.14).translate(0, 2.3, 0.05);
      const bulbs = Array.from({ length: 5 }, (_, i) => new THREE.SphereGeometry(0.07, 6, 5).translate(-1.2 + i * 0.6, 2.1, 0.98));
      return { body: merge(body), awn, bulbs: merge(bulbs) };
    })();
    const stallObj = (parent) => { const g = hide(new THREE.Group()); mesh(stallGeo.body, M.vcol, g); mesh(stallGeo.awn, M.awning, g); mesh(stallGeo.bulbs, M.bulb, g); parent.add(g); return g; };
    const pierGeo = (() => {
      const parts = [];
      for (const z of [-1.5, 1.5]) for (let b = 0; b < 9; b++) {
        const h = b < 3 ? 3.4 : rng(1.8, 3.6);
        parts.push(new THREE.CylinderGeometry(0.3, 0.34, h + 1, 8).translate(-b * 5, (h - 1) / 2, z));
        if (b >= 3 && h > 2.6 && Math.random() < 0.6) parts.push(new THREE.BoxGeometry(0.22, 0.22, 3.4).translate(-b * 5, h - 0.1, 0));
      }
      parts.push(new THREE.BoxGeometry(15, 0.28, 3.8).translate(-7.5, 3.55, 0));
      return merge(parts);
    })();

    /* ---------- ingredient pickups (one small model per id) and the umbrella ---------- */
    const mat = (color, o) => std(Object.assign({ color, roughness: 0.6 }, o));
    const at = (g, x, y, z) => g.translate(x, y, z);
    const FOOD = {
      coconut: () => [[new THREE.SphereGeometry(0.27, 14, 10), mat(0x6b4a2a, { roughness: 0.95 })], [at(new THREE.SphereGeometry(0.1, 8, 6), 0, 0.27, 0), mat(0xc9a56a)]],
      banana: () => [0, 1].map((i) => [at(new THREE.TorusGeometry(0.3, 0.075, 6, 12, PI * 0.8).rotateZ(PI * 0.1 + i * 0.35).rotateY(i * 0.3), 0, -0.1 + i * 0.07, i * 0.1), mat(i ? 0xd9b92f : 0xe8c23a)]),
      jaggery: () => [[merge([at(new THREE.BoxGeometry(0.36, 0.22, 0.3), -0.1, 0.11, 0), at(new THREE.BoxGeometry(0.3, 0.22, 0.28).rotateY(0.5), 0.14, 0.11, 0.05), at(new THREE.BoxGeometry(0.26, 0.2, 0.24).rotateY(-0.3), 0, 0.31, 0)]), mat(0x8a4a1c, { roughness: 0.8 })]],
      rice: () => [[at(new THREE.SphereGeometry(0.3, 12, 8).scale(1, 1.15, 0.8), 0, 0.2, 0), mat(0xe9dfc4)], [at(new THREE.CylinderGeometry(0.06, 0.1, 0.16, 8), 0, 0.5, 0), mat(0xe9dfc4)], [at(new THREE.TorusGeometry(0.075, 0.025, 5, 8).rotateX(PI / 2), 0, 0.46, 0), mat(0x7a5a2a)]],
      ghee: () => [[at(new THREE.CylinderGeometry(0.22, 0.25, 0.4, 14), 0, 0.2, 0), mat(0xe0a82e, { metalness: 0.4, roughness: 0.4 })], [at(new THREE.CylinderGeometry(0.19, 0.19, 0.07, 14), 0, 0.43, 0), mat(0x8a5a1c, { metalness: 0.5, roughness: 0.4 })]],
      spice: () => [[at(new THREE.SphereGeometry(0.27, 12, 6, 0, PI * 2, PI / 2, PI / 2).scale(1, 0.8, 1), 0, 0.22, 0), mat(0x3a2a22, { side: DS })], [at(new THREE.SphereGeometry(0.22, 10, 6, 0, PI * 2, 0, PI / 2).scale(1, 0.7, 1), 0, 0.22, 0), mat(0xc2381f, { roughness: 1 })]],
      coffee: () => [[merge([at(new THREE.SphereGeometry(0.17, 8, 6).scale(1, 0.75, 0.8), -0.14, 0.15, 0), at(new THREE.SphereGeometry(0.17, 8, 6).scale(1, 0.75, 0.8).rotateY(0.6), 0.14, 0.15, 0.04), at(new THREE.SphereGeometry(0.17, 8, 6).scale(1, 0.75, 0.8), 0, 0.15, 0.2)]), mat(0x4a2a18, { roughness: 0.5 })], [at(new THREE.SphereGeometry(0.1, 8, 6), 0, 0.34, -0.1), mat(0xb8281e)]],
      pepper: () => [[merge(Array.from({ length: 9 }, (_, i) => at(new THREE.SphereGeometry(0.075, 6, 5), Math.cos(i * 2.4) * 0.14, 0.12 + i * 0.045, Math.sin(i * 2.4) * 0.14))), mat(0x2a2420, { roughness: 0.6 })], [at(new THREE.CylinderGeometry(0.03, 0.03, 0.55, 5), 0, 0.28, 0), mat(0x4a7a2a)]],
      cardamom: () => [[merge([0, 1, 2].map((i) => at(new THREE.CapsuleGeometry(0.075, 0.24, 3, 8).rotateZ(PI / 2 + (i - 1) * 0.4).rotateY(i * 0.5), 0, 0.12 + i * 0.1, (i - 1) * 0.1))), mat(0x6f9a3a, { roughness: 0.6 })]],
      tea: () => [[at(new THREE.CylinderGeometry(0.2, 0.14, 0.24, 14, 1, true), 0, 0.16, 0), mat(0xf1ece0, { side: DS })], [at(new THREE.CircleGeometry(0.19, 14).rotateX(-PI / 2), 0, 0.25, 0), mat(0x6b3a1a, { roughness: 0.2 })], [at(new THREE.CylinderGeometry(0.28, 0.28, 0.03, 16), 0, 0.02, 0), mat(0xf1ece0)]]
    };
    const HERB = {   // real Kerala health herbs: tulsi (holy basil), turmeric, aloe vera
      tulsi: () => [[merge(Array.from({ length: 7 }, (_, i) => at(new THREE.IcosahedronGeometry(0.16, 1).scale(1, 0.8, 1), Math.cos(i * 2.4) * 0.2, 0.18 + (i % 3) * 0.08, Math.sin(i * 2.4) * 0.2))), mat(0x3f7a30, { flatShading: true })],
        [merge(Array.from({ length: 4 }, (_, i) => at(new THREE.ConeGeometry(0.045, 0.3, 5), Math.cos(i * 1.6) * 0.12, 0.52, Math.sin(i * 1.6) * 0.12))), mat(0x8a4fb0, { roughness: 0.6 })]],
      turmeric: () => [[merge(Array.from({ length: 5 }, (_, i) => at(new THREE.SphereGeometry(1, 8, 6).scale(0.09, 0.5, 0.22).rotateZ(Math.cos(i * 1.3) * 0.5).rotateY(i * 1.26), 0, 0.5, 0))), mat(0x4f9a3a, { roughness: 0.55, side: DS })],
        [merge([0, 1, 2].map((i) => at(new THREE.CapsuleGeometry(0.05, 0.14, 3, 6).rotateZ(PI / 2 + i * 0.5).rotateY(i * 1.1), (i - 1) * 0.1, 0.05, (i % 2) * 0.1))), mat(0xe08a1a, { roughness: 0.7 })]],
      aloe: () => [[merge(Array.from({ length: 9 }, (_, i) => at(new THREE.ConeGeometry(0.1, 0.62, 5).translate(0, 0.31, 0).rotateZ(0.55 + (i % 3) * 0.18).rotateY(i * 0.7), 0, 0.06, 0))), mat(0x6f9a6a, { roughness: 0.6, flatShading: true })]]
    };
    const ringGreen = new THREE.MeshBasicMaterial({ color: 0x8fe08a, transparent: true, opacity: 0.95 });
    const herbModel = (id) => {
      const g = new THREE.Group();
      for (const [geo, m] of (HERB[id] || HERB.tulsi)()) { const o = new THREE.Mesh(geo, m); o.position.y = -0.4; g.add(o); }
      const r = new THREE.Mesh(ring, ringGreen); r.position.y = -0.4; g.add(r); g.scale.setScalar(1.8); return g;
    };
    const ring = new THREE.TorusGeometry(0.55, 0.05, 8, 32).rotateX(PI / 2), ringMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.95 });
    const foodModel = (id) => {
      const g = new THREE.Group();
      for (const [geo, m] of (FOOD[id] || FOOD.coconut)()) { const o = new THREE.Mesh(geo, m); o.position.y = -0.3; g.add(o); }
      const r = new THREE.Mesh(ring, ringMat); r.position.y = -0.3; g.add(r); g.scale.setScalar(1.7);
      return g;
    };
    const umbrella = () => {
      const g = new THREE.Group(), cg = new THREE.SphereGeometry(1.35, 16, 8, 0, PI * 2, 0, PI / 2).scale(1, 0.5, 1), p = cg.attributes.position, cols = new Float32Array(p.count * 3), k = new THREE.Color();
      for (let i = 0; i < p.count; i++) { k.setHex(Math.floor(((Math.atan2(p.getZ(i), p.getX(i)) + PI) / (PI * 2)) * 8) % 2 ? 0x14161a : 0x6a1a16); cols.set([k.r, k.g, k.b], i * 3); }
      cg.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      const canopy = new THREE.Mesh(cg, std({ vertexColors: true, roughness: 0.75, side: DS }));
      canopy.position.y = 3.35; g.add(canopy);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.5, 6), M.wood); pole.position.y = 2.7; g.add(pole);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), M.white); tip.position.y = 3.9; g.add(tip);
      return g;
    };

    /* ---------- Wayanad: misty ghat road ---------- */
    const lateriteTex = mkTex(256, (x, s) => {
      x.fillStyle = '#5e3f32'; x.fillRect(0, 0, s, s);
      const cols = 4, rows = 6, w = s / cols, h = s / rows;
      for (let r = 0; r < rows; r++) for (let q = -1; q < cols; q++) { x.fillStyle = `hsl(${rng(12, 20)},${rng(40, 55)}%,${rng(30, 42)}%)`; x.fillRect(q * w + (r % 2) * w / 2 + 2, r * h + 2, w - 4, h - 4); }
      for (let i = 0; i < 2500; i++) { x.fillStyle = Math.random() < 0.5 ? 'rgba(20,8,4,.22)' : 'rgba(255,190,150,.1)'; x.fillRect(Math.random() * s, Math.random() * s, rng(1, 3), rng(1, 3)); }
    });
    const asphaltTex = mkTex(512, (x, s) => {
      x.fillStyle = '#3b3c3e'; x.fillRect(0, 0, s, s);
      for (let i = 0; i < 14000; i++) { x.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,.18)' : 'rgba(210,210,200,.10)'; x.fillRect(Math.random() * s, Math.random() * s, rng(1, 3), rng(1, 3)); }
      for (let i = 0; i < 6; i++) { x.fillStyle = 'rgba(20,20,22,.35)'; x.beginPath(); x.ellipse(rng(60, s - 60), rng(60, s - 60), rng(20, 60), rng(10, 30), Math.random() * PI, 0, PI * 2); x.fill(); }
      x.strokeStyle = 'rgba(15,15,16,.5)'; x.lineWidth = 1.5;
      for (let i = 0; i < 8; i++) { x.beginPath(); let px = rng(40, s - 40), py = rng(40, s - 40); x.moveTo(px, py); for (let j = 0; j < 6; j++) { px += rng(-25, 25); py += rng(-25, 25); x.lineTo(px, py); } x.stroke(); }
      x.fillStyle = 'rgba(236,236,226,.9)'; x.fillRect(12, 0, 8, s); x.fillRect(s - 20, 0, 8, s);   // white edge lines
    });
    const mistTex = canvasTex(256, 128, (x, w, h) => {
      x.save(); x.translate(w / 2, h / 2); x.scale(1, h / w);
      const g = x.createRadialGradient(0, 0, 0, 0, 0, w / 2); g.addColorStop(0, 'rgba(255,255,255,.7)'); g.addColorStop(0.5, 'rgba(255,255,255,.28)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.beginPath(); x.arc(0, 0, w / 2, 0, PI * 2); x.fill(); x.restore();
    });
    Object.assign(M, {
      lateriteBrick: std({ map: lateriteTex, roughness: 1 }),
      bamboo: std({ map: rep(barkTex, 1, 3), color: 0xb7c46a, roughness: 0.7 }),
      bambooLog: std({ map: rep(barkTex, 2, 1), color: 0xb7c46a, roughness: 0.7 }),
      bambooLeaf: std({ color: 0x7aa23a, roughness: 0.8, side: DS, flatShading: true }),
      coffeeLeaf: std({ color: 0x2c5a2a, roughness: 0.45, flatShading: true }),
      berry: std({ color: 0xb8281e, roughness: 0.5 }),
      teaLeaf: std({ color: 0x5a9a3c, roughness: 0.85, flatShading: true }),
      oakBark: std({ color: 0x8d8678, roughness: 1 }),
      oakLeaf: std({ color: 0x6a9a3e, roughness: 0.85, flatShading: true }),
      kerbBlack: std({ color: 0x1c1c1e, roughness: 0.9 }),
      kerbWhite: std({ color: 0xe8e6df, roughness: 0.9 })
    });
    // the road itself: dark asphalt with white edge lines, laid over the track while in this zone
    const asphaltMap = rep(asphaltTex, 1, TRACK_L / 4.6);
    const asphalt = plane(9.2, std({ map: asphaltMap, roughness: 0.95, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), 0, 0.0032);
    asphalt.renderOrder = -0.5;
    // three layers of misty hills far behind everything; colours fade toward the fog colour with distance
    const ridgeGeo = (seed, base, amp) => {
      const sh = new THREE.Shape(); sh.moveTo(-420, -30);
      for (let x = -420; x <= 420; x += 14) sh.lineTo(x, base + amp * (0.55 * Math.sin(x * 0.011 + seed) + 0.3 * Math.sin(x * 0.027 + seed * 2.1) + 0.15 * Math.sin(x * 0.06 + seed * 3.3)));
      sh.lineTo(420, -30); sh.closePath(); return new THREE.ShapeGeometry(sh);
    };
    const ridges = new THREE.Group(); ridges.visible = false; scene.add(ridges);
    [[-185, 30, 22, 0xaabfa3, 1.3], [-150, 22, 18, 0x86a07d, 4.1], [-115, 12, 14, 0x5f7d55, 7.7]].forEach(([z, base, amp, color, seed], i) => {
      const m = new THREE.Mesh(ridgeGeo(seed, base, amp), new THREE.MeshBasicMaterial({ color, fog: false, transparent: true, opacity: 0, depthWrite: false, side: DS }));
      m.position.z = z; m.renderOrder = -2.6 + i * 0.1; ridges.add(m);
    });
    // coffee bushes with red cherries (3 variants), tea terraces, bamboo, silver oaks, painted kerbs, mist banks
    const coffeeVariant = () => {
      const bush = [], berries = [];
      for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) {
        const cx = rng(-0.25, 0.25) + (j - 1) * 0.35, cz = -2 + i + rng(-0.15, 0.15), r = rng(0.45, 0.65), cy = r * 0.7;
        bush.push(new THREE.IcosahedronGeometry(r, 1).scale(1, 0.85, 1).translate(cx, cy, cz));
        for (let k = 0; k < 3; k++) { const a = Math.random() * PI * 2, e = rng(0.2, 0.9); berries.push(new THREE.SphereGeometry(0.05, 4, 3).translate(cx + Math.cos(a) * r * 0.95 * Math.cos(e), cy + Math.sin(e) * r * 0.8, cz + Math.sin(a) * r * 0.95 * Math.cos(e))); }
      }
      return { bush: merge(bush), berries: merge(berries) };
    };
    const COFFEE = Array.from({ length: 3 }, coffeeVariant);
    const coffeeObj = (parent) => {
      const g = hide(new THREE.Group()), bush = mesh(COFFEE[0].bush, M.coffeeLeaf, g), berries = mesh(COFFEE[0].berries, M.berry, g);
      g.userData.set = (i) => { bush.geometry = COFFEE[i].bush; berries.geometry = COFFEE[i].berries; };
      parent.add(g); return g;
    };
    const teaGeo = merge(Array.from({ length: 6 }, (_, i) => new THREE.SphereGeometry(0.75, 8, 5).scale(1, 0.5, 1).translate((i % 2) * 1.6 - 0.8, 0.2, ((i / 2) | 0) * 1.7 - 1.7)));
    const bambooGeo = (() => {
      const culms = [], tufts = [];
      for (let i = 0; i < 9; i++) {
        const h = rng(6, 10), x = rng(-0.9, 0.9), z = rng(-0.9, 0.9), lx = rng(-0.25, 0.25), lz = rng(-0.25, 0.25);
        culms.push(new THREE.CylinderGeometry(0.05, 0.085, h, 5).translate(0, h / 2, 0).rotateZ(lx).rotateX(lz).translate(x, 0, z));
        for (let k = 0; k < 3; k++) { const hk = h * (0.72 + 0.1 * k); tufts.push(new THREE.ConeGeometry(0.3, 1.5, 4).translate(0, 0.75, 0).rotateZ(rng(1, 1.5)).rotateY(rng(0, PI * 2)).translate(x - Math.sin(lx) * hk, hk, z + Math.sin(lz) * hk)); }
      }
      return { culms: merge(culms), tufts: merge(tufts) };
    })();
    const bambooObj = (parent) => { const g = hide(new THREE.Group()); mesh(bambooGeo.culms, M.bamboo, g); mesh(bambooGeo.tufts, M.bambooLeaf, g); parent.add(g); return g; };
    const oakVariant = () => {
      const h = rng(12, 17), bend = rng(-1, 1), trunk = new THREE.CylinderGeometry(0.16, 0.34, h, 7, 8), tp = trunk.attributes.position;
      for (let i = 0; i < tp.count; i++) { const t = (tp.getY(i) + h / 2) / h; tp.setX(i, tp.getX(i) + bend * t * t); }
      trunk.translate(0, h / 2, 0); trunk.computeVertexNormals();
      return { trunk, crown: merge(Array.from({ length: 6 }, () => new THREE.IcosahedronGeometry(rng(1.2, 2.2), 1).scale(1, 0.6, 1).translate(bend + rng(-1.6, 1.6), h + rng(-1.2, 1), rng(-1.6, 1.6)))) };
    };
    const OAKS = Array.from({ length: 4 }, oakVariant);
    const oakObj = (parent) => {
      const g = hide(new THREE.Group()), trunk = mesh(OAKS[0].trunk, M.oakBark, g), crown = mesh(OAKS[0].crown, M.oakLeaf, g);
      g.userData.set = (i) => { trunk.geometry = OAKS[i].trunk; crown.geometry = OAKS[i].crown; };
      parent.add(g); return g;
    };
    const parapetGeo = new THREE.BoxGeometry(4.7, 0.55, 0.45).translate(0, 0.275, 0);
    const mistMat = new THREE.SpriteMaterial({ map: mistTex, transparent: true, opacity: 0.4, depthWrite: false });
    const mistObj = (parent) => { const s = new THREE.Sprite(mistMat); s.visible = false; parent.add(s); return s; };
    const variant = (it, n) => { it.userData.set((Math.random() * n) | 0); return it; };

    const decorateWayanad = (sl, sd, place, lowQ) => {
      const I = sl.items, r = Math.random(), kerb = place(I.parapet, sd, 5.75, 0, 1);
      kerb.rotation.y = PI / 2; kerb.position.z = 0; kerb.material = Math.round(-sl.z / 5) % 2 ? M.kerbBlack : M.kerbWhite;   // black and white kerb stones
      const RB = window.RoboBend, d = -sl.z, bn = RB ? RB.apexIndex(d, 2.6) : 0, gk = RB ? RB.gantryAt(d, 2.6) : '';
      if (bn && sd < 0) { const s = place(I.hsign, -1, 6.6, 0, 1); s.rotation.y = 0; s.position.z = 0; s.userData.face.material.map = HSIGN_TEX[bn - 1]; s.userData.face.material.needsUpdate = true; }   // traffic keeps left: the numbered board stands on the left
      if (gk && sd > 0) { const g2 = place(I.gantry, 1, 0, 0, 1); g2.rotation.y = 0; g2.position.set(0, 0, 0); g2.userData.face.material.map = GANTRY_TEX[gk]; g2.userData.face.material.needsUpdate = true; }
      if (sd > 0) {                                   // hill side: red laterite cut, coffee and tea terraces, silver oaks, bamboo
        if (r < 0.3) place(I.laterite, sd, rng(9.5, 11.5), -0.4, rng(2.4, 3.8), rng(2.2, 3.6));
        else if (r < 0.62) variant(place(I.coffee, sd, rng(7.2, 9), 0, rng(0.9, 1.2)), COFFEE.length);
        else if (r < 0.82) place(I.tea, sd, rng(7.2, 9.5), 0, 1);
        if (Math.random() < 0.55) variant(place(I.oakA, sd, rng(12, 20), 0, rng(0.9, 1.25)), OAKS.length);
        if (Math.random() < (lowQ ? 0.2 : 0.4)) place(I.bamboo, sd, rng(10, 15), 0, rng(0.9, 1.3));
        if (Math.random() < 0.3) place(I.fern, sd, rng(6.2, 7.2), 0, rng(0.8, 1.3));
        if (!lowQ && Math.random() < 0.6) place(I.tuft, sd, rng(5.8, 8), 0, rng(0.9, 1.5));
      } else {                                        // valley side: oaks, bamboo, boulders, mist
        if (r < 0.5) variant(place(I.oakA, sd, rng(9, 16), 0, rng(0.9, 1.3)), OAKS.length);
        if (Math.random() < 0.4) place(I.bamboo, sd, rng(7, 12), 0, rng(0.9, 1.3));
        if (Math.random() < (lowQ ? 0.15 : 0.35)) variant(place(I.oakB, sd, rng(18, 30), -1, rng(1, 1.5)), OAKS.length);
        if (r > 0.88) place(I.laterite, sd, rng(8, 14), -0.2, rng(0.8, 1.5));
        if (Math.random() < 0.3) place(I.fern, sd, rng(6.2, 8), 0, rng(0.8, 1.3));
      }
      if (Math.random() < 0.3) place(I.mist, sd, rng(8, 22), rng(0.6, 1.8), 16, 5).position.z = rng(-2, 2);
    };

    /* ---------- the backpack on the character's back: grows with the slot count, shows what you carry ---------- */
    const PACKCOL = { coconut: 0x6b4a2a, banana: 0xe8c23a, jaggery: 0x8a4a1c, rice: 0xe9dfc4, ghee: 0xe0a82e, spice: 0xc2381f, tea: 0x4a8a3a, pepper: 0x2a2420, coffee: 0x4a2a18, cardamom: 0x6f9a3a };
    const pack = () => {
      const g = hide(new THREE.Group()), cloth = mat(0x7a2a24, { roughness: 0.9 }), flap = mat(0x5a1d19, { roughness: 0.9 }), gold = mat(0xd4a93a, { metalness: 0.5, roughness: 0.4 }), strap = mat(0x3a2a1a), mat0 = mat(0xcaa56a);
      const box = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
      box(0.56, 0.62, 0.3, cloth, 0, 0.6, 0); box(0.58, 0.16, 0.34, flap, 0, 0.95, 0.01); box(0.08, 0.1, 0.02, gold, 0, 0.84, 0.16);
      [-0.2, 0.2].forEach((x) => box(0.07, 0.5, 0.03, strap, x, 0.6, 0.16));
      const pouches = [-0.34, 0.34].map((x) => box(0.12, 0.3, 0.2, cloth, x, 0.45, 0));
      const bedroll = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.62, 10).rotateZ(PI / 2), mat0); bedroll.position.set(0, 1.14, 0.02); g.add(bedroll);
      const peek = [[-0.14, 1.1], [0, 1.14], [0.14, 1.09]].map(([x, y]) => { const o = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), mat(0xffffff)); o.position.set(x, y, 0.03); o.visible = false; g.add(o); return o; });
      return {
        g,
        update(cap, ids, zBack) {          // cap = backpack slots (8 to 24), ids = up to 3 ingredient ids poking out of the top, zBack = how far behind the body to sit
          const s = 0.85 + ((clamp(cap, 8, 24) - 8) / 16) * 0.4;
          g.scale.setScalar(s); g.position.set(0, (1 - s) * 0.6, zBack);
          pouches.forEach((o) => (o.visible = cap >= 12)); bedroll.visible = cap >= 16;
          peek.forEach((o, i) => { o.visible = !!ids[i]; if (ids[i]) o.material.color.setHex(PACKCOL[ids[i]] || 0xffffff); });
        }
      };
    };

    /* ---------- rides: models seen from behind, in the rider's own space (rider seat at the origin, front is -z). tick(dt, speed) animates ---------- */
    const rideMesh = (g, geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
    const paint = (hex) => new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.28, metalness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.15, envMap: beachEnv, envMapIntensity: 0.5, side: DS });
    const scooter = () => {
      const g = new THREE.Group(), body = paint(0x2f8a78), cream = paint(0xf1ece0), dark = mat(0x222428, { roughness: 0.6 }), seatM = mat(0x2a1d16, { roughness: 0.5 }), tire = mat(0x141414, { roughness: 0.95 }), chrome = mat(0xd6d9dd, { metalness: 0.9, roughness: 0.18 });
      const lens = new THREE.MeshBasicMaterial({ color: 0xfff1b0 }), tail = new THREE.MeshBasicMaterial({ color: 0xff3a2a }), wheels = [];
      [-1.12, 0.48].forEach((z) => {
        const w = new THREE.Group(); w.position.set(0, 0.3, z); g.add(w); wheels.push(w);
        rideMesh(w, new THREE.TorusGeometry(0.235, 0.07, 10, 22).rotateY(PI / 2), tire, 0, 0, 0);
        rideMesh(w, new THREE.CylinderGeometry(0.2, 0.2, 0.06, 18).rotateZ(PI / 2), chrome, 0, 0, 0);
        for (let k = 0; k < 5; k++) { const sp = rideMesh(w, new THREE.BoxGeometry(0.05, 0.38, 0.03), dark, 0, 0, 0); sp.rotation.x = (k / 5) * PI; }
        rideMesh(w, new THREE.CylinderGeometry(0.06, 0.06, 0.12, 10).rotateZ(PI / 2), chrome, 0, 0, 0);
      });
      rideMesh(g, new THREE.BoxGeometry(0.54, 0.07, 1.0), cream, 0, 0.34, -0.3);
      [-1, 1].forEach((sx) => rideMesh(g, new THREE.BoxGeometry(0.04, 0.16, 1.0), cream, sx * 0.27, 0.4, -0.3));
      rideMesh(g, new THREE.CapsuleGeometry(0.27, 0.55, 6, 14).rotateX(PI / 2).scale(1, 0.95, 1), body, 0, 0.7, 0.52);                         // rear body
      rideMesh(g, new THREE.CapsuleGeometry(0.16, 0.5, 6, 12).rotateX(PI / 2).scale(1.1, 0.5, 1), seatM, 0, 1.0, 0.12);                     // seat
      rideMesh(g, new THREE.CylinderGeometry(0.36, 0.36, 0.95, 18, 1, true, PI - 1.0, 2.0), body, 0, 0.86, -0.64).rotation.x = -0.25;           // curved leg shield
      rideMesh(g, new THREE.CylinderGeometry(0.035, 0.035, 0.9, 8), chrome, 0, 0.8, -0.82).rotation.x = -0.28;                                // fork
      rideMesh(g, new THREE.CapsuleGeometry(0.07, 0.5, 4, 8).rotateZ(PI / 2), cream, 0, 1.3, -0.79);                                         // handlebar cover
      [-1, 1].forEach((sx) => {
        rideMesh(g, new THREE.CylinderGeometry(0.035, 0.035, 0.14, 8).rotateZ(PI / 2), dark, sx * 0.4, 1.3, -0.79);                           // grips
        rideMesh(g, new THREE.CylinderGeometry(0.012, 0.012, 0.22, 5), chrome, sx * 0.3, 1.4, -0.8);                                          // mirror stems
        rideMesh(g, new THREE.SphereGeometry(0.06, 8, 6).scale(1.3, 1, 0.5), chrome, sx * 0.31, 1.52, -0.8);
      });
      rideMesh(g, new THREE.SphereGeometry(0.13, 12, 8), chrome, 0, 1.18, -0.93); rideMesh(g, new THREE.SphereGeometry(0.095, 10, 8), lens, 0, 1.18, -1.0);   // headlamp
      const fen = rideMesh(g, new THREE.TorusGeometry(0.34, 0.05, 6, 16, PI * 0.9).rotateZ(PI * 0.05).rotateY(PI / 2).scale(1.6, 1, 1), cream, 0, 0.3, -1.12);
      rideMesh(g, new THREE.CylinderGeometry(0.05, 0.06, 0.62, 10).rotateX(PI / 2), chrome, 0.2, 0.4, 0.62); rideMesh(g, new THREE.SphereGeometry(0.06, 8, 6), chrome, 0.2, 0.4, 0.94);  // exhaust
      rideMesh(g, new THREE.BoxGeometry(0.2, 0.1, 0.02), mat(0xf4f1ea, { roughness: 0.6 }), 0, 0.52, 1.03); rideMesh(g, new THREE.BoxGeometry(0.14, 0.05, 0.03), tail, 0, 0.7, 1.04);   // number plate, tail lamp
      g.userData.tick = (dt, speed) => wheels.forEach((w) => (w.rotation.x -= (speed * dt) / 0.3));
      return g;
    };
    /* a tube that tapers from radius r0 to r1 along a curve (horns) */
    const taperTube = (pts, r0, r1, seg, rs) => {
      const curve = new THREE.CatmullRomCurve3(pts), fr = curve.computeFrenetFrames(seg, false), pos = [], idx = [];
      for (let i = 0; i <= seg; i++) {
        const t = i / seg, q = curve.getPoint(t), N = fr.normals[i], B = fr.binormals[i], r = lerp(r0, r1, Math.pow(t, 0.8));
        for (let j = 0; j < rs; j++) { const a = (j / rs) * PI * 2, cx = Math.cos(a) * r, sx = Math.sin(a) * r; pos.push(q.x + N.x * cx + B.x * sx, q.y + N.y * cx + B.y * sx, q.z + N.z * cx + B.z * sx); }
      }
      for (let i = 0; i < seg; i++) for (let j = 0; j < rs; j++) { const a = i * rs + j, b = i * rs + ((j + 1) % rs), c2 = (i + 1) * rs + j, d = (i + 1) * rs + ((j + 1) % rs); idx.push(a, c2, b, b, c2, d); }
      const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.setIndex(idx); gg.computeVertexNormals(); return gg;
    };
    const hideBump = mkTex(128, (x, s2) => { x.fillStyle = '#808080'; x.fillRect(0, 0, s2, s2); for (let i = 0; i < 2600; i++) { const v = (Math.random() * 90 + 80) | 0; x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(Math.random() * s2, Math.random() * s2, rng(1, 3), rng(1, 3)); } });
    const buffalo = () => {
      const g = new THREE.Group(), bump = rep(hideBump, 16, 16);
      const hide0 = mat(0x26221f, { roughness: 1, bumpMap: bump, bumpScale: 0.22 }), pale = mat(0x4a423b, { roughness: 1 }), sock = mat(0x6e675e, { roughness: 1 }), horn = mat(0x9a917c, { roughness: 0.45 }), hoof = mat(0x1a1816, { roughness: 0.7 }), legs = [];
      const body = (geo, m, x, y, z) => rideMesh(g, geo, m, x, y, z);
      body(new THREE.SphereGeometry(1, 24, 16).scale(0.62, 0.6, 1.25), hide0, 0, 1.1, 0.1);                       // barrel
      body(new THREE.SphereGeometry(1, 16, 12).scale(0.56, 0.56, 0.62), hide0, 0, 1.12, 0.95);                    // rump
      body(new THREE.SphereGeometry(0.46, 16, 12).scale(1, 0.95, 1.1), hide0, 0, 1.55, -0.62);                    // shoulder hump
      body(new THREE.CylinderGeometry(0.28, 0.4, 1.0, 14).rotateX(1.15), hide0, 0, 1.45, -1.15);                  // neck
      body(new THREE.SphereGeometry(1, 16, 12).scale(0.24, 0.5, 0.36).rotateX(0.5), hide0, 0, 1.12, -1.35);       // dewlap
      body(new THREE.SphereGeometry(1, 18, 14).scale(0.28, 0.26, 0.44), hide0, 0, 1.32, -1.8);                    // head
      body(new THREE.SphereGeometry(1, 14, 10).scale(0.22, 0.2, 0.26), hide0, 0, 1.46, -1.62);                    // forehead boss
      body(new THREE.SphereGeometry(1, 12, 10).scale(0.21, 0.18, 0.22), pale, 0, 1.2, -2.14);                     // muzzle
      [-1, 1].forEach((sx) => {
        body(taperTube([new THREE.Vector3(sx * 0.2, 1.52, -1.68), new THREE.Vector3(sx * 0.5, 1.52, -1.56), new THREE.Vector3(sx * 0.78, 1.6, -1.56), new THREE.Vector3(sx * 0.9, 1.8, -1.64), new THREE.Vector3(sx * 0.84, 2.02, -1.78)], 0.075, 0.012, 16, 7), horn, 0, 0, 0);
        const ear = body(new THREE.SphereGeometry(1, 10, 8).scale(0.22, 0.06, 0.13), hide0, sx * 0.36, 1.4, -1.58); ear.rotation.z = sx * -0.25;
        body(new THREE.SphereGeometry(0.035, 6, 5), mat(0x0a0a0a, { roughness: 0.3 }), sx * 0.2, 1.36, -2.0);                // eyes
      });
      [[-1, -0.78], [1, -0.78], [-1, 0.95], [1, 0.95]].forEach(([sx, z]) => {
        const leg = new THREE.Group(); leg.position.set(sx * 0.38, 0.98, z); g.add(leg);
        rideMesh(leg, new THREE.CylinderGeometry(0.17, 0.12, 0.5, 10), hide0, 0, -0.25, 0);
        const knee = new THREE.Group(); knee.position.y = -0.5; leg.add(knee);
        rideMesh(knee, new THREE.CylinderGeometry(0.115, 0.085, 0.42, 10), sock, 0, -0.21, 0); rideMesh(knee, new THREE.CylinderGeometry(0.1, 0.11, 0.08, 10), hoof, 0, -0.44, 0.01);
        legs.push({ leg, knee });
      });
      const tailG = new THREE.Group(); tailG.position.set(0, 1.4, 1.45); g.add(tailG);
      rideMesh(tailG, new THREE.CylinderGeometry(0.035, 0.025, 0.75, 6), hide0, 0, -0.37, 0.05); rideMesh(tailG, new THREE.SphereGeometry(0.1, 8, 6).scale(1, 1.7, 1), hoof, 0, -0.82, 0.06);
      let ph = 0;
      g.userData.tick = (dt, speed) => {
        ph += speed * dt * 1.15;
        legs.forEach((l, i) => { const o = i === 1 || i === 2 ? PI : 0; l.leg.rotation.x = Math.sin(ph + o) * 0.55; l.knee.rotation.x = -Math.max(0, Math.sin(ph + o + 1.4)) * 0.7; });
        g.position.y = Math.abs(Math.sin(ph)) * 0.07; tailG.rotation.x = Math.sin(ph * 0.5) * 0.3;
      };
      return g;
    };
    const ride = (kind) => (kind === 'buffalo' ? buffalo() : scooter());
    const rideIcon = (kind) => {                       // small spinning version on the track, with a glowing ring like the other pickups
      const g = new THREE.Group(), m = ride(kind); m.scale.setScalar(0.42); m.position.set(0, -0.62, kind === 'buffalo' ? 0.3 : 0.2); g.add(m);
      const r = new THREE.Mesh(ring, ringMat); r.position.y = -0.6; r.scale.setScalar(1.35); g.add(r); return g;
    };

    /* ---------- photo textures (CC0, Poly Haven; js/textures.js) painted over the generated ones once decoded. If anything fails the generated look stays. ---------- */
    const PHOTO = window.ROBO_TEX || {}, hiQ = c.effQ() === 'High';
    const loadImg = (uri) => new Promise((res) => { if (!uri) return res(null); const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = uri; });
    const paintTiled = (cv, im, cols, rows, after) => { const x = cv.getContext('2d'), w = cv.width / cols, h = cv.height / rows; for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) x.drawImage(im, i * w, j * h, w, h); if (after) after(x, cv.width, cv.height); };
    const normalCanvas = (im, cols, rows) => { const cv = document.createElement('canvas'); cv.width = cv.height = 512; paintTiled(cv, im, cols, rows); const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
    const normalImage = (im) => { const t = new THREE.Texture(im); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.needsUpdate = true; return t; };
    const withPhoto = async (slug, fn) => { const t = PHOTO[slug]; if (!t) return; const [d, n] = await Promise.all([loadImg(t.d), hiQ ? loadImg(t.n) : null]); if (!d) return; try { fn(d, n); } catch (e) { console.warn('[robo] photo texture failed: ' + slug, e); } };
    // ground overlays: the photo is tiled into the existing canvas, so every scale and scroll rule stays as it was (normal maps share the colour map's uv transform)
    withPhoto('asphalt_02', (d, n) => {
      paintTiled(asphaltTex.image, d, 4, 2, (x, w, h) => { x.fillStyle = 'rgba(236,236,226,.9)'; x.fillRect(12, 0, 8, h); x.fillRect(w - 20, 0, 8, h); });   // white edge lines again on top
      asphaltMap.needsUpdate = true; if (n) { asphalt.material.normalMap = normalCanvas(n, 4, 2); asphalt.material.needsUpdate = true; }
    });
    withPhoto('square_pavers', (d, n) => { paintTiled(paveTex.image, d, 2, 2, (x, w, h) => { x.fillStyle = 'rgba(236,206,168,0.2)'; x.fillRect(0, 0, w, h); }); paveMap.needsUpdate = true;   // cream wash: warmer and lighter, less like a running track
      if (n) { pave.material.normalMap = normalCanvas(n, 2, 2); pave.material.needsUpdate = true; } });
    withPhoto('sand_01', (d, n) => {
      paintTiled(sandTex.image, d, 2, 2); tiles.forEach((t) => (t.needsUpdate = true)); [sandR, sandL].forEach((m) => m.material.color.setHex(0xffffff));
      if (n) { const nm = normalCanvas(n, 2, 2); [sandR, sandL].forEach((m) => { m.material.normalMap = nm; m.material.normalScale.set(0.6, 0.6); m.material.needsUpdate = true; }); }
    });
    // object materials: a NEW texture replaces the old one (an in-place image swap would overflow the old texture's storage when the size differs), same repeat, plus a normal map
    const swapImage = (m, d, n, color, rx, ry) => {
      const t = new THREE.Texture(d); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; t.repeat.copy(m.map.repeat); if (rx) t.repeat.set(rx, ry); t.needsUpdate = true;
      m.map = t; if (color !== undefined) m.color.setHex(color); if (n) m.normalMap = normalImage(n); m.needsUpdate = true;
    };
    withPhoto('palm_tree_bark', (d, n) => { swapImage(M.palmBark, d, n, 0xe6dccd); swapImage(M.palmLog, d, n, 0xe6dccd); });
    withPhoto('weathered_planks', (d, n) => swapImage(M.wood, d, n, 0xffffff));
    withPhoto('blue_painted_planks', (d, n) => swapImage(M.crateBlue, d, n, 0xa8c4ff));   // slight blue push: the photo is a muted teal-grey
    withPhoto('large_red_bricks', (d, n) => swapImage(M.lateriteBrick, d, n, 0xffffff, 2, 2));
    withPhoto('red_laterite_soil_stones', (d, n) => { const t = new THREE.Texture(d); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding; t.needsUpdate = true; M.laterite.map = t; M.laterite.color.setHex(0xe0c8b8); if (n) M.laterite.normalMap = normalImage(n); M.laterite.needsUpdate = true; });

    /* ---------- extra ground cover: grass tufts, flowering hibiscus, bleached driftwood ---------- */
    const tuftGeo = merge(Array.from({ length: 26 }, () => { const a = rng(0, PI * 2), d = rng(0, 0.3), h = rng(0.4, 0.85); return col(new THREE.ConeGeometry(0.03, h, 3).translate(0, h / 2, 0).rotateZ(rng(-0.4, 0.4)).rotateY(rng(0, PI)).translate(Math.cos(a) * d, 0, Math.sin(a) * d), new THREE.Color().setHSL(rng(0.18, 0.26), rng(0.35, 0.55), rng(0.3, 0.48)).getHex()); }));
    const hibiscusGeo = (() => {
      const parts = [];
      for (let i = 0; i < 5; i++) parts.push(col(new THREE.IcosahedronGeometry(rng(0.35, 0.55), 1).scale(1, 0.85, 1).translate(rng(-0.5, 0.5), rng(0.35, 0.7), rng(-0.5, 0.5)), 0x3f6a2c));
      for (let i = 0; i < 9; i++) { const a = rng(0, PI * 2), e = rng(0.3, 1.1); parts.push(col(new THREE.SphereGeometry(0.1, 7, 5).scale(1, 0.55, 1).translate(Math.cos(a) * 0.62 * Math.cos(e), 0.5 + Math.sin(e) * 0.5, Math.sin(a) * 0.62 * Math.cos(e)), i % 4 ? 0xd8202a : 0xf0a020)); }
      return merge(parts);
    })();
    const driftGeo = merge([col(new THREE.CylinderGeometry(0.09, 0.14, 2, 7).rotateZ(PI / 2).translate(0, 0.12, 0), 0xcdbfa5), col(new THREE.CylinderGeometry(0.04, 0.07, 0.8, 5).rotateZ(PI / 2 - 0.9).translate(0.5, 0.35, 0.2), 0xc4b59a)]);

    /* ---------- butterflies: real local species, drifting along the verge and sometimes across the path (instanced wings: two per butterfly) ---------- */
    const wingShape = (x) => { x.beginPath(); x.moveTo(2, 30); x.bezierCurveTo(10, 4, 44, 0, 60, 18); x.bezierCurveTo(62, 28, 52, 32, 40, 34); x.bezierCurveTo(52, 40, 54, 56, 36, 60); x.bezierCurveTo(20, 64, 6, 50, 2, 36); x.closePath(); };
    const wingTex = (paintWing) => canvasTex(64, 64, (x) => { x.save(); wingShape(x); x.clip(); paintWing(x); x.restore(); x.strokeStyle = 'rgba(20,14,10,.8)'; x.lineWidth = 1.5; wingShape(x); x.stroke(); });
    const dots = (x, color, pts) => { x.fillStyle = color; pts.forEach(([px, py, r]) => { x.beginPath(); x.arc(px, py, r, 0, PI * 2); x.fill(); }); };
    const SPECIES = [
      { n: 7, tex: wingTex((x) => { x.fillStyle = '#34261f'; x.fillRect(0, 0, 64, 64); dots(x, '#f4f1e6', [[50, 14, 2.2], [56, 22, 2], [52, 30, 2.2], [44, 46, 2], [34, 56, 2.2], [24, 54, 1.8]]); x.fillStyle = 'rgba(80,110,170,.35)'; x.fillRect(0, 0, 64, 20); }) },                    // Common Crow
      { n: 7, tex: wingTex((x) => { x.fillStyle = '#1c2230'; x.fillRect(0, 0, 64, 64); x.strokeStyle = '#a9d6ee'; x.lineWidth = 3; for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(6, 32); x.lineTo(56, 8 + i * 9); x.stroke(); } }) },                                              // Blue Tiger
      { n: 6, tex: wingTex((x) => { x.fillStyle = '#e8873a'; x.fillRect(0, 0, 64, 64); x.strokeStyle = '#1a120c'; x.lineWidth = 9; wingShape(x); x.stroke(); dots(x, '#f4f1e6', [[52, 12, 2], [58, 22, 2], [50, 32, 2], [34, 56, 2]]); }) },                                                  // Plain Tiger
      { n: 7, tex: wingTex((x) => { x.fillStyle = '#f2eedd'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#1a120c'; x.fillRect(40, 0, 24, 22); dots(x, '#e0452a', [[30, 52, 6], [20, 50, 5], [38, 46, 4]]); x.strokeStyle = '#1a120c'; x.lineWidth = 6; wingShape(x); x.stroke(); }) },                      // Common Jezebel
      { n: 2, tex: wingTex((x) => { x.fillStyle = '#16221b'; x.fillRect(0, 0, 64, 64); const g = x.createLinearGradient(0, 30, 64, 30); g.addColorStop(0, 'rgba(79,208,168,0)'); g.addColorStop(0.5, 'rgba(79,208,168,.95)'); g.addColorStop(1, 'rgba(79,208,168,0)'); x.fillStyle = g; x.fillRect(14, 22, 40, 14); }) }   // Malabar Banded Peacock (Kerala's state butterfly), rare
    ];
    const flies = (() => {
      const wingGeo = new THREE.PlaneGeometry(0.42, 0.42).rotateX(-PI / 2).translate(0.21, 0, 0), dm = new THREE.Object3D(), list = [], high = c.effQ() === 'High';
      SPECIES.forEach((sp) => {
        const n = high ? sp.n : Math.ceil(sp.n / 2), mesh2 = new THREE.InstancedMesh(wingGeo, new THREE.MeshBasicMaterial({ map: sp.tex, alphaTest: 0.5, side: DS, transparent: false }), n * 2);
        mesh2.frustumCulled = false; mesh2.visible = false; scene.add(mesh2);
        const b = Array.from({ length: n }, (_, i) => ({ x: 0, y: rng(0.6, 2.5), z: -rng(5, 60), ang: rng(0, PI * 2), sp: rng(0.6, 1.5), ph: rng(0, 6), s: rng(0.8, 1.25), cross: Math.random() < 0.18, base: rng(0.7, 2.4), side: i % 2 ? 1 : -1 }));
        b.forEach((q) => { q.x = q.side * rng(6, 13); });
        list.push({ mesh: mesh2, b, n });
      });
      const respawn = (q, pz) => { q.z = pz - rng(18, 75); q.x = q.cross ? rng(-8, 8) : q.side * rng(6, 13); q.base = rng(0.7, 2.4); };
      return {
        update(dt, pz, amount) {          // amount 0..1: how many are out (fewer on the evening beach, more in the Wayanad forest)
          list.forEach((L) => {
            L.mesh.visible = amount > 0.02; if (!L.mesh.visible) return;
            const active = Math.max(0, Math.round(L.n * amount));
            L.b.forEach((q, i) => {
              if (q.z > pz + 8) respawn(q, pz);
              q.ph += dt * (13 + q.sp * 3); q.ang += (Math.random() - 0.5) * dt * 3.2;
              const hx = Math.cos(q.ang), hz = Math.sin(q.ang), lim = q.cross ? 12 : 14;
              q.x += hx * q.sp * dt; q.z += hz * q.sp * dt;
              if (!q.cross && Math.abs(q.x) < 5.8) q.x += q.side * dt * 2; if (Math.abs(q.x) > lim) q.ang = Math.atan2(hz, -Math.sign(q.x) * Math.abs(hx));   // keep to the verge, turn back at the edge
              if (q.side < 0 && q.x < -24) q.x = -24;
              q.y = q.base + Math.sin(q.ph * 0.3) * 0.35;
              const yaw = Math.atan2(-hx, -hz), flap = 0.15 + Math.abs(Math.sin(q.ph)) * 1.05, on = i < active;
              for (let w = 0; w < 2; w++) {
                const side = w ? -1 : 1; dm.position.set(q.x, on ? q.y : -50, q.z); dm.rotation.set(0, yaw, flap * side, 'YZX'); dm.scale.set(side * q.s, q.s, q.s); dm.updateMatrix(); L.mesh.setMatrixAt(i * 2 + w, dm.matrix);
              }
            });
            L.mesh.instanceMatrix.needsUpdate = true;
          });
        },
        snapshot: () => list.map((L) => ({ shown: L.mesh.visible, n: L.n }))
      };
    })();

    /* ---------- spider web across the forest road, with a giant wood spider (Western Ghats forests). Hang at head height: slide under it or it slows you and breaks. ---------- */
    const webTex = canvasTex(256, 176, (x, w, h) => {
      const cx = w / 2, cy = h / 2, rx = w / 2 - 4, ry = h / 2 - 4; const gr = x.createRadialGradient(cx, cy, 0, cx, cy, rx); gr.addColorStop(0, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0.08)'); x.fillStyle = gr; x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, PI * 2); x.fill();
      x.strokeStyle = 'rgba(250,248,240,1)'; x.lineWidth = 3;
      for (let i = 0; i < 16; i++) { const a = (i / 16) * PI * 2; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry); x.stroke(); }
      for (let r = 1; r <= 9; r++) { x.beginPath(); for (let i = 0; i <= 16; i++) { const a = (i / 16) * PI * 2, k = (r / 9) * (0.96 + Math.random() * 0.06); const px = cx + Math.cos(a) * rx * k, py = cy + Math.sin(a) * ry * k; if (i) x.lineTo(px, py); else x.moveTo(px, py); } x.stroke(); }
    });
    const webModel = () => {
      const g = new THREE.Group();
      const sheet = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.75), new THREE.MeshBasicMaterial({ map: webTex, transparent: true, alphaTest: 0.05, side: DS, depthWrite: false })); sheet.position.set(0, 2.15, 0); g.add(sheet);
      const lines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([[-1.2, 2.5, 0], [-1.9, 4.2, -0.2], [1.2, 2.5, 0], [1.9, 4.2, -0.2], [0, 3.0, 0], [0.1, 4.4, -0.3], [-1.1, 1.7, 0], [-1.7, 0.6, 0.1], [1.1, 1.7, 0], [1.7, 0.6, 0.1]].map(([a, b, c]) => new THREE.Vector3(a, b, c))), new THREE.LineBasicMaterial({ color: 0xf0eee4, transparent: true, opacity: 0.7 })); g.add(lines);
      const sp = new THREE.Group(); sp.position.set(0, 2.15, 0.05); g.add(sp);
      const dark = mat(0x1a120c, { roughness: 0.6 }), gold = mat(0xd9b030, { roughness: 0.5 }), band = mat(0xc9582a, { roughness: 0.6 });
      rideMesh(sp, new THREE.SphereGeometry(1, 12, 9).scale(0.1, 0.1, 0.2), gold, 0, -0.02, 0.18);
      [0.1, 0.22, 0.3].forEach((z) => rideMesh(sp, new THREE.TorusGeometry(0.095 - (z - 0.1) * 0.12, 0.012, 4, 10).scale(1, 1, 1), dark, 0, -0.02, z));
      rideMesh(sp, new THREE.SphereGeometry(0.08, 10, 8).scale(1, 0.9, 1.2), band, 0, 0, -0.04); rideMesh(sp, new THREE.SphereGeometry(0.045, 8, 6), dark, 0, 0.01, -0.14);
      const legs = [];
      for (let i = 0; i < 8; i++) {
        const side = i < 4 ? 1 : -1, k = i % 4, leg = new THREE.Group(); leg.position.set(side * 0.05, 0, -0.1 + k * 0.07); sp.add(leg); legs.push(leg);
        const yaw = side * (0.5 + k * 0.28) * (k < 2 ? -1 : 1) * 0.9;
        const a = rideMesh(leg, new THREE.CylinderGeometry(0.012, 0.012, 0.3, 5).translate(0, 0.15, 0).rotateZ(-side * 1.1), dark, 0, 0, 0); a.rotation.y = yaw;
        const b = rideMesh(leg, new THREE.CylinderGeometry(0.01, 0.006, 0.34, 5).translate(0, 0.17, 0).rotateZ(-side * 2.3), k % 2 ? dark : gold, side * 0.27, 0.15, 0); b.rotation.y = yaw;
      }
      g.userData.tick = (t) => { sp.position.y = 2.15 + Math.sin(t * 2.2) * 0.03; sp.position.x = Math.sin(t * 0.9) * 0.05; legs.forEach((l, i) => (l.rotation.z = Math.sin(t * 5 + i) * 0.06)); };
      return g;
    };

    /* ---------- ghost crabs on the sand: sand-coloured, scuttle sideways, bolt away from you (beach only) ---------- */
    const crabs = (() => {
      const geo = merge([
        col(new THREE.SphereGeometry(1, 10, 7).scale(0.17, 0.075, 0.12).translate(0, 0.07, 0), 0xcfae78),
        ...[-1, 1].map((sx) => col(new THREE.SphereGeometry(0.065, 7, 5).scale(1.2, 0.8, 1).translate(sx * 0.22, 0.075, -0.14), 0xd98a5c)),                       // claws
        ...[-1, 1].map((sx) => col(new THREE.CylinderGeometry(0.008, 0.008, 0.07, 4).translate(sx * 0.06, 0.15, -0.1), 0x2a2018)),                                // eye stalks
        ...[-1, 1].flatMap((sx) => [0, 1, 2].map((k) => col(new THREE.BoxGeometry(0.17, 0.015, 0.015).rotateZ(sx * 0.35).translate(sx * 0.22, 0.04, -0.04 + k * 0.06), 0xb8956a)))   // legs
      ]);
      const high = c.effQ() === 'High', N = high ? 16 : 8, mesh2 = new THREE.InstancedMesh(geo, M.vcol, N), dm = new THREE.Object3D();
      mesh2.frustumCulled = false; mesh2.visible = false; scene.add(mesh2);
      const list = Array.from({ length: N }, (_, i) => ({ x: 0, z: -rng(5, 70), vx: 0, mode: 0, t: rng(0, 3), side: i % 4 === 0 ? 1 : -1, ph: rng(0, 6), s: rng(0.9, 1.5) }));
      const place = (q, pz) => { q.z = pz - rng(12, 75); q.side = Math.random() < 0.25 ? 1 : -1; q.x = q.side > 0 ? rng(6.8, 13) : -rng(8, 24); q.mode = 0; q.vx = 0; q.t = rng(0.5, 3); };
      list.forEach((q) => { q.x = q.side > 0 ? rng(6.8, 13) : -rng(8, 24); });
      return {
        update(dt, px, pz, amount) {
          mesh2.visible = amount > 0.02; if (!mesh2.visible) return;
          const active = Math.round(N * amount);
          list.forEach((q, i) => {
            if (q.z > pz + 8) place(q, pz);
            const near = Math.abs(q.z - pz) < 6 && Math.abs(q.x - px) < 12;
            if (near && q.mode !== 2) { q.mode = 2; q.vx = -q.side * rng(4.5, 6.5); }                 // flee away from the path, toward the sea or the dunes
            else if (q.mode === 0) { q.t -= dt; if (q.t <= 0) { q.mode = 1; q.t = rng(0.3, 0.9); q.vx = (Math.random() < 0.5 ? -1 : 1) * rng(0.7, 1.6); } }
            else if (q.mode === 1) { q.t -= dt; if (q.t <= 0) { q.mode = 0; q.t = rng(0.8, 3); q.vx = 0; } }
            q.x += q.vx * dt; q.ph += dt * (q.mode ? 28 : 3);
            if (q.side < 0 && q.x < -25.5) q.x = -25.5;                                                // stop at the wet sand
            if (q.side < 0 && q.x > -6.4) q.x = -6.4; if (q.side > 0 && q.x < 6.4) q.x = 6.4;           // never onto the path
            const bob = q.mode ? Math.abs(Math.sin(q.ph)) * 0.025 : 0;
            dm.position.set(q.x, i < active ? bob : -50, q.z); dm.rotation.set(0, q.vx < 0 ? 0.2 : -0.2, 0); dm.scale.setScalar(q.s); dm.updateMatrix(); mesh2.setMatrixAt(i, dm.matrix);
          });
          mesh2.instanceMatrix.needsUpdate = true;
        },
        snapshot: () => list.map((q) => ({ x: Math.round(q.x * 10) / 10, z: Math.round(q.z), mode: q.mode }))
      };
    })();

    /* ---------- roadside shops: a whitewashed Kerala shopfront with a Mangalore-tile roof and wooden veranda, its name board (English and Malayalam),
       goods for its trade, and a glowing bay in the right-hand lane. Local origin = the lane centre; the building stands to the right of the road. ---------- */
    const roofTex = mkTex(128, (x, s2) => { x.fillStyle = '#b5532e'; x.fillRect(0, 0, s2, s2); for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? 'rgba(90,30,15,.35)' : 'rgba(230,140,90,.25)'; x.fillRect(0, i * 8, s2, 4); } for (let i = 0; i < 700; i++) { x.fillStyle = 'rgba(40,15,8,.18)'; x.fillRect(Math.random() * s2, Math.random() * s2, 2, 2); } });
    Object.assign(M, { shopWall: std({ color: 0xece0c4, roughness: 0.95 }), shopRoof: std({ map: rep(roofTex, 3, 2), roughness: 0.85, side: DS }), shopWood: std({ color: 0x6a4527, roughness: 0.9 }), shopDark: std({ color: 0x1c1410, roughness: 1 }) });
    const signTex = (kind) => {
      const sh = (window.RoboShop && window.RoboShop.SHOPS[kind]) || { name: kind, local: '', emoji: '', color: '#444' };
      return canvasTex(512, 128, (x, w, h) => {
        x.fillStyle = sh.color; x.fillRect(0, 0, w, h); x.strokeStyle = '#f3e6cf'; x.lineWidth = 6; x.strokeRect(5, 5, w - 10, h - 10);
        x.fillStyle = '#f7efe0'; x.textBaseline = 'middle'; x.font = '60px sans-serif'; x.fillText(sh.emoji, 22, h / 2 + 2);
        x.font = 'bold 44px sans-serif'; x.fillText(sh.name.toUpperCase(), 100, h / 2 - 18); x.font = 'bold 34px "Nirmala UI","Noto Sans Malayalam","Kartika",sans-serif'; x.fillText(sh.local, 102, h / 2 + 26);
      });
    };
    const bannerTex = (kind) => {
      const sh = (window.RoboShop && window.RoboShop.SHOPS[kind]) || { color: '#444', emoji: '' };
      return canvasTex(256, 64, (x, w, h) => { x.fillStyle = sh.color; x.fillRect(0, 0, w, h); x.strokeStyle = '#f3e6cf'; x.lineWidth = 4; x.strokeRect(3, 3, w - 6, h - 6); x.fillStyle = '#f7efe0'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = 'bold 34px sans-serif'; x.fillText(sh.emoji + ' OPEN  ▼', w / 2, h / 2 + 2); });
    };
    const bx = (w, h, d, hex, px, py, pz) => col(new THREE.BoxGeometry(w, h, d).translate(px, py, pz), hex);
    const cy = (r0, r1, h, hex, px, py, pz, seg) => col(new THREE.CylinderGeometry(r0, r1, h, seg || 8).translate(px, py, pz), hex);
    const shopGoods = {
      snacks: () => [bx(0.9, 0.08, 4.2, 0x8a5a2e, 4.3, 1.04, 0), ...[-1.6, -0.8, 0, 0.8, 1.6].map((z, i) => cy(0.18, 0.2, 0.3, i % 2 ? 0xd9a030 : 0xb8402a, 4.4, 1.23, z)),
        ...[-1.4, 0.2, 1.5].flatMap((z) => [0, 1, 2, 3].map((i) => col(new THREE.CapsuleGeometry(0.07, 0.3, 3, 6).rotateZ(0.2).translate(4.2 + (i % 2) * 0.12, 2.85 - i * 0.1, z + i * 0.08), 0xe8c23a))),
        cy(0.28, 0.32, 0.5, 0xc4c8cc, 4.1, 1.33, 1.9, 12), cy(0.1, 0.1, 0.3, 0xc4c8cc, 4.1, 1.7, 1.9)],
      pharmacy: () => [bx(0.9, 0.08, 4.2, 0x7a5a38, 4.3, 1.04, 0), ...[1.5, 2.0, 2.5].map((y) => bx(0.4, 0.05, 4.4, 0x6a4527, 4.15, y, 0)),
        ...[1.5, 2.0, 2.5].flatMap((y, r) => Array.from({ length: 9 }, (_, i) => cy(0.07, 0.07, 0.22, [0x3f7a30, 0x8a5a2e, 0xd9a030][(i + r) % 3], 4.18, y + 0.14, -1.9 + i * 0.48, 7))),
        col(new THREE.SphereGeometry(0.5, 8, 6).scale(0.12, 0.8, 0.55).translate(3.3, 3.1, 2.4), 0x3f8a3a)],
      tools: () => [bx(0.9, 0.08, 4.2, 0x6a4a2a, 4.3, 1.04, 0), ...[-1.5, -0.5, 0.5, 1.5].map((z) => col(new THREE.TorusGeometry(0.28, 0.035, 5, 12, PI * 1.3).rotateY(PI / 2).translate(4.05, 2.3, z), 0xb8bcc2)),
        bx(0.3, 0.38, 0.22, 0x1a1a1a, 3.7, 0.19, 0.5), bx(0.3, 0.38, 0.22, 0x1a1a1a, 3.7, 0.19, 0.85), cy(0.25, 0.2, 0.4, 0xc03a2a, 3.8, 0.2, -1.6), cy(0.25, 0.2, 0.4, 0xd9a030, 3.8, 0.2, -2.1),
        cy(0.03, 0.03, 2.0, 0x8a5a2e, 4.1, 1.0, 2.4), bx(0.06, 0.3, 0.3, 0xb8bcc2, 4.1, 0.1, 2.4)],
      clothes: () => [bx(0.9, 0.08, 4.2, 0x6a4a2a, 4.3, 1.04, 0), col(new THREE.CylinderGeometry(0.025, 0.025, 4.6, 6).rotateX(PI / 2).translate(3.9, 2.9, 0), 0x8a5a2e),
        ...[-2, -1.3, -0.6, 0.1, 0.8, 1.5].flatMap((z, i) => [bx(0.04, 1.5, 0.6, [0xf4f1e6, 0xf2e2b0, 0x3a6ea0, 0xb8282e, 0xf4f1e6, 0x2f8a78][i], 3.9, 2.1, z), bx(0.05, 0.12, 0.6, 0xd4a93a, 3.9, 1.42, z)])]
    };
    shopGoods.footwear = () => [bx(0.9, 0.08, 4.2, 0x6a4a2a, 4.3, 1.04, 0), ...[1.5, 2.0, 2.5].map((y) => bx(0.4, 0.05, 4.4, 0x6a4527, 4.15, y, 0)),
      ...[1.5, 2.0, 2.5].flatMap((y, r) => Array.from({ length: 8 }, (_, i) => bx(0.34, 0.12, 0.13, [0xf4f1e6, 0x2f6ea0, 0xb8282e, 0x3a3a3a][(i + r) % 4], 4.12, y + 0.09, -1.75 + i * 0.5))),
      ...[-1.2, 0, 1.2].map((z) => bx(0.04, 0.5, 0.3, 0xd9a030, 3.85, 2.9, z))];   // shoe racks, and a row of hanging chappals
    const shopModel = (kind) => {
      const g = new THREE.Group(), glowMat = new THREE.MeshBasicMaterial({ color: (window.RoboShop && window.RoboShop.SHOPS[kind] ? new THREE.Color(window.RoboShop.SHOPS[kind].color).lerp(new THREE.Color(0xffe9a0), 0.55) : 0xffe9a0), transparent: true, opacity: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 6.6).rotateX(-PI / 2), glowMat); glow.position.y = 0.05; g.add(glow);
      const sx = 7.2;
      rideMesh(g, new THREE.BoxGeometry(6.4, 3.6, 5.6), M.shopWall, sx, 1.8, 0);                                                              // walls
      rideMesh(g, new THREE.BoxGeometry(0.1, 2.2, 1.7), M.shopDark, 4.0, 1.1, 0);                                                              // doorway
      [[5.4, 0.42], [9.0, -0.42]].forEach(([x, rz]) => { const r = rideMesh(g, new THREE.BoxGeometry(4.7, 0.14, 6.6), M.shopRoof, x, 4.3, 0); r.rotation.z = rz; });   // tiled roof, two slopes
      rideMesh(g, new THREE.CylinderGeometry(0.12, 0.12, 6.6, 6).rotateX(PI / 2), M.shopRoof, 7.2, 4.95, 0);
      [-2.5, 0, 2.5].forEach((z) => rideMesh(g, new THREE.BoxGeometry(0.16, 3.2, 0.16), M.shopWood, 3.3, 1.6, z));                           // veranda posts
      rideMesh(g, new THREE.BoxGeometry(0.16, 0.16, 5.6), M.shopWood, 3.3, 3.2, 0);
      rideMesh(g, merge(shopGoods[kind]()), M.vcol, 0, 0, 0);                                                                                  // counter and goods
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.1), new THREE.MeshBasicMaterial({ map: signTex(kind) })); sign.position.set(3.15, 3.55, 0); sign.rotation.y = -PI / 2; g.add(sign);
      const banner = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.75), new THREE.MeshBasicMaterial({ map: bannerTex(kind), side: DS })); banner.position.set(2.6, 4.6, -3.4); g.add(banner);   // hangs high over the bay: nothing to duck
      g.userData.tick = (t) => { glowMat.opacity = 0.32 + 0.14 * Math.sin(t * 3); };
      return g;
    };

    /* ---------- hooks for the engine ---------- */
    const last = { '-1': {}, 1: {} };
    const palm = (it) => { it.userData.set((Math.random() * PALMS.length) | 0); return it; };
    const THEMES = { beach: { stone: { block: M.crateBlue, log: M.palmLog, default: M.wood }, rock: M.laterite }, wayanad: { stone: { block: M.lateriteBrick, log: M.bambooLog, default: M.wood }, rock: M.laterite } };

    const decorateBeach = (sl, sd, place, lowQ) => {
        const I = sl.items, r = Math.random(), z = sl.z, L = last[sd], far = (k, gap) => Math.abs(z - (L[k] === undefined ? 1e9 : L[k])) > gap;
        if (sd > 0) {                                  // land side: palms, food stalls, boats pulled up on the sand
          if (r > 0.9 && far('stall', 45)) { const s = place(I.stall, sd, 8.8, 0, 1); s.rotation.y = -PI / 2; L.stall = z; }
          else {
            if (r < 0.62) palm(place(I.palmA, sd, rng(7.5, 12.5), 0, rng(0.95, 1.3)));
            if (r > 0.8 && far('boat', 25)) { const b = place(I.boat, sd, rng(10, 14), 0, rng(1, 1.2)); b.rotation.y = PI / 2 + rng(-0.25, 0.25); b.userData.hull.material = HULLS[(Math.random() * HULLS.length) | 0]; L.boat = z; }
          }
          if (Math.random() < (lowQ ? 0.2 : 0.5)) palm(place(I.palmB, sd, rng(14, 26), 0, rng(1, 1.4)));
          if (Math.random() < 0.35) place(I.grass, sd, rng(5.6, 7), 0, rng(0.8, 1.4));
          if (Math.random() < 0.18) place(I.sbush, sd, rng(6, 8), 0, rng(0.8, 1.5));
          if (!lowQ && Math.random() < 0.7) place(I.tuft, sd, rng(5.8, 9), 0, rng(0.9, 1.5));
          if (!lowQ && Math.random() < 0.14) place(I.hibiscus, sd, rng(6.4, 8.5), 0, rng(0.9, 1.3));
        } else {                                       // sea side: sand, boats facing the water, laterite rocks, the old pier
          if (r < 0.03 && far('pier', 120)) { const p = place(I.pier, sd, 0, 0, 1); p.position.set(SHORE + 2, 0, rng(-1.5, 1.5)); p.rotation.set(0, 0, 0); L.pier = z; }
          else if (r < 0.15 && far('boat', 22)) { const b = place(I.boat, sd, rng(13, 22), 0, rng(1, 1.25)); b.rotation.y = PI + rng(-0.3, 0.3); b.userData.hull.material = HULLS[(Math.random() * HULLS.length) | 0]; L.boat = z; }
          else if (r < 0.2 && !lowQ) { const b = place(I.boat, sd, rng(42, 70), 0.04, rng(1.2, 1.6)); b.rotation.y = rng(0, PI * 2); b.userData.hull.material = HULLS[(Math.random() * HULLS.length) | 0]; }
          else if (r < 0.32) place(I.laterite, sd, rng(16, 25), -0.2, rng(0.8, 1.6));
          if (Math.random() < 0.3) palm(place(I.palmA, sd, rng(6.5, 10), 0, rng(0.9, 1.2)));
          if (Math.random() < 0.3) place(I.grass, sd, rng(5.6, 8), 0, rng(0.8, 1.4));
          if (!lowQ && Math.random() < 0.55) place(I.tuft, sd, rng(5.8, 12), 0, rng(0.9, 1.5));
          if (!lowQ && Math.random() < 0.1) place(I.drift, sd, rng(12, 22), 0, rng(0.9, 1.3));
        }
      };

    return {
      /* models for the walkable town (explore.js): the same palms, stalls, boats, shops, pickups and rides, as ready-to-place objects */
      kit: {
        palm(i) { const v = PALMS[i % PALMS.length], g = new THREE.Group(), crown = mesh(v.crown, M.palmLeaf, g); mesh(v.trunk, M.palmBark, g); mesh(v.nuts, M.coconut, crown); crown.position.set(v.top[0], v.top[1], 0); g.userData.crown = crown; g.userData.phase = Math.random() * 6.28; return g; },
        stall() { const p = new THREE.Group(), g = stallObj(p); p.remove(g); g.visible = true; return g; },
        boat(i) { const p = new THREE.Group(), g = boatObj(p); p.remove(g); g.visible = true; g.userData.hull.material = HULLS[(i || 0) % HULLS.length]; return g; },
        shop: shopModel, herb: herbModel, food: foodModel, ride, vcol: M.vcol, white: M.white, awning: M.awning, bulb: M.bulb, wood: M.wood, laterite: M.laterite, concrete: M.concrete
      },
      kinds: ['beach', 'wayanad'], foodModel, herbModel, webModel, shopModel, stats: () => ({ crabs: crabs.snapshot(), flies: flies.snapshot() }), umbrella, pack, ride, rideIcon,
      slotItems(g, i) {
        return { palmA: palmObj(g), palmB: palmObj(g), boat: boatObj(g), stall: stallObj(g), pier: hide(mesh(pierGeo, M.concrete, g)),
          laterite: hide(mesh(ROCKS[i % 3], M.laterite, g)), grass: hide(mesh(FERN, M.beachGrass, g)), sbush: hide(mesh(BUSH[i % 3], M.beachBush, g)),
          tuft: hide(mesh(tuftGeo, M.vcol, g)), hibiscus: hide(mesh(hibiscusGeo, M.vcol, g)), drift: hide(mesh(driftGeo, M.vcol, g)),
          hsign: hsignObj(g), gantry: gantryObj(g), coffee: coffeeObj(g), tea: hide(mesh(teaGeo, M.teaLeaf, g)), bamboo: bambooObj(g), oakA: oakObj(g), oakB: oakObj(g), parapet: hide(mesh(parapetGeo, M.kerbWhite, g)), mist: mistObj(g) };
      },
      decorate(sl, sd, place, lowQ, kind) { (kind === 'wayanad' ? decorateWayanad : decorateBeach)(sl, sd, place, lowQ); },
      theme(o, kind) {                                 // re-skin shared obstacle models for this zone (stone → painted wood, palm log, laterite)
        o.g.traverse((m) => {
          if (!m.isMesh) return;
          const base = m.userData.m0 || (m.userData.m0 = m.material), t = THEMES[kind];
          m.material = t ? (base === M.stone ? t.stone[o.type] || t.stone.default : base === M.rock ? t.rock : base) : base;
        });
      },
      frame(dt, time, px, pz, fx) {
        const mz = pz - 90, kw = fx.wayanad || 0, wOn = kw > 0.01;
        flies.update(dt, pz, clamp((fx.beach || 0) * 0.45 + kw, 0, 1)); crabs.update(dt, px, pz, fx.beach || 0);
        ridges.visible = asphalt.visible = wOn;
        if (wOn) { ridges.position.set(px, 0, pz); ridges.children.forEach((m) => (m.material.opacity = kw)); asphalt.position.z = mz; asphaltMap.offset.y = -mz / 4.6; asphalt.material.opacity = kw; }
        const k = fx.beach || 0, on = k > 0.01;
        sky.visible = on; glitter.visible = on; ground.forEach((m) => (m.visible = on));
        if (!on) return;
        ground.forEach((m) => (m.position.z = mz));
        tiles.forEach((t) => (t.offset.y = -mz / T)); paveMap.offset.y = -mz / 4.6;
        seaMap.offset.set(time * 0.012, -mz / 14 + time * 0.03);
        foamMap.offset.y = -mz / 6;
        sandR.material.opacity = sandL.material.opacity = sea.material.opacity = pave.material.opacity = k; wet.material.opacity = 0.35 * k;
        foam.material.opacity = k * (0.55 + 0.3 * Math.sin(time * 0.8 + 1)); foam.position.x = SHORE + 0.7 + Math.sin(time * 0.8) * 0.9;
        skyMats.forEach((m) => (m.opacity = k)); clouds.children.forEach((m) => (m.material.opacity = m.userData.o * k));
        sky.position.set(px, 0, pz); clouds.rotation.y = time * 0.004;
        glitter.position.set(px + sunDir.x * 130 / Math.hypot(sunDir.x, sunDir.z), 0.06, pz + sunDir.z * 130 / Math.hypot(sunDir.x, sunDir.z)); glitter.rotation.y = Math.atan2(sunDir.x, sunDir.z);
        glitterMap.offset.y = time * 0.06; glitter.material.opacity = k * (0.62 + 0.25 * Math.sin(time * 2.1));
        for (const g of palms) if (g.visible) { const u = g.userData; u.crown.rotation.set(Math.cos(time * 0.9 + u.phase) * 0.025, 0, Math.sin(time * 1.1 + u.phase) * 0.03); }
      }
    };
  }

  window.MalabarWorld = { zones, kinds: ['beach', 'wayanad'], init };
})();
