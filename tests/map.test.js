// Run: node tests/map.test.js  (the map screen's data and arithmetic in src/js/map.js; the drawing and the panel are checked in the browser)
const fs = require('fs'), path = require('path'), assert = require('assert');
const src = (f) => fs.readFileSync(path.join(__dirname, '..', 'src', 'js', f), 'utf8');
const store = new Map(), ls = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) };
const win = {}; for (const f of ['scrap.js', 'battery.js', 'clock.js', 'explore_rides.js', 'shop.js', 'explore.js', 'map.js']) new Function('window', 'localStorage', src(f))(win, ls);
const M = win.RoboMap, L = win.RoboExplore.layout, RR = win.RoboExploreRides, S = win.RoboShop;
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok  ' + name); };

t('every place on the region sketch is complete and inside the box, and every town area has one', () => {
  for (const [k, p] of Object.entries(M.REGION.nodes)) { for (const f of ['name', 'short', 'local', 'emoji', 'text']) assert.ok(p[f] && p[f].length > 0, k + '.' + f); assert.ok(p.x >= 3 && p.x <= 97 && p.y >= 5 && p.y <= 90, k + ' position'); assert.ok(p.short.length <= 14, k + ' short name'); assert.ok(/[ഀ-ൿ]/.test(p.local), k + ' local name is Malayalam'); }
  for (const a of Object.keys(M.OX)) { assert.ok(M.REGION.nodes[a] && M.REGION.nodes[a].area, a + ' is on the sketch'); assert.ok(L.maps[a], a + ' has a map'); assert.ok(win.RoboExplore.AREAS[a], a + ' is an area'); }
  assert.equal(M.REGION.nodes.wayanad.area, true);
});
t('the sketch has the sea on the left: every town area is east of the coast, and the Churam is north-east of the city and Manjeri south-east (the directions of the real places)', () => {
  const N = M.REGION.nodes; assert.ok(N.wayanad.x > N.city.x && N.wayanad.y < N.city.y, 'Churam north-east of the city'); assert.ok(N.manjeri.x > N.city.x && N.manjeri.y > N.city.y, 'Manjeri south-east'); assert.ok(N.hilite.y > N.city.y && N.hilite.x >= N.city.x, 'HiLITE City south of the city'); assert.ok(N.kozhikode.x < N.city.x, 'the beach is west of the city');
});
t('the bus lines on the sketch are the real ones from the ride data: same fares and times, every end is on the sketch, every area is reachable', () => {
  const edges = M.regionEdges(); assert.equal(edges.length, RR.BUS_LINKS.length);
  for (const e of edges) { assert.ok(M.REGION.nodes[e.a] && M.REGION.nodes[e.b], 'ends exist'); assert.notEqual(e.a, e.b); assert.ok(/^KSRTC ₹\d+ · (\d+ min|\d+ h( \d+ min)?)$/.test(e.label), e.label); }
  const first = edges.find((e) => e.a === 'kozhikode' && e.b === 'city'); assert.equal(first.label, 'KSRTC ₹15 · 24 min'); assert.equal(edges.find((e) => e.a === 'kozhikode' && e.b === 'manjeri').label, 'KSRTC ₹45 · 1 h 30 min');
  for (const a of Object.keys(M.OX)) assert.ok(edges.some((e) => e.a === a || e.b === a), a + ' has a bus');
  assert.ok(M.REGION.nodes[M.REGION.road.from] && M.REGION.nodes[M.REGION.road.to]);
});
t('every kind of shop in the game, and every other kind of spot, gets a category with a heading, an icon and a colour', () => {
  const expect = { snacks: 'eat', farsa: 'eat', oottupura: 'eat', zindagi: 'eat', vanitha: 'eat', rayadhan: 'eat', bombay: 'eat', swamy: 'eat', pharmacy: 'health', scrap: 'services', kseb: 'charging', tools: 'shops', clothes: 'shops', footwear: 'shops', supermarket: 'shops', budget: 'shops' };
  for (const k of S.kinds) { if (k === 'ledger') continue; const c = M.categoryOf({ kind: 'shop', arg: k }); assert.ok(c && M.CATS[c], k + ' -> ' + c); if (expect[k]) assert.equal(c, expect[k], k); else assert.equal(c, 'travel', k + ' (autos and buses)'); }
  const kinds = { door: 'enter', talk: 'people', note: 'learn', job: 'jobs', gate: 'run', charge: 'charging', travel: 'travel', menu: 'home' }; for (const [k, c] of Object.entries(kinds)) assert.equal(M.categoryOf({ kind: k }), c, k);
  assert.equal(M.categoryOf({ kind: 'exit' }), null, 'exit mats are not places'); assert.equal(M.categoryOf(null), null);
  for (const c of Object.values(M.CATS)) { assert.ok(c.title && c.emoji && /^#[0-9a-f]{6}$/i.test(c.color)); }
});
t('place names read well: Enter and Leave come off, the delivery spot is called the desk', () => { assert.equal(M.displayName({ label: 'Enter HiLITE Mall' }), 'HiLITE Mall'); assert.equal(M.displayName({ label: 'Leave Robo\'s dock' }), 'Robo\'s dock'); assert.equal(M.displayName({ label: 'Delivery job' }), 'Delivery desk'); assert.equal(M.displayName({ label: 'Talk to Nadiya' }), 'Nadiya'); assert.equal(M.displayName({ label: 'Auto stand' }), 'Auto stand'); });
t('the list of places groups by kind, keeps only this area, drops exit mats and puts the nearest first', () => {
  const spots = [{ x: 20, z: 40, kind: 'shop', arg: 'tools', label: 'Hardware' }, { x: 2, z: 3, kind: 'shop', arg: 'tools', label: 'Textiles' }, { x: 5, z: 5, kind: 'exit', label: 'Leave' }, { x: 605, z: 0, kind: 'shop', arg: 'pharmacy', label: 'Elsewhere (Manjeri)' }, { x: 1, z: 1, kind: 'note', label: 'A note', emoji: '📜' }];
  const g = M.placesFor(spots, 'kozhikode', { x: 0, z: 0 }); assert.deepEqual(Object.keys(g).sort(), ['learn', 'shops']); assert.deepEqual(g.shops.map((p) => p.name), ['Textiles', 'Hardware']); assert.ok(g.shops[0].d < g.shops[1].d);
  const m = M.placesFor(spots, 'manjeri', null); assert.deepEqual(Object.keys(m), ['health']); assert.equal(m.health[0].d, 0, 'no player, no distances');
});
t('the drawing arithmetic fits every area in the canvas, centres on the player when zoomed, and round-trips', () => {
  for (const a of Object.keys(M.OX)) {
    const A = L.maps[a], F = M.fit(A, 320, 360, 1, null), tl = M.toCanvas(F, A.x0, A.z0), br = M.toCanvas(F, A.x1, A.z1); assert.ok(F.s > 0); assert.ok(tl.x >= -0.01 && tl.y >= -0.01 && br.x <= 320.01 && br.y <= 360.01, a + ' fits'); assert.ok(Math.abs((tl.x + br.x) / 2 - 160) < 0.01 && Math.abs((tl.y + br.y) / 2 - 180) < 0.01, a + ' centred');
    const P = { x: (A.x0 + A.x1) / 2 + 10, z: A.z0 + 20 }, Z = M.fit(A, 320, 360, 2.6, P), c = M.toCanvas(Z, P.x, P.z); assert.ok(Math.abs(c.x - 160) < 1e-9 && Math.abs(c.y - 180) < 1e-9, 'zoom centres on the player'); assert.ok(Z.s > F.s * 2.5);
    const back = M.fromCanvas(Z, 37, 91), again = M.toCanvas(Z, back.x, back.z); assert.ok(Math.abs(again.x - 37) < 1e-9 && Math.abs(again.y - 91) < 1e-9);
  }
});
t('the street and building names are inside their own area, once each, in sizes 1 to 3', () => {
  for (const [a, list] of Object.entries(M.LABELS)) { const A = L.maps[a], ox = M.OX[a], names = list.map((x) => x[0]); assert.equal(new Set(names).size, names.length, a + ' duplicate'); assert.ok(M.AREA_NAME[a]);
    for (const [txt, lx, lz, sz] of list) { assert.ok(txt && [1, 2, 3].includes(sz), txt); assert.ok(ox + lx >= A.x0 && ox + lx <= A.x1 && lz >= A.z0 && lz <= A.z1, a + ': ' + txt + ' is off the map'); } }
  assert.deepEqual(Object.keys(M.LABELS).sort(), Object.keys(M.OX).sort());
});
t('tapping finds the nearest dot within reach, ignores exit mats and empty ground', () => {
  const A = L.maps.kozhikode, F = M.fit(A, 320, 360, 1, null), spots = [{ x: 0, z: 0, kind: 'shop', arg: 'tools', label: 'A' }, { x: 3, z: 0, kind: 'shop', arg: 'tools', label: 'B' }, { x: 0.5, z: 0, kind: 'exit', label: 'X' }];
  const p = M.toCanvas(F, 0.4, 0); assert.equal(M.nearestMarker(F, spots, p.x, p.y, 40).label, 'A'); assert.equal(M.nearestMarker(F, spots, p.x + 200, p.y + 200, 20), null);
  const q = M.toCanvas(F, 0.5, 0); assert.notEqual(M.nearestMarker(F, spots, q.x, q.y, 40).label, 'X');
});
t('visited areas are remembered, unknown names are ignored, and a damaged save is survived', () => {
  store.clear(); assert.deepEqual(M.visited(), {}); M.noteVisit('manjeri'); M.noteVisit('manjeri'); M.noteVisit('mars'); M.noteVisit(''); assert.deepEqual(M.visited(), { manjeri: true });
  store.set('runaway.visited', '{not json'); assert.deepEqual(M.visited(), {}); M.noteVisit('city'); assert.deepEqual(M.visited(), { city: true });
});
t('places that are not open yet are on the sketch as restricted areas: complete, named, in the box, and not crowding anything', () => {
  const all = Object.assign({}, M.REGION.nodes, M.REGION.locked); assert.ok(Object.keys(M.REGION.locked).length >= 3);
  for (const [k, p] of Object.entries(M.REGION.locked)) { assert.ok(!M.REGION.nodes[k], k + ' is not also a place you can go'); for (const f of ['name', 'short', 'local', 'emoji']) assert.ok(p[f], k + '.' + f); assert.ok(/[ഀ-ൿ]/.test(p.local), k + ' Malayalam name'); assert.ok(p.x >= 3 && p.x <= 97 && p.y >= 5 && p.y <= 95, k + ' in the box'); assert.equal(p.area, undefined); }
  const ks = Object.keys(all); for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) assert.ok(Math.hypot(all[ks[i]].x - all[ks[j]].x, all[ks[i]].y - all[ks[j]].y) >= 9, ks[i] + ' is too close to ' + ks[j]);
});
t('the margin round each area (the restricted band) tiles the ring exactly, is the sea only on the beach side, and never covers the walkable ground', () => {
  for (const a of Object.keys(M.OX)) {
    const A = L.maps[a], E = M.expand(A, M.MARGIN), out = M.outerRects(A, M.MARGIN, a), ring = (E.x1 - E.x0) * (E.z1 - E.z0) - (A.x1 - A.x0) * (A.z1 - A.z0);
    const sum = out.reduce((s, [x0, x1, z0, z1]) => s + (x1 - x0) * (z1 - z0), 0); assert.ok(Math.abs(sum - ring) < 1e-6, a + ' ring ' + sum + ' vs ' + ring);
    for (const [x0, x1, z0, z1] of out) { assert.ok(x1 > x0 && z1 > z0); assert.ok(x0 >= E.x0 - 1e-9 && x1 <= E.x1 + 1e-9 && z0 >= E.z0 - 1e-9 && z1 <= E.z1 + 1e-9); assert.ok(!(x0 < A.x1 && x1 > A.x0 && z0 < A.z1 && z1 > A.z0), a + ': a band covers the walkable ground'); }
    const seas = out.filter((r) => r[4] === 'sea').map((r) => r[5]); assert.deepEqual(seas, a === 'kozhikode' ? ['south'] : [], a + ' sea side');
    assert.deepEqual(out.map((r) => r[5]).sort(), ['east', 'north', 'south', 'west']);
  }
  const E = M.expand({ x0: 0, x1: 10, z0: 0, z1: 20 }, 4); assert.deepEqual(E, { x0: -4, x1: 14, z0: -4, z1: 24 });
});
t('a place in another area is reached through the KSRTC stop of the area you are in: every area has one, the right stop is found, and no stop gives nothing', () => {
  const spots = [{ kind: 'shop', arg: 'bus_kz_ksrtc', x: -21, z: 63 }, { kind: 'shop', arg: 'bus_mj_ksrtc', x: 209.5, z: 33.6 }, { kind: 'shop', arg: 'bus_cy_ksrtc', x: -190, z: 40 }, { kind: 'shop', arg: 'bus_hl_ksrtc', x: -390, z: 30 }, { kind: 'shop', arg: 'bus_wy_ksrtc', x: -290.5, z: 51.6 }, { kind: 'shop', arg: 'bus_mp_ksrtc', x: 870, z: -7.8 }, { kind: 'shop', arg: 'snacks', x: 1, z: 1 }];
  for (const a of Object.keys(M.OX)) { const sp = M.busStopSpot(spots, a); assert.ok(sp && sp.arg === M.STOP_ARG[a], a); assert.equal(M.categoryOf(sp), 'travel'); }
  assert.equal(M.busStopSpot(spots, 'manjeri').x, 209.5); assert.equal(M.busStopSpot([], 'manjeri'), null); assert.equal(M.busStopSpot(null, 'city'), null); assert.equal(M.busStopSpot(spots, 'nowhere'), null);
});
t('the real game builds a KSRTC stop in every area (the destination button needs one)', () => {
  const text = ['explore.js', 'explore_manjeri.js', 'explore_city.js', 'explore_hilite.js', 'explore_wayanad.js', 'explore_malappuram.js'].map((f) => src(f)).join('\n');
  for (const arg of Object.values(M.STOP_ARG)) assert.ok(text.includes("arg: '" + arg + "'"), arg + ' is not built anywhere');
});
t('the journey card says how long a walk takes: seconds for a short one, minutes for a long one, and distances read as metres or kilometres', () => {
  assert.equal(M.etaText(0), 'a few seconds'); assert.equal(M.etaText(20), 'a few seconds'); assert.equal(M.etaText(40), 'about 10 s'); assert.equal(M.etaText(105), 'about 25 s'); assert.equal(M.etaText(252), 'about 1 min'); assert.equal(M.etaText(480), 'about 2 min'); assert.equal(M.etaText(-5), 'a few seconds');
  assert.equal(M.fmtD(20), '20 m'); assert.equal(M.fmtD(999.6), '1000 m'); assert.equal(M.fmtD(1500), '1.5 km');
});
console.log('\n' + n + ' tests passed');
