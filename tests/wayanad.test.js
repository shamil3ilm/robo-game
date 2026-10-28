// Run: node tests/wayanad.test.js  (the Churam road and Lakkidi layout in src/js/explore_wayanad.js: nine bends, solid hills cut exactly round the open ground, and a real walking path up the whole climb)
const fs = require('fs'), path = require('path'), assert = require('assert');
const load = (f) => { const win = {}; new Function('window', fs.readFileSync(path.join(__dirname, '..', 'src', 'js', f), 'utf8'))(win); return win; };
const W = load('explore_wayanad.js').RoboExploreWayanad, N = load('nav.js').RoboNav;
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok  ' + name); };
const CX = -500, WX = -300, L = W.layout(CX, WX);
const area = (rs) => rs.reduce((s, r) => s + (r[1] - r[0]) * (r[3] - r[2]), 0);
const overlap = (a, b) => Math.min(a[1], b[1]) - Math.max(a[0], b[0]) > 1e-9 && Math.min(a[3], b[3]) - Math.max(a[2], b[2]) > 1e-9;

t('the road climbs in nine legs joined by eight hairpins, east then west, ending at the top going east', () => {
  assert.equal(L.legs.length, 9); assert.equal(L.bends.length, 8);
  L.bends.forEach((b, i) => { assert.equal(b.n, i + 1); assert.equal(b.east, i % 2 === 0); });
  for (let i = 1; i < 9; i++) assert.ok(L.legs[i] < L.legs[i - 1], 'each leg is further north');
  assert.ok(L.gateX > CX + 80 && L.zTop === L.legs[8]);
});
t('the hills are the region minus the open ground: no block touches a road, and block area + open area fills the region', () => {
  for (const reg of [L.hill1, L.hill2]) {
    const blocks = W.carve(reg, L.open); assert.ok(blocks.length > 5);
    for (const b of blocks) for (const o of L.open) assert.ok(!overlap(b, o), 'block ' + b + ' hits open ' + o);
    for (let i = 0; i < blocks.length; i++) for (let j = i + 1; j < blocks.length; j++) assert.ok(!overlap(blocks[i], blocks[j]), 'blocks overlap');
    const clipped = L.open.map((o) => [Math.max(reg[0], o[0]), Math.min(reg[1], o[1]), Math.max(reg[2], o[2]), Math.min(reg[3], o[3])]).filter((o) => o[1] > o[0] && o[3] > o[2]);
    let openArea = 0; const xs = [...new Set(clipped.flatMap((o) => [o[0], o[1]]))].sort((a, b) => a - b); // union area by vertical strips
    for (let i = 0; i < xs.length - 1; i++) { const iv = clipped.filter((o) => o[0] <= xs[i] && o[1] >= xs[i + 1]).map((o) => [o[2], o[3]]).sort((a, b) => a[0] - b[0]); let end = -Infinity, len = 0; for (const [a, b] of iv) { if (b > end) { len += b - Math.max(a, end); end = b; } } openArea += len * (xs[i + 1] - xs[i]); }
    assert.ok(Math.abs(area(blocks) + openArea - area([reg])) < 1e-6, 'area ' + (area(blocks) + openArea) + ' vs ' + area([reg]));
  }
});
t('a walker can climb from the highway junction to the Lakkidi street, and the climb is long (nine bends)', () => {
  const colliders = W.carve(L.hill1, L.open).concat(W.carve(L.hill2, L.open)).map(([x0, x1, z0, z1]) => ({ t: 'box', x0, x1, z0, z1 }));
  const G = N.makeGrid({ x0: -516, x1: -216, z0: -72, z1: 104 }, colliders, 0.55), r = N.route(G, CX, 60, WX, 50);
  assert.ok(r && r.length, 'a path exists'); assert.equal(r.snapped, false);
  assert.ok(r.length > 600 && r.length < 1000, 'the climb is ' + Math.round(r.length) + ' m');
  const tea = N.route(G, WX, 0, WX + 50, 0); assert.ok(tea && tea.length < 120, 'the tea estate is reachable'); const deck = N.route(G, WX, 18, WX - 62, 18); assert.ok(deck && deck.length < 100, 'the view point is reachable');
});
t('the map rectangles carry the roads and the hatched hills', () => {
  const rs = W.hillMapRects(CX, WX, '#9a968e', '#232b1f', []); assert.ok(rs.filter((r) => r[5] === 'hatch').length > 10); assert.ok(rs.length > 30);
});
console.log(n + ' tests passed');
