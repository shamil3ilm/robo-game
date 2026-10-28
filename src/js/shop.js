/* Robo Run — roadside shops: what each shop sells and the buying rules. Exposes window.RoboShop. Player-facing text is English (with the Malayalam shop names).
   A shop is `stock(kind, ctx)` → items; `buy(kind, id, ctx)` spends coins and applies the effect. `ctx` supplies the game's side:
     pool()            coins the player can spend right now
     spend(n)          take n coins (true if it worked)
     apply(fx)         apply a run effect in the game (heal, buffs, boots, sickle)
     kitchen, progress the RoboKitchen and RoboProgress modules (umbrella, costumes)
     onUmbrella()      tell the game the umbrella is now owned */
(function () {
  'use strict';

  const COSTUMES = [['mundushirt', 120], ['fisher', 150], ['khaki', 200], ['farmer', 250], ['kasavu', 300], ['footballer', 350]];   // coin prices for the clothes shop (the Chef and Forest guide are earned, not sold)
  const SHOPS = {
    snacks: { name: 'Chaya Kada', local: 'ചായക്കട', emoji: '☕', color: '#a8322a', blurb: 'Hot tea and fresh snacks: every Kerala street has one.', items: [
      { id: 'chips', name: 'Banana chips', local: 'kaya varuthathu', emoji: '🍌', price: 12, desc: 'Pulls in energy cells for 15 seconds', fx: { type: 'magnet', secs: 15 } },
      { id: 'pazham', name: 'Pazhampori', local: 'banana fritter', emoji: '🥞', price: 18, desc: 'Double score for 20 seconds', fx: { type: 'mult', secs: 20 } },
      { id: 'unni', name: 'Unniyappam', local: 'sweet rice fritter', emoji: '🍘', price: 20, desc: 'A shield for 20 seconds', fx: { type: 'shield', secs: 20 } },
      { id: 'karikku', name: 'Tender coconut', local: 'karikku', emoji: '🥥', price: 10, desc: 'Run 12% faster for 25 seconds', fx: { type: 'sprint', secs: 25 } }
    ] },
    pharmacy: { name: 'Vaidyasala', local: 'വൈദ്യശാല', emoji: '🌿', color: '#2f6a3a', blurb: 'Ayurvedic herbs and remedies.', items: [
      { id: 'kashayam', name: 'Herbal kashayam', local: 'herbal decoction', emoji: '🍵', price: 30, desc: 'Restores one heart', fx: { type: 'heal' } },
      { id: 'tulsitea', name: 'Tulsi and ginger tea', local: 'holy basil tea', emoji: '🫖', price: 22, desc: 'Restores one heart', fx: { type: 'heal' } },
      { id: 'balm', name: 'Herbal balm', local: '', emoji: '🧴', price: 22, desc: 'A shield for 25 seconds', fx: { type: 'shield', secs: 25 } }
    ] },
    tools: { name: 'Hardware', local: 'ഹാർഡ്‌വെയർ', emoji: '🛠️', color: '#2a5a8a', blurb: 'Tools for the road ahead.', items: [
      { id: 'boots', name: 'Gumboots', local: 'rubber boots', emoji: '🥾', price: 35, desc: 'Mud cannot slow you for the rest of this run', fx: { type: 'boots' } },
      { id: 'sickle', name: 'Sickle', local: 'aruval', emoji: '🌾', price: 40, desc: 'Cuts through spider webs for the rest of this run', fx: { type: 'sickle' } },
      { id: 'umbrella', name: 'Umbrella', local: 'kuda', emoji: '☂️', price: 120, desc: 'Opens by itself when you fall, and keeps the rain off in town, for good', fx: { type: 'umbrella' } }
    ] },
    clothes: { name: 'Textiles', local: 'വസ്ത്രാലയം', emoji: '👕', color: '#7a2a4a', blurb: 'Mundu and shirt, khaki for the auto stand, the cream-and-gold kasavu of Onam, and work clothes.', items: COSTUMES.map(([id, price]) => ({ id, name: '', local: '', emoji: '👕', price, desc: '', fx: { type: 'costume', id } })) },
    /* counters inside the walkable town's buildings: real names, game prices (nothing here is a real menu or price list) */
    footwear: { name: 'Footwear', local: 'ചെരിപ്പ് കട', emoji: '👟', color: '#6a3a2a', blurb: 'Chappals and sports shoes. The best pair you own is the one you wear.', items: [
      { id: 'chappal', name: 'Rubber chappals', local: 'ചെരിപ്പ്', emoji: '🩴', price: 60, desc: 'Walk 8% faster in town', fx: { type: 'shoes', id: 'chappal' } },
      { id: 'sports', name: 'Sports shoes', local: '', emoji: '👟', price: 180, desc: 'Walk 15% faster in town, and every run starts with 12 seconds of sprint', fx: { type: 'shoes', id: 'sports' } }
    ] },
    /* the scrap dealer buys, he does not sell: one line per kind in the scrap bag, priced at weight times the posted rate (game rates). He pays cash only. */
    scrap: { name: 'Scrap dealer', local: 'ആക്രിക്കട', emoji: '♻️', color: '#4a5a3a', buys: true, accepts: ['cash'], blurb: 'Old paper, plastic, tins, glass and iron, bought by weight at the posted rate. Cash only. Game rates.',
      get items() { const T = (window.RoboScrap && window.RoboScrap.TYPES) || {}; return Object.keys(T).map((id) => ({ id, name: T[id].name, local: '', emoji: T[id].emoji, price: window.RoboScrap.pay(id), desc: T[id].kg + ' kg a piece at ₹' + T[id].rate + '/kg', fx: { type: 'scrap', id } })); } },
    /* a public charging bay: you buy blocks of 10% at the KSEB per-unit tariff of the hour (battery.js has the arithmetic, clock.js the tariff); GPay only, as on the real chargers' apps. Game scale: a full battery is 3 units. */
    kseb: { name: 'KSEB EV charging', local: 'കെഎസ്ഇബി ഇവി ചാർജിങ്', emoji: '🔌', color: '#1f4a7a', accepts: ['upi'], blurb: 'A public charging bay. You pay by the unit at the tariff of the hour, by GPay. Slow AC takes long and costs less; fast DC is quick and dearer. Game scale: a full battery is 3 units. Tariffs as reported in May 2025.',
      get items() {
        const B = window.RoboBattery, C = window.RoboClock; if (!B || !C) return [];
        const tf = C.evTariff(api.tariffHours());
        return ['ac', 'dc'].map((k) => { const b = B.blockCost(k, tf), slow = k === 'ac'; return { id: k, name: slow ? 'Slow charge (AC)' : 'Fast charge (DC)', local: '', emoji: slow ? '🔌' : '⚡', price: b.price, desc: '+' + B.BLOCK + '% battery · ' + b.units + ' unit at ₹' + b.rate + '/unit · ' + b.minutes + ' min · ' + tf.band, fx: { type: 'charge', kind: k } }; });
      } },
    /* not a shop: the page opens this to show every bill and slip (the bill screen with the list always open) */
    ledger: { name: 'My bills', local: 'ബില്ലുകൾ', emoji: '🧾', color: '#3a3a4a', blurb: 'Every bill and slip, newest first.', accepts: ['cash'], items: [] },
    farsa: { name: 'Hotel Farsa', local: 'ഹോട്ടൽ ഫർസ', emoji: '🍛', color: '#1f5a3a', blurb: 'An old Manjeri hotel on Pandikkad Road, known for porotta and biryani. Game prices.', items: [
      { id: 'porotta', name: 'Porotta and curry', local: '', emoji: '🫓', price: 28, desc: 'A shield for 25 seconds', fx: { type: 'shield', secs: 25 } },
      { id: 'biryani', name: 'Biryani', local: '', emoji: '🍛', price: 45, desc: 'Double score for 25 seconds', fx: { type: 'mult', secs: 25 } },
      { id: 'chaya', name: 'Chaya', local: 'tea', emoji: '🍵', price: 8, desc: 'Pulls in energy cells for 15 seconds', fx: { type: 'magnet', secs: 15 } }
    ] },
    oottupura: { name: 'Hotel Oottupura', local: 'ഹോട്ടൽ ഊട്ടുപുര', emoji: '🍽️', color: '#6a4a1c', blurb: 'A Manjeri restaurant known for its breakfast: dosa, idli and puttu. Game prices.', items: [
      { id: 'dosa', name: 'Dosa and chutney', local: '', emoji: '🥞', price: 30, desc: 'A shield for 25 seconds', fx: { type: 'shield', secs: 25 } },
      { id: 'puttu', name: 'Puttu and kadala', local: '', emoji: '🍚', price: 40, desc: 'Double score for 20 seconds', fx: { type: 'mult', secs: 20 } },
      { id: 'chaya', name: 'Chaya', local: 'tea', emoji: '🍵', price: 8, desc: 'Pulls in energy cells for 15 seconds', fx: { type: 'magnet', secs: 15 } }
    ] },
    zindagi: { name: 'Hotel Zindagi', local: 'ഹോട്ടൽ സിന്ദഗി', emoji: '🍽️', color: '#5a4a1c', blurb: 'A Manjeri hotel at Nelliparambu, open from early morning till late. Game prices.', items: [
      { id: 'porotta', name: 'Porotta and curry', local: '', emoji: '🫓', price: 28, desc: 'A shield for 25 seconds', fx: { type: 'shield', secs: 25 } },
      { id: 'pazhampori', name: 'Pazhampori', local: 'banana fritter', emoji: '🍌', price: 12, desc: 'Double score for 15 seconds', fx: { type: 'mult', secs: 15 } },
      { id: 'chaya', name: 'Chaya', local: 'tea', emoji: '🍵', price: 8, desc: 'Pulls in energy cells for 15 seconds', fx: { type: 'magnet', secs: 15 } }
    ] },
    vanitha: { name: 'Vanitha Mess', local: 'വനിത മെസ്', emoji: '🍛', color: '#3a5a2a', blurb: 'A small Manjeri mess for simple lunches on a banana leaf. Game prices.', items: [
      { id: 'meals', name: 'Meals on a banana leaf', local: '', emoji: '🍛', price: 35, desc: 'A shield for 25 seconds', fx: { type: 'shield', secs: 25 } },
      { id: 'fishfry', name: 'Fish fry', local: '', emoji: '🐟', price: 25, desc: 'Double score for 15 seconds', fx: { type: 'mult', secs: 15 } },
      { id: 'chaya', name: 'Chaya', local: 'tea', emoji: '🍵', price: 8, desc: 'Pulls in energy cells for 15 seconds', fx: { type: 'magnet', secs: 15 } }
    ] },
    rayadhan: { name: 'Al Rayadhan Kuzhi Mandhi', local: 'അൽ റയാദാൻ കുഴിമന്തി', emoji: '🍖', color: '#6a3a1c', blurb: 'A Manjeri place for kuzhi mandi, rice and meat cooked in a pit in the Arab style. Game prices.', items: [
      { id: 'kuzhimandi', name: 'Kuzhi mandi', local: '', emoji: '🍖', price: 90, desc: 'Double score for 25 seconds', fx: { type: 'mult', secs: 25 } },
      { id: 'mandihalf', name: 'Mandi half portion', local: '', emoji: '🍚', price: 55, desc: 'A shield for 25 seconds', fx: { type: 'shield', secs: 25 } },
      { id: 'lime', name: 'Lime juice', local: '', emoji: '🍋', price: 15, desc: 'Pulls in energy cells for 15 seconds', fx: { type: 'magnet', secs: 15 } }
    ] },
    bombay: { name: 'Bombay Hotel', local: 'ബോംബെ ഹോട്ടൽ', emoji: '🍛', color: '#7a2a1c', blurb: 'Dum biryani since 1949, near the beach. Game prices.', items: [
      { id: 'dum', name: 'Dum biryani', local: '', emoji: '🍛', price: 45, desc: 'Double score for 25 seconds', fx: { type: 'mult', secs: 25 } },
      { id: 'chattippathiri', name: 'Chattippathiri', local: '', emoji: '🥞', price: 22, desc: 'A shield for 20 seconds', fx: { type: 'shield', secs: 20 } },
      { id: 'elanchi', name: 'Elanchi', local: '', emoji: '🥞', price: 14, desc: 'Run 12% faster for 20 seconds', fx: { type: 'sprint', secs: 20 } }
    ] },
    swamy: { name: 'Swamy & Sons', local: 'സ്വാമി ആൻഡ് സൺസ്', emoji: '☕', color: '#4a2a18', blurb: 'A third-generation coffee store on S. M. Street. Game prices.', items: [
      { id: 'filter', name: 'Filter coffee', local: 'kaapi', emoji: '☕', price: 14, desc: 'Run 12% faster for 25 seconds', fx: { type: 'sprint', secs: 25 } },
      { id: 'powder', name: 'Coffee powder pack', local: '', emoji: '🫘', price: 20, desc: 'Pulls in energy cells for 25 seconds', fx: { type: 'magnet', secs: 25 } },
      { id: 'beans', name: 'Coffee beans', local: '', emoji: '🫘', price: 16, desc: 'Goes into your backpack for the kitchen', fx: { type: 'ingredient', id: 'coffee' } }
    ] },
    supermarket: { name: 'Supermarket', local: 'സൂപ്പർ മാർക്കറ്റ്', emoji: '🛒', color: '#1f5a8a', blurb: 'Everything for the kitchen. What you buy goes into your backpack, if there is room when you leave town. Game prices.', items: [
      { id: 'rice', name: 'Rice', local: '', emoji: '🍚', price: 12, desc: 'Goes into your backpack for the kitchen', fx: { type: 'ingredient', id: 'rice' } },
      { id: 'ghee', name: 'Ghee', local: '', emoji: '🧈', price: 25, desc: 'Goes into your backpack for the kitchen', fx: { type: 'ingredient', id: 'ghee' } },
      { id: 'jaggery', name: 'Jaggery', local: '', emoji: '🍯', price: 10, desc: 'Goes into your backpack for the kitchen', fx: { type: 'ingredient', id: 'jaggery' } },
      { id: 'spice', name: 'Spice mix', local: '', emoji: '🌶️', price: 12, desc: 'Goes into your backpack for the kitchen', fx: { type: 'ingredient', id: 'spice' } },
      { id: 'tea', name: 'Tea leaves', local: '', emoji: '🍵', price: 10, desc: 'Goes into your backpack for the kitchen', fx: { type: 'ingredient', id: 'tea' } },
      { id: 'coconut', name: 'Coconut', local: '', emoji: '🥥', price: 8, desc: 'Goes into your backpack for the kitchen', fx: { type: 'ingredient', id: 'coconut' } },
      { id: 'banana', name: 'Plantain', local: '', emoji: '🍌', price: 6, desc: 'Goes into your backpack for the kitchen', fx: { type: 'ingredient', id: 'banana' } },
      { id: 'pepper', name: 'Black pepper', local: '', emoji: '⚫', price: 14, desc: 'Goes into your backpack for the kitchen', fx: { type: 'ingredient', id: 'pepper' } },
      { id: 'cardamom', name: 'Cardamom', local: '', emoji: '🌿', price: 16, desc: 'Goes into your backpack for the kitchen', fx: { type: 'ingredient', id: 'cardamom' } }
    ] }
  };
  SHOPS.budget = Object.assign({}, SHOPS.supermarket, { name: 'Budget Hyper Market', local: 'ബജറ്റ് ഹൈപ്പർ മാർക്കറ്റ്' });   // Manjeri's supermarket sells what the HiLITE one sells

  /* ---- rides: a prepaid auto stand at each stop (the fare is the meter's base plus a distance fare, from explore_rides.js) and a KSRTC counter at each bus stand. Paying gives the bill and a trip for the page to start. ---- */
  if (window.RoboExploreRides) {
    const RD = window.RoboExploreRides;
    for (const id of Object.keys(RD.STOPS)) {
      const here = RD.STOPS[id];
      SHOPS['auto_' + id] = { name: 'Auto stand · ' + here.name, local: 'ഓട്ടോ സ്റ്റാൻഡ്', emoji: '🛺', color: '#a07a10', blurb: 'A prepaid auto: the fare is the start fare of the meter plus a distance fare (₹' + RD.BASE + ' and ₹' + RD.PER_100M + ' for every 100 m; the town is small, so 100 m counts as a kilometre). You pay first, then ride.',
        items: RD.tripsFrom(id).map((tr) => ({ id: tr.to, name: 'To ' + tr.name, local: tr.local, emoji: '🛺', price: tr.fare, desc: Math.round(tr.dist) + ' m · about ' + tr.secs + ' seconds', fx: { type: 'ride', mode: 'auto', from: id, to: tr.to } })) };
    }
    const hm = (h) => (h >= 1 ? Math.floor(h) + ' h ' + Math.round((h % 1) * 60) + ' min' : Math.round(h * 60) + ' min');
    for (const id of Object.keys(RD.BUS_STOPS)) {
      const here = RD.BUS_STOPS[id];
      SHOPS['bus_' + id] = { name: here.name + ' · tickets', local: 'കെഎസ്ആർടിസി ടിക്കറ്റ്', emoji: '🚌', color: '#8a1f2b', blurb: window.ROBO_ACTIVE_AREAS ? 'Buses to the other towns start when those towns open. Game fares and times.' : 'KSRTC buses run between the town, the city and Manjeri. Game fares and times (the real runs are about 4 km and about 45 km); the clock moves on while you travel.',
        items: RD.busFrom(id).filter((l) => !window.ROBO_ACTIVE_AREAS || window.ROBO_ACTIVE_AREAS.indexOf(RD.BUS_STOPS[l.to].area) >= 0).map((l) => ({ id: l.to, name: 'Ticket to ' + l.name, local: '', emoji: '🎫', price: l.fare, desc: 'KSRTC · about ' + hm(l.hours), fx: { type: 'ride', mode: 'bus', from: id, to: l.to, hours: l.hours } })) };
    }
  }

  /* ---- barter: what an ingredient is worth in rupees, and what each shop would actually take for it ---- */
  const ING_VALUE = { rice: 12, ghee: 25, jaggery: 10, spice: 12, tea: 10, coconut: 8, banana: 6, pepper: 14, cardamom: 16, coffee: 16 };   // the supermarket's own prices
  const ING_NAME = { rice: 'Rice', ghee: 'Ghee', jaggery: 'Jaggery', spice: 'Spice mix', tea: 'Tea leaves', coconut: 'Coconut', banana: 'Plantain', pepper: 'Black pepper', cardamom: 'Cardamom', coffee: 'Coffee beans' };
  const ING_EMOJI = { rice: '🍚', ghee: '🧈', jaggery: '🍯', spice: '🌶️', tea: '🍵', coconut: '🥥', banana: '🍌', pepper: '⚫', cardamom: '🌿', coffee: '🫘' };
  const DEMAND = {   // a shop credits `rate` of the value, and only for goods it would use; hardware and textiles take no goods
    snacks: { take: ['banana', 'jaggery', 'rice', 'coconut', 'tea', 'cardamom'], rate: 0.8 },
    pharmacy: { take: ['pepper', 'cardamom', 'spice', 'jaggery'], rate: 0.8 },
    farsa: { take: ['rice', 'ghee', 'spice', 'coconut', 'banana'], rate: 0.8 },
    bombay: { take: ['rice', 'ghee', 'spice', 'coconut', 'banana'], rate: 0.8 },
    oottupura: { take: ['rice', 'ghee', 'spice', 'coconut', 'banana'], rate: 0.8 },
    zindagi: { take: ['rice', 'ghee', 'spice', 'coconut', 'banana'], rate: 0.8 },
    vanitha: { take: ['rice', 'ghee', 'spice', 'coconut', 'banana'], rate: 0.8 },
    rayadhan: { take: ['rice', 'ghee', 'spice', 'coconut', 'banana'], rate: 0.8 },
    swamy: { take: ['coffee', 'cardamom', 'tea', 'jaggery'], rate: 0.8 },
    supermarket: { take: 'all', rate: 0.6 },
    budget: { take: 'all', rate: 0.6 }   // buys from anyone, but pays less than it sells for, so trading back and forth never makes money
  };
  const BARTER_OVER = 1.3;   // goods may be worth a little more than the bill (no change is given), never much more
  const PREFIX = { snacks: 'CK', pharmacy: 'VS', tools: 'HW', clothes: 'TX', farsa: 'HF', oottupura: 'OP', zindagi: 'ZG', vanitha: 'VM', rayadhan: 'AR', budget: 'BS', bombay: 'BH', swamy: 'SS', supermarket: 'SM', footwear: 'FW', scrap: 'AK', kseb: 'KS', auto: 'AU', bus: 'KT' };   // the first letters of each shop's bill numbers
  const prefixOf = (kind) => PREFIX[kind] || PREFIX[String(kind).split('_')[0]] || 'XX';   // 'auto_kz_beach' is an auto bill
  /* opening hours (game hours, plausible for each kind of place, not any real shop's): the clock decides; chargers, autos and buses are always there */
  const HOURS = { snacks: [5, 22], pharmacy: [8, 22], tools: [9, 19], clothes: [10, 21], footwear: [10, 21], scrap: [8, 18], farsa: [6, 23], oottupura: [6, 23], zindagi: [5.5, 23], vanitha: [10, 15], rayadhan: [11, 24], budget: [8, 22], bombay: [6, 23], swamy: [7, 20], supermarket: [8, 22] };
  for (const k of Object.keys(HOURS)) if (SHOPS[k]) SHOPS[k].hours = HOURS[k];
  const fmtH = (h) => { const hh = Math.floor(h) % 24, mm = Math.round((h % 1) * 60), ap = hh >= 12 ? 'pm' : 'am', h12 = hh % 12 === 0 ? 12 : hh % 12; return h12 + (mm ? ':' + String(mm).padStart(2, '0') : '') + ' ' + ap; };
  const openNow = (sh, h) => !sh.hours || (h >= sh.hours[0] && h < sh.hours[1]);
  const round1 = (x) => Math.round(x * 10) / 10;

  /* ---- bills: the last 30, newest first, with a running number per shop ---- */
  const BILLS_KEY = 'runaway.bills', MAX_BILLS = 30;
  let mem = { list: [], seq: {} };
  const loadBills = () => {
    try { const raw = JSON.parse(localStorage.getItem(BILLS_KEY) || 'null'); if (raw && Array.isArray(raw.list)) return { list: raw.list.slice(0, MAX_BILLS), seq: raw.seq && typeof raw.seq === 'object' ? raw.seq : {} }; } catch (e) { /* no storage or a corrupt save: start with an empty book */ }
    return mem;
  };
  const saveBills = (b) => { mem = b; try { localStorage.setItem(BILLS_KEY, JSON.stringify(b)); } catch (e) { /* the bills are just not remembered */ } };

  const owned = (item, ctx) => {
    if (item.fx.type === 'umbrella') return !!(ctx.kitchen && ctx.kitchen.hasUmbrella());
    if (item.fx.type === 'shoes') return !!(ctx.gear && ctx.gear.has(item.fx.id));
    if (item.fx.type === 'costume') { const sk = ctx.progress && ctx.progress.snapshot().skins.find((s) => s.id === item.fx.id); return !sk || !!sk.owned; }
    return false;
  };
  const named = (item, ctx) => {   // costume names and looks come from the character list
    if (item.fx.type !== 'costume') return item;
    const sk = ctx.progress && ctx.progress.snapshot().skins.find((s) => s.id === item.fx.id);
    return Object.assign({}, item, { name: sk ? sk.name : item.fx.id, desc: 'A new character to run as', local: 'costume' });
  };

  const nameOf = (item, ctx) => named(item, ctx);
  const api = {
    tariffHours: () => 16.5,   // the game clock, set by the page, so a charging bay quotes the tariff of the hour
    SHOPS, kinds: Object.keys(SHOPS), ING_VALUE, ING_NAME, ING_EMOJI, DEMAND,
    /* what this shop would take, and the credit for one of each: [{ id, name, emoji, each }] */
    barterList(kind) { const d = DEMAND[kind]; if (!d) return []; return (d.take === 'all' ? Object.keys(ING_VALUE) : d.take).map((id) => ({ id, name: ING_NAME[id], emoji: ING_EMOJI[id], each: round1(ING_VALUE[id] * d.rate) })); },
    /* is this place open at hour h (the game clock; the page keeps tariffHours pointed at it), and the line to show about its hours */
    isOpen(kind, h) { const sh = SHOPS[kind]; return !!sh && openNow(sh, h === undefined ? api.tariffHours() : h); },
    openLine(kind) { const sh = SHOPS[kind]; return sh && sh.hours ? 'Open ' + fmtH(sh.hours[0]) + ' to ' + fmtH(sh.hours[1]) + ' (game hours).' : ''; },
    accepts(kind) { const sh = SHOPS[kind]; return (sh && sh.accepts) || ['cash', 'upi']; },
    bills() { return loadBills().list.slice(); },
    /* the bill for a cart (item id -> quantity) with goods offered in barter (ingredient id -> quantity): lines, total, credit, what is due in cash or GPay, and any problems */
    quote(kind, cart, offer, ctx) {
      const sh = SHOPS[kind], problems = [], lines = [], creditLines = []; let subtotal = 0, credit = 0;
      if (sh && !openNow(sh, api.tariffHours())) return { ok: false, closed: true, problems: ['Closed now. Open ' + fmtH(sh.hours[0]) + ' to ' + fmtH(sh.hours[1]) + '.'], lines, subtotal: 0, creditLines, credit: 0, due: 0, payout: 0, buys: !!sh.buys, noChange: 0, accepts: api.accepts(kind) };
      if (sh && sh.buys) {   // a dealer buys: each line is a number of pieces from your scrap bag, and the total is what he pays you
        for (const id of Object.keys(cart || {})) {
          const q = Math.floor(Number(cart[id])); if (!(q >= 1)) continue;
          const item = sh.items.find((i) => i.id === id); if (!item) { problems.push('He does not buy that.'); continue; }
          const have = ctx.scrapHave ? ctx.scrapHave(id) : 0; if (have < q) { problems.push('You only have ' + have + ' of ' + item.name.toLowerCase() + '.'); continue; }
          lines.push({ id, name: item.name, qty: q, rate: item.price, amount: item.price * q }); subtotal += item.price * q;
        }
        if (!lines.length && !problems.length) problems.push('Nothing to sell yet.');
        return { ok: problems.length === 0, problems, lines, subtotal, creditLines, credit: 0, due: 0, payout: subtotal, noChange: 0, accepts: ['cash'], buys: true };
      }
      if (!sh) return { ok: false, problems: ['That shop is not here.'], lines, subtotal: 0, creditLines, credit: 0, due: 0, noChange: 0, accepts: [] };
      for (const id of Object.keys(cart || {})) {
        const q = Math.floor(Number(cart[id])); if (!(q >= 1)) continue;
        const item = sh.items.find((i) => i.id === id); if (!item) { problems.push('That is not on sale here.'); continue; }
        const nm = nameOf(item, ctx).name || id, one = item.fx.type === 'costume' || item.fx.type === 'umbrella' || item.fx.type === 'shoes' || item.fx.type === 'ride';
        if (owned(item, ctx)) problems.push(nm + ': you already have it.'); else if (one && q > 1) problems.push(nm + ': only one is needed.');
        lines.push({ id, name: nm, qty: q, rate: item.price, amount: item.price * q }); subtotal += item.price * q;
      }
      if (!lines.length && !problems.length) problems.push('Your cart is empty.');
      if (lines.reduce((s, l) => s + (sh.items.find((i) => i.id === l.id).fx.type === 'ride' ? l.qty : 0), 0) > 1) problems.push('One trip at a time.');
      const blocks = lines.reduce((s, l) => s + (sh.items.find((i) => i.id === l.id).fx.type === 'charge' ? l.qty : 0), 0);
      if (blocks > 0 && ctx.batteryRoom) { const room = ctx.batteryRoom(); if (room <= 0) problems.push('Your battery is already full.'); else if (blocks * 10 > room) problems.push('Your battery has room for only ' + room + '% more.'); }
      const dem = DEMAND[kind];
      for (const ing of Object.keys(offer || {})) {
        const q = Math.floor(Number(offer[ing])); if (!(q >= 1)) continue;
        if (!ING_VALUE[ing]) { problems.push('That is not something to trade.'); continue; }
        if (!dem) { problems.push(sh.name + ' does not take goods.'); continue; }
        if (dem.take !== 'all' && dem.take.indexOf(ing) < 0) { problems.push(sh.name + ' does not take ' + ING_NAME[ing].toLowerCase() + '.'); continue; }
        if (!ctx.have || ctx.have(ing) < q) { problems.push('You do not have ' + q + ' ' + ING_NAME[ing].toLowerCase() + '.'); continue; }
        const each = round1(ING_VALUE[ing] * dem.rate); creditLines.push({ id: ing, name: ING_NAME[ing], qty: q, each, credit: round1(each * q) }); credit += each * q;
      }
      credit = round1(credit);
      if (creditLines.length && credit > subtotal * BARTER_OVER + 1e-9) problems.push('That is worth more than the bill. Offer a little less.');
      return { ok: problems.length === 0, problems, lines, subtotal, creditLines, credit, due: Math.max(0, Math.ceil(subtotal - credit - 1e-9)), noChange: Math.max(0, round1(credit - subtotal)), accepts: api.accepts(kind) };
    },
    /* pay: pay = { method: 'cash' | 'upi', offer } ; everything is checked before anything is taken, spent or applied */
    checkout(kind, cart, pay, ctx) {
      pay = pay || {}; const q = api.quote(kind, cart, pay.offer, ctx), sh = SHOPS[kind];
      if (!q.ok) return { ok: false, msg: q.problems[0] };
      if (q.buys) {   // selling scrap: the pieces leave your bag, the dealer pays cash
        for (const l of q.lines) ctx.scrapTake(l.id, l.qty); ctx.earn(q.payout);
        const book = loadBills(), pre = prefixOf(kind); book.seq[pre] = (book.seq[pre] || 0) + 1;
        const receipt = { no: pre + '-' + String(book.seq[pre]).padStart(4, '0'), shop: sh.name, local: sh.local, date: new Date().toISOString(), lines: q.lines, subtotal: q.subtotal, creditLines: [], credit: 0, due: 0, payout: q.payout, noChange: 0, method: 'sold', paidBy: '', txn: '' };
        book.list.unshift(receipt); book.list = book.list.slice(0, MAX_BILLS); saveBills(book);
        return { ok: true, msg: 'Sold. Slip ' + receipt.no + '.', receipt };
      }
      let how = 'barter';
      if (q.due > 0) {
        how = pay.method === 'upi' ? 'upi' : 'cash';
        if (q.accepts.indexOf(how) < 0) return { ok: false, msg: sh.name + (how === 'upi' ? ' does not take GPay here: pay cash.' : ' does not take cash here: pay by GPay.') };
        if (how === 'upi' && (!ctx.wallet || ctx.wallet.upi() < q.due)) return { ok: false, msg: 'Your GPay balance is ₹' + (ctx.wallet ? ctx.wallet.upi() : 0) + ' and this needs ₹' + q.due + '.' };
        if (how === 'cash' && ctx.pool() < q.due) return { ok: false, msg: 'You need ₹' + (q.due - ctx.pool()) + ' more cash.' };
      }
      let txn = '';
      if (q.due > 0) {
        if (how === 'upi') { const r = ctx.wallet.pay(q.due, sh.name); if (!r.ok) return { ok: false, msg: r.msg || 'The payment did not go through.' }; txn = r.txn; }
        else if (!ctx.spend(q.due)) return { ok: false, msg: 'The payment did not go through.' };
      }
      for (const c of q.creditLines) ctx.take(c.id, c.qty);
      for (const l of q.lines) {
        const item = sh.items.find((i) => i.id === l.id), fx = item.fx;
        if (fx.type === 'umbrella') { ctx.kitchen.grantUmbrella(); if (ctx.onUmbrella) ctx.onUmbrella(); }
        else if (fx.type === 'costume') ctx.progress.grant(fx.id);
        else if (fx.type === 'shoes') { if (ctx.gear) ctx.gear.equip(fx.id); }
        else if (fx.type === 'charge') { if (ctx.charge) ctx.charge(fx.kind, l.qty); }
        else if (fx.type === 'ride') { if (ctx.ride) ctx.ride(fx); }
        else for (let k = 0; k < l.qty; k++) { if (fx.type === 'ingredient') { if (ctx.ingredient) ctx.ingredient(fx.id); } else ctx.apply(fx); }
      }
      const book = loadBills(), pre = prefixOf(kind); book.seq[pre] = (book.seq[pre] || 0) + 1;
      const receipt = { no: pre + '-' + String(book.seq[pre]).padStart(4, '0'), shop: sh.name, local: sh.local, date: new Date().toISOString(), lines: q.lines, subtotal: q.subtotal, creditLines: q.creditLines, credit: q.credit, due: q.due, noChange: q.noChange, method: q.creditLines.length ? (q.due > 0 ? 'mixed' : 'barter') : how, paidBy: q.due > 0 ? how : '', txn };
      book.list.unshift(receipt); book.list = book.list.slice(0, MAX_BILLS); saveBills(book);
      return { ok: true, msg: 'Paid. Bill ' + receipt.no + '.', receipt };
    },
    stock(kind, ctx) {
      const sh = SHOPS[kind]; if (!sh) return null;
      return { kind, name: sh.name, local: sh.local, emoji: sh.emoji, blurb: sh.blurb, items: sh.items.map((it) => { const n = named(it, ctx); return Object.assign({}, n, { soldOut: owned(it, ctx) }); }) };
    },
    buy(kind, id, ctx) {
      const sh = SHOPS[kind], item = sh && sh.items.find((i) => i.id === id);
      if (!item) return { ok: false, msg: 'That is not on sale here.' };
      if (owned(item, ctx)) return { ok: false, msg: 'You already have that.' };
      if (ctx.pool() < item.price) return { ok: false, msg: 'You need ' + (item.price - ctx.pool()) + ' more coins.' };
      if (!ctx.spend(item.price)) return { ok: false, msg: 'The payment did not go through.' };
      const fx = item.fx, label = named(item, ctx).name;
      if (fx.type === 'umbrella') { ctx.kitchen.grantUmbrella(); if (ctx.onUmbrella) ctx.onUmbrella(); }
      else if (fx.type === 'costume') ctx.progress.grant(fx.id);
      else if (fx.type === 'ingredient') { if (ctx.ingredient) ctx.ingredient(fx.id); }
      else ctx.apply(fx);
      return { ok: true, msg: 'Bought ' + label + '. ' + (fx.type === 'costume' ? 'Find it under Characters.' : fx.type === 'umbrella' ? 'It opens by itself when you fall.' : fx.type === 'ingredient' ? 'It is in your backpack.' : 'Enjoy!') };
    }
  };
  window.RoboShop = api;
})();
