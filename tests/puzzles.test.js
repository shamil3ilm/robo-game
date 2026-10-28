// Run: node tests/puzzles.test.js  (the code puzzles in src/js/puzzles.js)
// The puzzles' own code is run here, in Node, to prove each puzzle is fair. The shipped module never runs anything.
const fs = require('fs'), path = require('path'), assert = require('assert');
const file = fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'puzzles.js'), 'utf8');
const win = {}; new Function('window', file)(win);
const P = win.RoboPuzzles, ids = Object.keys(P.PUZZLES);
const story = {}; new Function('window', fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'story.js'), 'utf8'))(story);
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok  ' + name); };

/* how many of the puzzle's test cases a source passes (a crash counts as a failure) */
const passes = (p, lines) => { let ok = 0; try { const f = new Function(lines.join('\n') + '\nreturn ' + p.fn + ';')(); for (const c of p.cases) { try { if (f(...c.args) === c.expect) ok++; } catch (e) { /* a crash is a failed case */ } } } catch (e) { /* source that does not even parse passes nothing */ } return ok; };

t('the shipped puzzle module never runs text: no eval, no Function, no timers, no network', () => {
  for (const bad of ['eval(', 'new Function', 'Function(', 'setTimeout', 'setInterval', 'fetch(', 'XMLHttpRequest', 'import(', 'document.', 'localStorage']) assert.ok(!file.includes(bad), 'puzzles.js contains ' + bad);
});
t('every puzzle is complete: id matches, title, brief, log, lines, a bug line in range, hints, options and accepted fixes, cases', () => {
  assert.ok(ids.length >= 1);
  for (const id of ids) { const p = P.get(id); assert.equal(p.id, id); assert.ok(p.title && p.brief.length > 20 && p.solved.length > 10); assert.ok(p.log.length >= 2 && p.lines.length >= 3 && p.hints.length >= 2 && p.cases.length >= 4); assert.ok(Number.isInteger(p.bug) && p.bug >= 0 && p.bug < p.lines.length); assert.ok(p.options.length >= 3 && p.options.length <= 5 && p.options.some((o) => o.ok) && p.options.some((o) => !o.ok)); assert.ok(p.accepted.length >= 1); assert.ok(/^\w+$/.test(p.fn)); }
  assert.equal(P.get('nope'), null); assert.equal(P.get('__proto__'), null); assert.equal(P.get('toString'), null);
});
t('every puzzle is fair: the broken code fails, every accepted typed fix and every right choice passes all cases, every wrong choice still fails', () => {
  for (const id of ids) {
    const p = P.get(id), all = p.cases.length;
    assert.ok(passes(p, p.lines) < all, id + ': the broken code must fail at least one case');
    for (const a of p.accepted) assert.equal(passes(p, P.apply(p, a === '' ? null : a)), all, id + ': accepted fix "' + a + '" does not pass');
    for (const o of p.options) { const got = passes(p, P.apply(p, o.lines)); if (o.ok) assert.equal(got, all, id + ': right choice "' + o.label + '" does not pass'); else assert.ok(got < all, id + ': wrong choice "' + o.label + '" actually passes'); }
  }
});
t('every right choice is also an accepted typed fix, so both modes agree', () => {
  for (const id of ids) { const p = P.get(id); for (const o of p.options.filter((x) => x.ok)) assert.ok(P.matchesAccepted(p, o.lines === null ? '' : o.lines), id + ': "' + o.label + '" is not accepted when typed'); }
});
t('typed answers are compared as text: spaces and quote style do not matter, extra code and long text do not pass', () => {
  const p = P.get('m01');
  assert.ok(P.matchesAccepted(p, ''), 'delete'); assert.ok(P.matchesAccepted(p, '  // removed '), 'a comment means delete'); assert.ok(P.matchesAccepted(p, "if(account.status==='closed'&&account.legacyHook)return false"), 'spaces, quotes and the semicolon are ignored');
  assert.ok(!P.matchesAccepted(p, 'if (account.status === "closed" && account.legacyHook) return true;')); assert.ok(!P.matchesAccepted(p, 'return false; process.exit()')); assert.ok(!P.matchesAccepted(p, 'x'.repeat(500))); assert.ok(!P.matchesAccepted(p, null) === false, 'null is the same as empty');
  assert.equal(P.normalise("a  'b' ;;"), 'a"b"'); assert.equal(P.normalise(null), '');
});
t('the right mode is chosen by device: touch or a narrow screen gets taps, a desktop gets the console', () => {
  assert.equal(P.defaultMode({ touch: true, width: 1200 }), 'tap'); assert.equal(P.defaultMode({ touch: false, width: 360 }), 'tap'); assert.equal(P.defaultMode({ touch: false, width: 1280 }), 'type'); assert.equal(P.defaultMode(), 'type');
});
t('tap mode: a wrong line teaches without ending the puzzle, a wrong fix does not solve it, the right line then the right fix does', () => {
  const p = P.get('m01'), s = P.session(p, 'tap'); assert.equal(s.state().stage, 'line');
  assert.equal(s.pick(0).ok, false, 'cannot pick a fix before choosing the line'); let r = s.tapLine(0); assert.equal(r.ok, false); assert.ok(/Line 1 looks fine/.test(r.text)); assert.equal(s.tapLine(99).ok, false); assert.equal(s.tapLine(-1).ok, false); assert.equal(s.tapLine('2').ok, false, 'a string is not a line');
  r = s.tapLine(p.bug); assert.ok(r.ok && !r.done); assert.equal(s.state().stage, 'fix'); const wrong = p.options.findIndex((o) => !o.ok); r = s.pick(wrong); assert.equal(r.ok, false); assert.equal(s.state().done, false); assert.equal(s.pick(99).ok, false);
  r = s.pick(p.options.findIndex((o) => o.ok)); assert.ok(r.ok && r.done); assert.equal(s.state().done, true); assert.equal(s.state().tries >= 3, true); assert.equal(s.tapLine(p.bug).ok, false, 'finished');
});
t('type mode: help, show, hint and run guide the player; fix and delete on the wrong line teach; the right fix wins', () => {
  const p = P.get('m01'), s = P.session(p, 'type'); assert.equal(s.state().stage, 'console');
  assert.ok(/fix N/.test(s.command('help').text)); assert.ok(/3  .*legacyHook/.test(s.command('show').text)); const h1 = s.command('hint').text, h2 = s.command('hint').text, h3 = s.command('hint').text, h4 = s.command('hint').text; assert.deepEqual([h1, h2, h3, h4], [p.hints[0], p.hints[1], p.hints[2], p.hints[2]], 'hints get clearer and then repeat the last'); assert.ok(/FAILED/.test(s.command('run').text));
  assert.ok(/Line 2 looks fine/.test(s.command('fix 2 return false;').text)); assert.ok(/no line 9/.test(s.command('delete 9').text)); assert.ok(/Type the new code/.test(s.command('fix 3').text)); assert.ok(/which line/i.test(s.command('delete').text)); assert.ok(/do not know/.test(s.command('format c:').text)); assert.ok(/does not fix/.test(s.command('fix 3 return true;').text));
  assert.equal(s.command('').ok, false); assert.equal(s.state().done, false);
  const r = s.command('delete 3'); assert.ok(r.ok && r.done); assert.equal(s.command('delete 3').ok, false, 'already fixed');
  const s2 = P.session(p, 'type'); assert.ok(s2.command('FIX 3 if (account.status === \'closed\' && account.legacyHook) return false').done, 'upper case command, single quotes, no semicolon');
});
t('modes do not cross: taps do nothing in the console and typing does nothing in tap mode; an odd mode becomes tap', () => {
  const p = P.get('m01'); const tap = P.session(p, 'tap'), typ = P.session(p, 'type'); assert.equal(tap.command('delete 3').ok, false); assert.equal(typ.tapLine(p.bug).ok, false); assert.equal(P.session(p, 'hack').state().mode, 'tap');
  assert.equal(P.session(p, 'type').command(undefined).ok, false); assert.equal(P.session(p, 'type').command({}).ok, false);
});
t('every puzzle the story waits for exists (the delivery story waits for none: the puzzles are kept for the thriller, DEAD SIGNAL, which is not in the game for now)', () => {
  const wanted = story.RoboStory.quests.flatMap((q) => q.steps.filter((s) => s.type === 'puzzle').map((s) => s.puzzle));
  for (const w of wanted) assert.ok(P.get(w), 'the story waits for puzzle ' + w + ' which does not exist');
});
console.log('\n' + n + ' tests passed');
