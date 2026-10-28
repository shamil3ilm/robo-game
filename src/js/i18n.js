/* Robo Run: the Malayalam option. Exposes window.RoboI18n = { tr, lang, set, missing, DICT, PATTERNS }.
   English is the default. With Malayalam on, text that appears on the screen is swapped for the text in DICT (an exact match, ignoring case and any emoji in front) or for a PATTERN (a sentence with numbers or names in it);
   anything not listed stays English, so nothing is ever blank. Names that are already bilingual on signs and shop screens are left alone.
   To change or add a translation, edit DICT or PATTERNS below: nothing else needs to change. THESE ARE DRAFT TRANSLATIONS: a Malayali reader should review them (see the design doc).
   The page is only watched while Malayalam is on, so English costs nothing. Icon-font text (the names of icons) is never touched. */
(function () {
  'use strict';
  if (window.RoboI18n) return;   // the page loads each script twice; only the first copy runs, so there is one language state and one set of swapped nodes
  const KEY = 'runaway.lang';
  const DICT = {
    /* the home screen and the buttons under it */
    'START RUN': 'ഓട്ടം തുടങ്ങൂ', 'Missions': 'ദൗത്യങ്ങൾ', 'Characters': 'കഥാപാത്രങ്ങൾ', 'Badges': 'ബാഡ്ജുകൾ', 'Town': 'ടൗൺ', 'Kitchen': 'അടുക്കള', 'Bills': 'ബില്ലുകൾ', 'Settings': 'ക്രമീകരണങ്ങൾ',
    'A delivery robot on the Malabar coast. Run the beach, collect ingredients and cook meals that power your next run.': 'മലബാർ തീരത്തെ ഒരു ഡെലിവറി റോബോട്ട്. കടൽത്തീരത്തുകൂടി ഓടി ചേരുവകൾ ശേഖരിക്കൂ, അടുത്ത ഓട്ടത്തിനു കരുത്തുതരുന്ന ഭക്ഷണം ഉണ്ടാക്കൂ.',
    'Change lanes': 'പാത മാറ്റുക', 'Jump': 'ചാടുക', 'Slide': 'കുനിഞ്ഞു നീങ്ങുക', 'Corner buttons attack rivals': 'മൂലകളിലെ ബട്ടണുകൾ എതിരാളികളെ ആക്രമിക്കും', 'Swipe to change lanes': 'പാത മാറ്റാൻ വിരൽ വലിക്കുക',
    /* titles and the pause and result screens */
    'MISSIONS': 'ദൗത്യങ്ങൾ', 'CHARACTERS': 'കഥാപാത്രങ്ങൾ', 'BADGES': 'ബാഡ്ജുകൾ', 'KITCHEN': 'അടുക്കള', 'SETTINGS': 'ക്രമീകരണങ്ങൾ', 'DAILY CHALLENGE': 'ഇന്നത്തെ വെല്ലുവിളി', 'RECIPES': 'പാചകക്കുറിപ്പുകൾ',
    'PAUSED': 'നിർത്തിവച്ചു', 'RESUME': 'തുടരുക', 'Restart run': 'ഓട്ടം വീണ്ടും തുടങ്ങുക', 'Back to title': 'ആദ്യ സ്ക്രീനിലേക്ക്', 'Finish run and see results': 'ഓട്ടം തീർത്ത് ഫലം കാണുക',
    'SCORE': 'സ്കോർ', 'NEW BEST': 'പുതിയ റെക്കോർഡ്', 'RUN AGAIN': 'വീണ്ടും ഓടുക', 'SYSTEM FAILURE': 'സിസ്റ്റം തകരാർ', 'ENTERING': 'പ്രവേശിക്കുന്നു', 'LOADING': 'ലോഡ് ചെയ്യുന്നു', 'DONE': 'പൂർത്തിയായി', 'OWNED': 'സ്വന്തം', 'EQUIPPED': 'ധരിച്ചിരിക്കുന്നു', 'EQUIP': 'ധരിക്കുക', 'LOCKED': 'പൂട്ടിയത്',
    /* settings */
    'Game': 'ഗെയിം', 'Sound': 'ശബ്ദം', 'Display': 'ദൃശ്യം', 'Controls': 'നിയന്ത്രണങ്ങൾ', 'Save': 'സേവ്', 'Language': 'ഭാഷ', 'Pick the language of the menus': 'മെനുകളുടെ ഭാഷ തിരഞ്ഞെടുക്കൂ',
    "Who's playing": 'ആരാണ് കളിക്കുന്നത്', 'The full challenge': 'പൂർണ്ണ വെല്ലുവിളി', 'Kids': 'കുട്ടികൾ', 'Standard': 'സാധാരണ', 'Difficulty': 'ബുദ്ധിമുട്ട്', 'Relaxed': 'ശാന്തം', 'Moderate': 'ഇടത്തരം', 'Hard': 'കഠിനം',
    'World': 'ലോകം', 'Classic': 'ക്ലാസിക്', 'Malabar': 'മലബാർ', 'Kerala coast: Kozhikode Beach at sunset': 'കേരള തീരം: സൂര്യാസ്തമയത്തിലെ കോഴിക്കോട് ബീച്ച്', 'The lost jungle and its six zones': 'നഷ്ടപ്പെട്ട കാടും അതിന്റെ ആറു മേഖലകളും',
    'Combat': 'പോരാട്ടം', 'Rival robots, weapons and loot. Turn off to just run.': 'എതിരാളി റോബോട്ടുകൾ, ആയുധങ്ങൾ, കൊള്ളമുതൽ. ഓടാൻ മാത്രം വേണമെങ്കിൽ ഓഫ് ചെയ്യൂ.', 'Tutorial': 'പരിശീലനം', 'Play tutorial': 'പരിശീലനം കളിക്കുക', 'Practise the moves again': 'നീക്കങ്ങൾ വീണ്ടും പരിശീലിക്കൂ',
    'Graphics': 'ഗ്രാഫിക്സ്', 'Reduce motion': 'ചലനം കുറയ്ക്കുക', 'Text size': 'അക്ഷരവലിപ്പം', 'Fullscreen': 'ഫുൾസ്ക്രീൻ', 'Music': 'സംഗീതം', 'Sound effects': 'ശബ്ദ ഫലങ്ങൾ', 'Voice': 'ശബ്ദം (വോയ്സ്)', 'Subtitles': 'സബ്ടൈറ്റിലുകൾ',
    'Slower and friendlier, with unlimited lives': 'സാവധാനവും സൗഹൃദവുമായ രീതി, ജീവനുകൾ പരിധിയില്ലാതെ',
    /* the town: the hint line, jobs, labels on the use button */
    'WASD or arrows walk · Shift runs · Q E or drag to look · F to use · Esc to leave': 'WASD അല്ലെങ്കിൽ അമ്പടയാളങ്ങൾ: നടക്കാൻ · Shift: ഓടാൻ · Q E അല്ലെങ്കിൽ വലിക്കുക: ചുറ്റും നോക്കാൻ · F: ഉപയോഗിക്കാൻ · Esc: പുറത്തുപോകാൻ',
    'Delivery job': 'ഡെലിവറി ജോലി', 'CANCEL DELIVERY': 'ഡെലിവറി റദ്ദാക്കുക', 'Delivery cancelled': 'ഡെലിവറി റദ്ദാക്കി', 'KSRTC tickets': 'കെഎസ്ആർടിസി ടിക്കറ്റ്', 'Auto stand': 'ഓട്ടോ സ്റ്റാൻഡ്', 'Scrap dealer': 'ആക്രിക്കട', 'Supermarket': 'സൂപ്പർമാർക്കറ്റ്', 'Food court': 'ഫുഡ് കോർട്ട്',
    'KSEB EV charging': 'കെഎസ്ഇബി ഇവി ചാർജിങ്', 'Charging cradle · free': 'ചാർജിങ് തൊട്ടിൽ · സൗജന്യം', 'Footwear': 'ചെരിപ്പ് കട', 'Textiles': 'വസ്ത്രാലയം', 'Hardware': 'ഹാർഡ്‌വെയർ', 'Chaya Kada': 'ചായക്കട', 'Vaidyasala': 'വൈദ്യശാല', 'Wardrobe · Characters': 'അലമാര · കഥാപാത്രങ്ങൾ', 'Stove · Kitchen': 'അടുപ്പ് · അടുക്കള', 'Read the board': 'ബോർഡ് വായിക്കുക',
    /* shop and bill screens */
    'PAY WITH': 'പണമടയ്ക്കാൻ', 'CASH': 'പണം', 'YOUR BILL': 'നിങ്ങളുടെ ബിൽ', 'TO PAY': 'അടയ്ക്കേണ്ടത്', 'Total (prices include tax)': 'ആകെ (വിലയിൽ നികുതി ഉൾപ്പെടെ)', 'Total at the posted rates': 'എഴുതിയ നിരക്കിൽ ആകെ', 'Total paid to you': 'നിങ്ങൾക്ക് കിട്ടിയ ആകെ തുക',
    'ADD SOMETHING TO BUY': 'വാങ്ങാൻ എന്തെങ്കിലും ചേർക്കൂ', 'BACK TO THE ROAD': 'റോഡിലേക്ക് മടങ്ങുക', 'MY BILLS': 'എന്റെ ബില്ലുകൾ', 'HIDE MY BILLS': 'ബില്ലുകൾ മറയ്ക്കുക', 'CLOSE': 'അടയ്ക്കുക', 'CLOSED NOW': 'ഇപ്പോൾ അടച്ചിരിക്കുന്നു',
    'START THE RIDE': 'യാത്ര തുടങ്ങുക', 'BOARD THE BUS': 'ബസ്സിൽ കയറുക', 'SETTLE BY BARTER': 'സാധനങ്ങൾ നൽകി തീർക്കുക', 'SELL EVERYTHING I HAVE': 'എന്റെ കൈയിലുള്ളതെല്ലാം വിൽക്കുക', 'THE DEALER PAYS': 'കച്ചവടക്കാരൻ നൽകുന്നത്',
    'YOUR SCRAP BAG IS EMPTY': 'നിങ്ങളുടെ ആക്രിസഞ്ചി ഒഴിഞ്ഞതാണ്', 'CHOOSE WHAT TO SELL': 'വിൽക്കാനുള്ളത് തിരഞ്ഞെടുക്കൂ', 'NOTHING TO SELL': 'വിൽക്കാനൊന്നുമില്ല',
    'Add cash to your GPay balance:': 'GPay ബാലൻസിലേക്ക് പണം ചേർക്കൂ:', 'Thank you': 'നന്ദി', 'Paid by barter': 'സാധനങ്ങൾ നൽകി അടച്ചു', 'Your cart is empty.': 'നിങ്ങളുടെ കാർട്ട് ഒഴിഞ്ഞതാണ്.', 'Nothing to sell yet.': 'വിൽക്കാൻ ഒന്നുമായിട്ടില്ല.',
    'BILL': 'ബിൽ', 'SLIP': 'രസീത്', 'Every bill and slip, newest first.': 'എല്ലാ ബില്ലുകളും രസീതുകളും, പുതിയത് ആദ്യം.', 'One trip at a time.': 'ഒരു സമയം ഒരു യാത്ര മാത്രം.', 'Your battery is already full.': 'നിങ്ങളുടെ ബാറ്ററി ഇതിനകം നിറഞ്ഞിരിക്കുന്നു.',
    'No bills yet. Buy something, or sell scrap.': 'ഇതുവരെ ബില്ലുകളില്ല. എന്തെങ്കിലും വാങ്ങൂ, അല്ലെങ്കിൽ ആക്രി വിൽക്കൂ.',
    /* notices */
    'The rain stops.': 'മഴ നിന്നു.', 'It starts to rain. Your umbrella keeps you moving.': 'മഴ തുടങ്ങി. കുട ഉള്ളതുകൊണ്ട് നടത്തം തടസ്സപ്പെടില്ല.', 'It starts to rain. The wet street slows you. An umbrella from the Hardware shop helps.': 'മഴ തുടങ്ങി. നനഞ്ഞ വഴി നിങ്ങളെ വേഗം കുറയ്ക്കുന്നു. ഹാർഡ്‌വെയർ കടയിലെ കുട സഹായിക്കും.',
    'Already full (100%).': 'ഇതിനകം നിറഞ്ഞു (100%).', 'Battery empty: you crawl. Charge at home or at a KSEB bay.': 'ബാറ്ററി തീർന്നു: നിങ്ങൾ ഇഴയുകയാണ്. വീട്ടിലോ കെഎസ്ഇബി ബേയിലോ ചാർജ് ചെയ്യൂ.',
    'Picked up': 'എടുത്തു', 'Delivered!': 'എത്തിച്ചു!',
    /* ingredients, scrap, and the places a job or a ticket can name */
    'Rice': 'അരി', 'Ghee': 'നെയ്യ്', 'Jaggery': 'ശർക്കര', 'Spice mix': 'മസാലക്കൂട്ട്', 'Tea leaves': 'തേയില', 'Coconut': 'തേങ്ങ', 'Plantain': 'ഏത്തപ്പഴം', 'Black pepper': 'കുരുമുളക്', 'Cardamom': 'ഏലം', 'Coffee': 'കാപ്പി',
    'Newspaper bundle': 'പത്രക്കെട്ട്', 'Plastic bottles': 'പ്ലാസ്റ്റിക് കുപ്പികൾ', 'Tin cans': 'തകരടിന്നുകൾ', 'Glass bottles': 'ഗ്ലാസ് കുപ്പികൾ', 'Iron pieces': 'ഇരുമ്പ് കഷണങ്ങൾ',
    'Rubber chappals': 'റബ്ബർ ചെരിപ്പ്', 'Sports shoes': 'സ്പോർട്സ് ഷൂസ്', 'Umbrella': 'കുട', 'Slow charge (AC)': 'സാവധാന ചാർജ് (എസി)', 'Fast charge (DC)': 'വേഗത്തിലുള്ള ചാർജ് (ഡിസി)',
    'Tea stall': 'ചായക്കട', 'Railway station': 'റെയിൽവേ സ്റ്റേഷൻ', 'Kozhikode railway station': 'കോഴിക്കോട് റെയിൽവേ സ്റ്റേഷൻ', 'KSRTC Bus Stand': 'കെഎസ്ആർടിസി ബസ് സ്റ്റാൻഡ്', 'Kozhikode KSRTC Bus Stand': 'കോഴിക്കോട് കെഎസ്ആർടിസി ബസ് സ്റ്റാൻഡ്', 'Mofussil Bus Stand': 'മൊഫ്യൂസിൽ ബസ് സ്റ്റാൻഡ്',
    'EMS Stadium': 'ഇഎംഎസ് സ്റ്റേഡിയം', 'Baby Memorial Hospital': 'ബേബി മെമ്മോറിയൽ ആശുപത്രി', 'Aster MIMS': 'ആസ്റ്റർ മിംസ്', 'KSEB office': 'കെഎസ്ഇബി ഓഫീസ്', 'Pharmacy': 'ഫാർമസി', 'Football turf': 'ഫുട്ബോൾ ടർഫ്', 'Medical college gate': 'മെഡിക്കൽ കോളേജ് ഗേറ്റ്',
    'KSRTC station': 'കെഎസ്ആർടിസി സ്റ്റേഷൻ', 'KSRTC': 'കെഎസ്ആർടിസി', 'Business Park': 'ബിസിനസ് പാർക്ക്', 'HiLITE Business Park': 'ഹൈലൈറ്റ് ബിസിനസ് പാർക്ക്', 'HiLITE Mall': 'ഹൈലൈറ്റ് മാൾ', 'Mall forecourt': 'മാൾ മുറ്റം', 'UL Cyberpark': 'യു.എൽ. സൈബർപാർക്ക്', 'Bus stop': 'ബസ് സ്റ്റോപ്പ്', 'HiLITE bus stop': 'ഹൈലൈറ്റ് ബസ് സ്റ്റോപ്പ്',
    'Church square': 'ചർച്ച് സ്ക്വയർ', 'Hardware shop': 'ഹാർഡ്‌വെയർ കട', 'Textile shop': 'തുണിക്കട', 'Spice stall, market lane': 'സുഗന്ധവ്യഞ്ജനക്കട, ചന്ത ഇടവഴി', 'Flower stall, temple lane': 'പൂക്കട, അമ്പല ഇടവഴി', 'Sweet stall, promenade': 'മധുരക്കട, നടപ്പാത', 'Fishing boats': 'മീൻപിടുത്ത വള്ളങ്ങൾ',
    'Beach promenade': 'ബീച്ച് നടപ്പാത', 'Kozhikode Beach bus stop': 'കോഴിക്കോട് ബീച്ച് ബസ് സ്റ്റോപ്പ്', 'Manjeri KSRTC stand': 'മഞ്ചേരി കെഎസ്ആർടിസി സ്റ്റാൻഡ്', 'Manjeri town': 'മഞ്ചേരി ടൗൺ', 'Government Medical College': 'ഗവ. മെഡിക്കൽ കോളേജ്', 'HiLITE City bus stop': 'ഹൈലൈറ്റ് സിറ്റി ബസ് സ്റ്റോപ്പ്',
    'Mittai Theruvu, middle': 'മിഠായിത്തെരുവ്, നടുവിൽ', 'Mittai Theruvu, north end': 'മിഠായിത്തെരുവ്, വടക്കേ അറ്റം', 'Mavoor Road, middle': 'മാവൂർ റോഡ്, നടുവിൽ', 'Auto stand, KSRTC': 'ഓട്ടോ സ്റ്റാൻഡ്, കെഎസ്ആർടിസി'
  };
  Object.assign(DICT, {
    /* characters, dishes, the kitchen */
    'Scout': 'സ്കൗട്ട്', 'Jade': 'ജേഡ്', 'Ember': 'എംബർ', 'Frost': 'ഫ്രോസ്റ്റ്', 'Midnight': 'അർധരാത്രി', 'Golden': 'സ്വർണ്ണം', 'Fisher': 'മത്സ്യത്തൊഴിലാളി', 'Estate farmer': 'തോട്ടം കർഷകൻ', 'Footballer': 'ഫുട്ബോളർ', 'Chef': 'പാചകക്കാരൻ', 'Forest guide': 'കാട്ടുവഴികാട്ടി',
    'Mundu and shirt': 'മുണ്ടും ഷർട്ടും', 'Auto driver': 'ഓട്ടോ ഡ്രൈവർ', 'Kasavu set': 'കസവ് സെറ്റ്', 'Tap a character to try it on.': 'ഒരു കഥാപാത്രത്തിൽ തൊട്ട് ധരിച്ചുനോക്കൂ.', 'Unlocked': 'തുറന്നത്', 'Not reached yet': 'ഇതുവരെ എത്തിയിട്ടില്ല',
    'Kozhikodan halwa': 'കോഴിക്കോടൻ ഹൽവ', 'Malabar biryani': 'മലബാർ ബിരിയാണി', 'Pepper ghee rice': 'കുരുമുളക് നെയ്ച്ചോറ്', 'Sulaimani tea': 'സുലൈമാനി', 'Unnakkaya': 'ഉന്നക്കായ', 'Wayanadan coffee': 'വയനാടൻ കാപ്പി',
    'MEALS · PACK ONE FOR YOUR NEXT RUN': 'ഭക്ഷണം · അടുത്ത ഓട്ടത്തിനായി ഒന്ന് പായ്ക്ക് ചെയ്യൂ', 'MISSING INGREDIENTS': 'കുറവുള്ള ചേരുവകൾ', 'BACKPACK': 'ബാക്ക്പാക്ക്', 'Cook': 'പാകം ചെയ്യുക', 'Pack': 'പായ്ക്ക് ചെയ്യുക',
    'Empty. Run in the Malabar world and grab coconuts, rice, ghee, spice, tea, plantain, jaggery, and in Wayanad coffee, pepper and cardamom. They go into your backpack when the run ends.': 'ശൂന്യം. മലബാർ ലോകത്ത് ഓടി തേങ്ങ, അരി, നെയ്യ്, മസാല, തേയില, ഏത്തപ്പഴം, ശർക്കര എന്നിവയും വയനാട്ടിൽ കാപ്പി, കുരുമുളക്, ഏലം എന്നിവയും ശേഖരിക്കൂ. ഓട്ടം തീരുമ്പോൾ അവ നിങ്ങളുടെ ബാക്ക്പാക്കിൽ എത്തും.',
    'You have nothing this shop takes. Pick up ingredients around town or on a run.': 'ഈ കട സ്വീകരിക്കുന്നതൊന്നും നിങ്ങളുടെ കൈയിലില്ല. ടൗണിലോ ഓട്ടത്തിനിടയിലോ ചേരുവകൾ ശേഖരിക്കൂ.',
    /* more settings, and the controls, save and start screens */
    'High': 'ഉയർന്നത്', 'Low': 'താഴ്ന്നത്', 'Auto': 'സ്വയം', 'Turns off camera shake and flashing effects': 'ക്യാമറ കുലുക്കവും മിന്നുന്ന ഇഫക്റ്റുകളും ഓഫ് ചെയ്യും', 'Hides the browser bars': 'ബ്രൗസർ ബാറുകൾ മറയ്ക്കും',
    "Show the robot's voice lines as text": 'റോബോട്ടിന്റെ വാക്കുകൾ എഴുത്തായി കാണിക്കും', 'The robot calls out zones and power-ups': 'റോബോട്ട് മേഖലകളും പവർ-അപ്പുകളും വിളിച്ചുപറയും', 'Voice lines': 'ശബ്ദ വാക്കുകൾ', 'No music tracks loaded yet': 'സംഗീതം ഇതുവരെ ചേർത്തിട്ടില്ല',
    'Control style': 'നിയന്ത്രണ രീതി', 'Swipe and keys': 'വിരൽ വലിക്കലും കീകളും', 'Tap sides': 'വശങ്ങളിൽ തൊടുക', 'One button': 'ഒറ്റ ബട്ടൺ', 'Controller': 'കൺട്രോളർ', 'Not connected': 'ബന്ധിപ്പിച്ചിട്ടില്ല',
    'Swipe, or use the keyboard, to change lanes, jump and slide.': 'പാത മാറ്റാനും ചാടാനും കുനിയാനും വിരൽ വലിക്കുക, അല്ലെങ്കിൽ കീബോർഡ് ഉപയോഗിക്കുക.', 'D-pad or stick: change lanes. A: jump. B: slide. LB / RB: attack. Start: pause.': 'ഡി-പാഡ് അല്ലെങ്കിൽ സ്റ്റിക്ക്: പാത മാറ്റുക. A: ചാടുക. B: കുനിയുക. LB / RB: ആക്രമിക്കുക. Start: നിർത്തിവയ്ക്കുക.',
    'Backup code': 'ബാക്കപ്പ് കോഡ്', 'Copy code': 'കോഡ് പകർത്തുക', 'Restore from a code': 'കോഡിൽനിന്ന് തിരിച്ചെടുക്കുക', 'Restore': 'തിരിച്ചെടുക്കുക', 'Reset': 'റീസെറ്റ്', 'Start over': 'തുടക്കം മുതൽ',
    'Progress is saved on this device. Keep this code to move it to another device or get it back later.': 'പുരോഗതി ഈ ഉപകരണത്തിൽ സൂക്ഷിക്കുന്നു. മറ്റൊരു ഉപകരണത്തിലേക്ക് മാറ്റാനോ പിന്നീട് തിരിച്ചെടുക്കാനോ ഈ കോഡ് സൂക്ഷിക്കുക.', 'Replaces the progress on this device.': 'ഈ ഉപകരണത്തിലെ പുരോഗതിക്കു പകരം വയ്ക്കും.',
    "WHO'S PLAYING?": 'ആരാണ് കളിക്കുന്നത്?', 'You can change this any time in Settings.': 'ഇത് എപ്പോൾ വേണമെങ്കിലും ക്രമീകരണങ്ങളിൽ മാറ്റാം.', 'Tip: portrait mode gives a bigger view of the track.': 'ടിപ്പ്: പോർട്രെയിറ്റ് മോഡിൽ ട്രാക്ക് വലുതായി കാണാം.', 'KIDS MODE': 'കുട്ടികളുടെ മോഡ്', 'GUARDIAN': 'രക്ഷിതാവ്', 'Try again!': 'വീണ്ടും ശ്രമിക്കൂ!',
    'Missions pay out energy as soon as you finish them, even mid-run. Spend energy on new characters.': 'ദൗത്യം തീർക്കുമ്പോൾ തന്നെ ഊർജം കിട്ടും, ഓട്ടത്തിനിടയിലും. ഊർജം പുതിയ കഥാപാത്രങ്ങൾക്കായി ചെലവാക്കൂ.',
    /* words used in lists */
    'tickets': 'ടിക്കറ്റുകൾ', 'Kozhikode KSRTC': 'കോഴിക്കോട് കെഎസ്ആർടിസി', 'Barefoot': 'ചെരിപ്പില്ലാതെ', 'Chappals': 'ചെരിപ്പ്'
  });
  Object.assign(DICT, {
    /* what the shops sell: names, the little gloss under a name, and the lines about each shop */
    'Banana chips': 'ഏത്തക്കായ ഉപ്പേരി', 'kaya varuthathu': 'കായ വറുത്തത്', 'Pazhampori': 'പഴംപൊരി', 'banana fritter': 'വാഴപ്പഴം പൊരിച്ചത്', 'Unniyappam': 'ഉണ്ണിയപ്പം', 'sweet rice fritter': 'മധുരമുള്ള അരിപ്പലഹാരം', 'Tender coconut': 'ഇളനീർ', 'karikku': 'കരിക്ക്',
    'Herbal kashayam': 'കഷായം', 'herbal decoction': 'ഔഷധ കഷായം', 'Tulsi and ginger tea': 'തുളസി-ഇഞ്ചി ചായ', 'holy basil tea': 'തുളസിച്ചായ', 'Herbal balm': 'ഔഷധ ബാം',
    'Gumboots': 'ഗംബൂട്ട്സ്', 'rubber boots': 'റബ്ബർ ബൂട്ട്', 'Sickle': 'അരിവാൾ', 'aruval': 'അരിവാൾ', 'kuda': 'കുട',
    'Porotta and curry': 'പൊറോട്ടയും കറിയും', 'Dosa and chutney': 'ദോശയും ചമ്മന്തിയും', 'Buses to the other towns start when those towns open. Game fares and times.': 'മറ്റ് ടൗണുകളിലേക്കുള്ള ബസുകൾ ആ ടൗണുകൾ തുറക്കുമ്പോൾ തുടങ്ങും. ഗെയിം നിരക്കുകളും സമയവും.', 'Pazhampori': 'പഴംപൊരി', 'banana fritter': 'പഴംപൊരി', 'Meals on a banana leaf': 'ഇലയിൽ ഊണ്', 'Fish fry': 'മീൻ വറുത്തത്', 'Kuzhi mandi': 'കുഴിമന്തി', 'Mandi half portion': 'മന്തി ഹാഫ്', 'Lime juice': 'ലൈം ജ്യൂസ്',
    'A Manjeri hotel at Nelliparambu, open from early morning till late. Game prices.': 'നെല്ലിപ്പറമ്പിലെ മഞ്ചേരി ഹോട്ടൽ, അതിരാവിലെ മുതൽ രാത്രി വൈകി വരെ. ഗെയിം വിലകൾ.', 'A small Manjeri mess for simple lunches on a banana leaf. Game prices.': 'ഇലയിൽ ലളിതമായ ഊണിന് മഞ്ചേരിയിലെ ഒരു ചെറിയ മെസ്. ഗെയിം വിലകൾ.', 'A Manjeri place for kuzhi mandi, rice and meat cooked in a pit in the Arab style. Game prices.': 'അറബി രീതിയിൽ കുഴിയിൽ വേവിച്ച ചോറും ഇറച്ചിയും, കുഴിമന്തിക്ക് മഞ്ചേരിയിലെ ഒരിടം. ഗെയിം വിലകൾ.', 'Puttu and kadala': 'പുട്ടും കടലയും', 'Biryani': 'ബിരിയാണി', 'Chaya': 'ചായ', 'tea': 'ചായ', 'Dum biryani': 'ദം ബിരിയാണി', 'Chattippathiri': 'ചട്ടിപ്പത്തിരി', 'Elanchi': 'ഇലഞ്ചി',
    'Filter coffee': 'ഫിൽട്ടർ കാപ്പി', 'kaapi': 'കാപ്പി', 'Coffee powder pack': 'കാപ്പിപ്പൊടി പായ്ക്ക്', 'Coffee beans': 'കാപ്പിക്കുരു',
    'Hot tea and fresh snacks: every Kerala street has one.': 'ചൂടുചായയും പുതിയ പലഹാരങ്ങളും: കേരളത്തിലെ ഓരോ തെരുവിലും ഒരെണ്ണമുണ്ട്.', 'Ayurvedic herbs and remedies.': 'ആയുർവേദ മരുന്നുകളും ഔഷധങ്ങളും.', 'Tools for the road ahead.': 'മുന്നോട്ടുള്ള വഴിക്കുള്ള ഉപകരണങ്ങൾ.',
    'Mundu and shirt, khaki for the auto stand, the cream-and-gold kasavu of Onam, and work clothes.': 'മുണ്ടും ഷർട്ടും, ഓട്ടോ സ്റ്റാൻഡിനുള്ള ഖാക്കി, ഓണത്തിന്റെ ക്രീം-സ്വർണ്ണ കസവ്, പണിവസ്ത്രങ്ങൾ.',
    'Chappals and sports shoes. The best pair you own is the one you wear.': 'ചെരിപ്പുകളും സ്പോർട്സ് ഷൂസും. നിങ്ങളുടെ കൈയിലുള്ളതിൽ ഏറ്റവും നല്ല ജോടിയാണ് നിങ്ങൾ ധരിക്കുന്നത്.',
    'Old paper, plastic, tins, glass and iron, bought by weight at the posted rate. Cash only. Game rates.': 'പഴയ കടലാസ്, പ്ലാസ്റ്റിക്, തകരം, ഗ്ലാസ്, ഇരുമ്പ് എന്നിവ എഴുതിവച്ച നിരക്കിൽ തൂക്കത്തിനനുസരിച്ച് വാങ്ങും. പണമായി മാത്രം. ഗെയിം നിരക്കുകൾ.',
    'A public charging bay. You pay by the unit at the tariff of the hour, by GPay. Slow AC takes long and costs less; fast DC is quick and dearer. Game scale: a full battery is 3 units. Tariffs as reported in May 2025.': 'ഒരു പൊതു ചാർജിങ് ബേ. ആ സമയത്തെ നിരക്കിൽ യൂണിറ്റിന് GPay വഴി പണമടയ്ക്കണം. സാവധാന എസി കൂടുതൽ സമയമെടുക്കും, വില കുറവ്; വേഗമുള്ള ഡിസി വേഗത്തിലാകും, വില കൂടുതൽ. ഗെയിം അളവ്: ഒരു നിറഞ്ഞ ബാറ്ററി 3 യൂണിറ്റ്. 2025 മേയിൽ റിപ്പോർട്ട് ചെയ്ത നിരക്കുകൾ.',
    'A Manjeri restaurant known for its breakfast: dosa, idli and puttu. Game prices.': 'പ്രഭാതഭക്ഷണത്തിന് പേരുകേട്ട മഞ്ചേരിയിലെ ഒരു റെസ്റ്റോറന്റ്: ദോശ, ഇഡ്ഡലി, പുട്ട്. ഗെയിം വിലകൾ.', 'An old Manjeri hotel on Pandikkad Road, known for porotta and biryani. Game prices.': 'പാണ്ടിക്കാട് റോഡിലെ മഞ്ചേരിയിലെ ഒരു പഴയ ഹോട്ടൽ, പൊറോട്ടയ്ക്കും ബിരിയാണിക്കും പേരുകേട്ടത്. ഗെയിം വിലകൾ.', 'Dum biryani since 1949, near the beach. Game prices.': '1949 മുതൽ ദം ബിരിയാണി, കടപ്പുറത്തിനടുത്ത്. ഗെയിം വിലകൾ.',
    'A third-generation coffee store on S. M. Street. Game prices.': 'എസ്. എം. സ്ട്രീറ്റിലെ മൂന്നാം തലമുറ കാപ്പിക്കട. ഗെയിം വിലകൾ.', 'Everything for the kitchen. What you buy goes into your backpack, if there is room when you leave town. Game prices.': 'അടുക്കളയ്ക്ക് വേണ്ടതെല്ലാം. വാങ്ങുന്നത് ടൗൺ വിടുമ്പോൾ സ്ഥലമുണ്ടെങ്കിൽ നിങ്ങളുടെ ബാക്ക്പാക്കിൽ ചേരും. ഗെയിം വിലകൾ.',
    'KSRTC buses run between the town, the city and Manjeri. Game fares and times (the real runs are about 4 km and about 45 km); the clock moves on while you travel.': 'കെഎസ്ആർടിസി ബസ്സുകൾ ടൗൺ, നഗരം, മഞ്ചേരി എന്നിവയ്ക്കിടയിൽ ഓടുന്നു. ഗെയിം നിരക്കും സമയവും (യഥാർത്ഥ ദൂരം ഏകദേശം 4 കിലോമീറ്ററും 45 കിലോമീറ്ററും); യാത്രയ്ക്കിടയിൽ ക്ലോക്ക് മുന്നോട്ടു പോകും.',
    'Restores one heart': 'ഒരു ഹൃദയം തിരികെ തരും', 'Mud cannot slow you for the rest of this run': 'ഈ ഓട്ടത്തിൽ ചെളി നിങ്ങളെ വേഗം കുറയ്ക്കില്ല', 'Cuts through spider webs for the rest of this run': 'ഈ ഓട്ടത്തിൽ ചിലന്തിവലകൾ മുറിച്ചുകടക്കാം',
    'Opens by itself when you fall, and keeps the rain off in town, for good': 'വീഴുമ്പോൾ തനിയെ തുറക്കും, ടൗണിൽ മഴ കൊള്ളാതെ കാക്കും, എന്നെന്നേക്കും', 'Walk 8% faster in town': 'ടൗണിൽ 8% വേഗത്തിൽ നടക്കാം', 'Walk 15% faster in town, and every run starts with 12 seconds of sprint': 'ടൗണിൽ 15% വേഗത്തിൽ നടക്കാം, ഓരോ ഓട്ടവും 12 സെക്കൻഡ് അതിവേഗത്തോടെ തുടങ്ങും',
    'Goes into your backpack for the kitchen': 'അടുക്കളയ്ക്കായി ബാക്ക്പാക്കിൽ ചേരും', 'Evening and night (4 pm to 9 am)': 'വൈകുന്നേരവും രാത്രിയും (4 pm മുതൽ 9 am വരെ)', 'Day (9 am to 4 pm)': 'പകൽ (9 am മുതൽ 4 pm വരെ)',
    'A prepaid auto: the fare is the start fare of the meter plus a distance fare (₹30 and ₹15 for every 100 m; the town is small, so 100 m counts as a kilometre). You pay first, then ride.': 'ഒരു പ്രീപെയ്ഡ് ഓട്ടോ: മീറ്ററിന്റെ തുടക്ക നിരക്കും ദൂരത്തിനനുസരിച്ചുള്ള നിരക്കും ചേർന്നതാണ് യാത്രക്കൂലി (തുടക്കം ₹30, ഓരോ 100 മീറ്ററിനും ₹15; ടൗൺ ചെറുതായതിനാൽ 100 മീറ്റർ ഒരു കിലോമീറ്ററായി കണക്കാക്കും). ആദ്യം പണമടയ്ക്കുക, പിന്നെ യാത്ര ചെയ്യുക.'
  });
  Object.assign(DICT, {
    /* the map screen */
    'Map': 'ഭൂപടം', 'MAP': 'ഭൂപടം', 'REGION': 'മേഖല', 'HERE': 'ഇവിടെ', 'Near me': 'എന്റെ അടുത്ത്', 'Whole area': 'മുഴുവൻ പ്രദേശം', 'Key': 'സൂചിക', 'Show the way': 'വഴി കാണിക്കൂ', 'Clear the way': 'വഴി ഒഴിവാക്കൂ',
    'Tap a dot on the map, or a place in the list.': 'ഭൂപടത്തിലെ ഒരു കുത്തിൽ, അല്ലെങ്കിൽ പട്ടികയിലെ ഒരു സ്ഥലത്തിൽ തൊടൂ.', 'You are here.': 'നിങ്ങൾ ഇവിടെയാണ്.',
    'You have not been here yet. Take a KSRTC bus from any bus stop.': 'നിങ്ങൾ ഇവിടെ ഇതുവരെ പോയിട്ടില്ല. ഏതെങ്കിലും ബസ് സ്റ്റോപ്പിൽനിന്ന് കെഎസ്ആർടിസി ബസ്സിൽ പോകൂ.',
    'Shops': 'കടകൾ', 'Eat and drink': 'ഭക്ഷണവും പാനീയവും', 'Health': 'ആരോഗ്യം', 'Autos and buses': 'ഓട്ടോയും ബസ്സും', 'Charging': 'ചാർജിങ്', 'Services': 'സേവനങ്ങൾ', 'Delivery jobs': 'ഡെലിവറി ജോലികൾ', 'Places to enter': 'അകത്തു കയറാവുന്ന സ്ഥലങ്ങൾ', 'Read about': 'വായിച്ചറിയാൻ', 'The run': 'ഓട്ടം', 'Home': 'വീട്',
    'Delivery desk': 'ഡെലിവറി ഡെസ്ക്', 'Beach town': 'ബീച്ച് ടൗൺ', 'City': 'നഗരം', 'HiLITE City': 'ഹൈലൈറ്റ് സിറ്റി', 'The Churam': 'ചുരം', 'Arabian Sea': 'അറബിക്കടൽ', 'WAYANAD': 'വയനാട്', 'NH 766 · run it': 'NH 766 · ഓടിക്കൊണ്ട്',
    'Sketch: directions about right, distances not to scale. Blue lines are KSRTC buses. Locked places are restricted areas.': 'രേഖാചിത്രം: ദിശകൾ ഏകദേശം ശരി, ദൂരങ്ങൾ അളവനുസരിച്ചല്ല. നീല വരകൾ കെഎസ്ആർടിസി ബസ്സുകൾ. പൂട്ടിയ സ്ഥലങ്ങൾ നിയന്ത്രിത മേഖലകളാണ്.',
    'Restricted area': 'നിയന്ത്രിത മേഖല', 'This part of Malabar is not open yet. It is planned for a later chapter.': 'മലബാറിലെ ഈ ഭാഗം ഇതുവരെ തുറന്നിട്ടില്ല. ഇത് പിന്നീടുള്ള ഒരു അധ്യായത്തിനായി ആസൂത്രണം ചെയ്തിരിക്കുന്നു.',
    'Malappuram': 'മലപ്പുറം', 'Kondotty and Karipur airport': 'കൊണ്ടോട്ടിയും കരിപ്പൂർ വിമാനത്താവളവും', 'Karipur': 'കരിപ്പൂർ', 'Nilambur': 'നിലമ്പൂർ', 'Wayanad beyond Lakkidi': 'ലക്കിടിക്കപ്പുറത്തെ വയനാട്', 'Beyond Lakkidi': 'ലക്കിടിക്കപ്പുറം',
    'Kozhikode Beach and Mittai Theruvu': 'കോഴിക്കോട് ബീച്ചും മിഠായിത്തെരുവും', 'Kozhikode city (Mavoor Road)': 'കോഴിക്കോട് നഗരം (മാവൂർ റോഡ്)', 'HiLITE City (Palazhi)': 'ഹൈലൈറ്റ് സിറ്റി (പാലാഴി)', 'Thamarassery Churam': 'താമരശ്ശേരി ചുരം', 'Manjeri': 'മഞ്ചേരി',
    'Mittai Theruvu': 'മിഠായിത്തെരുവ്', 'Kozhikode Beach': 'കോഴിക്കോട് ബീച്ച്', 'The sea': 'കടൽ', 'Church square': 'ചർച്ച് സ്ക്വയർ', 'Temple lane': 'അമ്പല ഇടവഴി', 'Market lane': 'ചന്ത ഇടവഴി', 'Temple courtyard': 'ക്ഷേത്രമുറ്റം', 'Mosque courtyard': 'പള്ളിമുറ്റം',
    'KSEB': 'കെഎസ്ഇബി', 'School': 'സ്കൂൾ', 'Main road': 'പ്രധാന റോഡ്', 'HiLITE City road': 'ഹൈലൈറ്റ് സിറ്റി റോഡ്', 'NH 66 bypass': 'എൻഎച്ച് 66 ബൈപ്പാസ്', 'KSRTC station': 'കെഎസ്ആർടിസി സ്റ്റേഷൻ',
    'The old sweet street (S. M. Street, about 2.1 km long), the beach where the Kerala Literature Festival is held, a temple, a mosque and a church, and Robo\'s dock. Kozhikode became a UNESCO City of Literature in October 2023.': 'പഴയ മധുരത്തെരുവ് (എസ്. എം. സ്ട്രീറ്റ്, ഏകദേശം 2.1 കിലോമീറ്റർ നീളം), കേരള സാഹിത്യോത്സവം നടക്കുന്ന കടപ്പുറം, ഒരു ക്ഷേത്രം, ഒരു പള്ളി, ഒരു ചർച്ച്, റോബോയുടെ ഡോക്ക്. 2023 ഒക്ടോബറിൽ കോഴിക്കോട് യുനെസ്കോ സാഹിത്യനഗരമായി.',
    'The railway station (four platforms), the KSRTC Bus Stand and the Mofussil Bus Stand, EMS Stadium (opened 1977, about 50,000 seats), Baby Memorial Hospital, Aster MIMS and a school.': 'റെയിൽവേ സ്റ്റേഷൻ (നാല് പ്ലാറ്റ്ഫോമുകൾ), കെഎസ്ആർടിസി ബസ് സ്റ്റാൻഡും മൊഫ്യൂസിൽ ബസ് സ്റ്റാൻഡും, ഇഎംഎസ് സ്റ്റേഡിയം (1977-ൽ തുറന്നു, ഏകദേശം 50,000 സീറ്റ്), ബേബി മെമ്മോറിയൽ ആശുപത്രി, ആസ്റ്റർ മിംസ്, ഒരു സ്കൂൾ.',
    'HiLITE Mall (opened 10 April 2015), the HiLITE Business Park twin towers, UL Cyberpark, and the NH 66 bypass.': 'ഹൈലൈറ്റ് മാൾ (2015 ഏപ്രിൽ 10-ന് തുറന്നു), ഹൈലൈറ്റ് ബിസിനസ് പാർക്കിന്റെ ഇരട്ട ടവറുകൾ, യു.എൽ. സൈബർപാർക്ക്, എൻഎച്ച് 66 ബൈപ്പാസ്.',
    'A Malappuram town: the KSRTC station, Hotel Farsa on Pandikkad Road, a football turf (Malappuram is football country), the Government Medical College and Zilla Money, the game\'s parody of Zil Money\'s engineering office.': 'മലപ്പുറം ജില്ലയിലെ ഒരു ടൗൺ: കെഎസ്ആർടിസി സ്റ്റേഷൻ, പാണ്ടിക്കാട് റോഡിലെ ഹോട്ടൽ ഫർസ, ഒരു ഫുട്ബോൾ ടർഫ് (മലപ്പുറം ഫുട്ബോളിന്റെ നാടാണ്), ഗവ. മെഡിക്കൽ കോളേജ്, സിൽ മണിയുടെ എൻജിനീയറിങ് ഓഫീസിന്റെ ഗെയിമിലെ പാരഡിയായ സില്ല മണി.',
    'NH 766 climbs about 14 km from Adivaram to the Lakkidi view point in nine hairpin bends, into Wayanad. You reach it on the three-lane run: keep running along the beach road and the ghat begins.': 'എൻഎച്ച് 766 അടിവാരത്തുനിന്ന് ലക്കിടി വ്യൂ പോയിന്റ് വരെ ഏകദേശം 14 കിലോമീറ്റർ ഒൻപത് ഹെയർപിൻ വളവുകളിലൂടെ വയനാട്ടിലേക്ക് കയറുന്നു. മൂന്നുവരി ഓട്ടത്തിൽ നിങ്ങൾക്ക് ഇവിടെ എത്താം: കടപ്പുറം റോഡിലൂടെ ഓടിക്കൊണ്ടിരിക്കൂ, ചുരം തുടങ്ങും.'
  });
  /* sentences with a number or a name inside: [regexp on the whole text (after any emoji in front), builder] */
  const PATTERNS = [
    [/^(\d+) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec), (\d+:\d+ [ap]m)$/, (m) => m[1] + ' ' + MONTHS[m[2]] + ', ' + m[3]],
    [/^Run (\d[\d,]*) m in one run$/, (m) => 'ഒരു ഓട്ടത്തിൽ ' + m[1] + ' മീറ്റർ ഓടുക'],
    [/^Run (\d[\d,]*) m in total$/, (m) => 'ആകെ ' + m[1] + ' മീറ്റർ ഓടുക'],
    [/^Run (\d[\d,]*) m without a scratch$/, (m) => 'ഒരു പോറലുമില്ലാതെ ' + m[1] + ' മീറ്റർ ഓടുക'],
    [/^Collect (\d[\d,]*) energy in one run$/, (m) => 'ഒരു ഓട്ടത്തിൽ ' + m[1] + ' ഊർജം ശേഖരിക്കുക'],
    [/^Collect (\d[\d,]*) energy in total$/, (m) => 'ആകെ ' + m[1] + ' ഊർജം ശേഖരിക്കുക'],
    [/^Jump over (\d+) obstacles in one run$/, (m) => 'ഒരു ഓട്ടത്തിൽ ' + m[1] + ' തടസ്സങ്ങൾക്കു മുകളിലൂടെ ചാടുക'],
    [/^Slide under (\d+) beams in one run$/, (m) => 'ഒരു ഓട്ടത്തിൽ ' + m[1] + ' കമ്പികൾക്കടിയിലൂടെ നീങ്ങുക'],
    [/^Dodge (\d+) blocks in one run$/, (m) => 'ഒരു ഓട്ടത്തിൽ ' + m[1] + ' ബ്ലോക്കുകൾ ഒഴിഞ്ഞുമാറുക'],
    [/^Pick up (\d+) power-ups in one run$/, (m) => 'ഒരു ഓട്ടത്തിൽ ' + m[1] + ' പവർ-അപ്പുകൾ എടുക്കുക'],
    [/^Play (\d+) runs$/, (m) => m[1] + ' ഓട്ടങ്ങൾ കളിക്കുക'],
    [/^Reach the (.+)$/, (m) => m[1] + ' എത്തുക'],
    [/^(\d+) of (\d+) slots$/, (m) => m[1] + '/' + m[2] + ' സ്ലോട്ടുകൾ'],
    [/^(\d+) of (\d+) unlocked$/, (m) => m[1] + '/' + m[2] + ' തുറന്നു'],
    [/^Bigger backpack: \+(\d+) slots for (\d+) energy$/, (m) => 'വലിയ ബാക്ക്പാക്ക്: +' + m[1] + ' സ്ലോട്ടുകൾ ' + m[2] + ' ഊർജത്തിന്'],
    [/^Picks the best setting for this device\. Using (\w+) now\.$/, (m) => 'ഈ ഉപകരണത്തിനു ചേരുന്ന മികച്ച ക്രമീകരണം തിരഞ്ഞെടുക്കും. ഇപ്പോൾ ' + ({ Low: 'താഴ്ന്നത്', High: 'ഉയർന്നത്' }[m[1]] || m[1]) + ' ഉപയോഗിക്കുന്നു.'],
    [/^New challenge in (\d+) hours?$/, (m) => 'പുതിയ വെല്ലുവിളി ' + m[1] + ' മണിക്കൂറിൽ'],
    [/^Barter: pay with goods from your backpack(?: \((.+)\))?$/, (m) => 'സാധനങ്ങൾ നൽകി അടയ്ക്കാം: ബാക്ക്പാക്കിലെ സാധനങ്ങൾ' + (m[1] ? ' (' + m[1] + ')' : '')],
    [/^Barter: (.+) × (\d+) @ (₹[\d.,]+)$/, (m) => 'സാധനം നൽകി: ' + nm(m[1]) + ' × ' + m[2] + ' @ ' + m[3]],
    [/^Barter (₹[\d.,]+) \+ (cash|GPay) (₹[\d.,]+)(.*)$/, (m) => 'സാധനങ്ങൾ ' + m[1] + ' + ' + (m[2] === 'cash' ? 'പണം ' : 'GPay ') + m[3] + m[4]],
    [/^(.+) × (\d+) @ (₹[\d.,]+)$/, (m) => nm(m[1]) + ' × ' + m[2] + ' @ ' + m[3]],
    [/^Pulls in energy cells for (\d+) seconds$/, (m) => m[1] + ' സെക്കൻഡ് ഊർജ സെല്ലുകളെ വലിച്ചടുപ്പിക്കും'],
    [/^Double score for (\d+) seconds$/, (m) => m[1] + ' സെക്കൻഡ് ഇരട്ടി സ്കോർ'],
    [/^A shield for (\d+) seconds$/, (m) => m[1] + ' സെക്കൻഡ് സംരക്ഷണ കവചം'],
    [/^A shield for the first (\d+) seconds$/, (m) => 'ആദ്യത്തെ ' + m[1] + ' സെക്കൻഡ് സംരക്ഷണ കവചം'],
    [/^Run (\d+)% faster for (\d+) seconds$/, (m) => m[2] + ' സെക്കൻഡ് ' + m[1] + '% വേഗത്തിൽ ഓടാം'],
    [/^([\d.]+) kg a piece at (₹[\d.]+)\/kg$/, (m) => 'ഒന്നിന് ' + m[1] + ' കിലോ, കിലോയ്ക്ക് ' + m[2]],
    [/^\+(\d+)% battery$/, (m) => '+' + m[1] + '% ബാറ്ററി'],
    [/^([\d.]+) unit at (₹[\d.]+)\/unit$/, (m) => m[1] + ' യൂണിറ്റ്, യൂണിറ്റിന് ' + m[2]],
    [/^(\d+) min$/, (m) => m[1] + ' മിനിറ്റ്'],
    [/^(\d+) m · about (\d+) seconds$/, (m) => m[1] + ' മീറ്റർ · ഏകദേശം ' + m[2] + ' സെക്കൻഡ്'],
    [/^KSRTC · about (?:(\d+) h )?(\d+) min$/, (m) => 'കെഎസ്ആർടിസി · ഏകദേശം ' + (m[1] ? m[1] + ' മണിക്കൂർ ' : '') + m[2] + ' മിനിറ്റ്'],
    [/^KSRTC · about (\d+) h$/, (m) => 'കെഎസ്ആർടിസി · ഏകദേശം ' + m[1] + ' മണിക്കൂർ'],
    [/^You have arrived: (.+)$/, (m) => 'നിങ്ങൾ എത്തി: ' + nm(m[1])],
    [/^Clear the way to (.+)$/, (m) => nm(m[1]) + ' എന്നിടത്തേക്കുള്ള വഴി ഒഴിവാക്കൂ'],
    [/^KSRTC from here: (.+)$/, (m) => 'ഇവിടെനിന്ന് കെഎസ്ആർടിസി: ' + m[1].split(' · ').map((x) => x.replace(/^(.+?) (₹.*)$/, (mm, a2, b2) => nm(a2) + ' ' + b2)).join(' · ')],
    [/^(.+?) · (\d+(?:\.\d)? (?:m|km)) · (Shops|Eat and drink|Health|Autos and buses|Charging|Services|Delivery jobs|Places to enter|Read about|The run|Home)$/, (m) => nm(m[1]) + ' · ' + m[2] + ' · ' + nm(m[3])],
    [/^PAY (₹[\d,]+) IN CASH$/i, (m) => 'പണമായി ' + m[1] + ' അടയ്ക്കുക'],
    [/^PAY (₹[\d,]+) WITH GPAY$/i, (m) => 'GPay വഴി ' + m[1] + ' അടയ്ക്കുക'],
    [/^SELL FOR (₹[\d,]+)$/i, (m) => m[1] + '-ന് വിൽക്കുക'],
    [/^Closed now\. Open (.+) to (.+)\.$/, (m) => 'ഇപ്പോൾ അടച്ചിരിക്കുന്നു. തുറക്കുന്ന സമയം: ' + m[1] + ' മുതൽ ' + m[2] + ' വരെ.'],
    [/^(.*?) ?Open (.+) to (.+) \(game hours\)\.$/, (m) => (m[1] ? tr(m[1]) + ' ' : '') + 'തുറന്നിരിക്കുന്ന സമയം: ' + m[2] + ' മുതൽ ' + m[3] + ' വരെ (ഗെയിം സമയം).'],
    [/^Open (.+) to (.+) \(game hours\)\.$/, (m) => 'തുറന്നിരിക്കുന്ന സമയം: ' + m[1] + ' മുതൽ ' + m[2] + ' വരെ (ഗെയിം സമയം).'],
    [/^Battery (\d+)%\. Charge soon: home is free, KSEB bays cost\.$/, (m) => 'ബാറ്ററി ' + m[1] + '%. ഉടൻ ചാർജ് ചെയ്യൂ: വീട്ടിൽ സൗജന്യം, കെഎസ്ഇബി ബേയിൽ പണം നൽകണം.'],
    [/^Charged to (\d+)% at home, free\. (\d+) h (\d+) min passed\.$/, (m) => 'വീട്ടിൽ ' + m[1] + '% വരെ ചാർജ് ചെയ്തു, സൗജന്യം. ' + m[2] + ' മണിക്കൂർ ' + m[3] + ' മിനിറ്റ് കഴിഞ്ഞു.'],
    [/^Charged to (\d+)%\. (\d+) h (\d+) min passed\.$/, (m) => m[1] + '% വരെ ചാർജ് ചെയ്തു. ' + m[2] + ' മണിക്കൂർ ' + m[3] + ' മിനിറ്റ് കഴിഞ്ഞു.'],
    [/^Battery (\d+)%$/, (m) => 'ബാറ്ററി ' + m[1] + '%'],
    [/^Scrap bag (\d+) of (\d+)$/, (m) => 'ആക്രിസഞ്ചി ' + m[1] + '/' + m[2]],
    [/^Your scrap bag is full \((\d+) of (\d+)\)\. Sell some to the scrap dealer\.$/, (m) => 'നിങ്ങളുടെ ആക്രിസഞ്ചി നിറഞ്ഞു (' + m[1] + '/' + m[2] + '). കുറച്ച് ആക്രിക്കടയിൽ വിൽക്കൂ.'],
    [/^Delivered! (₹\d+)( \+ (₹\d+) tip)?$/, (m) => 'എത്തിച്ചു! ' + m[1] + (m[3] ? ' + ' + m[3] + ' ടിപ്പ്' : '')],
    [/^Picked up\. Deliver to (.+)\.$/, (m) => 'എടുത്തു. ' + nm(m[1]) + ' എന്നിടത്ത് എത്തിക്കൂ.'],
    [/^Parcel for (.+)\. Collect it at (.+)\.$/, (m) => nm(m[1]) + ' എന്നിടത്തേക്കുള്ള പാഴ്സൽ. ' + nm(m[2]) + ' എന്നിടത്തുനിന്ന് എടുക്കൂ.'],
    [/^Collect at (.+) · (₹\d+)(.*)$/, (m) => nm(m[1]) + ' എന്നിടത്തുനിന്ന് എടുക്കൂ · ' + m[2] + m[3]],
    [/^Deliver to (.+) · (₹\d+)(.*)$/, (m) => nm(m[1]) + ' എന്നിടത്ത് എത്തിക്കൂ · ' + m[2] + m[3]],
    [/^Leave (.+)$/i, (m) => nm(m[1]) + ' വിടുക'],
    [/^Enter (.+)$/i, (m) => nm(m[1]) + ' ഉള്ളിലേക്ക്'],
    [/^(.+) meter (₹\d+) · (\d+) s$/, (m) => nm(m[1]) + ' · മീറ്റർ ' + m[2] + ' · ' + m[3] + ' സെ'],
    [/^Ticket to (.+)$/, (m) => nm(m[1]) + ' എന്നിടത്തേക്കുള്ള ടിക്കറ്റ്'],
    [/^To (.+)$/, (m) => nm(m[1]) + ' എന്നിടത്തേക്ക്'],
    [/^(.+) \+1 \((\d+) of (\d+)\)$/, (m) => nm(m[1]) + ' +1 (' + m[2] + '/' + m[3] + ')'],
    [/^The prepaid fare was (₹\d+)\.$/, (m) => 'മുൻകൂർ അടച്ച നിരക്ക് ' + m[1] + ' ആയിരുന്നു.'],
    [/^Paid in cash (₹\d+)$/, (m) => 'പണമായി ' + m[1] + ' അടച്ചു'],
    [/^Paid by GPay (₹\d+)(.*)$/, (m) => 'GPay വഴി ' + m[1] + ' അടച്ചു' + m[2]],
    [/^The dealer paid you (₹\d+) in cash$/, (m) => 'കച്ചവടക്കാരൻ നിങ്ങൾക്ക് ' + m[1] + ' പണമായി തന്നു'],
    [/^Auto stand, (.+)$/, (m) => 'ഓട്ടോ സ്റ്റാൻഡ്, ' + nm(m[1])],
    [/^you have (\d+)$/, (m) => 'നിങ്ങളുടെ കൈയിൽ ' + m[1]]
  ];
  const MONTHS = { Jan: 'ജനുവരി', Feb: 'ഫെബ്രുവരി', Mar: 'മാർച്ച്', Apr: 'ഏപ്രിൽ', May: 'മേയ്', Jun: 'ജൂൺ', Jul: 'ജൂലൈ', Aug: 'ഓഗസ്റ്റ്', Sep: 'സെപ്റ്റംബർ', Oct: 'ഒക്ടോബർ', Nov: 'നവംബർ', Dec: 'ഡിസംബർ' };
  const hasMl = (s) => /[ഀ-ൿ]/.test(s);
  const lc = {}; for (const k of Object.keys(DICT)) lc[k.toLowerCase()] = DICT[k];
  const nm = (name) => { const k = String(name).trim(); return DICT[k] || lc[k.toLowerCase()] || name; };   // a name inside a sentence: translated if known, else left as it is
  const cache = new Map();
  /* translate one piece of text, or return it unchanged: whitespace and any leading symbols (emoji, bullets) are kept */
  const tr = (text) => {
    if (typeof text !== 'string') return text;
    if (cache.has(text)) return cache.get(text);
    let out = text; const lead = (text.match(/^[\s -⯿\u{1F000}-\u{1FFFF}️·•▸▾]*/u) || [''])[0], trail = (text.match(/\s*$/) || [''])[0], core = text.slice(lead.length, text.length - trail.length);
    if (core && /[A-Za-z]{2,}/.test(core) && !hasMl(core)) {
      let ml = DICT[core] || lc[core.toLowerCase()];
      if (!ml) for (const [re, f] of PATTERNS) { const m = re.exec(core); if (m) { ml = f(m); break; } }
      if (!ml && core.indexOf(' · ') > 0) { const parts = core.split(' · '), done = parts.map((x) => tr(x)); if (done.some((x, i) => x !== parts[i])) ml = done.join(' · '); }   // "Battery 94% · Scrap bag 2 of 30": each piece on its own
      if (ml) out = lead + ml + trail;
    }
    if (cache.size > 3000) cache.clear(); cache.set(text, out); return out;
  };

  let lang = 'en'; try { lang = localStorage.getItem(KEY) === 'ml' ? 'ml' : 'en'; } catch (e) { /* English */ }
  const orig = new WeakMap(), gaps = new Set(); let obs = null;
  const isIcon = (el) => !!el && ((el.style && /Material/.test(el.style.fontFamily || '')) || /material-symbols/.test(el.className || ''));
  const fix = (node) => {
    const v = node.nodeValue, o = orig.get(node);
    if (lang !== 'ml') { if (o) { if (v === o.out) node.nodeValue = o.en; orig.delete(node); } return; }   // English: put back what we swapped (unless the page has since written something new)
    if (o && v === o.out) return;
    if (isIcon(node.parentNode) || /^(SCRIPT|STYLE|TEXTAREA)$/.test((node.parentNode && node.parentNode.tagName) || '')) return;
    const out = tr(v);
    if (out !== v) { orig.set(node, { en: v, out }); node.nodeValue = out; } else { if (o) orig.delete(node); if (/[A-Za-z]{3,}/.test(v) && !hasMl(v) && v.indexOf('{{') < 0) gaps.add(v.trim().replace(/\s+/g, ' ')); }
  };
  const walk = (root) => {
    if (!root) return;
    if (root.nodeType === 3) { fix(root); return; }
    if (root.nodeType !== 1 || /^(SCRIPT|STYLE|TEXTAREA|INPUT|CANVAS)$/.test(root.tagName) || isIcon(root)) return;
    const tw = document.createTreeWalker(root, 4, null); let n; while ((n = tw.nextNode())) fix(n);
  };
  const start = () => {
    if (obs || typeof MutationObserver === 'undefined' || !document.body) return;
    obs = new MutationObserver((list) => { for (const r of list) { if (r.type === 'characterData') fix(r.target); else for (const n of r.addedNodes) walk(n); } });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
  };
  const stop = () => { if (obs) { obs.disconnect(); obs = null; } };
  const api = {
    DICT, PATTERNS, tr, lang: () => lang, missing: () => Array.from(gaps).sort(),
    set(l) {
      lang = l === 'ml' ? 'ml' : 'en'; try { localStorage.setItem(KEY, lang); } catch (e) { /* not remembered */ }
      if (typeof document === 'undefined' || !document.body) return;
      if (lang === 'ml') { walk(document.body); start(); } else { stop(); walk(document.body); }   // going back to English restores every swapped node
    }
  };
  window.RoboI18n = api;
  if (typeof document !== 'undefined') {
    const boot = () => { if (lang === 'ml') { walk(document.body); start(); } };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  }
})();
