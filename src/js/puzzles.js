/* Robo Run: the code puzzles of DEAD SIGNAL. Exposes window.RoboPuzzles = { PUZZLES, get, defaultMode, normalise, session }.
   A puzzle is a short piece of real code with one wrong line and a log that shows the symptom. It is solved in one of two ways, chosen by device:
     tap  (phones):   tap the wrong line, then pick the right fix from a few choices.
     type (desktop):  a small console: `show`, `hint`, `fix 3 <new code>`, `delete 3`, `run`.
   SAFETY: an answer is only ever compared as text with the accepted fixes (whitespace and quote style ignored). The game NEVER runs what the player types, so nothing typed can reach the page, the device or the network.
   Each puzzle also carries test cases (`fn`, `cases`); tests/puzzles.test.js uses them, in Node, to prove that the broken code really fails, that every accepted fix passes, and that every wrong choice still fails.
   Pure and tested in Node (tests/puzzles.test.js). */
(function () {
  'use strict';
  const PUZZLES = {
    m01: {
      id: 'm01', title: 'Mission 01: The dead account',
      brief: 'A client account was shut down last year, but a message still went out from it at 2:17. Find the line that lets a closed account through.',
      log: [
        '02:17:03 notify: account 4471 status=closed',
        '02:17:03 notify: legacyHook=1, route=ON',
        '02:17:04 notify: sent to console (1 attachment)',
        '02:17:04 WARNING closed account still routed'
      ],
      lines: [
        'function shouldNotify(account, event) {',
        '  if (!event || !event.type) return false;',
        '  if (account.status === "closed" && account.legacyHook) return true;',
        '  if (account.status === "closed") return false;',
        '  return account.notify !== false;',
        '}'
      ],
      bug: 2,   // the line to fix (0-based)
      /* what a tap player can choose between (lines: replacement text, or null = delete the line) */
      options: [
        { label: 'Delete the line', lines: null, ok: true },
        { label: 'Change `&&` to `||`', lines: '  if (account.status === "closed" || account.legacyHook) return true;', ok: false },
        { label: 'Change `return true` to `return null`', lines: '  if (account.status === "closed" && account.legacyHook) return null;', ok: false },
        { label: 'Change `return true` to `return false`', lines: '  if (account.status === "closed" && account.legacyHook) return false;', ok: true }
      ],
      /* what a typing player may write instead of the line (compared as text; an empty answer means delete the line) */
      accepted: ['', 'if (account.status === "closed" && account.legacyHook) return false;'],
      hints: [
        'The log says the account is closed, yet the message went out. Which line decides that?',
        'Look at line 3. A closed account that has a legacy hook returns true.',
        'Delete line 3, or make it return false.'
      ],
      fn: 'shouldNotify',
      cases: [
        { args: [{ status: 'closed', legacyHook: 1 }, { type: 'ping' }], expect: false },
        { args: [{ status: 'closed' }, { type: 'ping' }], expect: false },
        { args: [{ status: 'open' }, { type: 'ping' }], expect: true },
        { args: [{ status: 'open', notify: false }, { type: 'ping' }], expect: false },
        { args: [{ status: 'open' }, {}], expect: false },
        { args: [{ status: 'open' }, null], expect: false }
      ],
      solved: 'Fixed. The old rule that kept sending for accounts with a legacy hook is gone, and a closed account stays closed.'
    }
  };

  const get = (id) => (Object.prototype.hasOwnProperty.call(PUZZLES, id) ? PUZZLES[id] : null);
  /* phones and touch screens get tap-to-fix, everything else gets the typing console; `o` = { touch, width } from the page */
  const defaultMode = (o) => ((o && (o.touch || (o.width && o.width < 700))) ? 'tap' : 'type');
  /* the same text with the same meaning: no spaces, one quote style, no closing semicolon */
  const normalise = (s) => String(s == null ? '' : s).replace(/\s+/g, '').replace(/'/g, '"').replace(/;+$/, '');
  /* a source line with the wrong line replaced (null = deleted); only used to show the result and by the tests */
  const apply = (p, replacement) => p.lines.flatMap((l, i) => (i !== p.bug ? [l] : replacement === null ? [] : [replacement]));
  const matchesAccepted = (p, text) => {
    const t = String(text == null ? '' : text).trim();
    if (t.length > 200) return false;
    if (t === '' || t.slice(0, 2) === '//') return p.accepted.some((a) => normalise(a) === '');
    return p.accepted.some((a) => normalise(a) !== '' && normalise(a) === normalise(t));
  };

  /* one attempt at one puzzle in one mode. Everything it says is plain text, ready to show. */
  function session(p, mode) {
    mode = mode === 'type' ? 'type' : 'tap';
    let stage = mode === 'tap' ? 'line' : 'console', tries = 0, hints = 0, done = false;
    const lineNo = (i) => i + 1;
    const state = () => ({ mode, stage: done ? 'done' : stage, tries, hints, done });
    const win = () => { done = true; stage = 'done'; return { ok: true, done: true, text: p.solved }; };
    const miss = (text) => { tries++; return { ok: false, done: false, text }; };
    const hint = () => { const h = p.hints[Math.min(hints, p.hints.length - 1)]; hints++; return { ok: true, done: false, text: h }; };
    return {
      state, hint, lines: () => p.lines.map((l, i) => ({ n: lineNo(i), text: l })), log: () => p.log.slice(),
      /* tap mode, stage 1: tap a line */
      tapLine(i) {
        if (done || mode !== 'tap' || stage !== 'line') return miss('Nothing to do here.');
        if (!Number.isInteger(i) || i < 0 || i >= p.lines.length) return miss('That is not a line.');
        if (i !== p.bug) return miss('Line ' + lineNo(i) + ' looks fine. Read the log again.');
        stage = 'fix'; return { ok: true, done: false, text: 'Line ' + lineNo(i) + ' is the one. How do you fix it?' };
      },
      /* tap mode, stage 2: pick a fix */
      pick(i) {
        if (done || mode !== 'tap' || stage !== 'fix') return miss('Tap the wrong line first.');
        const o = Number.isInteger(i) ? p.options[i] : null; if (!o) return miss('That is not a choice.');
        return o.ok ? win() : miss('That does not fix it. The closed account would still be routed or something else breaks.');
      },
      /* type mode: one line typed into the console */
      command(text) {
        if (done) return { ok: false, done: true, text: 'Already fixed.' };
        if (mode !== 'type') return miss('Use the taps on a phone.');
        const raw = String(text == null ? '' : text).slice(0, 300).trim(), m = /^(\w+)\s*(.*)$/.exec(raw); if (!m) return { ok: false, done: false, text: 'Type `help` to see what you can do.' };
        const cmd = m[1].toLowerCase(), rest = m[2];
        if (cmd === 'help') return { ok: true, done: false, text: 'show: list the code. hint: a hint. fix N <code>: replace line N. delete N: remove line N. run: test the code.' };
        if (cmd === 'hint') return hint();
        if (cmd === 'show') return { ok: true, done: false, text: p.lines.map((l, i) => lineNo(i) + '  ' + l).join('\n') };
        if (cmd === 'run') return { ok: false, done: false, text: 'FAILED: ' + p.log[p.log.length - 1] };
        if (cmd === 'fix' || cmd === 'delete' || cmd === 'rm') {
          const nm = /^(\d{1,3})\s*(.*)$/.exec(rest); if (!nm) return miss('Say which line: ' + cmd + ' 3' + (cmd === 'fix' ? ' <code>' : ''));
          const n = Number(nm[1]); if (n < 1 || n > p.lines.length) return miss('There is no line ' + n + '.');
          if (n - 1 !== p.bug) return miss('Line ' + n + ' looks fine. Read the log again.');
          const code = cmd === 'fix' ? nm[2] : '';
          if (cmd === 'fix' && !code.trim()) return miss('Type the new code after the line number.');
          return matchesAccepted(p, code) ? win() : miss('That does not fix it. Type `run` to see the failing test, or `hint`.');
        }
        return miss('I do not know "' + cmd + '". Type `help`.');
      }
    };
  }

  window.RoboPuzzles = { PUZZLES, get, defaultMode, normalise, apply, matchesAccepted, session };
})();
