/* PARKED: the DEAD SIGNAL thriller (Act 1), taken out of the game on 2026-10-28 when the story became the delivery story (src/js/story.js, CHAYA EXPRESS).
   To put it back: copy this file over src/js/story.js and restore tests/quests.test.js and tests/puzzles.test.js for it (the puzzle m01, the terminal and the 'puzzle' quest event are still in the code).
   All people and companies here are made up. The company name is a placeholder to check against real companies before anything is published. */
(function () {
  'use strict';
  const COMPANY = 'Axiom Infrastructure';
  window.RoboStory = {
    title: 'DEAD SIGNAL',
    tagline: 'The system remembers what everyone else forgot.',
    note: 'A mystery with a death in the story, told without anything graphic. All people and companies are made up.',
    chapters: [
      { id: 'a1', day: 'Act 1', title: 'The Dead Account', theme: 'A message from the past', place: 'manjeri', open: true, summary: 'At 2:17 in the morning a message arrives from a developer who died three years ago. It contains part of a function you wrote last week.' },
      { id: 'a2', day: 'Act 2', title: 'A Locked Office', theme: 'Trust', place: 'city', open: false, summary: 'A recording from a closed office in Kozhikode shows someone you trust. It was made before you ever met.' },
      { id: 'a3', day: 'Act 3', title: 'False Positive', theme: 'Proof', place: 'hilite', open: false, summary: 'Records that say they succeeded when they did not. Somebody has been tidying the numbers.' },
      { id: 'a4', day: 'Act 4', title: 'The Mountain Relay', theme: 'Loyalty', place: 'kozhikode', open: false, summary: 'A damaged data logger on the road up the ghat, and a friend who has not told you everything.' },
      { id: 'a5', day: 'Act 5', title: 'Dead Signal', theme: 'Choice', place: 'kozhikode', open: false, summary: 'Put the evidence together, check every claim, and decide what to do with it.' }
    ],
    npcs: {
      mira: { name: 'Mira Nair', emoji: '💻', role: 'Software engineer, your mentor', look: 'techieF', at: [667, -3.1], face: 0 },
      rayan: { name: 'Rayan', emoji: '🔧', role: 'Mechanic and electronics repair', look: 'lungi', at: [682, -3.1], face: 0 },
      stranger: { name: 'The stranger', emoji: '❓', role: 'Someone you have not met', look: 'thattam', at: [636, 14], face: 1.57 }
    },
    quests: [
      { id: 'message', chapter: 'a1', title: 'The 2:17 message', requires: [], reward: {}, steps: [{ id: 'show_mira', type: 'talk', npc: 'mira', text: 'Show Mira the message. She works in the software studio on Pandikkad Road, east of the bus station yard.' }] },
      { id: 'm01', chapter: 'a1', title: 'Mission 01: The dead account', requires: ['message'], reward: { coins: 80 }, steps: [{ id: 'fix', type: 'puzzle', puzzle: 'm01', text: 'Open the terminal and stop the notification that should not exist.' }, { id: 'report', type: 'talk', npc: 'mira', text: 'Tell Mira what you found.' }] },
      { id: 'garage', chapter: 'a1', title: 'A friend with tools', requires: ['m01'], reward: { coins: 40 }, steps: [{ id: 'see_rayan', type: 'talk', npc: 'rayan', text: 'Find Rayan at his repair shop on Pandikkad Road. He has your bike.' }] },
      { id: 'attachment', chapter: 'a1', title: 'Did you open the attachment?', requires: ['garage'], reward: { coins: 100 }, steps: [{ id: 'meet', type: 'talk', npc: 'stranger', text: 'Someone in the bus station yard has been waiting for you.' }] }
    ],
    dialogue: {
      mira: [
        { when: { step: 'message.show_mira' }, lines: ['You are up early. Or very late. Show me.', 'A message from Elias Varghese. At 2:17. In the console of a client account that was shut down last year.', 'Elias died three years ago. I worked with him. Do not forward this to anyone, and do not answer it. First, find out why a closed account is still talking.', 'Open your map, tap STORY, and open the terminal. Read the log. Whatever is sending this, it is real code, and real code can be fixed.'] },
        { when: { step: 'm01.fix' }, lines: ['The log is in the terminal (map, STORY, Open the terminal). Read the line that fires after the service was shut down. Something is still switched on that should not be.'] },
        { when: { step: 'm01.report' }, lines: ['It was a leftover condition. Somebody wrote that check years ago and nobody removed it. That part is easy to explain.', 'The part I cannot explain is the fragment inside the message. That is your function. From last week. In a private project.', 'Go and see Rayan. He has your bike, and he knows people who ask fewer questions than I do.'] },
        { when: { done: 'm01' }, lines: ['One thing at a time. See Rayan first. We will talk about the function when you are back.'] },
        { lines: ['Not now. I am trying to remember who else could have read that code.'] }
      ],
      rayan: [
        { when: { step: 'garage.see_rayan' }, lines: ['There you are. You are buying tea, and I nearly died fixing your bike. Fair trade, no?', 'It was the chain, and the battery, and a thing I will not describe. It runs. Do not thank me, pay me.', 'Mira sent you? She has been quiet since Monday. Whatever it is, you look like you have not slept.', 'Listen. There is someone in the bus station yard who has been asking about you. I did not tell him anything. I did not know anything to tell.'] },
        { when: { done: 'garage' }, lines: ['The bike is fine. You are the one who looks broken. Go and see who is waiting.'] },
        { lines: ['I have a loose wire and an opinion about it. Come back when you want the bike.'] }
      ],
      stranger: [
        { when: { step: 'attachment.meet' }, lines: ['Did you open the attachment?', 'Do not look at me like that. If you opened it, you have a problem. If you did not, I have a problem.', 'Somebody else in this town got a message last night too. They did not tell me what it said. They did not have to.', 'I cannot say more here. Not with the buses and the radios. There are things I will show you when you are in the city. Think about who you can trust.'] },
        { when: { done: 'attachment' }, lines: ['Not here. The city. When you are ready.'] },
        { lines: ['I am just waiting for a bus. Honest.'] }
      ]
    }
  };
  window.RoboStory.company = COMPANY;
})();
