/* Robo Run: readable notes in the walkable town. Every fact here was checked against a public source (named per note); nothing is invented.
   Exposes window.RoboExploreNotes = { NOTES }. Local review welcome: change the text here, nothing else needs to change. */
(function () {
  'use strict';
  const NOTES = {
    smstreet: {
      title: 'S. M. Street · മിഠായിത്തെരുവ്', emoji: '📜',
      body: 'S. M. stands for Sweet Meat. The street is about 2.1 km long and is said to go back to the Zamorin, who invited Gujarati sweetmeat makers to set up shop just outside the palace walls. It is known for Kozhikodan halwa, textiles and sweets.',
      src: 'Wikipedia: S. M. Street; Kerala Tourism'
    },
    renovation: {
      title: 'The 2017 makeover', emoji: '💡',
      body: 'In 2017 the street was beautified: the overhead power lines were removed and lamp posts were put up along it. It was formally opened on 23 December 2017. That is why this street has lamps but no tangle of wires.',
      src: 'Wikipedia: S. M. Street'
    },
    pottekkatt: {
      title: 'S. K. Pottekkatt · എസ്. കെ. പൊറ്റെക്കാട്ട്', emoji: '📖',
      body: 'His statue faces the street. He wrote Oru Theruvinte Katha (ഒരു തെരുവിന്റെ കഥ, The Story of a Street), a novel about this very street that won the Kerala Sahitya Akademi Award.',
      src: 'Wikipedia: S. M. Street'
    },
    swamy: {
      title: 'Swamy & Sons · കാപ്പി', emoji: '☕',
      body: 'A third-generation coffee store on S. M. Street. Wayanad coffee and Kozhikode go together: the Wayanadan coffee dish in your kitchen is named for the hills where the beans grow.',
      src: 'Press reports (The Week, August 2025)'
    },
    bombay: {
      title: 'Bombay Hotel · ബോംബെ ഹോട്ടൽ', emoji: '🍛',
      body: 'Serving since 1949 and famous for dum biryani, chattippathiri and elanchi. It stands near the beach, on the corner of the road that leads from the Corporation Office to Big Bazaar.',
      src: 'Onmanorama: Kozhikode’s oldest restaurants (2022)'
    },
    foodtrail: {
      title: 'Kozhikode food trail', emoji: '🍽️',
      body: 'Bombay Hotel (1949): dum biryani, near the beach.\nParagon (1939): Kozhikode–Kannur road, near CH Overbridge; vellappam and fish curry.\nHotel Rahmath: AG Road, near Mananchira; biryani.\nSagar (1978): Mavoor Road; spicy curries and flaky porotta.',
      src: 'Onmanorama: Kozhikode’s oldest restaurants (2022)'
    },
    home: {
      title: "Robo's dock · റോബോയുടെ വീട്", emoji: '🏠',
      body: 'Your robot’s own space. The wardrobe opens Characters and the stove opens the Kitchen. The charging cradle is waiting for the battery update, when charging at home will be free and charging in town will be billed.',
      src: 'This game'
    },
    zilmoney: {
      title: 'Zilla Money (a parody) · Silicon Jeri', emoji: '💼',
      body: 'Zilla Money is the game\'s parody of Zil Money, with its own name, coin logo and colours; no original logo or artwork is used. About the real company: Zil Money, the US fintech platform founded by Sabeer Nelli, runs part of its engineering operations from Manjeri, his hometown, through an idea called Silicon Jeri: letting engineers in Kerala work on global financial technology without having to move away.',
      src: 'Free Press Journal, 19 March 2026'
    },
    zilsite: {
      title: 'The real Manjeri site · മഞ്ചേരി', emoji: '🏢',
      body: 'Press reports describe a site of about 30,000 square feet in Manjeri that houses Zil Money\'s global development centre together with co-working space and digital innovation facilities. Reports differ on the numbers: one says over 200 people work there with room to grow to 1,400, an older one says up to 500. The office in the game is a smaller, simpler version.',
      src: 'Free Press Journal (March 2026); MyNation; Republic World'
    },
    zilcubator: {
      title: 'ZillaCubator (a parody) · Silicon Jeri', emoji: '🌱',
      body: 'ZillaCubator is the game\'s parody of ZilCubator, the accelerator that is part of Silicon Jeri. It is described as offering local entrepreneurs mentoring, funding links and access to global markets. A proposed Zil Park, a technology park modelled on Apple Park, has been spoken of as a plan; it is not built.',
      src: 'Free Press Journal; MyNation; Asianet Newsable'
    },
    zilwork: {
      title: 'Zilla Workspace (a parody) · co-working', emoji: '🪑',
      body: 'Press reports say the real Manjeri site has co-working space beside the development centre and the accelerator. Zilla Workspace is the game’s invented version: a bar-stool counter, hot desks, a glass meeting room and a pantry. The layout is made up for the game, not a copy of any real floor.',
      src: 'Free Press Journal (March 2026); MyNation; the room itself is invented'
    },
    zilterrace: {
      title: 'Zilla Terrace (a parody) · the roof', emoji: '🌿',
      body: 'Zilla Terrace is the game’s invented roof terrace, drawn from the owner’s photos of the real site: a wooden deck under a tin roof with hanging lamps, tall tables with stools, round windows with climbing plants, and pots everywhere. The layout and the people are made up for the game.',
      src: 'Photos supplied by the game’s owner; the room itself is invented'
    },
    zilwhat: {
      title: 'The real company: what it does', emoji: '💳',
      body: 'Zil Money calls itself a payment operations platform for businesses. One wallet balance can fund payments by ACH, wire, check or card: digital checks that are printed and mailed, bill pay, virtual cards, and an API for other software. It connects to accounting tools such as QuickBooks and NetSuite.',
      src: 'zilmoney.com (public website, read 28 October 2026)'
    },
    farsa: {
      title: 'Hotel Farsa · ഹോട്ടൽ ഫർസ', emoji: '🍛',
      body: 'An old Manjeri hotel on Pandikkad Road (Kuthukal), listed as started in 1940 and known for its porotta and biryani. Its listing mentions three branches in Manjeri and others in Nilambur and Kizhisseri.',
      src: 'Public business listing (yappe.in), as reported'
    },
    oottupura: {
      title: 'Hotel Oottupura · ഹോട്ടൽ ഊട്ടുപുര', emoji: '🍽️',
      body: 'A restaurant on Thurakkal Baputty Bypass Road in Manjeri, shown on Google Maps with about 1,100 reviews and 4.1 stars, open late (until about 1 am). Its front is a dark modern building with a glowing yellow Malayalam signboard and an open glass front over the food counters; it is known for breakfast such as dosa and idli. In the game it stands on the bypass road west of the junction.',
      src: 'Google Maps listing and photo (read 28 October 2026); yappe.in, layla.ai'
    },
    zindagi: {
      title: 'Hotel Zindagi · ഹോട്ടൽ സിന്ദഗി', emoji: '🍽️',
      body: 'A hotel at Nelliparambu in Manjeri on the Kozhikode-Manjeri road (marked 28), shown on Google Maps with about 320 reviews and 3.8 stars, open from early morning to about 12:10 am. Its front is a low cream shop with a striped awning and scooters parked outside. The listing does not give a menu, so the game serves the usual tea and snacks.',
      src: 'Google Maps listing and photo (read 28 October 2026); yappe.in'
    },
    vanitha: {
      title: 'Vanitha Mess · വനിത മെസ്', emoji: '🍛',
      body: 'A small mess in Manjeri, shown on Google Maps inside Maanu Memorial Hospital on Manjeri-Wandoor Road at Cherani (next to Sreedevi Cine Palace), with 4.7 stars from a handful of reviews. Reviews describe a simple, budget lunch served on a banana leaf. A mess is the Malayali name for a home-style meals canteen. In the game it stands on the highway north of the junction.',
      src: 'Google Maps listing and photo (read 28 October 2026); yappe.in'
    },
    kuzhimandi: {
      title: 'Kuzhi mandi · കുഴിമന്തി', emoji: '🍖',
      body: 'Kuzhi mandi is rice and meat cooked in an underground pit (kuzhi), a dish with roots in the Arab region, less greasy than biryani and now found across Kerala. Al Rayadhan Kuzhi Mandhi is shown on Google Maps on the highway north of Manjeri, near Cherani and Hotel Zindagi, with 4.2 stars from about 200 reviews, open until 11 pm. The game gives it a plain mandi menu.',
      src: 'Onmanorama (2019, 2025) on kuzhi mandi; Google Maps listing (read 28 October 2026)'
    },
    malappuram: {
      title: 'Malappuram · മലപ്പുറം', emoji: '🕌',
      body: 'The district town of Malappuram district, reached from Manjeri by KSRTC bus. On the map the KSRTC Bus Terminal stands at the junction where Malappuram-Perinthalmanna Road meets Kottakkunnu Road; Civil Station Road runs south-west past the Civil Station and the Collectorate, and the Town Hall and Mariyamman Kovil are close by. The game shows a small stretch round the junction.',
      src: 'Google Maps (read 28 October 2026); Wikipedia: Malappuram'
    },
    budget: {
      title: 'Budget Hyper Market · ബജറ്റ് ഹൈപ്പർ മാർക്കറ്റ്', emoji: '🛒',
      body: 'A big multi-storey hypermarket at Budget Circle on the Kozhikode-Malappuram bypass, near the Indira Gandhi Memorial Bus Terminal at Kacherippadi, shown on Google Maps with about 2,400 reviews and 4.1 stars, open until 11 pm. Its front is covered in large HYPER MARKET signboards. In the game it stands at the south end of the highway.',
      src: 'Google Maps listing and photo (read 28 October 2026)'
    },
    manjeri: {
      title: 'Manjeri · മഞ്ചേരി', emoji: '📍',
      body: 'Manjeri lies about 13 km north-east of Malappuram, the district headquarters, and 23 km from Karipur (Calicut) airport, on NH 966 and the Kozhikode–Palakkad highway. Malappuram is football country: the district sports complex at Payyanad seats 30,000.',
      src: 'Wikipedia: Manjeri; Malappuram District Sports Complex Stadium'
    },
    payyanad: {
      title: 'Payyanad Stadium', emoji: '⚽',
      body: 'The Malappuram District Sports Complex Stadium at Payyanad opened in 2013 with room for 30,000 spectators. It is about 7 km from Manjeri and 12 km from Malappuram, and hosted group matches of the 2013–14 Federation Cup. Turfs like this one are where the town plays.',
      src: 'Wikipedia: Malappuram District Sports Complex Stadium; Manjeri'
    },
    mcmanjeri: {
      title: 'Government Medical College, Manjeri', emoji: '🏥',
      body: 'Opened on 1 September 2013, with a 500-bed hospital and 12 operation theatres, about 12 km from Malappuram. This gate stands for it in the game.',
      src: 'Wikipedia: Government Medical College, Manjeri'
    },
    ksrtc: {
      title: 'KSRTC and the private buses', emoji: '🚌',
      body: 'KSRTC is Kerala’s state bus service. A Fast Passenger has a bright yellow front and a Super Fast a lighter red one. Private buses are colour-coded: green for city services, blue for rural, maroon for limited-stop, with three off-white lines above the floor.',
      src: 'Kerala Kaumudi (2023); Onmanorama (2018)'
    },
    ckstation: {
      title: 'Kozhikode railway station · കോഴിക്കോട് റെയിൽവേ സ്റ്റേഷൻ', emoji: '🚆',
      body: 'Station code CLT, run by Southern Railway in the Palakkad division. It has four platforms. The game shows one platform and a short train; the real station is much bigger.',
      src: 'Wikipedia: Kozhikode railway station'
    },
    emsstadium: {
      title: 'EMS Corporation Stadium · ഇ.എം.എസ്. സ്റ്റേഡിയം', emoji: '🏟️',
      body: 'On Rajaji Road. It opened in 1977, holds about 50,000 people and is named after E. M. S. Namboodiripad, Kerala’s first Chief Minister. Football is its main game. This frontage stands for it in the game.',
      src: 'Wikipedia: Kozhikode Corporation EMS Stadium'
    },
    babymemorial: {
      title: 'Baby Memorial Hospital', emoji: '🏥',
      body: 'At Arayidathupalam on Indira Gandhi Road. It was founded in 1987 by K. G. Alexander in memory of his father K. V. Varghese, known as Baby, and has about 500 beds. This block stands for it in the game.',
      src: 'Wikipedia: Baby Memorial Hospital'
    },
    mims: {
      title: 'Aster MIMS', emoji: '🏥',
      body: 'At Govindapuram. It opened in 2001 as MIMS and took the Aster name in 2015; it has about 600 beds. This block stands for it in the game.',
      src: 'Wikipedia: Aster MIMS'
    },
    kcitykseb: {
      title: 'KSEB chargers · ഇലക്ട്രിക് ചാർജിങ്', emoji: '🔌',
      body: 'KSEB has put pole-mounted chargers for electric autos and two-wheelers in Kozhikode city, in a pilot of about ten; you scan and pay on your phone. That is why the bays in the game take GPay only.',
      src: 'EQ Mag Pro; eMobility+ (2021, 2022)'
    },
    citybusstands: {
      title: 'The two bus stands · ബസ് സ്റ്റാൻഡുകൾ', emoji: '🚌',
      body: 'The KSRTC Bus Stand on Mavoor Road is described as the biggest in Kerala, about 36,000 square metres. Private buses to nearby districts leave from the Mofussil Bus Stand on Indira Gandhi Road (Mavoor Road).',
      src: 'Wikipedia: Transport in Kozhikode district; Mavoor Road'
    },
    hilitemall: {
      title: 'HiLITE Mall · ഹൈലൈറ്റ് മാൾ', emoji: '🛍️',
      body: 'On NH 66 near Palazhi, on the edge of Kozhikode. It opened on 10 April 2015 with about 1.26 million square feet built up, 810,000 of them retail, one of the largest malls in Kerala. The game’s mall is a small room with a supermarket and a food court.',
      src: 'Wikipedia: Hilite Mall Calicut; Palazhi'
    },
    hilitepark: {
      title: 'HiLITE Business Park', emoji: '🏢',
      body: 'Part of HiLITE City: twin office towers of about 1.4 million square feet that opened in April 2015, for IT firms, business services and start-ups. It is developed by HiLITE Realty, a Kozhikode company.',
      src: 'Wikipedia: HiLITE Business Park'
    },
    ulcyberpark: {
      title: 'UL Cyberpark · സൈബർപാർക്ക്', emoji: '💻',
      body: 'Built and run by ULCCS, a Kozhikode company, UL Cyberpark began work in 2012 near the bypass (NH 66); it has about 4.8 lakh square feet and a LEED Gold rating. The government’s Cyberpark is a separate campus at Nellikode, on 43.5 acres.',
      src: 'Wikipedia: Cyberpark, Kozhikode; Economy of Kozhikode district'
    },
    churam: {
      title: 'Thamarassery Churam · താമരശ്ശേരി ചുരം', emoji: '⛰️',
      body: 'The ghat road of NH 766 from Adivaram up to the Lakkidi view point, about 14 km, with nine hairpin bends. It is the main road from Kozhikode up into Wayanad. In the game the nine bends are packed into a short climb; every board counts one of them.',
      src: 'Wikipedia: Thamarassery Churam; National Highway 766 (India)'
    },
    lakkidi: {
      title: 'Lakkidi · ലക്കിടി', emoji: '🌫️',
      body: 'Lakkidi is the Wayanad end of the Churam climb, and is known as the gateway of Wayanad. The view point looks back down the ghat over the valley, often through mist. The game shows only the gateway: the area beyond it is not part of this world.',
      src: 'Wikipedia: Thamarassery Churam; Kerala Tourism'
    },
    literature: {
      title: 'City of Literature · സാഹിത്യ നഗരം', emoji: '🏛️',
      body: 'In October 2023 UNESCO named Kozhikode India’s first City of Literature. Kozhikode Beach hosts the Kerala Literature Festival every year; its 7th edition ran from 11 to 14 January 2023.',
      src: 'Onmanorama; Kerala Tourism; The Week'
    }
  };
  window.RoboExploreNotes = { NOTES };
})();
