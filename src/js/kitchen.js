/* Robo Run — kitchen: ingredients found on Malabar runs, the backpack, cooking, packed meals and the umbrella.
   Exposes window.RoboKitchen. Saved under the same 'runaway.' prefix as everything else, so backup codes and Start over cover it.
   Player-facing text is English and lives in the tables below. */
(function () {
  'use strict';
  const KEY = 'runaway.kitchen';
  const START_CAP = 8, MAX_CAP = 24, STEP = 4, STACK = 9, DISH_STACK = 3, UPGRADE_BASE = 100;

  const INGREDIENTS = [
    { id: 'coconut', name: 'Coconut', emoji: '🥥' },
    { id: 'banana', name: 'Plantain', emoji: '🍌' },
    { id: 'jaggery', name: 'Jaggery', emoji: '🍯' },
    { id: 'rice', name: 'Rice', emoji: '🍚' },
    { id: 'ghee', name: 'Ghee', emoji: '🧈' },
    { id: 'spice', name: 'Spice mix', emoji: '🌶️' },
    { id: 'tea', name: 'Tea leaves', emoji: '🍵' },
    { id: 'pepper', name: 'Black pepper', emoji: '⚫' },
    { id: 'coffee', name: 'Coffee beans', emoji: '🫘' },
    { id: 'cardamom', name: 'Cardamom', emoji: '🌿' }
  ];
  /* buff: what the meal does at the start of the next run (engine: start({ buff })) */
  const DISHES = [
    { id: 'sulaimani', name: 'Sulaimani tea', emoji: '🍵', need: { tea: 1, spice: 1, jaggery: 1 }, buff: { type: 'magnet', secs: 25 }, desc: 'Pulls in energy cells for 25 seconds' },
    { id: 'halwa', name: 'Kozhikodan halwa', emoji: '🍬', need: { ghee: 1, jaggery: 2, rice: 1 }, buff: { type: 'mult', secs: 30 }, desc: 'Double score for 30 seconds' },
    { id: 'biryani', name: 'Malabar biryani', emoji: '🍛', need: { rice: 2, ghee: 1, spice: 2 }, buff: { type: 'shield', secs: 40 }, desc: 'A shield for the first 40 seconds' },
    { id: 'unnakkaya', name: 'Unnakkaya', emoji: '🍌', need: { banana: 2, coconut: 1, jaggery: 1 }, buff: { type: 'weapon', weapon: 'baton' }, desc: 'Start the run holding a baton' },
    { id: 'wcoffee', name: 'Wayanadan coffee', emoji: '☕', need: { coffee: 2, cardamom: 1, jaggery: 1 }, buff: { type: 'forage' }, desc: 'Twice as many ingredients on the track all run' },
    { id: 'pepperrice', name: 'Pepper ghee rice', emoji: '🥘', need: { rice: 2, ghee: 1, pepper: 2 }, buff: { type: 'sprint', secs: 30 }, desc: 'Run 12% faster for 30 seconds' }
  ];
  const ING = {}, DISH = {};
  INGREDIENTS.forEach((i) => (ING[i.id] = i)); DISHES.forEach((d) => (DISH[d.id] = d));

  const blank = () => ({ cap: START_CAP, items: {}, dishes: {}, meal: null, book: {}, umbrella: false, cooked: 0, found: 0 });
  let K = blank(), bag = {};
  const load = () => {
    let raw = {};
    try { raw = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { raw = {}; }
    K = Object.assign(blank(), raw);
    ['items', 'dishes', 'book'].forEach((k) => { if (!K[k] || typeof K[k] !== 'object') K[k] = {}; });
    K.cap = Math.min(MAX_CAP, Math.max(START_CAP, Math.floor(K.cap) || START_CAP));
  };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(K)); } catch (e) { /* storage full or blocked: the game keeps working, progress just isn't saved */ } };
  const n = (o, id) => o[id] || 0;
  const used = () => Object.keys(K.items).filter((k) => K.items[k] > 0).length + Object.keys(K.dishes).filter((k) => K.dishes[k] > 0).length;
  const upgradeCost = () => (K.cap >= MAX_CAP ? 0 : UPGRADE_BASE * ((K.cap - START_CAP) / STEP + 1));
  const list = (m) => Object.keys(m).map((k) => ING[k].emoji + '×' + m[k]).join('  ');

  const api = {
    INGREDIENTS, DISHES,
    beginRun() { bag = {}; },
    collect(id) { if (!ING[id]) return 0; bag[id] = (bag[id] || 0) + 1; return bag[id]; },
    /* move the run's haul into the backpack; what does not fit (no free slot, stack full) is lost */
    endRun() {
      const added = [], lost = [];
      K.found = (K.found || 0) + Object.keys(bag).reduce((t, k) => t + bag[k], 0);   // everything picked up counts toward costume unlocks, even what did not fit
      for (const id of Object.keys(bag)) {
        let k = bag[id], room = 0;
        if (n(K.items, id) > 0 || used() < K.cap) room = STACK - n(K.items, id);
        const take = Math.max(0, Math.min(k, room));
        if (take) { K.items[id] = n(K.items, id) + take; added.push({ id, n: take }); }
        if (k - take > 0) lost.push({ id, n: k - take });
      }
      bag = {};
      if (added.length || K.found) save();
      const fmt = (a) => a.map((x) => ING[x.id].emoji + '×' + x.n).join('  ');
      return { added, lost, addedLabel: fmt(added), lostLabel: fmt(lost), has: added.length > 0 || lost.length > 0 };
    },
    runCount() { return Object.keys(bag).reduce((s, k) => s + bag[k], 0); },
    /* how many of an ingredient you hold: the backpack plus what was picked up this visit */
    have(id) { return ING[id] ? n(K.items, id) + (bag[id] || 0) : 0; },
    /* hand over `count` of an ingredient (barter): what was picked up this visit first, then the backpack. Takes nothing and returns false if there is not enough. */
    take(id, count) {
      count = Math.floor(Number(count)); if (!ING[id] || !(count >= 1) || api.have(id) < count) return false;
      const fromBag = Math.min(count, bag[id] || 0); if (fromBag) { bag[id] -= fromBag; if (bag[id] <= 0) delete bag[id]; }
      const rest = count - fromBag; if (rest) { K.items[id] = n(K.items, id) - rest; if (K.items[id] <= 0) delete K.items[id]; save(); }
      return true;
    },
    cook(id) {
      const d = DISH[id]; if (!d) return { ok: false, msg: 'Unknown recipe.' };
      for (const k in d.need) if (n(K.items, k) < d.need[k]) return { ok: false, msg: 'You need ' + list(d.need) + ' for ' + d.name + '.' };
      if (n(K.dishes, id) >= DISH_STACK) return { ok: false, msg: 'You already carry ' + DISH_STACK + ' ' + d.name + '. Eat one on a run first.' };
      const items = Object.assign({}, K.items); for (const k in d.need) items[k] -= d.need[k];
      const slots = Object.keys(items).filter((k) => items[k] > 0).length + Object.keys(K.dishes).filter((k) => K.dishes[k] > 0).length;
      if (n(K.dishes, id) === 0 && slots >= K.cap) return { ok: false, msg: 'Your backpack is full. Free a slot or upgrade it.' };
      K.items = items; K.dishes[id] = n(K.dishes, id) + 1; K.book[id] = true; K.cooked++;
      let msg = d.name + ' is ready. ' + d.desc + '.';
      if (!K.umbrella) { K.umbrella = true; msg += ' The stall owner also hands you an umbrella: it opens by itself when you fall.'; }
      save(); return { ok: true, msg };
    },
    /* choose which meal to eat before the next run (tap again to unpack) */
    pack(id) { if (n(K.dishes, id) < 1) return; K.meal = K.meal === id ? null : id; save(); },
    takeMeal() {
      const id = K.meal; if (!id || n(K.dishes, id) < 1) { K.meal = null; return null; }
      K.dishes[id]--; if (K.dishes[id] < 1) K.meal = null;
      save(); const d = DISH[id]; return { id, name: d.name, emoji: d.emoji, desc: d.desc, buff: d.buff };
    },
    hasUmbrella() { return !!K.umbrella; },
    grantUmbrella() { K.umbrella = true; save(); },   // bought in a hardware shop instead of earned by cooking
    /* characters earned by playing (progress.js grants them): Chef after 3 dishes cooked, Forest guide after 25 ingredients found */
    unlocks() { return [K.cooked >= 3 ? 'chef' : null, K.found >= 25 ? 'guide' : null].filter(Boolean); },
    upgrade() {
      const cost = upgradeCost(); if (!cost) return { ok: false, msg: 'Your backpack is as big as it gets.' };
      if (!window.RoboProgress || !window.RoboProgress.spend(cost)) return { ok: false, msg: 'You need ' + cost + ' energy for a bigger backpack.' };
      K.cap += STEP; save(); return { ok: true, msg: 'Backpack upgraded to ' + K.cap + ' slots.' };
    },
    snapshot() {
      const cost = upgradeCost();
      return {
        cap: K.cap, used: used(), slotsLabel: used() + ' of ' + K.cap + ' slots', umbrella: !!K.umbrella, meal: K.meal,
        ingredients: INGREDIENTS.filter((i) => n(K.items, i.id) > 0).map((i) => ({ id: i.id, name: i.name, emoji: i.emoji, n: K.items[i.id] })),
        meals: DISHES.filter((d) => n(K.dishes, d.id) > 0).map((d) => ({ id: d.id, name: d.name, emoji: d.emoji, n: K.dishes[d.id], desc: d.desc, packed: K.meal === d.id })),
        recipes: DISHES.map((d) => ({
          id: d.id, name: d.name, emoji: d.emoji, desc: d.desc, made: !!K.book[d.id],
          need: Object.keys(d.need).map((k) => ({ emoji: ING[k].emoji, name: ING[k].name, want: d.need[k], have: n(K.items, k), ok: n(K.items, k) >= d.need[k] })),
          can: Object.keys(d.need).every((k) => n(K.items, k) >= d.need[k])
        })),
        upgrade: cost ? { cost, label: 'Bigger backpack: +' + STEP + ' slots for ' + cost + ' energy' } : null
      };
    }
  };
  load();
  window.RoboKitchen = api;
})();
