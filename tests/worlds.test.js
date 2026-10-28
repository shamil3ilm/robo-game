// Run: node tests/worlds.test.js  (guards: the Classic three-lane run must keep working beside the Malabar theme; Malabar-only features stay behind the Malabar switch)
const fs = require('fs'), path = require('path'), assert = require('assert');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');
const html = read('index.html'), engine = read('js/engine.js');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok  ' + name); };

t('both worlds can be chosen in Settings, and Classic is one of them', () => { assert.ok(/\[\['classic', 'Classic'\], \['malabar', 'Malabar'\]\]/.test(html)); });
t('the Town, Kitchen and Bills buttons are added only for the Malabar world, so Classic keeps its four buttons', () => {
  const i = html.indexOf("n.label === 'Settings' && set.world === 'malabar'"); assert.ok(i > 0, 'nav is gated');
  const nav = html.slice(html.lastIndexOf('nav: [', i), i); for (const l of ['Missions', 'Characters', 'Badges', 'Settings']) assert.ok(nav.includes("label: '" + l + "'"), l);
  for (const l of ['Town', 'Kitchen', 'Bills']) assert.ok(!nav.includes("label: '" + l + "'"), l + ' must not be in the base list');
});
t('the shoe and battery run boosts apply only in the Malabar world', () => { assert.ok(/const boost = opt\.world !== 'malabar' \? 0 :/.test(engine)); });
t('the clock, the world bend, the backpack and the zone captions are Malabar-only', () => { assert.ok(/opt\.world !== 'malabar'\) return null;\s*\n?\s*const C = window\.RoboClock/.test(engine) || /if \(!clock \|\| !window\.RoboClock \|\| opt\.world !== 'malabar'\) return null;/.test(engine)); assert.ok(/s\.world !== 'malabar'\) return null;/.test(html), 'the backpack is Malabar-only'); });
t('the phone layout: the main buttons sit four to a row, and Town and Bills use emoji (the icon font has no glyph for them)', () => {
  assert.ok(html.includes("navCols: 'repeat(4, minmax(0, 1fr))'")); assert.ok(html.includes("emoji: '🧭', label: 'Town'") && html.includes("emoji: '🧾', label: 'Bills'"));
  assert.ok(!/icon: 'explore'/.test(html) && !/icon: 'receipt_long'/.test(html), 'no icon names the font lacks');
});
console.log('\n' + n + ' tests passed');
