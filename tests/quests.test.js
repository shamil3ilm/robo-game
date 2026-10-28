// Run: node tests/quests.test.js  (the story data in src/js/story.js and the quest engine in src/js/quests.js)
const fs = require('fs'), path = require('path'), assert = require('assert');
const src = (f) => fs.readFileSync(path.join(__dirname, '..', 'src', 'js', f), 'utf8');
const win = {}; new Function('window', 'localStorage', src('story.js'))(win, null); new Function('window', 'localStorage', src('quests.js'))(win, { getItem: () => null, setItem() {} });
const ex = {}; new Function('window', src('explore.js'))(ex);
const S = win.RoboStory, Lib = win.RoboQuestsLib, EV = Lib.EVENTS;
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok  ' + name); };
const mem = (init) => { let v = init === undefined ? null : init; const store = { get: () => (v === null ? null : JSON.parse(JSON.stringify(v))), set: (x) => { v = JSON.parse(JSON.stringify(x)); }, raw: () => v }; return store; };
const fresh = (store, rewards) => { const got = rewards || []; const e = Lib.create(S, store || mem(), { reward: (r) => got.push(r) }); e.got = got; return e; };
const areaOfX = (x) => (x < -150 ? 'wayanad' : x > 800 ? 'malappuram' : x > 500 ? 'manjeri' : x > 300 ? 'hilite' : x > 100 ? 'city' : 'kozhikode');

