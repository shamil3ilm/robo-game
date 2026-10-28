/* Robo Run: the story, as data. Exposes window.RoboStory = { title, chapters, npcs, quests, dialogue }. See the design doc.
   The story is a small, warm one about a delivery desk in Manjeri: you carry parcels on the bike, then carry people in the auto (the shuttle service), then take the bus out to Malappuram. All people and the company are made up; real places appear only as backdrops.
   (The earlier thriller, DEAD SIGNAL, is kept in the design doc and the puzzle engine; it is not part of the game for now.)
   To change the story, edit this file: the quest engine (quests.js) and the Story tab read it, and tests/quests.test.js checks that it hangs together.
   A quest has steps done in order. A step is "done" by an event: talk {npc}, puzzle {id}, job {mode: 'parcel' | 'ride'}, pay_upi, buy {shop, count}, area {area}, sell_scrap {count}, scrap_pick, ride {mode}, charge, cook {dish}, run, spend. A step may ask for n of them.
   A dialogue rule says what a character says: the first rule whose `when` matches wins ({ step: 'quest.step' } = that step is the one to do now; { done: 'quest' }; { flag: 'name' }), and a rule with no `when` is the last resort. */
(function () {
  'use strict';
  const COMPANY = 'Chaya Express';   // made up: the delivery desk in the story
  window.RoboStory = {
    title: 'CHAYA EXPRESS',
    tagline: 'One parcel, one passenger, one street at a time.',
    note: 'A gentle story about a delivery desk and a little shuttle in Manjeri. All people and the company are made up.',
    chapters: [
      { id: 'd1', day: 'Day 1', title: 'The Desk by the Turf', theme: 'A first day', place: 'manjeri', open: true,
        summary: 'A new delivery desk opens on the highway south of the junction. Meet Sreeja, take your first parcel and learn the streets.' },
      { id: 'd2', day: 'Day 2', title: 'Busy Streets', theme: 'Learning the town', place: 'manjeri', open: true,
        summary: 'More parcels, a bike that needs looking after, and a proper lunch at one of the old hotels.' },
      { id: 'd3', day: 'Day 3', title: 'The Shuttle', theme: 'Carrying people', place: 'manjeri', open: true,
        summary: 'The desk starts a little shuttle: take an auto from a stand and carry people where they need to go.' },
      { id: 'd4', day: 'Day 4', title: 'The Road to Malappuram', theme: 'Going further', place: 'malappuram', open: true,
        summary: 'Take the KSRTC bus to Malappuram to see where the desk may open its next stand, then come home.' }
    ],
    /* where each character stands (world coordinates; Manjeri is around x = 600, Malappuram around x = 900) and how they look (a person type from explore.js) */
    npcs: {
      sreeja: { name: 'Sreeja', emoji: '📋', role: 'Runs the Chaya Express desk', look: 'saree', at: [596.5, 39], face: 1.57 },
      hameed: { name: 'Hameed Ikka', emoji: '🍵', role: 'Tea stall by the desk', look: 'mundu', at: [602.4, 24.4], face: 0 },
      rayan: { name: 'Rayan', emoji: '🔧', role: 'Mechanic and electronics repair', look: 'lungi', at: [682, -3.1], face: 0 },
      mini: { name: 'Mini', emoji: '🩺', role: 'Nurse at the medical college', look: 'thattam', at: [613, 38.6], face: -1.57 },
      joseph: { name: 'Joseph', emoji: '🎫', role: 'Ticket clerk at the Malappuram bus terminal', look: 'mundu', at: [869.5, -9.4], face: 0 }
    },
    quests: [
      { id: 'welcome', chapter: 'd1', title: 'Meet Sreeja', requires: [], reward: { coins: 20 },
        steps: [{ id: 'meet', type: 'talk', npc: 'sreeja', text: 'Meet Sreeja at the Chaya Express desk, on the highway south of the junction, by the football turf.' }] },
      { id: 'first_parcel', chapter: 'd1', title: 'The first parcel', requires: ['welcome'], reward: { coins: 40 },
        steps: [{ id: 'deliver', type: 'job', mode: 'parcel', from: 'Tea stall', to: 'Hotel Farsa', text: 'Take the parcel at the desk (the button says Delivery desk): it goes from Hameed Ikka\'s tea stall to Hotel Farsa. The bike is yours for the job.' },
          { id: 'report', type: 'talk', npc: 'sreeja', text: 'Tell Sreeja how your first delivery went.' }] },
      { id: 'chaya', chapter: 'd1', title: 'A glass of chaya', requires: ['first_parcel'], reward: { coins: 15 },
        steps: [{ id: 'visit', type: 'talk', npc: 'hameed', text: 'Stop at Hameed Ikka\'s tea stall, just up the road from the desk.' }] },
      { id: 'rounds', chapter: 'd2', title: 'The morning rounds', requires: ['first_parcel'], reward: { coins: 60 },
        steps: [{ id: 'three', type: 'job', mode: 'parcel', n: 3, legs: [['Hotel Oottupura', 'KSRTC station'], ['Budget Hyper Market', 'Vanitha Mess'], ['Zilla Money', 'Hotel Farsa']], text: 'Finish three more deliveries, one at a time at the desk: Hotel Oottupura to the bus station, then Budget Hyper Market to Vanitha Mess, then Zilla Money to Hotel Farsa. The desk gives each in turn.' },
          { id: 'report', type: 'talk', npc: 'sreeja', text: 'Tell Sreeja the rounds are done.' }] },
      { id: 'bike_care', chapter: 'd2', title: 'Look after the bike', requires: ['rounds'], reward: { coins: 40 },
        steps: [{ id: 'advice', type: 'talk', npc: 'rayan', text: 'Rayan knows bikes. Find him at his repair shop on Manjeri-Pandikkad Road, east of the bus yard.' },
          { id: 'charge', type: 'charge', text: 'Charge up at an EV bay (there is one by the bus yard).' }] },
      { id: 'lunch', chapter: 'd2', title: 'A proper lunch', requires: ['rounds'], reward: { coins: 20 },
        steps: [{ id: 'eat', type: 'buy', shop: 'farsa', text: 'Have a meal at Hotel Farsa, on the south side of Manjeri-Pandikkad Road, near the junction.' }] },
      { id: 'shuttle_start', chapter: 'd3', title: 'A little shuttle', requires: ['bike_care', 'lunch'], reward: { coins: 20 },
        steps: [{ id: 'briefing', type: 'talk', npc: 'sreeja', text: 'Sreeja has news about the shuttle. Find her at the desk.' }] },
      { id: 'first_fare', chapter: 'd3', title: 'The first fare', requires: ['shuttle_start'], reward: { coins: 50 },
        steps: [{ id: 'drive', type: 'job', mode: 'ride', from: 'KSRTC station', to: 'Medical college gate', text: 'At an auto stand, take Drive an auto, then Get a passenger at the desk: a passenger waits at the KSRTC station and is going to the medical college gate.' },
          { id: 'report', type: 'talk', npc: 'sreeja', text: 'Tell Sreeja how the first fare went.' }] },
      { id: 'shift_change', chapter: 'd3', title: 'Shift change', requires: ['first_fare'], reward: { coins: 80 },
        steps: [{ id: 'fares', type: 'job', mode: 'ride', n: 3, legs: [['Medical college gate', 'Budget Hyper Market'], ['KSRTC station', 'Zilla Money'], ['Hotel Oottupura', 'Medical college gate']], text: 'Carry three more passengers in the auto: from the medical college gate to Budget Hyper Market, from the KSRTC station to Zilla Money, and from Hotel Oottupura to the medical college gate.' },
          { id: 'nurse', type: 'talk', npc: 'mini', text: 'Mini, a nurse at the medical college, has heard about the shuttle. Find her at the gate of the Government Medical College.' }] },
      { id: 'bus_out', chapter: 'd4', title: 'The bus to Malappuram', requires: ['shift_change'], reward: { coins: 30 },
        steps: [{ id: 'go', type: 'area', area: 'malappuram', text: 'Take the KSRTC bus from the Manjeri bus yard to Malappuram. The ticket counter is by the shelter.' },
          { id: 'clerk', type: 'talk', npc: 'joseph', text: 'Say hello to Joseph at the ticket counter of the Malappuram bus terminal.' }] },
      { id: 'home', chapter: 'd4', title: 'Back to Manjeri', requires: ['bus_out'], reward: { coins: 150 },
        steps: [{ id: 'return', type: 'area', area: 'manjeri', text: 'Take the bus back to Manjeri.' },
          { id: 'tell', type: 'talk', npc: 'sreeja', text: 'Tell Sreeja what you saw in Malappuram.' }] }
    ],
    dialogue: {
      sreeja: [
        { when: { step: 'welcome.meet' }, lines: [
          'You must be the new rider. I am Sreeja. This is the whole of Chaya Express: a desk, a counter, and me.',
          'The deal is simple. Press the button at the desk and I give you a parcel. Collect it, take it where it says, and the bike is yours for the job.',
          'Follow the blue dots and the flag on your map. Honk if someone steps in front of you. Everybody here knows how to ignore a horn, so honk twice.'] },
        { when: { step: 'first_parcel.deliver' }, lines: ['The button at the desk gives you the parcel. It goes from Hameed Ikka\'s tea stall, just up the road, to Hotel Farsa. The map shows the way. Go on, I will keep the tea warm.'] },
        { when: { step: 'first_parcel.report' }, lines: [
          'On time? Good. The shopkeepers here do not forgive late tea or late parcels.',
          'Hameed Ikka at the stall up the road has been asking about the new rider. Go and be seen. It is good for business.'] },
        { when: { step: 'rounds.three' }, lines: ['Three more, one at a time, and each one is a proper walk across the town: the bypass road to the bus station, the far south end to the north, and Zilla Money all the way back down. The streets are longer than they look. Use the map.'] },
        { when: { step: 'rounds.report' }, lines: [
          'Four parcels in a morning. The desk has never had a morning like it.',
          'Two things now. Your bike needs looking at, and you need to eat something. Rayan for the bike. For the food, try Hotel Farsa, near the junction.'] },
        { when: { step: 'shuttle_start.briefing' }, lines: [
          'Here is the news. The people who live up and down this road keep asking for a lift between the junction, the bus yard, the medical college and the south end.',
          'So we start a little shuttle. Go to any auto stand and take Drive an auto. Then come back to the desk: it will give you a passenger instead of a parcel.',
          'The meter works like a real one: thirty rupees for the first one and a half kilometres, then fifteen for every kilometre after. Drive carefully. Nobody likes a fast auto.'] },
        { when: { step: 'first_fare.drive' }, lines: ['Take an auto from a stand, then ask the desk for a passenger. Your first one is waiting at the bus station, going to the medical college gate. Stop beside them, then stop again at the drop.'] },
        { when: { step: 'first_fare.report' }, lines: [
          'The first fare. Did they like the ride? I could not tell from here, but nobody has complained, and that is the best review in Manjeri.',
          'Do three more. Mini at the medical college has been hearing about it from the other nurses.'] },
        { when: { step: 'home.tell' }, lines: [
          'Malappuram has a Civil Station, a Collectorate, a bus terminal and, I am told, a very good Town Hall clock. All of it with no Chaya Express.',
          'A new stand there is a dream for another day. But you went, and you came back, and you did every parcel and every passenger on the way. That is a good week.',
          'Same time tomorrow?'] },
        { when: { done: 'home' }, lines: ['Same time tomorrow. The desk is open. Take as many parcels and passengers as you like.'] },
        { when: { done: 'first_fare' }, lines: ['The shuttle is yours. Take people where they need to go, and keep the meter honest.'] },
        { lines: ['Parcels at the desk, passengers from the autos. I am here all day.'] }
      ],
      hameed: [
        { when: { step: 'chaya.visit' }, lines: [
          'So you are the one Sreeja found. Sit down, have a chaya. It is on the house today and only today.',
          'Every rider who stops here learns the same thing: in Manjeri, nobody is in a hurry until they are late.',
          'Ride well. And remember: a glass of tea is faster than a lecture.'] },
        { lines: ['Chaya? Sit. The kettle is always on.'] }
      ],
      rayan: [
        { when: { step: 'bike_care.advice' }, lines: [
          'Ah, the delivery bike. I have seen it go past. You ride like someone who has never been shouted at.',
          'Two things. Keep the tyres firm, and keep the battery charged. The EV bay by the bus yard is free for a short top-up. A flat bike is a slow bike.',
          'Do it now, while I am watching. I like to see people listen.'] },
        { lines: ['I have a loose wire and an opinion about it. Come back when your bike needs me.'] }
      ],
      mini: [
        { when: { step: 'shift_change.nurse' }, lines: [
          'You are the shuttle! The other nurses told me. At the end of a shift, an auto home is worth more than a chocolate.',
          'If the desk stands near the medical college gate at shift change, you will never be short of passengers. Tell Sreeja I said so.',
          'And thank you. A ride home after a long night is a small kindness that helps a lot.'] },
        { lines: ['I have a shift to get to. Come back at shift change.'] }
      ],
      joseph: [
        { when: { step: 'bus_out.clerk' }, lines: [
          'Welcome to Malappuram. First time? Everyone says the junction is confusing. Everyone is right.',
          'Kozhikode buses leave from this side, Manjeri buses from that side, and Perinthalmanna from the other. If you remember that, you are better than the signboards.',
          'Go on, have a look round: the Civil Station is down that road, the Town Hall is close, and the bus home leaves from the counter behind you.'] },
        { when: { done: 'bus_out' }, lines: ['The bus to Manjeri leaves from the same counter. Mind the step.'] },
        { lines: ['Tickets? The counter is just behind you.'] }
      ]
    }
  };
  window.RoboStory.company = COMPANY;
})();
