/* Robo Run: the football turf game. Exposes window.RoboTurf = { kick, step, goal, rect, KICK_R, GOAL_HALF }.
   The rules are pure (the ball is a plain { x, z, vx, vz, hop } that every function returns anew), so tests can play a match without a browser; the drawing lives in explore_manjeri.js.
   Walk into the ball and it runs ahead of you; a ball that crosses the goal line between the posts is a goal. */
(function () {
  'use strict';
  if (window.RoboTurf) return;   // the page loads its scripts twice

  const KICK_R = 0.95, GOAL_HALF = 3.0, GOAL_LINE = 1.4;   // metres: how close you must be, half the goal mouth, how far the goal line stands in from the end

  /* the pitch as a rectangle: centre and size (the fence line) */
  const rect = (cx, cz, w, d) => ({ cx, cz, hw: w / 2, hd: d / 2 });

  /* a touch: if the player is close enough the ball goes the way the player is going, a little faster than the player; standing still only nudges it. A kick every quarter of a second at most, so a dribble is a string of small kicks. */
  const kick = (b, p, now) => {
    const dx = b.x - p.x, dz = b.z - p.z, d = Math.hypot(dx, dz);
    if (d > KICK_R || now - (b.last || -9) < 0.25) return b;
    const sp = Math.hypot(p.vx, p.vz), dirX = sp > 0.4 ? p.vx / sp : d > 1e-3 ? dx / d : 0, dirZ = sp > 0.4 ? p.vz / sp : d > 1e-3 ? dz / d : 1;
    const power = sp > 0.4 ? 3.2 + sp * 1.25 : 2.2;
    return { x: b.x, z: b.z, vx: dirX * power, vz: dirZ * power, hop: 0.22 + Math.min(0.3, power * 0.025), last: now };
  };

  /* one step of the ball: rolls, slows (a ball loses about 80% of its speed in a second), bounces off the fence and keeps its small hop */
  const step = (b, dt, r) => {
    let { x, z, vx, vz, hop } = b; const k = Math.exp(-1.6 * dt);
    x += vx * dt; z += vz * dt; vx *= k; vz *= k; hop = Math.max(0, hop - dt * 0.9);
    const x0 = r.cx - r.hw + 0.3, x1 = r.cx + r.hw - 0.3, z0 = r.cz - r.hd + 0.3, z1 = r.cz + r.hd - 0.3;
    if (x < x0) { x = x0; vx = Math.abs(vx) * 0.6; } else if (x > x1) { x = x1; vx = -Math.abs(vx) * 0.6; }
    if (z < z0) { z = z0; vz = Math.abs(vz) * 0.6; } else if (z > z1) { z = z1; vz = -Math.abs(vz) * 0.6; }
    return { x, z, vx, vz, hop, last: b.last };
  };

  /* 'north' or 'south' when the ball is over a goal line between the posts, else null */
  const goal = (b, r) => {
    if (Math.abs(b.x - r.cx) >= GOAL_HALF) return null;
    const dz = b.z - r.cz, line = r.hd - GOAL_LINE;
    return dz <= -line ? 'north' : dz >= line ? 'south' : null;
  };

  /* a ball set going in a direction (unit vector) at a speed, with a hop */
  const push = (b, dx, dz, power, now) => ({ x: b.x, z: b.z, vx: dx * power, vz: dz * power, hop: 0.22 + Math.min(0.3, power * 0.025), last: now });

  /* your own shot (the Shoot button): a hard kick the way you face, when the ball is close enough */
  const shoot = (b, p, dirX, dirZ, now) => (Math.hypot(b.x - p.x, b.z - p.z) > KICK_R + 0.5 ? b : push(b, dirX, dirZ, 11, now));

  /* the other players. Each is { x, z, team: 'home' | 'away', hx, hz (where he stands when the ball is not his), moving, yaw }. Home attacks the north goal (low z) like you; away attacks the south goal.
     The player of each team closest to the ball chases it (a home player stays back when you are the closer one); the rest hold their place, drifting with the play. At the ball he dribbles it towards goal with small pushes, and shoots when he is near; he waits 0.45 s after any touch, so a dribble can be stolen by running into the ball. */
  const SPEED = { home: 3.0, away: 3.2 };
  const goalZ = (team, r) => (team === 'home' ? r.cz - r.hd + 0.4 : r.cz + r.hd - 0.4);
  const ai = (list, b, r, dt, now, human) => {
    const d2 = (p) => Math.hypot(p.x - b.x, p.z - b.z), chaser = {};
    for (const team of ['home', 'away']) {
      let best = -1, bd = Infinity; list.forEach((p, i) => { if (p.team === team && d2(p) < bd) { bd = d2(p); best = i; } });
      chaser[team] = team === 'home' && human && Math.hypot(human.x - b.x, human.z - b.z) < bd ? -1 : best;
    }
    let ball = b;
    const out = list.map((p, i) => {
      const chase = chaser[p.team] === i, lead = chase ? 0.3 : 0;
      const tx = chase ? b.x + b.vx * lead : p.hx + (b.x - r.cx) * 0.25, tz = chase ? b.z + b.vz * lead : p.hz + (b.z - p.hz) * 0.3;
      const dx = tx - p.x, dz = tz - p.z, dist = Math.hypot(dx, dz), sp = SPEED[p.team] * (chase ? 1 : 0.7), mv = dist > 0.35 ? Math.min(dist, sp * dt) : 0;
      let x = p.x + (dist > 1e-6 ? dx / dist * mv : 0), z = p.z + (dist > 1e-6 ? dz / dist * mv : 0);
      x = Math.max(r.cx - r.hw + 0.8, Math.min(r.cx + r.hw - 0.8, x)); z = Math.max(r.cz - r.hd + 0.8, Math.min(r.cz + r.hd - 0.8, z));
      const yaw = mv > 0 ? Math.atan2(-(x - p.x), -(z - p.z)) : p.yaw;
      if (chase && Math.hypot(b.x - x, b.z - z) < KICK_R * 0.9 && now - (ball.last || -9) > 0.45) {
        const gz = goalZ(p.team, r), gx = r.cx + Math.sin(now * 1.7 + i * 2.3) * (GOAL_HALF - 0.8), ex = gx - ball.x, ez = gz - ball.z, el = Math.hypot(ex, ez) || 1;
        ball = push(ball, ex / el, ez / el, el > 15 ? 3.8 : el > 8 ? 6.5 : 8.5, now);
      }
      return { x, z, team: p.team, hx: p.hx, hz: p.hz, moving: mv > 0, yaw };
    });
    return { players: out, ball };
  };

  /* a match is first to WIN_AT goals: 'home' (you), 'away' (them) or null while it is still on */
  const WIN_AT = 5;
  const result = (home, away) => (home >= WIN_AT && home > away ? 'home' : away >= WIN_AT && away > home ? 'away' : null);

  window.RoboTurf = { kick, step, goal, rect, push, shoot, ai, result, WIN_AT, KICK_R, GOAL_HALF, GOAL_LINE };
})();
