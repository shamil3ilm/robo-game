/* Robo Run: the terminal screen of DEAD SIGNAL, a small simulated computer for the code puzzles. Exposes window.RoboTerminal = { open(o), close(), isOpen() }.
   o = { puzzle: 'm01', mode?: 'tap' | 'type', onSolved(puzzleId), onOpen(), onClose() }.
   The rules live in puzzles.js (pure, tested). This file only draws them: on a phone you tap the wrong line and pick a fix; on a desktop you type commands into a console. The player can switch modes at any time.
   Everything shown is set with textContent, never as HTML, and nothing typed is ever run. */
(function () {
  'use strict';
  if (window.RoboTerminal) return;   // the page loads its scripts twice; one screen only
  let panel = null, keyHandler = null, current = null;
  const h = (tag, style, text, attrs) => { const e = document.createElement(tag); if (style) e.style.cssText = style; if (text != null) e.textContent = text; if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
  const MONO = 'font-family:"JetBrains Mono",ui-monospace,Consolas,monospace';
  const BTN = 'min-height:44px;padding:8px 14px;border:1px solid rgba(143,255,176,0.35);border-radius:10px;background:rgba(10,24,16,0.8);color:#c8ffd8;font-family:Oxanium,sans-serif;font-weight:700;font-size:14px;letter-spacing:0.04em;cursor:pointer;touch-action:manipulation;text-align:left';
  const GREEN = 'background:#7fe8a8;color:#06180d;border-color:transparent';

  function open(o) {
    o = o || {}; if (typeof document === 'undefined') return false;
    const P = window.RoboPuzzles, p = P && P.get(o.puzzle); if (!p) return false;
    close();
    const touch = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    let mode = o.mode === 'tap' || o.mode === 'type' ? o.mode : P.defaultMode({ touch, width: window.innerWidth }), S = null, solved = false;
    current = o;
    panel = h('div', 'position:fixed;inset:0;z-index:62;display:flex;flex-direction:column;background:#050b07;color:#c8ffd8;font-family:Barlow,sans-serif;padding:max(10px,env(safe-area-inset-top)) max(10px,env(safe-area-inset-right)) max(10px,env(safe-area-inset-bottom)) max(10px,env(safe-area-inset-left))', null, { role: 'dialog', 'aria-label': 'Terminal' });
    const bar = h('div', 'display:flex;align-items:center;gap:8px;flex:none');
    const back = h('button', BTN + ';width:48px;padding:0;text-align:center', '✕', { 'aria-label': 'Close the terminal' }); back.onclick = () => close();
    const title = h('div', 'flex:1;min-width:0;font-family:Oxanium,sans-serif;font-weight:800;font-size:16px;letter-spacing:0.05em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap', '💻 ' + p.title);
    const sw = h('button', BTN + ';min-height:44px;padding:6px 10px;font-size:12px;text-align:center'); bar.append(back, title, sw);
    const body = h('div', 'flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:10px;margin-top:8px;padding-right:2px');
    panel.append(bar, body);

    const box = (label) => { const b = h('div', 'border:1px solid rgba(143,255,176,0.25);border-radius:10px;background:#07120b;padding:8px 10px'); b.append(h('div', 'font-family:Oxanium,sans-serif;font-size:11px;letter-spacing:0.14em;color:#5fbf86;margin-bottom:4px', label)); return b; };
    const say = h('div', 'font-size:14px;line-height:1.45;min-height:20px;color:#ffe9b0');

    const render = () => {
      S = S && S.state().mode === mode ? S : P.session(p, mode);
      sw.textContent = mode === 'tap' ? 'Type instead' : 'Tap instead'; sw.style.cssText = BTN + ';min-height:44px;padding:6px 10px;font-size:12px;text-align:center';
      body.textContent = '';
      body.append(h('div', 'font-size:14px;line-height:1.45', p.brief));
      const lg = box('LOG'); for (const l of S.log()) lg.append(h('div', MONO + ';font-size:12px;line-height:1.5;color:' + (/WARNING/.test(l) ? '#ff9a7a' : '#9fe8bd') + ';word-break:break-word', l)); body.append(lg);
      const code = box('CODE'); code.dataset.code = '1';
      const st = S.state();
      for (const ln of S.lines()) {
        const tapOn = mode === 'tap' && st.stage === 'line' && !solved;
        const row = h(tapOn ? 'button' : 'div', MONO + ';font-size:13px;line-height:1.5;display:flex;gap:10px;width:100%;min-height:' + (mode === 'tap' ? '40px' : '22px') + ';align-items:center;padding:2px 6px;border-radius:6px;border:0;background:' + (tapOn ? 'rgba(143,255,176,0.07)' : 'transparent') + ';color:inherit;text-align:left;white-space:pre-wrap;word-break:break-word;margin-bottom:' + (tapOn ? '4px' : '0'), null, tapOn ? { 'aria-label': 'Line ' + ln.n } : null);
        row.append(h('span', 'flex:none;width:18px;text-align:right;color:#5fbf86', String(ln.n)), h('span', 'flex:1', ln.text));
        if (tapOn) row.onclick = () => { const r = S.tapLine(ln.n - 1); say.textContent = r.text; render(); };
        code.append(row);
      }
      body.append(code);
      if (mode === 'tap' && st.stage === 'fix' && !solved) {
        const ch = box('HOW DO YOU FIX IT?'); p.options.forEach((opt, i) => { const b = h('button', BTN + ';display:block;width:100%;margin-bottom:6px', opt.label); b.onclick = () => finish(S.pick(i)); ch.append(b); }); body.append(ch);
      }
      if (mode === 'type' && !solved) {
        const con = box('CONSOLE'); con.append(h('div', MONO + ';font-size:12px;color:#5fbf86;margin-bottom:6px', 'Type help. Example: fix 3 <new code>'));
        const out = h('div', MONO + ';font-size:12px;line-height:1.5;white-space:pre-wrap;word-break:break-word;color:#c8ffd8;max-height:30vh;overflow-y:auto'); out.dataset.out = '1';
        const row = h('div', 'display:flex;gap:8px;align-items:center;margin-top:6px'); row.append(h('span', MONO + ';color:#7fe8a8', '$'));
        const inp = h('input', MONO + ';flex:1;min-width:0;min-height:44px;padding:6px 8px;border-radius:8px;border:1px solid rgba(143,255,176,0.35);background:#020604;color:#e8fff0;font-size:16px', null, { type: 'text', autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false', maxlength: '300', 'aria-label': 'Console command', inputmode: 'text' });
        const go = h('button', BTN + ';text-align:center;padding:8px 12px', 'Run');
        const submit = () => { const v = inp.value; if (!v.trim()) return; out.append(h('div', 'color:#7fe8a8', '$ ' + v)); const r = S.command(v); out.append(h('div', r.ok || r.done ? 'color:#c8ffd8' : 'color:#ffb89a', r.text)); inp.value = ''; out.scrollTop = out.scrollHeight; if (r.done) finish(r); };
        inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); submit(); } });   // the game must not hear what is typed here
        go.onclick = submit; row.append(inp, go); con.append(out, row); body.append(con);
        if (!touch) setTimeout(() => { try { inp.focus(); } catch (e) { /* focus is a courtesy */ } }, 0);
      }
      if (mode === 'tap' && !solved) { const hb = h('button', BTN + ';text-align:center', 'Hint'); hb.onclick = () => { say.textContent = S.hint().text; }; body.append(hb); }
      body.append(say);
      if (solved) { const done = h('button', BTN + ';' + GREEN + ';text-align:center;margin-bottom:6px', 'Continue'); done.onclick = () => close(); body.append(done); }
    };
    const finish = (r) => {
      if (!r.done || solved) { say.textContent = r.text; render(); return; }
      solved = true; render(); say.textContent = '✓ ' + r.text;
      if (current && current.onSolved) current.onSolved(p.id);
    };
    sw.onclick = () => { mode = mode === 'tap' ? 'type' : 'tap'; S = null; render(); };
    document.body.appendChild(panel); render();
    keyHandler = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } };
    window.addEventListener('keydown', keyHandler, true);
    if (o.onOpen) o.onOpen(); return true;
  }

  function close() {
    if (!panel) return false;
    window.removeEventListener('keydown', keyHandler, true); keyHandler = null;
    const o = current; panel.remove(); panel = null; current = null; if (o && o.onClose) o.onClose();
    return true;
  }

  window.RoboTerminal = { open, close, isOpen: () => !!panel };
})();
