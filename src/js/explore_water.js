/* Robo Run: water in the walkable town. Exposes window.RoboExploreWater = { build(c), pure }.
   When it rains the roads wet and puddles appear; rings spread on the puddles, drops fall from the awnings (and keep dripping for a while after the rain stops), and walking or riding through a puddle throws a splash.
   Everything is pooled and instanced: puddles, rings and drops are three draw calls in all, and nothing runs while it is dry. The rules (how wet the town is, where puddles go, how a ring grows) are pure and tested in tests/water.test.js. */
(function () {
  'use strict';
  if (window.RoboExploreWater) return;   // the page loads its scripts twice

  /* wetness 0 to 1: rises while it rains (about 10 s to soak), dries over about 2 minutes after */
  const wetStep = (wet, rain, dt) => (rain > 0.02 ? Math.min(1, wet + Math.max(rain, 0.3) * dt / 10) : Math.max(0, wet - dt / 120));
  /* puddles inside the road rectangles [x0, x1, z0, z1] (absolute metres), none where blocked(x, z, r) says a wall, stall or vehicle is: returns [{ x, z, r }] */
  const placePuddles = (rects, n, rnd, blocked) => {
    const out = [];
    for (let tries = 0; out.length < n && tries < n * 30; tries++) {
      const [x0, x1, z0, z1] = rects[(rnd() * rects.length) | 0], r = 0.7 + rnd() * 1.1, x = x0 + r + rnd() * Math.max(0.01, x1 - x0 - 2 * r), z = z0 + rnd() * (z1 - z0);
      if (blocked && blocked(x, z, r)) continue; if (out.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + r + 0.8)) continue; out.push({ x, z, r });
    }
    return out;
  };
  const inPuddle = (list, x, z, pad) => { for (const p of list) if (Math.hypot(p.x - x, p.z - z) < p.r + (pad || 0)) return p; return null; };
  /* a ring's life t (0 to 1): its radius grows from 10% to 100% of its full size and it fades out */
  const ring = (t) => ({ scale: 0.1 + 0.9 * Math.min(1, Math.max(0, t)), fade: Math.max(0, 1 - t) * Math.max(0, 1 - t) });
  /* a drop falling from y0 with gravity: the time it takes to reach the ground */
  const fallTime = (y0) => Math.sqrt((2 * Math.max(0, y0)) / 9.8);
  /* how the road's surface changes with the wetness: its brightness and roughness for a given wetness (dry values are the starting point) */
  const wetLook = (wet, dryRough) => { const k = Math.min(1, Math.max(0, wet)); return { bright: 1 - 0.42 * k, rough: dryRough + (0.62 - dryRough) * k }; /* darker, with a soft sheen: a mirror finish would wash out in the sky's reflection */ };
  const pure = { wetStep, placePuddles, inPuddle, ring, fallTime, wetLook };

  function build(c) {
    const { THREE, scene, colliders, fadeables, zones, rnd } = c, PI = Math.PI, surfaces = (c.surfaces || []).map((m) => ({ m, rough: m.roughness, col: null, env: m.envMapIntensity }));   // the road and pavement materials, to wet and dry
    const blocked = (x, z, r) => { for (const q of colliders) { if (q.dyn) continue; if (q.t === 'box') { if (x > q.x0 - r - 0.6 && x < q.x1 + r + 0.6 && z > q.z0 - r - 0.6 && z < q.z1 + r + 0.6) return true; } else if (q.t === 'circle') { if (Math.hypot(x - q.x, z - q.z) < (q.r || 0.4) + r + 0.6) return true; } } return false; };
    const puddles = []; for (const zn of zones) puddles.push(...placePuddles(zn.rects, zn.n, rnd, blocked));
    const PN = puddles.length; if (!PN) return { step() {}, info: () => ({ puddles: 0 }), pure };
    const dummy = new THREE.Object3D();
    const pm = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 18).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: 0x1d2c37, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }) /* unlit and dark: a wet patch that reads on any road in any light */, PN);
    puddles.forEach((p, i) => { dummy.position.set(p.x, 0.085, p.z); dummy.scale.set(p.r * (1 + 0.25 * rnd()), 1, p.r * (0.8 + 0.2 * rnd())); dummy.rotation.set(0, rnd() * PI, 0); dummy.updateMatrix(); pm.setMatrixAt(i, dummy.matrix); });
    pm.frustumCulled = false; pm.visible = false; scene.add(pm);
    /* rings on the ground: a pool of 28 */
    const RN = 28, rings = Array.from({ length: RN }, () => ({ t: 1, x: 0, z: 0, r: 0.5, life: 0.8 }));
    const rm = new THREE.InstancedMesh(new THREE.RingGeometry(0.78, 1, 20).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, fog: true }), RN);
    rm.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(RN * 3), 3); rm.frustumCulled = false; rm.visible = false; scene.add(rm);
    /* drops: a pool of 80, falling from awnings or thrown up by a splash */
    const DN = 80, drops = Array.from({ length: DN }, () => ({ on: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, kind: 0, life: 0 }));
    const dm = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 5, 4), new THREE.MeshBasicMaterial({ color: 0xcfe6f5, transparent: true, opacity: 0.85, depthWrite: false }), DN);
    dm.frustumCulled = false; dm.visible = false; scene.add(dm);
    let wet = 0, shown = 0, ringI = 0, dropI = 0, tDrip = 0, tRing = 0, tSplash = 0, tPick = 0, near = [], nearPud = [];
    const addRing = (x, z, r, life) => { const g = rings[ringI++ % RN]; g.t = 0; g.x = x; g.z = z; g.r = r; g.life = life || 0.8; };
    const addDrop = (x, y, z, vx, vy, vz, kind) => { const d = drops[dropI++ % DN]; d.on = true; d.x = x; d.y = y; d.z = z; d.vx = vx; d.vy = vy; d.vz = vz; d.kind = kind; d.life = 1.2; };
    const col = new THREE.Color();
    return {
      info: () => ({ puddles: PN, sample: puddles.filter((q) => q.x > 560 && q.x < 640).slice(0, 4).map((q) => [Math.round(q.x * 10) / 10, Math.round(q.z * 10) / 10, Math.round(q.r * 10) / 10]), wet, shown: pm.visible, opacity: Math.round(pm.material.opacity * 100) / 100, rings: rings.filter((g) => g.t < 1).length, drops: drops.filter((d) => d.on).length }),
      setWet: (v) => { wet = v; },
      /* dt seconds; rain 0..1; p = { x, z, speed, bike } the walker; indoors = in a building */
      step(dt, rain, p, indoors) {
        wet = wetStep(wet, indoors ? 0 : rain, dt);
        if (surfaces.length && Math.abs(wet - shown) > 0.01) { shown = wet; for (const s of surfaces) { if (!s.col) s.col = s.m.color.clone(); /* the dry colour, taken the first time it gets wet: the textures set their tint after the town is built */ const l = wetLook(wet, s.rough); s.m.color.copy(s.col).multiplyScalar(l.bright); s.m.roughness = l.rough; s.m.envMapIntensity = s.env + 0.5 * wet; } }   // the roads darken and take a sheen
        const on = wet > 0.02 && !indoors; pm.visible = rm.visible = dm.visible = on; if (!on) return;
        pm.material.opacity = 0.7 * Math.min(1, Math.max(0, (wet - 0.12) / 0.45));
        if ((tPick -= dt) <= 0) { tPick = 0.8; near = fadeables.filter((f) => Math.abs(f.x0 - p.x) < 16 && Math.abs(f.z0 - p.z) < 16); nearPud = puddles.filter((q) => Math.abs(q.x - p.x) < 24 && Math.abs(q.z - p.z) < 24); }
        const drip = (rain > 0.05 ? 5 + 9 * rain : wet * 4), ringRate = rain > 0.1 ? 8 + 16 * rain : 0;
        for (tDrip += dt * drip; tDrip >= 1 && near.length; tDrip -= 1) { const f = near[(rnd() * near.length) | 0]; addDrop(f.x0 + (f.x1 - f.x0) * 0.1 + (rnd() - 0.5) * 0.3, 2.95, f.z0 + (f.z1 - f.z0) * rnd(), 0, 0, 0, 0); }
        tDrip = Math.min(tDrip, 2);
        for (tRing += dt * ringRate; tRing >= 1 && nearPud.length; tRing -= 1) { const q = nearPud[(rnd() * nearPud.length) | 0], a = rnd() * PI * 2, d = Math.sqrt(rnd()) * q.r * 0.8; addRing(q.x + Math.cos(a) * d, q.z + Math.sin(a) * d, 0.3 + rnd() * 0.3, 0.7 + rnd() * 0.4); }
        tRing = Math.min(tRing, 2);
        if (wet > 0.3 && p.speed > 0.8 && (tSplash -= dt) <= 0) { const q = inPuddle(nearPud, p.x, p.z, 0.4); if (q) { tSplash = p.bike ? 0.1 : 0.17; addRing(p.x, p.z, 0.6, 0.6); if (c.onSplash) c.onSplash(); for (let k = 0; k < 5; k++) addDrop(p.x + (rnd() - 0.5) * 0.4, 0.12, p.z + (rnd() - 0.5) * 0.4, (rnd() - 0.5) * 2.2, 2.2 + rnd() * 1.8, (rnd() - 0.5) * 2.2, 1); } }
        for (const d of drops) {
          if (!d.on) continue; d.vy -= 9.8 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; d.life -= dt;
          if (d.y <= 0.09 || d.life <= 0) { d.on = false; if (d.kind === 0 && wet > 0.1) { addRing(d.x, d.z, 0.18 + rnd() * 0.1, 0.5); if (c.onDrip && Math.abs(d.x - p.x) < 7 && Math.abs(d.z - p.z) < 7) c.onDrip(); } }   // a drip from an awning lands and makes a small ring
        }
        let n = 0; for (const d of drops) { dummy.position.set(d.x, d.on ? d.y : -9, d.z); dummy.scale.set(d.kind ? 0.8 : 0.6, d.kind ? 0.8 : 2.4, d.kind ? 0.8 : 0.6); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); dm.setMatrixAt(n++, dummy.matrix); }
        dm.instanceMatrix.needsUpdate = true;
        rings.forEach((g, i) => { if (g.t < 1) g.t = Math.min(1, g.t + dt / g.life); const r = ring(g.t); dummy.position.set(g.x, 0.1, g.z); dummy.scale.setScalar(g.t >= 1 ? 0.0001 : g.r * r.scale); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); rm.setMatrixAt(i, dummy.matrix); col.setScalar(g.t >= 1 ? 0 : r.fade * 0.8); rm.setColorAt(i, col); });
        rm.instanceMatrix.needsUpdate = true; if (rm.instanceColor) rm.instanceColor.needsUpdate = true;
      }
    };
  }

  window.RoboExploreWater = { build, pure };
})();
