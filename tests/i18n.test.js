// Run: node tests/i18n.test.js  (the Malayalam option in src/js/i18n.js: the dictionary and patterns; the page itself is checked in the browser)
const fs = require('fs'), path = require('path'), assert = require('assert');
const win = {}; new Function('window', fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'i18n.js'), 'utf8'))(win); const I = win.RoboI18n;
const shopWin = {}; for (const f of ['scrap.js', 'battery.js', 'clock.js', 'explore_rides.js', 'shop.js']) new Function('window', fs.readFileSync(path.join(__dirname, '..', 'src', 'js', f), 'utf8'))(shopWin);
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok  ' + name); };
const ml = (s) => /[ഀ-ൿ]/.test(s);

t('English is the default and nothing is swapped until the page asks', () => { assert.equal(I.lang(), 'en'); });
t('every dictionary entry has a real Malayalam translation, never empty and never the English again', () => {
  for (const [k, v] of Object.entries(I.DICT)) { assert.ok(v && v.trim().length > 0, k); assert.ok(ml(v), 'no Malayalam letters for: ' + k); assert.notEqual(v, k); }
  assert.ok(Object.keys(I.DICT).length >= 200, 'at least 200 entries, got ' + Object.keys(I.DICT).length);
});
t('exact text, any case, and the same text with emoji or spaces round it all translate', () => {
  assert.equal(I.tr('START RUN'), 'ഓട്ടം തുടങ്ങൂ'); assert.equal(I.tr('Start run'), 'ഓട്ടം തുടങ്ങൂ'); assert.equal(I.tr('  Missions  '), '  ദൗത്യങ്ങൾ  ');
  assert.equal(I.tr('🧾  MY BILLS'), '🧾  എന്റെ ബില്ലുകൾ'); assert.equal(I.tr('📦  CANCEL DELIVERY'), '📦  ഡെലിവറി റദ്ദാക്കുക');
});
t('text it does not know, text that is already Malayalam, bilingual labels, numbers and icon names stay exactly as they are', () => {
  for (const s of ['Mittai Theruvu · മിഠായിത്തെരുവ്', 'മിഠായിത്തെരുവ്', 'ZIL MONEY', '₹594', '12:00 pm · 31°C · 🔋 96%', 'arrow_back', 'pause', 'receipt_long', 'Some brand new sentence nobody translated', '', '   ']) assert.equal(I.tr(s), s, JSON.stringify(s));
});
t('sentences with numbers and names keep them and become Malayalam', () => {
  assert.equal(I.tr('PAY ₹40 IN CASH'), 'പണമായി ₹40 അടയ്ക്കുക'); assert.equal(I.tr('PAY ₹17 WITH GPAY'), 'GPay വഴി ₹17 അടയ്ക്കുക'); assert.equal(I.tr('SELL FOR ₹126'), '₹126-ന് വിൽക്കുക');
  assert.equal(I.tr('Closed now. Open 8 am to 10 pm.'), 'ഇപ്പോൾ അടച്ചിരിക്കുന്നു. തുറക്കുന്ന സമയം: 8 am മുതൽ 10 pm വരെ.');
  assert.equal(I.tr('Delivered! ₹37 + ₹10 tip'), 'എത്തിച്ചു! ₹37 + ₹10 ടിപ്പ്'); assert.equal(I.tr('Delivered! ₹37'), 'എത്തിച്ചു! ₹37');
  assert.equal(I.tr('Parcel for Church square. Collect it at Spice stall, market lane.'), 'ചർച്ച് സ്ക്വയർ എന്നിടത്തേക്കുള്ള പാഴ്സൽ. സുഗന്ധവ്യഞ്ജനക്കട, ചന്ത ഇടവഴി എന്നിടത്തുനിന്ന് എടുക്കൂ.');
  assert.equal(I.tr('🔋 Battery 80%'), '🔋 ബാറ്ററി 80%'); assert.equal(I.tr('Scrap bag 3 of 30'), 'ആക്രിസഞ്ചി 3/30'); assert.equal(I.tr('Ticket to Manjeri KSRTC stand'), 'മഞ്ചേരി കെഎസ്ആർടിസി സ്റ്റാൻഡ് എന്നിടത്തേക്കുള്ള ടിക്കറ്റ്');
});
t('every pattern produces Malayalam (checked with a sample sentence for each kind)', () => {
  const samples = ['PAY ₹5 IN CASH', 'PAY ₹5 WITH GPAY', 'SELL FOR ₹5', 'Closed now. Open 8 am to 10 pm.', 'Open 8 am to 10 pm (game hours).', 'Ayurvedic herbs. Open 8 am to 10 pm (game hours).', 'Battery 10%. Charge soon: home is free, KSEB bays cost.', 'Charged to 100% at home, free. 6 h 0 min passed.', 'Charged to 80%. 1 h 30 min passed.', 'Battery 5%', 'Scrap bag 1 of 30',
    'Your scrap bag is full (30 of 30). Sell some to the scrap dealer.', 'Delivered! ₹40 + ₹10 tip', 'Picked up. Deliver to Hotel Farsa.', 'Parcel for A. Collect it at B.', 'Collect at Zil Money · ₹40', 'Deliver to Zil Money · ₹40 · 0:30', 'Leave HiLITE Mall', 'Enter HiLITE Mall', 'Auto stand meter ₹30 · 8 s', 'Ticket to Manjeri', 'To HiLITE bus stop', 'Plastic bottles +1 (1 of 30)', 'The prepaid fare was ₹46.', 'Paid in cash ₹40', 'Paid by GPay ₹17 · ref UPI1', 'The dealer paid you ₹126 in cash', 'you have 4'];
  for (const s of samples) { const o = I.tr(s); assert.notEqual(o, s, 'unchanged: ' + s); assert.ok(ml(o), 'no Malayalam: ' + s); }
});
t('the shop screen texts the code really produces are covered (closed message, opening line, trip and ticket lines)', () => {
  const S = shopWin.RoboShop; S.tariffHours = () => 3; const q = S.quote('pharmacy', { x: 1 }, {}, { pool: () => 0 });
  assert.ok(ml(I.tr(q.problems[0])), q.problems[0]); assert.ok(ml(I.tr(S.openLine('tools'))), S.openLine('tools'));
  for (const k of ['bus_kz_ksrtc', 'auto_kz_beach']) for (const it of S.SHOPS[k].items) assert.ok(ml(I.tr(it.name)), it.name);
  S.tariffHours = () => 16.5;
});
t('dates, mission texts and lines joined with a dot are translated piece by piece, keeping numbers and unknown names', () => {
  assert.equal(I.tr('27 Oct, 4:04 pm'), '27 ഒക്ടോബർ, 4:04 pm'); assert.equal(I.tr('3 Jan, 10:30 am'), '3 ജനുവരി, 10:30 am');
  assert.equal(I.tr('Run 1,500 m without a scratch'), 'ഒരു പോറലുമില്ലാതെ 1,500 മീറ്റർ ഓടുക'); assert.equal(I.tr('Dodge 20 blocks in one run'), 'ഒരു ഓട്ടത്തിൽ 20 ബ്ലോക്കുകൾ ഒഴിഞ്ഞുമാറുക'); assert.equal(I.tr('Play 3 runs'), '3 ഓട്ടങ്ങൾ കളിക്കുക'); assert.equal(I.tr('3 of 8 slots'), '3/8 സ്ലോട്ടുകൾ');
  assert.equal(I.tr('🔋 Battery 94% · ♻️ Scrap bag 2 of 30 · 👟 Sports shoes'), '🔋 ബാറ്ററി 94% · ♻️ ആക്രിസഞ്ചി 2/30 · 👟 സ്പോർട്സ് ഷൂസ്');
  assert.equal(I.tr('AK-0001 · Scrap dealer · +₹126'), 'AK-0001 · ആക്രിക്കട · +₹126'); assert.equal(I.tr('KT-0006 · Kozhikode KSRTC Bus Stand · tickets · ₹45'), 'KT-0006 · കോഴിക്കോട് കെഎസ്ആർടിസി ബസ് സ്റ്റാൻഡ് · ടിക്കറ്റുകൾ · ₹45');
  assert.equal(I.tr('ZIL MONEY · Silicon Jeri'), 'ZIL MONEY · Silicon Jeri', 'names with nothing known stay exactly as they are');
});
t('every shop in the game is fully in Malayalam: its blurb, and the name, gloss and description of everything it sells', () => {
  const S = shopWin.RoboShop; S.tariffHours = () => 16.5; const gaps = [];
  const chk = (x) => { if (x && /[A-Za-z]{3,}/.test(x) && I.tr(x) === x) gaps.push(x); };
  for (const k of S.kinds) { const sh = S.SHOPS[k]; if (!sh.items) continue; chk(sh.blurb); for (const it of sh.items) { chk(it.name); chk(it.local); chk(it.desc); } }
  assert.deepEqual(gaps, [], 'untranslated: ' + gaps.join(' | '));
});
t('a shop blurb joined to its opening hours, the barter line and the bill lines are fully translated', () => {
  assert.equal(I.tr('Hot tea and fresh snacks: every Kerala street has one. Open 5 am to 10 pm (game hours).'), 'ചൂടുചായയും പുതിയ പലഹാരങ്ങളും: കേരളത്തിലെ ഓരോ തെരുവിലും ഒരെണ്ണമുണ്ട്. തുറന്നിരിക്കുന്ന സമയം: 5 am മുതൽ 10 pm വരെ (ഗെയിം സമയം).');
  assert.equal(I.tr('▸ Barter: pay with goods from your backpack'), '▸ സാധനങ്ങൾ നൽകി അടയ്ക്കാം: ബാക്ക്പാക്കിലെ സാധനങ്ങൾ'); assert.equal(I.tr('▾ Barter: pay with goods from your backpack (₹9.6)'), '▾ സാധനങ്ങൾ നൽകി അടയ്ക്കാം: ബാക്ക്പാക്കിലെ സാധനങ്ങൾ (₹9.6)');
  assert.equal(I.tr('Banana chips × 2 @ ₹12'), 'ഏത്തക്കായ ഉപ്പേരി × 2 @ ₹12'); assert.equal(I.tr('Barter: Rice × 2 @ ₹9.6'), 'സാധനം നൽകി: അരി × 2 @ ₹9.6'); assert.equal(I.tr('Barter ₹9.6 + cash ₹5'), 'സാധനങ്ങൾ ₹9.6 + പണം ₹5');
});
t('the page is never touched when there is no document (tests, servers) and setting a language there does not throw', () => { assert.doesNotThrow(() => I.set('ml')); assert.equal(I.lang(), 'ml'); assert.doesNotThrow(() => I.set('en')); assert.equal(I.lang(), 'en'); });
t('a second copy of the script does nothing (the page loads each script twice)', () => { const w2 = { RoboI18n: I }; new Function('window', fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'i18n.js'), 'utf8'))(w2); assert.equal(w2.RoboI18n, I); });
console.log('\n' + n + ' tests passed');
