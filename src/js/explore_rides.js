/* Robo Run: the pure rules for taking an auto or a bus in the walkable town (explore.js): roads as a small graph, shortest routes, fares and the meter, and where a vehicle is along its route.
   Exposes window.RoboExploreRides = { route, pathAt, length, fareFor, meterAt, ETA, SPEED }. Fares follow the pick-up and drop-off meter idea of Hey Auto (a base fare plus a distance fare); the town is small, so 100 m counts as one "kilometre". */
(function () {
  'use strict';
  const BASE = 30, PER_100M = 15, SPEED = 8.5;   // rupees, rupees, metres per second (an auto at about 30 km/h)
  const fareFor = (dist) => Math.round(BASE + PER_100M * (dist / 100));
  const meterAt = (dist, travelled) => Math.min(fareFor(dist), Math.round(BASE + PER_100M * (travelled / 100)));   // the meter starts at the base fare and ticks up with the distance, never past the final fare
  const ETA = (dist) => Math.ceil(dist / SPEED);

  const length = (pts) => { let d = 0; for (let i = 1; i < pts.length; i++) d += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return d; };
  /* graph = { nodes: { id: [x, z] }, edges: [[a, b], ...] }; returns { ids, points, dist } for the shortest road route, or null if the two are not connected */
  const route = (graph, from, to) => {
    if (!graph.nodes[from] || !graph.nodes[to]) return null;
    const adj = {}; for (const id in graph.nodes) adj[id] = [];
    for (const [a, b] of graph.edges) { const w = Math.hypot(graph.nodes[a][0] - graph.nodes[b][0], graph.nodes[a][1] - graph.nodes[b][1]); adj[a].push([b, w]); adj[b].push([a, w]); }
    const dist = {}, prev = {}, todo = new Set(Object.keys(graph.nodes)); for (const id of todo) dist[id] = Infinity; dist[from] = 0;
    while (todo.size) {
      let u = null; for (const id of todo) if (u === null || dist[id] < dist[u]) u = id;
      if (u === null || dist[u] === Infinity) break; todo.delete(u); if (u === to) break;
      for (const [v, w] of adj[u]) if (dist[u] + w < dist[v]) { dist[v] = dist[u] + w; prev[v] = u; }
    }
    if (dist[to] === Infinity) return null;
    const ids = []; for (let u = to; u !== undefined; u = prev[u]) ids.unshift(u);
    const points = ids.map((id) => graph.nodes[id].slice());
    return { ids, points, dist: length(points) };
  };
  /* the position and heading (the direction of travel as a unit vector) after travelling s metres along a polyline */
  const pathAt = (pts, s) => {
    if (pts.length < 2) return { x: pts[0][0], z: pts[0][1], dx: 0, dz: -1, done: true };
    let left = Math.max(0, s);
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], seg = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-9;
      if (left <= seg || i === pts.length - 1) { const t = Math.min(1, left / seg); return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, dx: (b[0] - a[0]) / seg, dz: (b[1] - a[1]) / seg, done: left >= seg && i === pts.length - 1 }; }
      left -= seg;
    }
  };
  /* the path shifted to the driver's left (India drives on the left): off metres to the left of the direction of travel, segment by segment */
  const laneOffset = (pts, off) => pts.map((p, i) => { const a = pts[Math.min(i, pts.length - 2)], b = pts[Math.min(i, pts.length - 2) + 1], d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [p[0] + (off * (b[1] - a[1])) / d, p[1] - (off * (b[0] - a[0])) / d]; });

  /* ---- the stops: auto stands on each town's main road, and the KSRTC counters. Coordinates are in explore.js's world (Manjeri is 200 m east). Names are places that exist in the game's town. ---- */
  const MANJERI_X = 600, CITY_X = 200, HILITE_X = 400;   // the other areas of the town, west to east: the city 200 m, HiLITE City 400 m, Manjeri 600 m from the beach town
  const GRAPHS = {
    kozhikode: { nodes: { beach: [0, 52], mid: [0, 6], north: [0, -52] }, edges: [['beach', 'mid'], ['mid', 'north']] },
    manjeri: { nodes: { zil: [MANJERI_X, -110], town: [MANJERI_X, -6], college: [MANJERI_X, 30], budget: [MANJERI_X, 92] }, edges: [['zil', 'town'], ['town', 'college'], ['college', 'budget']] },
    city: { nodes: { station: [CITY_X, -40], mid: [CITY_X, 0], stand: [CITY_X, 32] }, edges: [['station', 'mid'], ['mid', 'stand']] },
    hilite: { nodes: { park: [HILITE_X, -34], mall: [HILITE_X, -10], bypass: [HILITE_X, 34] }, edges: [['park', 'mall'], ['mall', 'bypass']] }
  };
  const STOPS = {
    kz_beach: { area: 'kozhikode', node: 'beach', name: 'Beach promenade', local: 'ബീച്ച് നടപ്പാത', x: -0.6, z: 52 },
    kz_mid: { area: 'kozhikode', node: 'mid', name: 'Mittai Theruvu, middle', local: 'മിഠായിത്തെരുവ്', x: -0.6, z: 6 },
    kz_north: { area: 'kozhikode', node: 'north', name: 'Mittai Theruvu, north end', local: 'മിഠായിത്തെരുവ്', x: -0.6, z: -52 },
    mj_zil: { area: 'manjeri', node: 'zil', name: 'Zilla Money, north end', local: 'സില്ല മണി', x: MANJERI_X - 0.6, z: -110 },
    mj_town: { area: 'manjeri', node: 'town', name: 'Manjeri Junction', local: 'മഞ്ചേരി ജങ്ഷൻ', x: MANJERI_X - 0.6, z: -6 },
    mj_college: { area: 'manjeri', node: 'college', name: 'Government Medical College', local: 'ഗവ. മെഡിക്കൽ കോളേജ്', x: MANJERI_X - 0.6, z: 30 },
    mj_budget: { area: 'manjeri', node: 'budget', name: 'Budget Hyper Market, south end', local: 'ബജറ്റ് ഹൈപ്പർ മാർക്കറ്റ്', x: MANJERI_X - 0.6, z: 92 },
    cy_station: { area: 'city', node: 'station', name: 'Kozhikode railway station', local: 'റെയിൽവേ സ്റ്റേഷൻ', x: CITY_X - 0.6, z: -40 },
    cy_mid: { area: 'city', node: 'mid', name: 'Mavoor Road, middle', local: 'മാവൂർ റോഡ്', x: CITY_X - 0.6, z: 0 },
    cy_stand: { area: 'city', node: 'stand', name: 'Kozhikode KSRTC Bus Stand', local: 'കെഎസ്ആർടിസി ബസ് സ്റ്റാൻഡ്', x: CITY_X - 0.6, z: 32 },
    hl_park: { area: 'hilite', node: 'park', name: 'HiLITE Business Park', local: 'ഹൈലൈറ്റ് ബിസിനസ് പാർക്ക്', x: HILITE_X - 0.6, z: -34 },
    hl_mall: { area: 'hilite', node: 'mall', name: 'HiLITE Mall', local: 'ഹൈലൈറ്റ് മാൾ', x: HILITE_X - 0.6, z: -10 },
    hl_bypass: { area: 'hilite', node: 'bypass', name: 'HiLITE bus stop', local: 'ബസ് സ്റ്റോപ്പ്', x: HILITE_X - 0.6, z: 34 }
  };
  /* the bus network: a ticket counter at each stop, and the links between them (fares and times are game values, not published fares: the real runs are about 4 km and about 45 km) */
  const BUS_STOPS = {
    kz_ksrtc: { area: 'kozhikode', name: 'Kozhikode Beach bus stop', x: -21, z: 62.6, arrive: [-21, 59.6] },
    cy_ksrtc: { area: 'city', name: 'Kozhikode KSRTC Bus Stand', x: CITY_X + 9.5, z: 33.6, arrive: [CITY_X + 9.5, 36.6] },
    mj_ksrtc: { area: 'manjeri', name: 'Manjeri KSRTC stand', x: MANJERI_X + 32.5, z: 8.6, arrive: [MANJERI_X + 35, 9.2] },
    hl_ksrtc: { area: 'hilite', name: 'HiLITE City bus stop', x: HILITE_X + 9.5, z: 39.5, arrive: [HILITE_X + 9.5, 43.5] },
    mp_ksrtc: { area: 'malappuram', name: 'Malappuram KSRTC Bus Terminal', x: 870, z: -7.8, arrive: [870, -3] },   // Malappuram stands at x = 900 (explore.js MALAPPURAM_X)
    wy_ksrtc: { area: 'wayanad', name: 'Lakkidi bus stop', x: -290.5, z: 51.6, arrive: [-290.5, 55] }   // Wayanad stands at x = -300 (explore.js WAYANAD_X)
  };
  const BUS_LINKS = [{ a: 'kz_ksrtc', b: 'cy_ksrtc', fare: 15, hours: 0.4 }, { a: 'kz_ksrtc', b: 'mj_ksrtc', fare: 45, hours: 1.5 }, { a: 'cy_ksrtc', b: 'mj_ksrtc', fare: 45, hours: 1.5 }, { a: 'kz_ksrtc', b: 'hl_ksrtc', fare: 25, hours: 0.6 }, { a: 'cy_ksrtc', b: 'hl_ksrtc', fare: 20, hours: 0.5 }, { a: 'mj_ksrtc', b: 'hl_ksrtc', fare: 45, hours: 1.4 }, { a: 'kz_ksrtc', b: 'wy_ksrtc', fare: 60, hours: 1.8 }, { a: 'cy_ksrtc', b: 'wy_ksrtc', fare: 55, hours: 1.6 }, { a: 'mj_ksrtc', b: 'wy_ksrtc', fare: 50, hours: 1.7 }, { a: 'hl_ksrtc', b: 'wy_ksrtc', fare: 50, hours: 1.5 }, { a: 'mj_ksrtc', b: 'mp_ksrtc', fare: 40, hours: 1.0 }, { a: 'kz_ksrtc', b: 'mp_ksrtc', fare: 55, hours: 1.4 }, { a: 'cy_ksrtc', b: 'mp_ksrtc', fare: 50, hours: 1.3 }, { a: 'hl_ksrtc', b: 'mp_ksrtc', fare: 45, hours: 1.2 }, { a: 'wy_ksrtc', b: 'mp_ksrtc', fare: 70, hours: 2.0 }];
  const busFrom = (id) => BUS_LINKS.filter((l) => l.a === id || l.b === id).map((l) => { const to = l.a === id ? l.b : l.a; return { to, name: BUS_STOPS[to].name, fare: l.fare, hours: l.hours }; });
  /* the prepaid auto fares from a stand to each other stand of its town: [{ to, name, local, dist, fare, secs, points }] */
  const tripsFrom = (stopId) => {
    const s = STOPS[stopId]; if (!s) return [];
    return Object.keys(STOPS).filter((id) => id !== stopId && STOPS[id].area === s.area).map((id) => {
      const r = route(GRAPHS[s.area], s.node, STOPS[id].node), d = STOPS[id];
      return { to: id, name: d.name, local: d.local, dist: r.dist, fare: fareFor(r.dist), secs: ETA(r.dist), points: r.points };
    });
  };
  window.RoboExploreRides = { route, pathAt, length, fareFor, meterAt, ETA, SPEED, BASE, PER_100M, laneOffset, GRAPHS, STOPS, BUS_STOPS, BUS_LINKS, busFrom, MANJERI_X, CITY_X, HILITE_X, tripsFrom };
})();
