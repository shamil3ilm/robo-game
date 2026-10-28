/* Robo Run: posters, banners, boards, a statue and the readable note spots of the walkable town (explore.js). Exposes window.RoboExploreSigns = { build(ctx) }.
   Only verified real names are used (see explore_notes.js for the sources); anything else is a plain product word, never an invented business. */
(function () {
  'use strict';
  const PI = Math.PI, FONT_ML = '"Nirmala UI","Noto Sans Malayalam","Kartika",sans-serif';

  function build(c) {
    const { THREE, add, mat, solid, post, canvasTex, spots, marker, lampPos, cullables, laneZ, notes } = c;
    const NOTES = notes || {};
    const std = (o) => new THREE.MeshStandardMaterial(o);
    /* a printed panel: size in metres, drawn on a canvas of tw x th pixels */
    const panel = (w, h, tw, th, draw, opts) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), std({ map: canvasTex(tw, th, draw), roughness: 0.9, side: THREE.DoubleSide, transparent: !!(opts && opts.alpha), alphaTest: opts && opts.alpha ? 0.3 : 0 }));
      m.receiveShadow = true; return m;
    };
    const center = (x, text, y, font, color) => { x.textAlign = 'center'; x.fillStyle = color; x.font = font; x.fillText(text, x._w / 2, y); };
    const POSTERS = {
      klf: (x, w, h) => { x._w = w; x.fillStyle = '#1f3a5f'; x.fillRect(0, 0, w, h); x.fillStyle = '#f2c46b'; x.fillRect(0, h * 0.62, w, 6); center(x, 'KLF', h * 0.2, 'bold 54px sans-serif', '#f2c46b'); center(x, 'Kerala Literature', h * 0.33, 'bold 24px sans-serif', '#fff'); center(x, 'Festival', h * 0.4, 'bold 24px sans-serif', '#fff'); center(x, 'ലിറ്ററേച്ചർ ഫെസ്റ്റിവൽ', h * 0.5, 'bold 22px ' + FONT_ML, '#ffe9b0'); center(x, 'Kozhikode Beach', h * 0.72, 'bold 22px sans-serif', '#fff'); center(x, 'കോഴിക്കോട് ബീച്ച്', h * 0.8, 'bold 20px ' + FONT_ML, '#ffe9b0'); },
      unesco: (x, w, h) => { x._w = w; x.fillStyle = '#0f5a6a'; x.fillRect(0, 0, w, h); x.strokeStyle = '#f3e6cf'; x.lineWidth = 6; x.strokeRect(8, 8, w - 16, h - 16); center(x, 'KOZHIKODE', h * 0.2, 'bold 34px sans-serif', '#fff'); center(x, 'കോഴിക്കോട്', h * 0.3, 'bold 26px ' + FONT_ML, '#ffe9b0'); center(x, 'UNESCO', h * 0.48, 'bold 30px sans-serif', '#f2c46b'); center(x, 'City of Literature', h * 0.58, 'bold 22px sans-serif', '#fff'); center(x, 'സാഹിത്യ നഗരം', h * 0.7, 'bold 26px ' + FONT_ML, '#ffe9b0'); center(x, '2023', h * 0.86, 'bold 26px sans-serif', '#f2c46b'); },
      halwa: (x, w, h) => { x._w = w; x.fillStyle = '#7a2a1c'; x.fillRect(0, 0, w, h); x.strokeStyle = '#f3e6cf'; x.lineWidth = 6; x.strokeRect(8, 8, w - 16, h - 16); center(x, 'Kozhikodan', h * 0.2, 'bold 30px sans-serif', '#fff'); center(x, 'HALWA', h * 0.36, 'bold 44px sans-serif', '#f2c46b'); center(x, 'ഹൽവ', h * 0.5, 'bold 40px ' + FONT_ML, '#ffe9b0'); center(x, '₹80 – ₹180 / kg', h * 0.7, 'bold 24px sans-serif', '#fff'); center(x, 'കിലോ', h * 0.8, 'bold 22px ' + FONT_ML, '#ffe9b0'); },
      onam: (x, w, h) => { x._w = w; x.fillStyle = '#e8a020'; x.fillRect(0, 0, w, h); x.strokeStyle = '#fff6dc'; x.lineWidth = 8; x.strokeRect(8, 8, w - 16, h - 16); center(x, '🌼', h * 0.22, '56px sans-serif', '#000'); center(x, 'ഓണാശംസകൾ', h * 0.5, 'bold 34px ' + FONT_ML, '#5a2a08'); center(x, 'Onam greetings', h * 0.68, 'bold 22px sans-serif', '#5a2a08'); },
      robo: (x, w, h) => { x._w = w; x.fillStyle = '#14201c'; x.fillRect(0, 0, w, h); x.strokeStyle = '#46e0ff'; x.lineWidth = 6; x.strokeRect(8, 8, w - 16, h - 16); center(x, '🤖', h * 0.3, '64px sans-serif', '#000'); center(x, 'ROBO RUN', h * 0.55, 'bold 36px sans-serif', '#46e0ff'); center(x, 'Run the beach road', h * 0.7, 'bold 20px sans-serif', '#fff'); center(x, 'ഓടാൻ പോകാം', h * 0.82, 'bold 22px ' + FONT_ML, '#ffe9b0'); }
    };
    const kinds = ['klf', 'unesco', 'halwa', 'onam', 'robo'];

    /* festival banners on the lamp posts, as hung along every Kerala street */
    lampPos.forEach(([x, z], i) => {
      const m = panel(0.95, 1.9, 190, 380, POSTERS[kinds[i % kinds.length]]); m.position.set(x - Math.sign(x) * 0.6, 3.0, z); m.rotation.y = 0;
      add(m); cullables.push(m); m.userData = { x, z };
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 0.05), mat(0x2b2b2b)); arm.position.set(x - Math.sign(x) * 0.3, 4.0, z); add(arm); cullables.push(arm); arm.userData = { x, z };
    });

    /* a wide flex banner across the street at the south end: UNESCO City of Literature */
    const flex = panel(8.6, 1.1, 1024, 130, (x, w, h) => { x._w = w; x.fillStyle = '#0f5a6a'; x.fillRect(0, 0, w, h); x.strokeStyle = '#f2c46b'; x.lineWidth = 6; x.strokeRect(5, 5, w - 10, h - 10); center(x, 'KOZHIKODE · UNESCO CITY OF LITERATURE', h * 0.4, 'bold 46px sans-serif', '#fff'); center(x, 'സാഹിത്യ നഗരം · കോഴിക്കോട്', h * 0.82, 'bold 40px ' + FONT_ML, '#ffe9b0'); });
    flex.rotation.y = PI / 2; flex.position.set(0, 5.4, 46); add(flex); cullables.push(flex); flex.userData = { x: 0, z: 46 };

    /* blue street-name boards, as on Kozhikode Corporation signposts */
    const nameBoard = (x, z, ry) => {
      const g = new THREE.Group(); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.9, 8), mat(0x2b2b2b)); pole.position.y = 1.45; g.add(pole);
      const b = panel(1.9, 0.62, 512, 166, (cx, w, h) => { cx._w = w; cx.fillStyle = '#17458a'; cx.fillRect(0, 0, w, h); cx.strokeStyle = '#fff'; cx.lineWidth = 5; cx.strokeRect(5, 5, w - 10, h - 10); center(cx, 'S. M. STREET', h * 0.4, 'bold 54px sans-serif', '#fff'); center(cx, 'മിഠായിത്തെരുവ്', h * 0.8, 'bold 44px ' + FONT_ML, '#ffe9b0'); });
      b.position.set(0, 2.6, 0.06); g.add(b); g.position.set(x, 0, z); g.rotation.y = ry; add(g); cullables.push(g); g.userData = { x, z }; post(x, z, 0.2);
    };
    nameBoard(3.3, 53.5, 0); nameBoard(-3.3, -64.5, PI);

    /* A-frame chalk boards on the pavement: handwritten prices and dishes, as outside every Kerala eatery */
    const chalk = (x, z, ry, lines) => {
      const g = new THREE.Group();
      [-1, 1].forEach((s) => { const b = panel(0.75, 1.0, 256, 340, (cx, w, h) => { cx._w = w; cx.fillStyle = '#2a3a34'; cx.fillRect(0, 0, w, h); cx.strokeStyle = '#a9835a'; cx.lineWidth = 14; cx.strokeRect(0, 0, w, h); lines.forEach((l, i) => center(cx, l[0], 60 + i * 52, 'bold ' + (l[1] || 26) + 'px ' + (/[ഀ-ൿ]/.test(l[0]) ? FONT_ML : 'sans-serif'), '#f4efdc')); }); b.position.set(0, 0.5, s * 0.22); b.rotation.x = -s * 0.2; g.add(b); });
      g.position.set(x, 0, z); g.rotation.y = ry; add(g); cullables.push(g); g.userData = { x, z }; post(x, z, 0.4);
    };
    chalk(4.05, -35, 0, [['ഇന്നത്തെ വിഭവം', 22], ['പഴംപൊരി', 28], ['ഉന്നക്കായ', 28], ['ചായ · സുലൈമാനി', 22]]);
    chalk(-4.05, 8, PI, [['HALWA', 30], ['ഹൽവ', 32], ['₹80 – ₹180 / kg', 20]]);
    chalk(4.05, 33, 0, [['Banana Chips', 24], ['ഉപ്പേരി', 32], ['Fresh today', 20]]);
    chalk(-4.05, -50, PI, [['TEA · COFFEE', 24], ['ചായ', 32], ['കാപ്പി', 32]]);

    /* a notice on a wall: no bill stickers (the commonest note in any Indian town) */
    const notice = panel(0.5, 0.7, 200, 280, (x, w, h) => { x._w = w; x.fillStyle = '#f4efdc'; x.fillRect(0, 0, w, h); x.strokeStyle = '#b8352a'; x.lineWidth = 8; x.strokeRect(6, 6, w - 12, h - 12); center(x, 'STICK NO', h * 0.3, 'bold 34px sans-serif', '#b8352a'); center(x, 'BILLS', h * 0.46, 'bold 40px sans-serif', '#b8352a'); center(x, 'ബില്ല്', h * 0.64, 'bold 28px ' + FONT_ML, '#333'); center(x, 'ഒട്ടിക്കരുത്', h * 0.8, 'bold 28px ' + FONT_ML, '#333'); });
    notice.rotation.y = PI / 2; notice.position.set(-4.58, 1.5, -20); add(notice); cullables.push(notice); notice.userData = { x: -4.5, z: -20 };

    /* the S. K. Pottekkatt statue on the west pavement: a bronze figure on a stone plinth, facing the street, with a plaque */
    (() => {
      const sx = -3.95, sz = -2, g = new THREE.Group(), bronze = mat(0x6a5a3a, { metalness: 0.6, roughness: 0.45 }), stone = mat(0xb8b0a0, { roughness: 0.95 });
      const bx = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
      bx(1.0, 0.25, 1.0, stone, 0, 0.12, 0); bx(0.8, 1.0, 0.8, stone, 0, 0.75, 0);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 1.0, 12), bronze); body.position.y = 1.75; body.castShadow = true; g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), bronze); head.position.y = 2.45; head.castShadow = true; g.add(head);
      [-1, 1].forEach((s) => { const a = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.8, 8), bronze); a.position.set(s * 0.3, 1.75, 0); a.rotation.z = s * 0.12; g.add(a); });
      const plaque = panel(0.7, 0.45, 256, 164, (x, w, h) => { x._w = w; x.fillStyle = '#3a3220'; x.fillRect(0, 0, w, h); x.strokeStyle = '#d9b86a'; x.lineWidth = 5; x.strokeRect(5, 5, w - 10, h - 10); center(x, 'S. K. POTTEKKATT', h * 0.34, 'bold 28px sans-serif', '#f0dca0'); center(x, 'എസ്. കെ. പൊറ്റെക്കാട്ട്', h * 0.62, 'bold 26px ' + FONT_ML, '#f0dca0'); center(x, 'ഒരു തെരുവിന്റെ കഥ', h * 0.86, 'bold 20px ' + FONT_ML, '#f0dca0'); });
      plaque.rotation.y = PI / 2; plaque.position.set(0.42, 0.75, 0); g.add(plaque);
      g.position.set(sx, 0.05, sz); g.rotation.y = 0; add(g); cullables.push(g); g.userData = { x: sx, z: sz }; post(sx, sz, 0.65);
    })();

    /* note boards on the promenade and the readable spots: step into the pale ring and press F */
    const board = (x, z, key, kind) => {
      const g = new THREE.Group(), wood = mat(0x6a4a2a);
      [-1, 1].forEach((s) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.4, 0.12), wood); p.position.set(s * 1.3, 1.2, 0); g.add(p); });
      const b = panel(2.5, 1.6, 400, 256, POSTERS[kind]); b.position.set(0, 1.6, 0.08); g.add(b);
      g.position.set(x, 0, z); add(g); cullables.push(g); g.userData = { x, z }; solid(x - 1.4, x + 1.4, z - 0.2, z + 0.2);
    };
    board(-8, 63, 'foodtrail', 'halwa'); board(8, 63, 'literature', 'unesco');
    const noteSpot = (x, z, key) => { const n = NOTES[key]; if (!n) return; marker(x, z, 0xcfe8ff); spots.push({ x, z, r: 2.0, kind: 'note', arg: key, label: n.title.split(' · ')[0], emoji: n.emoji }); };
    noteSpot(2.2, 53.5, 'smstreet'); noteSpot(-2.4, -2, 'pottekkatt'); noteSpot(2.4, 8, 'renovation'); noteSpot(-8, 61.4, 'foodtrail'); noteSpot(8, 61.4, 'literature');
    noteSpot(2.2, -64.5, 'smstreet');
    return { swamy: NOTES.swamy, bombay: NOTES.bombay };
  }

  window.RoboExploreSigns = { build };
})();
