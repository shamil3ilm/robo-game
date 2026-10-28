// Run: node tests/bend.test.js  (the world-bend maths in src/js/bend.js; the shader itself is checked in the browser)
const fs = require('fs'), path = require('path'), assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'bend.js'), 'utf8');
const win = {}; new Function('window', src)(win); const B = win.RoboBend, K = B.constants;
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok  ' + name); };
const ZL = K.ZL, W0 = ZL;   // the Wayanad zone is the second 750 m block: 750..1500

t('the beach zone and the start of the run are straight', () => { for (const d of [-50, 0, 100, 400, 749]) { assert.equal(B.R(d), 0); assert.equal(B.H(d), 0); } });
t('the Wayanad zone starts and ends straight, so zones join without a kink', () => {
  for (const d of [W0, W0 + 1, ZL * 2 - 1, ZL * 2]) assert.ok(Math.abs(B.R(d)) < 0.05, 'R(' + d + ') = ' + B.R(d));
  assert.ok(Math.abs(B.H(W0)) < 1e-9 && Math.abs(B.H(ZL * 2)) < 1e-9);
});
t('there are nine bends per Wayanad zone, alternating left and right, each as sharp as the amplitude says', () => {
  const peaks = []; let prev = 0, dir = 0;
  for (let d = W0; d <= ZL * 2; d += 0.5) { const r = B.R(d), s = Math.sign(r - prev); if (dir > 0 && s < 0) peaks.push([d, prev]); if (dir < 0 && s > 0) peaks.push([d, prev]); if (s !== 0) dir = s; prev = r; }
  assert.equal(peaks.length, 9, 'bends: ' + peaks.length);
  peaks.forEach((p, i) => { assert.ok(Math.abs(Math.abs(p[1]) - K.A) < 4.5 || i === 0 || i === 8, 'bend ' + (i + 1) + ' reaches ' + p[1]); if (i) assert.ok(Math.sign(p[1]) !== Math.sign(peaks[i - 1][1]), 'bend ' + (i + 1) + ' alternates'); });
});
t('the road never turns more sharply than the shader can draw cleanly (slope under 0.7)', () => { let m = 0; for (let d = W0; d < ZL * 2; d += 0.5) m = Math.max(m, Math.abs(B.R(d + 0.5) - B.R(d)) / 0.5); assert.ok(m < 0.7, 'max slope ' + m); });
t('the climbs roll up and down twice per zone and stay inside the hill height', () => {
  let up = 0, prev = 0, ups = 0; for (let d = W0; d <= ZL * 2; d += 1) { const h = B.H(d); assert.ok(h >= -1e-9 && h <= K.AH * 2 + 1e-6); if (h > prev && !up) { up = 1; ups++; } if (h < prev) up = 0; prev = h; }
  assert.equal(ups, 2);
});
t('hairpin() names the nine bends 1 to 9 at their apexes and nothing outside the zone', () => {
  for (let k = 1; k <= 9; k++) assert.equal(B.hairpin(W0 + B.apex(k)), k);
  assert.equal(B.hairpin(W0 + B.apex(1) + 40), 0, 'between bends'); assert.equal(B.hairpin(300), 0, 'on the beach'); assert.equal(B.hairpin(-5), 0);
  assert.equal(B.hairpin(ZL * 3 + B.apex(4)), 4, 'the second Wayanad zone repeats the nine');
});
t('the apex of bend 1 swings right and bend 2 left (the road turns right first)', () => { assert.ok(B.R(W0 + B.apex(1)) > 0); assert.ok(B.R(W0 + B.apex(2)) < 0); });
t('numbered boards and the two gantries land where the road says', () => {
  for (let k = 1; k <= 9; k++) { assert.equal(B.apexIndex(W0 + B.apex(k), 2.6), k); assert.equal(B.apexIndex(W0 + B.apex(k) + 3, 2.6), 0); }
  assert.equal(B.gantryAt(W0 + 30, 2.6), 'adivaram'); assert.equal(B.gantryAt(W0 + ZL - 30, 2.6), 'lakkidi'); assert.equal(B.gantryAt(W0 + 300, 2.6), ''); assert.equal(B.gantryAt(100, 2.6), '');
  // slots sit every 5 m at any offset: every bend and both gantries must get at least one slot inside the tolerance
  for (let off = 0; off < 5; off += 0.1) { let hits = 0; for (let j = -4; j < 5; j++) if (B.apexIndex(W0 + B.apex(5) + off - 2.5 + j * 5, 2.6) === 5) hits++; assert.ok(hits >= 1, 'offset ' + off); }
});
console.log('\n' + n + ' tests passed');
