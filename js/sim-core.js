/* mBot2 simulation core: worlds, robot kinematics, sensors (no rendering).
 * Units: cm. North = -Z, East = +X. Heading = degrees clockwise from north.
 */
(function (G) {
  'use strict';

  const WHEEL_R = 3.25;
  const WHEEL_BASE = 12;
  const ROBOT_R = 9;
  const RPM2CMS = (2 * Math.PI * WHEEL_R) / 60;
  const D2R = Math.PI / 180;

  const norm360 = (d) => ((d % 360) + 360) % 360;
  const fwd = (h) => ({ x: Math.sin(h * D2R), z: -Math.cos(h * D2R) });
  const rightv = (h) => ({ x: Math.cos(h * D2R), z: Math.sin(h * D2R) });

  /* ---------- stadium-shaped line track ---------- */
  const TRACK = { half: 50, r: 40, width: 4 };
  function trackDist(x, z) {
    const { half, r } = TRACK;
    if (Math.abs(x) <= half) return Math.abs(Math.abs(z) - r);
    const cx = Math.sign(x) * half;
    return Math.abs(Math.hypot(x - cx, z) - r);
  }

  function walls(hx, hz, t, h) {
    return [
      { x: 0, z: -hz - t / 2, w: 2 * hx + 2 * t, d: t, h, wall: true },
      { x: 0, z: hz + t / 2, w: 2 * hx + 2 * t, d: t, h, wall: true },
      { x: -hx - t / 2, z: 0, w: t, d: 2 * hz, h, wall: true },
      { x: hx + t / 2, z: 0, w: t, d: 2 * hz, h, wall: true },
    ];
  }

  const WORLDS = {
    arena: {
      floor: { w: 240, d: 240, color: '#f4f6f9' },
      start: { x: -40, z: 40, h: 0 },
      obstacles: walls(120, 120, 3, 5),
      view: { pos: [-20, 105, 135], target: [-20, 0, 15] },
      canvasFloor: true, // marker drawing surface
    },
    stage: {
      floor: { w: 240, d: 240, color: '#f4f6f9' },
      start: { x: 0, z: 0, h: 0 },
      obstacles: walls(120, 120, 3, 5),
      stage: true,
      view: { pos: [0, 45, 70], target: [0, 4, 0] },
    },
    traffic: {
      floor: { w: 120, d: 340, color: '#f4f6f9' },
      road: { w: 40, z0: 160, z1: -175 },
      start: { x: 0, z: 140, h: 0 },
      obstacles: [],
      patches: [
        { x: 0, z: 90, w: 36, d: 20, color: 'green' },
        { x: 0, z: 50, w: 36, d: 20, color: 'yellow' },
        { x: 0, z: 15, w: 36, d: 20, color: 'red' },
        { x: 0, z: -25, w: 36, d: 20, color: 'green' },
        { x: 0, z: -60, w: 36, d: 20, color: 'yellow' },
        { x: 0, z: -95, w: 36, d: 20, color: 'red' },
        { x: 0, z: -125, w: 36, d: 20, color: 'green' },
        { x: 0, z: -160, w: 36, d: 20, color: 'blue' },
      ],
      view: { pos: [60, 70, 200], target: [0, 0, 110] },
    },
    line: {
      floor: null,
      track: true,
      start: { x: -20, z: 40, h: 90 },
      obstacles: [],
      view: { pos: [0, 105, 135], target: [0, 0, 10] },
    },
    parking: {
      floor: { w: 200, d: 260, color: '#f4f6f9' },
      start: { x: 0, z: 100, h: 0 },
      obstacles: [
        { x: 0, z: -62, w: 64, d: 4, h: 22, color: '#cbd5e1', garage: true },
        { x: -32, z: -35, w: 4, d: 50, h: 22, color: '#cbd5e1', garage: true },
        { x: 32, z: -35, w: 4, d: 50, h: 22, color: '#cbd5e1', garage: true },
        { x: -62, z: -30, w: 22, d: 38, h: 12, color: '#fca5a5', car: true },
        { x: 62, z: -32, w: 22, d: 38, h: 12, color: '#93c5fd', car: true },
      ],
      view: { pos: [60, 80, 160], target: [0, 0, 40] },
    },
    obstacle: {
      floor: { w: 220, d: 220, color: '#f4f6f9' },
      start: { x: 0, z: 85, h: 0 },
      obstacles: walls(110, 110, 4, 14).concat([
        { x: -45, z: -45, w: 30, d: 30, h: 20, color: '#ffb4a2' },
        { x: 52, z: -12, w: 26, d: 40, h: 16, color: '#a0c4ff' },
        { x: -8, z: 12, w: 22, d: 22, h: 24, color: '#b9f2b0' },
        { x: 60, z: 68, w: 30, d: 20, h: 14, color: '#ffd6a5' },
        { x: -70, z: 55, w: 20, d: 34, h: 18, color: '#cdb4ff' },
        { x: 25, z: -75, w: 36, d: 16, h: 12, color: '#9ee6e6' },
      ]),
      view: { pos: [0, 110, 170], target: [0, 0, 50] },
    },
    ball: {
      floor: { w: 260, d: 260, color: '#f4f6f9' },
      start: { x: 0, z: 90, h: 0 },
      obstacles: walls(130, 130, 3, 8),
      ball: { cx: 0, cz: 0, r: 70, w: 0.1, a0: -Math.PI / 2, radius: 5 },
      view: { pos: [0, 115, 175], target: [0, 0, 35] },
    },
    camera: {
      floor: { w: 250, d: 270, color: '#f4f6f9' },
      start: { x: 0, z: 60, h: 0 },
      obstacles: walls(125, 135, 3, 6),
      cards: [
        { x: 0, z: -60, face: 180, color: 'blue', label: 'LEFT', icon: '←' },
        { x: -95, z: -21, face: 90, color: 'yellow', label: 'RIGHT', icon: '→' },
        { x: -51, z: -112, face: 180, color: 'red', label: 'GOAL', icon: '★' },
      ],
      view: { pos: [-10, 95, 140], target: [-10, 0, 25] },
    },
    train: {
      floor: null,
      track: true,
      start: { x: -20, z: 40, h: 90 },
      obstacles: [],
      patches: [
        { x: 25, z: 40, w: 10, d: 14, color: 'green', station: 'Maple' },
        { x: -12, z: -40, w: 10, d: 14, color: 'green', station: 'Ocean' },
        { x: -35, z: 40, w: 10, d: 14, color: 'green', station: 'Star' },
      ],
      cat: { x: 20, z: -40, awayZ: -78 },
      view: { pos: [0, 105, 135], target: [0, 0, 10] },
    },
  };

  const CARD_W = 26, CARD_BOTTOM = 5, CARD_H = 18;

  class SimCore {
    constructor(worldName) {
      this.robot = {};
      this.setWorld(worldName || 'arena');
    }

    setWorld(name) {
      this.worldName = name;
      this.world = WORLDS[name];
      this.reset();
    }

    reset() {
      const s = this.world.start;
      Object.assign(this.robot, {
        x: s.x, z: s.z, h: s.h, rpmL: 0, rpmR: 0,
        led: 'off', display: '', camMode: '', pen: false,
        bumped: false, odometer: 0,
      });
      this.vars = {};
      this.time = 0;
      this.dyn = [];
      const w = this.world;
      if (w.cat) {
        this.cat = { x: w.cat.x, z: w.cat.z, w: 12, d: 16, h: 10, cat: true, state: 'sit', near: 0 };
        this.dyn.push(this.cat);
      } else this.cat = null;
      if (w.ball) {
        this.ball = { a: w.ball.a0, x: 0, z: 0 };
        this._placeBall();
      } else this.ball = null;
    }

    obstacles() {
      return this.dyn.length ? this.world.obstacles.concat(this.dyn) : this.world.obstacles;
    }

    _placeBall() {
      const b = this.world.ball;
      this.ball.x = b.cx + b.r * Math.cos(this.ball.a);
      this.ball.z = b.cz + b.r * Math.sin(this.ball.a);
    }

    step(dt) {
      let remain = dt;
      while (remain > 1e-9) {
        const s = Math.min(remain, 0.005);
        this._integrate(s);
        this._world(s);
        remain -= s;
      }
      this.time += dt;
    }

    _world(dt) {
      if (this.ball) {
        this.ball.a += this.world.ball.w * dt;
        this._placeBall();
      }
      const c = this.cat;
      if (c) {
        const r = this.robot;
        const d = Math.hypot(r.x - c.x, r.z - c.z);
        if (c.state === 'sit') {
          c.near = d < 32 && r.rpmL === 0 && r.rpmR === 0 ? c.near + dt : 0;
          if (c.near > 1.2) c.state = 'leave';
        } else if (c.state === 'leave') {
          c.z = Math.max(this.world.cat.awayZ, c.z - 22 * dt);
          if (c.z <= this.world.cat.awayZ) c.state = 'gone';
        }
      }
    }

    _integrate(dt) {
      const r = this.robot;
      const vl = r.rpmL * RPM2CMS, vr = r.rpmR * RPM2CMS;
      const v = (vl + vr) / 2;
      const w = (vl - vr) / WHEEL_BASE;
      const f = fwd(r.h + (w * dt) / 2 / D2R);
      const nx = r.x + f.x * v * dt, nz = r.z + f.z * v * dt;
      r.h = norm360(r.h + (w * dt) / D2R);
      if (!this.collides(nx, nz)) {
        r.x = nx; r.z = nz; r.bumped = false;
        r.odometer += Math.abs(v * dt);
      } else if (Math.abs(v) > 0.01) r.bumped = true;
    }

    collides(x, z) {
      for (const o of this.obstacles()) {
        const cx = Math.max(o.x - o.w / 2, Math.min(x, o.x + o.w / 2));
        const cz = Math.max(o.z - o.d / 2, Math.min(z, o.z + o.d / 2));
        if (Math.hypot(x - cx, z - cz) < ROBOT_R) return true;
      }
      return false;
    }

    patchAt(x, z) {
      for (const p of this.world.patches || []) {
        if (Math.abs(x - p.x) <= p.w / 2 && Math.abs(z - p.z) <= p.d / 2) return p;
      }
      return null;
    }

    /* Quad RGB sensor: L2 L1 R1 R2, 7 cm in front of the wheel axle */
    sensorPoint(lat) {
      const r = this.robot, f = fwd(r.h), rv = rightv(r.h);
      return { x: r.x + f.x * 7 + rv.x * lat, z: r.z + f.z * 7 + rv.z * lat };
    }

    lineSensors() {
      const at = (lat) => {
        if (!this.world.track) return false;
        const p = this.sensorPoint(lat);
        return trackDist(p.x, p.z) < TRACK.width / 2 && !this.patchAt(p.x, p.z);
      };
      return { L2: at(-3.3), L1: at(-1.0), R1: at(1.0), R2: at(3.3) };
    }

    lineStatus() {
      const s = this.lineSensors();
      return (s.L1 ? '1' : '0') + (s.R1 ? '1' : '0');
    }

    floorColor() {
      const p = this.sensorPoint(0);
      const patch = this.patchAt(p.x, p.z);
      if (patch) return patch.color;
      if (this.world.track && trackDist(p.x, p.z) < TRACK.width / 2) return 'black';
      return 'white';
    }

    /* Ultrasonic sensor 2: fan of rays + two parallel rays covering the robot width */
    distance() {
      const r = this.robot, f = fwd(r.h), rv = rightv(r.h);
      const ox = r.x + f.x * 8, oz = r.z + f.z * 8;
      const rays = [];
      for (const a of [-15, -7, 0, 7, 15]) rays.push([ox, oz, fwd(r.h + a)]);
      for (const lat of [-9.5, 9.5]) rays.push([ox + rv.x * lat, oz + rv.z * lat, f]);
      let best = 300;
      const obs = this.obstacles();
      for (const [x0, z0, d] of rays) {
        for (const o of obs) {
          const t = rayBox(x0, z0, d.x, d.z, o);
          if (t !== null && t < best) best = t;
        }
      }
      return Math.max(3, Math.round(best * 10) / 10);
    }

    /* Smart camera: 60° field of view */
    cameraPose() {
      const r = this.robot, f = fwd(r.h);
      return { x: r.x + f.x * 6, z: r.z + f.z * 6, h: r.h };
    }

    cameraDetect() {
      const c = this.cameraPose(), f = fwd(c.h), rv = rightv(c.h);
      let found = null;
      for (const card of this.world.cards || []) {
        const dx = card.x - c.x, dz = card.z - c.z, dist = Math.hypot(dx, dz);
        if (dist > 35 || dist < 1) continue;
        const cos = (dx * f.x + dz * f.z) / dist;
        if (cos < Math.cos(30 * D2R)) continue;
        const n = fwd(card.face);
        if (n.x * -dx + n.z * -dz <= 0) continue;
        if (!found || dist < found.dist) {
          found = { color: card.color, dist, obj: card, confidence: Math.round(80 + 19 * cos), x: 160, size: 0 };
        }
      }
      if (this.ball) {
        const dx = this.ball.x - c.x, dz = this.ball.z - c.z, dist = Math.hypot(dx, dz);
        const ang = Math.atan2(dx * rv.x + dz * rv.z, dx * f.x + dz * f.z) / D2R; // + = right
        if (dist < 220 && Math.abs(ang) < 30) {
          const size = Math.min(320, Math.round((320 * 2 * this.world.ball.radius) / (2 * dist * Math.tan(30 * D2R))));
          found = {
            color: 'red', dist, obj: this.ball, confidence: 95,
            x: Math.round(160 + (ang / 30) * 160), size,
          };
        }
      }
      return found;
    }
  }

  function rayBox(ox, oz, dx, dz, o) {
    const minX = o.x - o.w / 2, maxX = o.x + o.w / 2, minZ = o.z - o.d / 2, maxZ = o.z + o.d / 2;
    let t0 = 0, t1 = Infinity;
    for (const [p, d, mn, mx] of [[ox, dx, minX, maxX], [oz, dz, minZ, maxZ]]) {
      if (Math.abs(d) < 1e-9) {
        if (p < mn || p > mx) return null;
      } else {
        let a = (mn - p) / d, b = (mx - p) / d;
        if (a > b) [a, b] = [b, a];
        t0 = Math.max(t0, a); t1 = Math.min(t1, b);
        if (t0 > t1) return null;
      }
    }
    return t0;
  }

  const DIR8 = ['North (N)', 'Northeast (NE)', 'East (E)', 'Southeast (SE)', 'South (S)', 'Southwest (SW)', 'West (W)', 'Northwest (NW)'];
  const DIR8S = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const REL8 = ['in front', 'front-right', 'on the right', 'back-right', 'behind', 'back-left', 'on the left', 'front-left'];
  const dirName = (h) => DIR8[Math.round(norm360(h) / 45) % 8];
  const dirShort = (h) => DIR8S[Math.round(norm360(h) / 45) % 8];
  const northRel = (h) => REL8[Math.round(norm360(-h) / 45) % 8];

  G.MBotSim = {
    SimCore, WORLDS, TRACK, CARD_W, CARD_H, CARD_BOTTOM,
    WHEEL_R, WHEEL_BASE, RPM2CMS, D2R,
    norm360, fwd, rightv, trackDist, dirName, dirShort, northRel,
  };
})(typeof window !== 'undefined' ? window : globalThis);
