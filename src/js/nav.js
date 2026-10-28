/* Robo Run: finding a walking path through the town. Exposes window.RoboNav = { makeGrid, route, lengthFrom, nearestFree }.
   The town is cut into 1 m squares; a square is blocked if a wall, stall, parked vehicle or post (anything in the collider list that does not move) touches it, widened by the walker's radius.
   route() runs A* from the walker to the wanted spot over free squares, then pulls the path straight (a line of sight check) so it has few corners and no zig-zag.
   Pure and tested in Node (tests/nav.test.js). A collider is { t: 'box', x0, x1, z0, z1 } or { t: 'circle', x, z, r, dyn? }; moving ones (dyn) are ignored: people and animals get out of the way. */
(function () {
  'use strict';
  if (window.RoboNav) return;   // the page loads its scripts twice
  const CELL = 1, SQ2 = Math.SQRT2;

  /* the grid of one area: bounds = { x0, x1, z0, z1 }; r = how wide the walker is */
  const makeGrid = (bounds, colliders, r) => {
    r = r === undefined ? 0.55 : r;
    const nx = Math.max(1, Math.ceil((bounds.x1 - bounds.x0) / CELL)), nz = Math.max(1, Math.ceil((bounds.z1 - bounds.z0) / CELL)), blocked = new Uint8Array(nx * nz);
    const cx = (x) => Math.floor((x - bounds.x0) / CELL), cz = (z) => Math.floor((z - bounds.z0) / CELL);
    for (const c of colliders) {
      if (c.dyn) continue;
      if (c.t === 'box') { for (let i = Math.max(0, cx(c.x0 - r)); i <= Math.min(nx - 1, cx(c.x1 + r)); i++) for (let j = Math.max(0, cz(c.z0 - r)); j <= Math.min(nz - 1, cz(c.z1 + r)); j++) { const mx = bounds.x0 + (i + 0.5) * CELL, mz = bounds.z0 + (j + 0.5) * CELL; if (mx > c.x0 - r - CELL / 2 + 0.001 && mx < c.x1 + r + CELL / 2 - 0.001 && mz > c.z0 - r - CELL / 2 + 0.001 && mz < c.z1 + r + CELL / 2 - 0.001) blocked[j * nx + i] = 1; } }
      else if (c.t === 'circle') { const rr = (c.r || 0.4) + r; for (let i = Math.max(0, cx(c.x - rr)); i <= Math.min(nx - 1, cx(c.x + rr)); i++) for (let j = Math.max(0, cz(c.z - rr)); j <= Math.min(nz - 1, cz(c.z + rr)); j++) { const mx = bounds.x0 + (i + 0.5) * CELL, mz = bounds.z0 + (j + 0.5) * CELL; if (Math.hypot(mx - c.x, mz - c.z) < rr + CELL * 0.35) blocked[j * nx + i] = 1; } }
    }
    // the outer ring is the edge of the walkable ground: a walker's centre stays r inside it
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const mx = bounds.x0 + (i + 0.5) * CELL, mz = bounds.z0 + (j + 0.5) * CELL; if (mx < bounds.x0 + r || mx > bounds.x1 - r || mz < bounds.z0 + r || mz > bounds.z1 - r) blocked[j * nx + i] = 1; }
    return { bounds, nx, nz, blocked, cx, cz, free: (x, z) => { const i = cx(x), j = cz(z); return i >= 0 && j >= 0 && i < nx && j < nz && !blocked[j * nx + i]; } };
  };

  /* the free square nearest to a point (a spot inside a wall becomes the doorstep), or null if none within maxR metres */
  const nearestFree = (G, x, z, maxR) => {
    if (G.free(x, z)) return { x, z };
    const R = maxR === undefined ? 20 : maxR; let best = null, bd = Infinity;
    for (let d = 1; d <= R; d++) {
      for (let i = G.cx(x) - d; i <= G.cx(x) + d; i++) for (let j = G.cz(z) - d; j <= G.cz(z) + d; j++) {
        if (Math.max(Math.abs(i - G.cx(x)), Math.abs(j - G.cz(z))) !== d || i < 0 || j < 0 || i >= G.nx || j >= G.nz || G.blocked[j * G.nx + i]) continue;
        const mx = G.bounds.x0 + (i + 0.5) * CELL, mz = G.bounds.z0 + (j + 0.5) * CELL, dd = Math.hypot(mx - x, mz - z); if (dd < bd) { bd = dd; best = { x: mx, z: mz }; }
      }
      if (best && bd <= d) return best;   // nothing in a wider ring can be closer
    }
    return best;
  };

  /* a straight line is clear if every square it crosses is free */
  const clear = (G, ax, az, bx, bz) => {
    const d = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(d / (CELL * 0.4)));
    for (let k = 0; k <= n; k++) { const t = k / n; if (!G.free(ax + (bx - ax) * t, az + (bz - az) * t)) return false; }
    return true;
  };

  /* a minimal binary heap of [f, index] pairs */
  const heap = () => { const a = []; return { size: () => a.length, push(f, v) { a.push([f, v]); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; const t = a[p]; a[p] = a[i]; a[i] = t; i = p; } }, pop() { const top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; const t = a[m]; a[m] = a[i]; a[i] = t; i = m; } } return top; } }; };

  /* the path from (fx, fz) to (tx, tz): { points: [{x, z}...] starting at the walker, length, to: the spot actually reached, snapped: true if the wanted spot was not walkable } or null if there is no way */
  const route = (G, fx, fz, tx, tz) => {
    const B = G.bounds, ox = tx, oz = tz; tx = Math.max(B.x0, Math.min(B.x1, tx)); tz = Math.max(B.z0, Math.min(B.z1, tz));   // a spot outside the ground is first pulled back onto it
    const from = nearestFree(G, fx, fz, 6), to = nearestFree(G, tx, tz, 25); if (!from || !to) return null;
    const snapped = tx !== ox || tz !== oz || !G.free(tx, tz), { nx, nz } = G, si = G.cz(from.z) * nx + G.cx(from.x), gi = G.cz(to.z) * nx + G.cx(to.x);
    const g = new Float32Array(nx * nz).fill(Infinity), prev = new Int32Array(nx * nz).fill(-1), done = new Uint8Array(nx * nz), H = heap();
    const gx = gi % nx, gz = (gi / nx) | 0, h = (i) => { const dx = Math.abs((i % nx) - gx), dz = Math.abs(((i / nx) | 0) - gz); return Math.max(dx, dz) + (SQ2 - 1) * Math.min(dx, dz); };
    g[si] = 0; H.push(h(si), si);
    while (H.size()) {
      const cur = H.pop()[1]; if (done[cur]) continue; done[cur] = 1; if (cur === gi) break;
      const ci = cur % nx, cj = (cur / nx) | 0;
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
        if (!di && !dj) continue; const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= nx || j >= nz) continue; const n = j * nx + i; if (G.blocked[n] || done[n]) continue;
        if (di && dj && (G.blocked[cj * nx + i] || G.blocked[j * nx + ci])) continue;   // no cutting a corner
        const ng = g[cur] + (di && dj ? SQ2 : 1); if (ng < g[n]) { g[n] = ng; prev[n] = cur; H.push(ng + h(n), n); }
      }
    }
    if (!done[gi]) return null;
    const cells = []; for (let i = gi; i !== -1; i = prev[i]) cells.push({ x: G.bounds.x0 + ((i % nx) + 0.5) * CELL, z: G.bounds.z0 + (((i / nx) | 0) + 0.5) * CELL }); cells.reverse();
    cells[0] = { x: from.x, z: from.z }; cells[cells.length - 1] = { x: to.x, z: to.z };
    const pts = [cells[0]]; let a = 0;   // pull the string straight: from each corner, jump to the furthest point in line of sight
    while (a < cells.length - 1) { let b = cells.length - 1; while (b > a + 1 && !clear(G, cells[a].x, cells[a].z, cells[b].x, cells[b].z)) b--; pts.push(cells[b]); a = b; }
    if (Math.hypot(fx - from.x, fz - from.z) > 0.05) pts.unshift({ x: fx, z: fz });
    let length = 0; for (let i = 1; i < pts.length; i++) length += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
    return { points: pts, length, to, snapped };
  };

  /* how much of the path is left from where the walker is now: the distance to the nearest point on the path plus the path after it */
  const lengthFrom = (pts, x, z) => {
    if (!pts || !pts.length) return 0; if (pts.length === 1) return Math.hypot(pts[0].x - x, pts[0].z - z);
    let best = Infinity, at = 0, t0 = 0;
    for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz, t = l2 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2)) : 0, d = Math.hypot(a.x + dx * t - x, a.z + dz * t - z); if (d < best) { best = d; at = i; t0 = t; } }
    let len = best + (1 - t0) * Math.hypot(pts[at + 1].x - pts[at].x, pts[at + 1].z - pts[at].z); for (let i = at + 1; i < pts.length - 1; i++) len += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].z - pts[i].z);
    return len;
  };

  /* how far (m) the walker is from the path */
  const distanceTo = (pts, x, z) => {
    if (!pts || !pts.length) return Infinity; let best = Infinity;
    for (let i = 0; i < Math.max(1, pts.length - 1); i++) { const a = pts[i], b = pts[Math.min(i + 1, pts.length - 1)], dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz, t = l2 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2)) : 0; best = Math.min(best, Math.hypot(a.x + dx * t - x, a.z + dz * t - z)); }
    return best;
  };
  /* points every `step` metres along the path, for the dots drawn on the ground; at most `max` of them */
  const sample = (pts, step, max) => {
    const out = []; if (!pts || pts.length < 2) return out; let into = 0;
    for (let i = 1; i < pts.length && out.length < (max || 200); i++) { const a = pts[i - 1], b = pts[i], d = Math.hypot(b.x - a.x, b.z - a.z); let s = into; while (s < d && out.length < (max || 200)) { out.push({ x: a.x + (b.x - a.x) * (s / d), z: a.z + (b.z - a.z) * (s / d) }); s += step; } into = s - d; }
    return out;
  };

  window.RoboNav = { makeGrid, route, lengthFrom, nearestFree, clear, distanceTo, sample };
})();
