/* Robo Run: the quest engine. Exposes window.RoboQuests = the engine for window.RoboStory (an instance, saved under 'runaway.story'), and window.RoboQuestsLib = { create, EVENTS }.
   It knows nothing about the game: the game tells it what happened with emit(type, data) (a delivery finished, a payment by GPay, a talk with someone) and it advances whichever quest step is waiting for that.
   Everything is pure and tested in Node (tests/quests.test.js); the game and the Story tab only call the functions below.
     emit(type, data)   -> a list of what changed: { kind: 'step' | 'quest' | 'chapter', ... }
     talk(npc)          -> what the character says now (from the state BEFORE this talk), and the changes the talk caused
     view()             -> chapters, quests and steps for the Story tab
     next()             -> the step to do now (for "show the way"), or null
   Rewards are given once, through hooks.reward({ coins }) ; hooks.notify(events) hears every change. */
(function () {
  'use strict';
  const EVENTS = ['talk', 'puzzle', 'job', 'pay_upi', 'buy', 'area', 'sell_scrap', 'scrap_pick', 'ride', 'charge', 'cook', 'run', 'spend'];
  const areaOfX = (x) => (x < -150 ? 'wayanad' : x > 800 ? 'malappuram' : x > 500 ? 'manjeri' : x > 300 ? 'hilite' : x > 100 ? 'city' : 'kozhikode');   // the same split as explore.js
  const blank = () => ({ v: 1, done: {}, step: {}, flags: {}, choices: {} });

  function create(story, store, hooks) {
    hooks = hooks || {};
    const byId = {}; for (const q of story.quests) byId[q.id] = q;
    const chapterOf = {}; for (const c of story.chapters) chapterOf[c.id] = c;
    const clean = (raw) => {   // a damaged or hostile save becomes an empty one, and only known quests and step positions survive
      const st = blank(); if (!raw || typeof raw !== 'object') return st;
      for (const id of Object.keys(raw.done || {})) if (byId[id] && raw.done[id] === true) st.done[id] = true;
      /* progress only counts in a quest that has unlocked */
      for (const id of Object.keys(raw.step || {})) { const q = byId[id], s = raw.step[id]; if (!q || !s || st.done[id] || !(q.requires || []).every((r) => st.done[r])) continue; const i = Math.floor(Number(s.i)), n = Math.floor(Number(s.n)); if (i >= 0 && i < q.steps.length) st.step[id] = { i, n: n >= 0 && n < 1e6 ? n : 0 }; }
      for (const k of Object.keys(raw.flags || {})) if (raw.flags[k] === true && /^[a-z0-9_]{1,40}$/.test(k)) st.flags[k] = true;
      for (const k of Object.keys(raw.choices || {})) if (/^[a-z0-9_]{1,40}$/.test(k) && typeof raw.choices[k] === 'string' && raw.choices[k].length <= 40) st.choices[k] = raw.choices[k];
      return st;
    };
    let st = clean(store && store.get ? store.get() : null);
    const save = () => { if (store && store.set) store.set(st); };

    const open = (q) => !!(chapterOf[q.chapter] && chapterOf[q.chapter].open);
    const ready = (q) => open(q) && !st.done[q.id] && (q.requires || []).every((r) => st.done[r]);
    const prog = (q) => st.step[q.id] || { i: 0, n: 0 };
    const stepNow = (q) => q.steps[prog(q).i];
    const active = () => story.quests.filter(ready);
    const chapterDone = (cid) => story.quests.filter((q) => q.chapter === cid).every((q) => st.done[q.id]) && story.quests.some((q) => q.chapter === cid);

    const matches = (step, type, data) => {
      if (step.type !== type) return 0; data = data || {};
      switch (type) {
        case 'talk': return step.npc === data.npc ? 1 : 0;
        case 'job': return !step.mode || step.mode === (data.mode || 'parcel') ? 1 : 0;   // a parcel delivery or a passenger trip
        case 'puzzle': return step.puzzle === data.id ? 1 : 0;
        case 'buy': return !step.shop || step.shop === data.shop ? Math.max(1, Math.floor(data.count) || 1) : 0;
        case 'area': return step.area === data.area ? 1 : 0;
        case 'ride': return !step.mode || step.mode === data.mode ? 1 : 0;
        case 'cook': return !step.dish || step.dish === data.dish ? 1 : 0;
        case 'sell_scrap': case 'scrap_pick': return Math.max(1, Math.floor(data.count) || 1);
        default: return 1;
      }
    };
    const emit = (type, data) => {
      const out = [];
      if (EVENTS.indexOf(type) < 0) return out;
      for (const q of active()) {
        const p = prog(q), step = q.steps[p.i], add = matches(step, type, data); if (!add) continue;
        const n = p.n + add, need = step.n || 1;
        if (n < need) { st.step[q.id] = { i: p.i, n }; out.push({ kind: 'progress', quest: q.id, step: step.id, text: step.text, n, need }); continue; }
        out.push({ kind: 'step', quest: q.id, step: step.id, text: step.text });
        if (p.i + 1 < q.steps.length) { st.step[q.id] = { i: p.i + 1, n: 0 }; continue; }
        delete st.step[q.id]; st.done[q.id] = true;
        out.push({ kind: 'quest', quest: q.id, title: q.title, reward: q.reward || {} });
        if (hooks.reward && q.reward && Object.keys(q.reward).length) hooks.reward(q.reward);
        if (chapterDone(q.chapter)) out.push({ kind: 'chapter', chapter: q.chapter, title: chapterOf[q.chapter].title });
      }
      if (out.length) { save(); if (hooks.notify) hooks.notify(out); }
      return out;
    };

    const ruleMatches = (w) => {
      if (!w) return true;
      if (w.step) { const [qid, sid] = w.step.split('.'), q = byId[qid]; return !!q && ready(q) && stepNow(q).id === sid; }
      if (w.done) return !!st.done[w.done];
      if (w.flag) return !!st.flags[w.flag];
      return false;
    };
    const talk = (npcId) => {
      const npc = story.npcs[npcId]; if (!npc) return null;
      const rules = story.dialogue[npcId] || [], rule = rules.find((r) => r.when && ruleMatches(r.when)) || rules.find((r) => !r.when);
      const card = { title: npc.name, emoji: npc.emoji, body: rule ? rule.lines.join('\n\n') : '', src: '' };
      return { npc: npcId, card, events: emit('talk', { npc: npcId }) };
    };

    const stepView = (q, i) => { const s = q.steps[i], p = prog(q), done = !!st.done[q.id] || i < p.i, cur = !st.done[q.id] && i === p.i && ready(q); return { id: s.id, text: s.text, done, current: cur, n: s.n || 1, progress: done ? (s.n || 1) : cur ? p.n : 0, target: s.type === 'talk' ? { npc: s.npc } : s.type === 'puzzle' ? { puzzle: s.puzzle } : null, type: s.type }; };
    const view = () => ({
      title: story.title, tagline: story.tagline || '', note: story.note || '',
      chapters: story.chapters.map((c) => {
        const qs = story.quests.filter((q) => q.chapter === c.id);
        const state = !c.open ? 'restricted' : chapterDone(c.id) ? 'done' : 'active';
        return { id: c.id, day: c.day, title: c.title, theme: c.theme, summary: c.summary, state, quests: qs.map((q) => ({ id: q.id, title: q.title, reward: q.reward || {}, state: st.done[q.id] ? 'done' : ready(q) ? 'active' : 'waiting', steps: q.steps.map((_, i) => stepView(q, i)) })) };
      })
    });
    const next = () => { const q = active()[0]; if (!q) return null; const s = stepNow(q), leg = s.legs && s.legs.length ? s.legs[Math.min(prog(q).n, s.legs.length - 1)] : null; return { quest: q.id, questTitle: q.title, step: s.id, text: s.text, type: s.type, from: leg ? leg[0] : s.from || null, to: leg ? leg[1] : s.to || null, mode: s.mode || null, npc: s.npc || null, area: s.npc && story.npcs[s.npc] ? areaOfX(story.npcs[s.npc].at[0]) : null }; };
    return {
      emit, talk, view, next, active: () => active().map((q) => q.id), isDone: (id) => !!st.done[id],
      flag: (k) => !!st.flags[k], setFlag(k) { if (/^[a-z0-9_]{1,40}$/.test(k) && !st.flags[k]) { st.flags[k] = true; save(); } },
      choice: (k) => st.choices[k] || null, choose(k, v) { if (/^[a-z0-9_]{1,40}$/.test(k) && typeof v === 'string' && v.length <= 40) { st.choices[k] = v; save(); } },
      setHooks(h) { hooks = h || {}; }, reset() { st = blank(); save(); }, state: () => JSON.parse(JSON.stringify(st))
    };
  }

  const lib = { create, EVENTS };
  window.RoboQuestsLib = lib;
  if (window.RoboStory && !window.RoboQuests) {
    const KEY = 'runaway.story';
    window.RoboQuests = create(window.RoboStory, {
      get() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } },
      set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* the progress is just not remembered */ } }
    });
  }
})();