t('the story is CHAYA EXPRESS, a delivery story: four open days, ids unique, with a tagline and a content note', () => {
  assert.equal(S.title, 'CHAYA EXPRESS'); assert.ok(S.tagline.length > 10 && S.note.length > 20);
  assert.equal(S.chapters.length, 4); const ids = S.chapters.map((c) => c.id); assert.equal(new Set(ids).size, 4);
  assert.deepEqual(S.chapters.map((c) => c.day), ['Day 1', 'Day 2', 'Day 3', 'Day 4']); assert.ok(S.chapters.every((c) => c.open)); for (const c of S.chapters) { assert.ok(c.title && c.theme && c.summary.length > 20, c.id); assert.ok(ex.RoboExplore.AREAS[c.place], c.id + ' place'); }
  assert.ok(S.quests.some((q) => q.steps.some((s) => s.type === 'job' && s.mode === 'parcel')) && S.quests.some((q) => q.steps.some((s) => s.type === 'job' && s.mode === 'ride')), 'both parcels and the shuttle are in the story');
});
t('every quest hangs together: its chapter exists, it requires only earlier quests, its steps use known events and known characters, rewards are whole numbers', () => {
  const qids = S.quests.map((q) => q.id); assert.equal(new Set(qids).size, qids.length); const seen = new Set();
  for (const q of S.quests) {
    assert.ok(S.chapters.some((c) => c.id === q.chapter), q.id + ' chapter'); for (const r of q.requires) assert.ok(seen.has(r), q.id + ' requires ' + r + ' which comes later or is missing'); seen.add(q.id);
    assert.ok(q.title && q.steps.length >= 1); const sids = q.steps.map((s) => s.id); assert.equal(new Set(sids).size, sids.length, q.id + ' step ids');
    for (const s of q.steps) { assert.ok(EV.includes(s.type), q.id + '.' + s.id + ' type ' + s.type); assert.ok(s.text && s.text.length > 10); if (s.n !== undefined) assert.ok(Number.isInteger(s.n) && s.n >= 1 && s.n <= 50); if (s.type === 'talk') assert.ok(S.npcs[s.npc], q.id + '.' + s.id + ' npc ' + s.npc); if (s.type === 'puzzle') assert.ok(/^[a-z0-9_]{1,20}$/.test(s.puzzle), q.id + '.' + s.id + ' puzzle id'); }
    for (const [k, v] of Object.entries(q.reward || {})) { assert.equal(k, 'coins'); assert.ok(Number.isInteger(v) && v >= 0 && v <= 1000); }
  }
});
t('every character stands inside their area, has a look, an emoji and a role, and a last-resort line, and has a line for every step that asks you to talk to them', () => {
  for (const [id, c] of Object.entries(S.npcs)) {
    assert.ok(c.name && c.emoji && c.role && c.look, id); const b = ex.RoboExplore.AREAS[areaOfX(c.at[0])].bounds; assert.ok(c.at[0] > b.x0 + 1 && c.at[0] < b.x1 - 1 && c.at[1] > b.z0 + 1 && c.at[1] < b.z1 - 1, id + ' is outside its area');
    const rules = S.dialogue[id]; assert.ok(rules && rules.some((r) => !r.when), id + ' has no last-resort line'); for (const r of rules) { assert.ok(r.lines.length >= 1 && r.lines.every((l) => l.length > 10), id); if (r.when && r.when.step) { const [q, s] = r.when.step.split('.'); assert.ok(S.quests.find((x) => x.id === q && x.steps.some((y) => y.id === s)), id + ' rule for a step that does not exist: ' + r.when.step); } if (r.when && r.when.done) assert.ok(S.quests.some((x) => x.id === r.when.done), id + ' rule for a quest that does not exist'); }
  }
  for (const q of S.quests) for (const s of q.steps) if (s.type === 'talk') assert.ok(S.dialogue[s.npc].some((r) => r.when && r.when.step === q.id + '.' + s.id), s.npc + ' has nothing to say at ' + q.id + '.' + s.id);
  for (const [a, b] of Object.entries(S.npcs).flatMap(([i, x], k, all) => all.slice(k + 1).map(([j, y]) => [x, y]))) assert.ok(Math.hypot(a.at[0] - b.at[0], a.at[1] - b.at[1]) > 6, 'two characters stand too close');
});
t('the story keeps its rules: no real company or party names, no landslide, no alcohol, drugs or gambling', () => {
  const all = JSON.stringify(S).toLowerCase();
  for (const bad of ['zil money', 'zilmoney', 'landslide', 'mundakkai', 'chooralmala', 'alcohol', 'whisky', 'whiskey', 'liquor', 'beer', 'cocaine', 'gambl', 'casino', 'lottery', 'bjp', 'muslim league']) assert.ok(!all.includes(bad), 'the story mentions "' + bad + '"');
});
t('a new game starts with the first quest waiting, and the next step is to meet Sreeja in Manjeri', () => {
  const e = fresh(); assert.deepEqual(e.active(), ['welcome']); const nx = e.next(); assert.deepEqual([nx.quest, nx.step, nx.type, nx.npc, nx.area], ['welcome', 'meet', 'talk', 'sreeja', 'manjeri']);
});
t('talking is answered from the state before the talk, and then moves the story on', () => {
  const e = fresh(); const r = e.talk('sreeja'); assert.ok(/Chaya Express/.test(r.card.body)); assert.equal(r.card.title, 'Sreeja'); assert.deepEqual(r.events.map((x) => x.kind), ['step', 'quest']); assert.deepEqual(e.active(), ['first_parcel']);
  const again = e.talk('sreeja'); assert.ok(/button at the desk/.test(again.card.body) && !/whole of Chaya Express/.test(again.card.body), 'now she points you to the desk'); assert.equal(e.talk('nobody'), null);
});
t('events that are not what the current step waits for are ignored; a passenger trip does not count as a parcel', () => {
  assert.deepEqual(fresh().emit('job', { mode: 'parcel' }), [], 'nothing waits for a job before Sreeja has been met');
  const e = fresh(); e.talk('sreeja'); assert.deepEqual(e.emit('pay_upi', {}), []); assert.deepEqual(e.emit('flying', {}), []); assert.deepEqual(e.emit('talk', { npc: 'rayan' }), []);
  assert.deepEqual(e.emit('job', { mode: 'ride' }), [], 'a ride is not a parcel'); assert.deepEqual(e.active(), ['first_parcel']); assert.deepEqual(e.emit('job', { mode: 'parcel' }).map((x) => x.kind), ['step']); assert.equal(e.next().step, 'report');
});
t('Day 1 and Day 2 played through: rewards come once each and chapters finish', () => {
  const rewards = [], e = fresh(mem(), rewards); e.talk('sreeja'); assert.deepEqual(rewards, [{ coins: 20 }]);
  e.emit('job', { mode: 'parcel' }); const rep = e.talk('sreeja'); assert.deepEqual(rep.events.map((x) => x.kind), ['step', 'quest']); assert.deepEqual(rewards, [{ coins: 20 }, { coins: 40 }]);
  const hm = e.talk('hameed'); assert.ok(/chaya/i.test(hm.card.body)); assert.deepEqual(hm.events.map((x) => x.kind), ['step', 'quest', 'chapter']); assert.equal(hm.events[2].chapter, 'd1'); assert.deepEqual(e.active(), ['rounds']);
  for (let i = 0; i < 3; i++) { const ev = e.emit('job', { mode: 'parcel' }); assert.deepEqual(ev.map((x) => x.kind), i < 2 ? ['progress'] : ['step']); }
  assert.deepEqual(e.talk('sreeja').events.map((x) => x.kind), ['step', 'quest']); assert.deepEqual(e.active().sort(), ['bike_care', 'lunch']);
  assert.deepEqual(e.talk('rayan').events.map((x) => x.kind), ['step']); assert.deepEqual(e.emit('charge', {}).map((x) => x.kind), ['step', 'quest']);
  assert.deepEqual(e.emit('buy', { shop: 'snacks', count: 1 }), [], 'another shop does not count'); const eat = e.emit('buy', { shop: 'farsa', count: 2 }); assert.deepEqual(eat.map((x) => x.kind), ['step', 'quest', 'chapter']); assert.equal(eat[2].chapter, 'd2'); assert.deepEqual(e.active(), ['shuttle_start']);
});
t('Day 3 and Day 4: the shuttle counts only passenger trips, then the bus out and back', () => {
  const rewards = [], e = fresh(mem(), rewards); e.talk('sreeja'); e.emit('job', { mode: 'parcel' }); e.talk('sreeja'); e.talk('hameed'); for (let i = 0; i < 3; i++) e.emit('job', { mode: 'parcel' }); e.talk('sreeja'); e.talk('rayan'); e.emit('charge', {}); e.emit('buy', { shop: 'farsa', count: 1 });
  e.talk('sreeja'); assert.deepEqual(e.active(), ['first_fare']); assert.deepEqual(e.emit('job', { mode: 'parcel' }), [], 'a parcel is not a fare'); assert.deepEqual(e.emit('job', { mode: 'ride' }).map((x) => x.kind), ['step']); e.talk('sreeja');
  assert.deepEqual(e.active(), ['shift_change']); for (let i = 0; i < 3; i++) e.emit('job', { mode: 'ride' }); const mini = e.talk('mini'); assert.ok(/shuttle/.test(mini.card.body)); assert.deepEqual(mini.events.map((x) => x.kind), ['step', 'quest', 'chapter']); assert.equal(mini.events[2].chapter, 'd3');
  assert.equal(e.next().step, 'go'); assert.deepEqual(e.emit('area', { area: 'manjeri' }), [], 'the wrong town'); assert.deepEqual(e.emit('area', { area: 'malappuram' }).map((x) => x.kind), ['step']); assert.equal(e.next().area, 'malappuram'); assert.ok(/Malappuram/.test(e.talk('joseph').card.body));
  assert.equal(e.next().step, 'return'); e.emit('area', { area: 'manjeri' }); const end = e.talk('sreeja'); assert.ok(/Same time tomorrow/.test(end.card.body)); assert.deepEqual(end.events.map((x) => x.kind), ['step', 'quest', 'chapter']); assert.equal(end.events[2].chapter, 'd4');
  assert.deepEqual(e.active(), [], 'the story is complete'); assert.equal(e.next(), null); assert.ok(/open/.test(e.talk('sreeja').card.body)); assert.equal(rewards.reduce((a, r) => a + r.coins, 0), 20 + 40 + 15 + 60 + 40 + 20 + 20 + 50 + 80 + 30 + 150);
});
t('the characters stay quiet about the story until their turn', () => {
  const e = fresh(); assert.ok(!/shuttle/.test(e.talk('mini').card.body)); assert.ok(!/EV bay/.test(e.talk('rayan').card.body)); assert.ok(!/Welcome to Malappuram/.test(e.talk('joseph').card.body)); assert.deepEqual(e.active(), ['welcome']);
});
t('the Story tab view shows the title, four days in order (the first active), and steps with done, current, the count and the target', () => {
  const e = fresh(); e.talk('sreeja'); e.emit('job', { mode: 'parcel' }); const v = e.view(); assert.equal(v.title, 'CHAYA EXPRESS'); assert.ok(v.tagline && v.note); assert.equal(v.chapters.length, 4); assert.equal(v.chapters[0].state, 'active');
  const q = v.chapters[0].quests.find((x) => x.id === 'first_parcel'); assert.equal(q.state, 'active'); assert.deepEqual(q.steps.map((s) => [s.done, s.current, s.n]), [[true, false, 1], [false, true, 1]]); assert.deepEqual(q.steps[1].target, { npc: 'sreeja' });
  assert.equal(v.chapters[0].quests.find((x) => x.id === 'welcome').state, 'done'); assert.equal(v.chapters[0].quests.find((x) => x.id === 'chaya').state, 'waiting');
});
t('progress is saved and comes back, and reset clears it', () => {
  const store = mem(), e = fresh(store); e.talk('sreeja'); e.emit('job', { mode: 'parcel' }); const e2 = fresh(store); assert.deepEqual(e2.active(), ['first_parcel']); assert.equal(e2.next().step, 'report');
  e2.reset(); assert.deepEqual(fresh(store).active(), ['welcome']);
});
t('a damaged or hostile save is cleaned: unknown quests, bad step positions, odd flags and long values are dropped', () => {
  const bad = { done: { welcome: true, ghost: true, first_parcel: 'yes' }, step: { chaya: { i: 99, n: 5 }, rounds: { i: 1, n: -4 }, first_parcel: { i: 1, n: 1 }, nonsense: { i: 0, n: 0 } }, flags: { ok_flag: true, 'bad flag!': true, x: 1 }, choices: { ending: 'truth', evil: 'x'.repeat(500), 'bad key': 'a' } };
  const e = fresh(mem(bad)), st = e.state(); assert.deepEqual(Object.keys(st.done), ['welcome']); assert.deepEqual(st.step, { first_parcel: { i: 1, n: 1 } }); assert.deepEqual(st.flags, { ok_flag: true }); assert.deepEqual(st.choices, { ending: 'truth' }); assert.deepEqual(e.active(), ['first_parcel']);
  for (const junk of [null, 'text', 42, [], { done: 7, step: 'x' }]) assert.deepEqual(fresh(mem(junk)).active(), ['welcome']);
});
t('flags and choices are remembered and validated', () => {
  const store = mem(), e = fresh(store); assert.equal(e.flag('met'), false); e.setFlag('met'); e.setFlag('bad flag!'); assert.equal(e.flag('met'), true); assert.equal(e.flag('bad flag!'), false); e.choose('ending', 'third_way'); e.choose('ending2', 5); assert.equal(fresh(store).choice('ending'), 'third_way'); assert.equal(fresh(store).choice('ending2'), null);
});
t('the notify hook hears every change, once per event', () => {
  const heard = [], e = Lib.create(S, mem(), { notify: (ev) => heard.push(ev.map((x) => x.kind).join('+')) }); e.talk('sreeja'); e.emit('job', { mode: 'parcel' }); assert.deepEqual(heard, ['step+quest', 'step']);
});
t('a chapter that is not open yet never starts, even if its steps could be matched', () => {
  const story = { title: 't', chapters: [{ id: 'a', day: 'A', title: 'A', theme: 't', summary: 's', open: true, place: 'kozhikode' }, { id: 'b', day: 'B', title: 'B', theme: 't', summary: 's', open: false, place: 'kozhikode' }], npcs: {}, dialogue: {},
    quests: [{ id: 'one', chapter: 'a', title: 'One', requires: [], reward: {}, steps: [{ id: 's', type: 'job', text: 'Do a job please' }] }, { id: 'two', chapter: 'b', title: 'Two', requires: ['one'], reward: {}, steps: [{ id: 's', type: 'job', text: 'Do another job please' }] }] };
  const e = Lib.create(story, mem(), {}); e.emit('job'); assert.deepEqual(e.active(), [], 'chapter b is closed'); assert.ok(e.isDone('one') && !e.isDone('two'));
});
t('a step with legs names the next pair after each job done', () => {
  const e = fresh(); e.talk('sreeja'); e.emit('job', { mode: 'parcel' }); e.talk('sreeja'); e.talk('hameed');
  const legs = S.quests.find((q) => q.id === 'rounds').steps[0].legs; for (let i = 0; i < 3; i++) { const nx = e.next(); assert.deepEqual([nx.step, nx.from, nx.to], ['three', legs[i][0], legs[i][1]], 'leg ' + i); e.emit('job', { mode: 'parcel' }); }
  assert.equal(e.next().step, 'report');
});
console.log('\n' + n + ' tests passed');
