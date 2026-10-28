// Run: node tests/clock.test.js  (the game clock, the temperature and the light by time of day, in src/js/clock.js)
const fs = require('fs'), path = require('path'), assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'clock.js'), 'utf8');
const win = {}; new Function('window', src)(win); const C = win.RoboClock;
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok  ' + name); };

t('times are written the way people read a clock', () => { assert.equal(C.fmt(16.5), '4:30 pm'); assert.equal(C.fmt(0), '12:00 am'); assert.equal(C.fmt(12), '12:00 pm'); assert.equal(C.fmt(13.25), '1:15 pm'); assert.equal(C.fmt(23.99), '11:59 pm'); assert.equal(C.fmt(6.05), '6:03 am'); assert.equal(C.fmt(24.5), '12:30 am'); });
t('the day has named parts, each with an icon', () => {
  const at = (h) => C.phase(h); assert.equal(at(5.5), 'Dawn'); assert.equal(at(9), 'Morning'); assert.equal(at(12.5), 'Midday'); assert.equal(at(15), 'Afternoon'); assert.equal(at(17), 'Evening'); assert.equal(at(19), 'Dusk'); assert.equal(at(22), 'Night'); assert.equal(at(2), 'Night');
  for (let h = 0; h < 24; h += 0.25) assert.ok(C.icon(h).length > 0, 'icon at ' + h);
});
t('Kozhikode is hottest in the early afternoon and coolest before dawn, within a believable coastal range', () => {
  const T = (h) => C.temperature('kozhikode', h); assert.ok(T(14.5) >= 31 && T(14.5) <= 33, 'peak ' + T(14.5)); assert.ok(T(5) >= 24 && T(5) <= 26, 'low ' + T(5));
  for (let h = 6; h < 14; h += 1) assert.ok(T(h + 1) >= T(h), 'warming up through the morning at ' + h);
  for (let h = 15; h < 23; h += 1) assert.ok(T(h + 1) <= T(h), 'cooling through the evening at ' + h);
});
t('the Wayanad ghat is always cooler than the coast, and inland Manjeri swings a little more than Kozhikode', () => {
  for (let h = 0; h < 24; h += 1) assert.ok(C.temperature('wayanad', h) < C.temperature('kozhikode', h), 'at ' + h);
  assert.ok(C.temperature('manjeri', 14.5) - C.temperature('manjeri', 5) > C.temperature('kozhikode', 14.5) - C.temperature('kozhikode', 5));
  assert.equal(typeof C.temperature('nowhere', 12), 'number');
});
t('the light is bright at noon, golden in the evening, dark at night, and the street lamps come on after dusk', () => {
  const L = C.light; assert.ok(L(12).sun.intensity > L(16.5).sun.intensity); assert.ok(L(16.5).sun.intensity > L(20).sun.intensity); assert.ok(L(2).hemi.intensity < L(12).hemi.intensity);
  assert.equal(L(12).lamps, 0); assert.equal(L(22).lamps, 1); assert.ok(L(18.5).lamps > 0 && L(18.5).lamps < 1, 'lamps fade up at dusk');
  assert.ok(L(16.5).sun.color[0] > L(16.5).sun.color[2], 'golden hour light is warm (more red than blue)');
});
t('the light has no jump where the clock wraps from midnight to midnight, nor anywhere in the day', () => {
  const a = C.light(0), b = C.light(24); assert.ok(Math.abs(a.sun.intensity - b.sun.intensity) < 1e-9 && Math.abs(a.bg[0] - b.bg[0]) < 1e-9);
  let prev = C.light(0); for (let h = 0.1; h <= 24; h += 0.1) { const l = C.light(h); assert.ok(Math.abs(l.sun.intensity - prev.sun.intensity) < 0.25, 'smooth at ' + h); assert.ok(Math.abs(l.hemi.intensity - prev.hemi.intensity) < 0.25); prev = l; }
});
t('the clock runs at one game minute per few real seconds, wraps at midnight, and can be set', () => {
  const c = C.create({ hours: 23.9, secsPerMinute: 4 }); c.tick(4 * 60 * 0.2); assert.ok(Math.abs(c.hours() - 0.1) < 1e-6, 'wrapped to ' + c.hours());
  const d = C.create({ hours: 12, secsPerMinute: 4 }); d.tick(4); assert.ok(Math.abs(d.hours() - (12 + 1 / 60)) < 1e-9); d.set(5.5); assert.equal(d.hours(), 5.5); d.set(30); assert.equal(d.hours(), 6);
  assert.equal(C.create().hours() >= 0, true);
});
t('KSEB charging is billed by the unit at one rate by day and a higher one from 4 pm to 9 am, dearer for fast (DC) than slow (AC)', () => {
  assert.deepEqual(C.evTariff(10), { ac: 8.5, dc: 16.5, band: 'Day (9 am to 4 pm)' }); assert.deepEqual(C.evTariff(17), { ac: 14.23, dc: 23.23, band: 'Evening and night (4 pm to 9 am)' });
  assert.equal(C.evTariff(8.99).ac, 14.23); assert.equal(C.evTariff(9).ac, 8.5); assert.equal(C.evTariff(15.99).ac, 8.5); assert.equal(C.evTariff(16).ac, 14.23); assert.equal(C.evTariff(2).dc, 23.23);
});
console.log('\n' + n + ' tests passed');
