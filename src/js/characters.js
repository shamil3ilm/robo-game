/* Robo Run — human characters. Loaded before engine.js. Exposes window.RoboCharacters = { attach(THREE, rig) }.
   attach() builds a human body on the SAME joints as the robot (head, torso, shoulders, elbows, hips, knees, ankles), so humans use the
   robot's run, jump, slide and fight animations. Every costume part is built once and shown or hidden per character.
   A character is a plain object (see SKINS in progress.js, field `human`):
     skin, hair, top, sleeve: 'short' | 'long', bottom: 'trousers' | 'mundu' | 'shorts', bottomColor, trim, shoe (colour, or null for chappals),
     head: 'none' | 'cap' | 'hat' | 'chef' | 'band', headColor, apron (colour, optional), stripes (bool, optional), build: 'slim' | 'regular' | 'sturdy' */
(function () {
  'use strict';

  function attach(THREE, rig) {
    const PI = Math.PI, parts = {};
    const mat = (o) => new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.8, metalness: 0, envMapIntensity: 0.4 }, o));
    const M = { skin: mat({}), hair: mat({ roughness: 0.6 }), top: mat({}), bottom: mat({}), trim: mat({ roughness: 0.5 }), shoe: mat({}), headwear: mat({}), apron: mat({}), eye: mat({ color: 0x15100d, roughness: 0.4 }) };
    const add = (tag, joint, geo, m, x, y, z) => {
      const o = new THREE.Mesh(geo, m); o.position.set(x || 0, y || 0, z || 0); o.castShadow = true; o.visible = false; joint.add(o);
      (parts[tag] = parts[tag] || []).push(o); return o;
    };
    const cyl = (rt, rb, h, seg) => new THREE.CylinderGeometry(rt, rb, h, seg || 10);
    const ball = (r, sx, sy, sz) => new THREE.SphereGeometry(r, 12, 9).scale(sx || 1, sy || 1, sz || 1);

    /* pelvis and torso */
    add('hipCloth', rig.pelvis, new THREE.BoxGeometry(0.62, 0.22, 0.36), M.bottom, 0, 0, 0);
    add('mundu', rig.pelvis, new THREE.BoxGeometry(0.68, 0.3, 0.42), M.bottom, 0, -0.08, 0);
    add('mundu', rig.pelvis, new THREE.BoxGeometry(0.7, 0.04, 0.44), M.trim, 0, -0.2, 0);
    add('shirt', rig.torso, cyl(0.28, 0.24, 0.74, 14).scale(1.5, 1, 0.88), M.top, 0, 0.56, 0);
    add('shirt', rig.torso, cyl(0.25, 0.25, 0.46, 14).scale(1.2, 1, 0.85), M.top, 0, 0.105, 0);   // waist: overlaps the hips and the chest so the body stays joined when the torso leans
    [0.66, 0.5].forEach((y) => add('stripes', rig.torso, cyl(0.287, 0.287, 0.07, 14).scale(1.5, 1, 0.89), M.trim, 0, y, 0));
    add('apron', rig.torso, new THREE.BoxGeometry(0.52, 0.66, 0.04), M.apron, 0, 0.45, -0.25);
    add('always', rig.torso, cyl(0.075, 0.085, 0.16, 10), M.skin, 0, 0.98, 0);

    /* head: face looks down -z like the robot's visor */
    add('always', rig.head, ball(0.22, 0.92, 1.08, 1), M.skin, 0, 0.24, 0);
    add('always', rig.head, ball(0.04), M.skin, 0, 0.22, -0.215);
    [-1, 1].forEach((s) => {
      add('always', rig.head, ball(0.03), M.eye, s * 0.08, 0.28, -0.195);
      add('always', rig.head, ball(0.045, 0.6, 1, 0.9), M.skin, s * 0.205, 0.24, 0.01);
    });
    add('always', rig.head, new THREE.SphereGeometry(0.235, 14, 8, 0, PI * 2, 0, PI * 0.62).rotateX(-0.12), M.hair, 0, 0.255, 0.012);
    add('cap', rig.head, new THREE.SphereGeometry(0.25, 14, 8, 0, PI * 2, 0, PI * 0.5), M.headwear, 0, 0.29, 0);
    add('cap', rig.head, new THREE.BoxGeometry(0.3, 0.02, 0.2), M.headwear, 0, 0.3, -0.25);
    add('hat', rig.head, cyl(0.5, 0.5, 0.03, 18), M.headwear, 0, 0.44, 0);
    add('hat', rig.head, cyl(0.24, 0.26, 0.17, 14), M.headwear, 0, 0.52, 0);
    add('chef', rig.head, cyl(0.2, 0.22, 0.3, 14), M.headwear, 0, 0.55, 0);
    add('chef', rig.head, ball(0.25, 1, 0.7, 1), M.headwear, 0, 0.74, 0);
    add('band', rig.head, new THREE.TorusGeometry(0.235, 0.028, 6, 18).rotateX(PI / 2), M.headwear, 0, 0.36, 0);

    /* arms, legs and feet: one set per side */
    [0, 1].forEach((i) => {
      add('shoulder', rig.sh[i], ball(0.15), M.top, 0, 0, 0);
      add('upperTop', rig.sh[i], cyl(0.1, 0.094, 0.24), M.top, 0, -0.12, 0);
      add('upperLowLong', rig.sh[i], cyl(0.094, 0.085, 0.26), M.top, 0, -0.35, 0);
      add('upperLowSkin', rig.sh[i], cyl(0.088, 0.08, 0.26), M.skin, 0, -0.35, 0);
      add('elbowCloth', rig.el[i], ball(0.09), M.top, 0, 0, 0);
      add('elbowSkin', rig.el[i], ball(0.085), M.skin, 0, 0, 0);
      add('foreLong', rig.el[i], cyl(0.085, 0.07, 0.4), M.top, 0, -0.21, 0);
      add('foreSkin', rig.el[i], cyl(0.08, 0.065, 0.4), M.skin, 0, -0.21, 0);
      add('always', rig.el[i], ball(0.085, 1, 1.1, 1), M.skin, 0, -0.46, 0);

      add('hipCloth', rig.hip[i], ball(0.13), M.bottom, 0, 0, 0);
      add('thighLong', rig.hip[i], cyl(0.135, 0.105, 0.6, 10), M.bottom, 0, -0.3, 0);
      add('thighMundu', rig.hip[i], cyl(0.17, 0.14, 0.6, 10), M.bottom, 0, -0.3, 0);
      add('thighShortTop', rig.hip[i], cyl(0.14, 0.125, 0.3, 10), M.bottom, 0, -0.15, 0);
      add('thighShortSkin', rig.hip[i], cyl(0.12, 0.1, 0.3, 10), M.skin, 0, -0.45, 0);
      add('kneeCloth', rig.knee[i], ball(0.12), M.bottom, 0, 0, 0);
      add('kneeSkin', rig.knee[i], ball(0.105), M.skin, 0, 0, 0);
      add('shinLong', rig.knee[i], cyl(0.105, 0.08, 0.6, 10), M.bottom, 0, -0.3, 0);
      add('shinMundu', rig.knee[i], cyl(0.14, 0.12, 0.4, 10), M.bottom, 0, -0.2, 0);
      add('shinMundu', rig.knee[i], cyl(0.085, 0.075, 0.2, 10), M.skin, 0, -0.5, 0);
      add('shinMundu', rig.knee[i], new THREE.TorusGeometry(0.125, 0.022, 6, 14).rotateX(PI / 2), M.trim, 0, -0.4, 0);
      add('shinShorts', rig.knee[i], cyl(0.1, 0.085, 0.38, 10), M.skin, 0, -0.19, 0);
      add('shinShorts', rig.knee[i], cyl(0.087, 0.08, 0.24, 10), M.trim, 0, -0.48, 0);
      add('shoe', rig.ank[i], new THREE.BoxGeometry(0.2, 0.12, 0.4), M.shoe, 0, -0.06, -0.07);
      add('chappal', rig.ank[i], new THREE.BoxGeometry(0.18, 0.07, 0.36), M.skin, 0, -0.04, -0.07);
      add('chappal', rig.ank[i], new THREE.BoxGeometry(0.2, 0.03, 0.4), M.shoe, 0, -0.1, -0.07);
    });

    const BUILD = { slim: [0.92, 1.04], regular: [1, 1], sturdy: [1.1, 0.97] };
    const setAll = (v) => { for (const k in parts) parts[k].forEach((o) => (o.visible = v)); };
    const show = (tags) => tags.forEach((t) => (parts[t] || []).forEach((o) => (o.visible = true)));

    return {
      /* turn this human on and the robot's own parts off */
      apply(c) {
        rig.robotMeshes.forEach((o) => (o.visible = false));
        setAll(false);
        M.skin.color.setHex(c.skin); M.hair.color.setHex(c.hair); M.top.color.setHex(c.top); M.bottom.color.setHex(c.bottomColor);
        M.trim.color.setHex(c.trim || 0xd4a93a); M.shoe.color.setHex(c.shoe == null ? 0x4a3322 : c.shoe); M.headwear.color.setHex(c.headColor || 0xffffff); M.apron.color.setHex(c.apron || 0xffffff);
        show(['always', 'shirt', 'shoulder', 'upperTop', 'hipCloth']);
        show(c.sleeve === 'long' ? ['upperLowLong', 'foreLong', 'elbowCloth'] : ['upperLowSkin', 'foreSkin', 'elbowSkin']);
        show({ trousers: ['thighLong', 'shinLong', 'kneeCloth'], mundu: ['thighMundu', 'shinMundu', 'kneeCloth', 'mundu'], shorts: ['thighShortTop', 'thighShortSkin', 'shinShorts', 'kneeSkin'] }[c.bottom] || []);
        show([c.shoe == null ? 'chappal' : 'shoe']);
        if (c.head && c.head !== 'none') show([c.head]);
        if (c.apron) show(['apron']);
        if (c.stripes) show(['stripes']);
        const b = BUILD[c.build] || BUILD.regular; rig.root.scale.set(b[0], b[1], b[0]);
      },
      /* back to the robot */
      clear() { setAll(false); rig.robotMeshes.forEach((o) => (o.visible = true)); rig.root.scale.set(1, 1, 1); }
    };
  }

  window.RoboCharacters = { attach };
})();
