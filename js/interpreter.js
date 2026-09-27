/* Block interpreter. Every block waits on the SIMULATION clock,
 * so pausing the clock pauses the program exactly where it is. */
(function (G) {
  'use strict';
  const { RPM2CMS, WHEEL_BASE, D2R, norm360 } = G.MBotSim;

  const STEP = 0.08;   // sim-seconds a normal block takes
  const CHECK = 0.05;  // sim-seconds a condition check takes
  const BEAT = 0.4;    // sim-seconds per music beat

  class SimClock {
    constructor() { this.t = 0; this.waiters = []; }
    wait(sec) { return new Promise((res) => this.waiters.push({ t: this.t + sec, res })); }
    nextDue() {
      let m = null;
      for (const w of this.waiters) if (m === null || w.t < m) m = w.t;
      return m;
    }
    flushDue() {
      const due = this.waiters.filter((w) => w.t <= this.t + 1e-9);
      if (!due.length) return false;
      this.waiters = this.waiters.filter((w) => w.t > this.t + 1e-9);
      due.forEach((w) => w.res(true));
      return true;
    }
    cancelAll() {
      const ws = this.waiters;
      this.waiters = [];
      ws.forEach((w) => w.res(false));
      this.t = 0;
    }
  }

  class StopSignal extends Error {}

  class Interpreter {
    constructor(core, clock, hooks) {
      this.core = core; this.clock = clock; this.h = hooks || {};
      this.token = 0; this.running = false; this.procs = {};
    }

    async start(program) {
      const my = ++this.token;
      this.running = true;
      this.procs = {};
      const mains = [];
      program.scripts.forEach((s, lane) => {
        if (s[0] && s[0].op === 'define') this.procs[s[0].args.name] = s;
        else mains.push([s, lane]);
      });
      let ended = 'done';
      try {
        await Promise.all(mains.map(([s, lane]) => this.execList(s, my, lane)));
      } catch (e) {
        if (!(e instanceof StopSignal)) { console.error(e); ended = 'error'; }
        else ended = e.message || 'stopped';
      } finally {
        if (my === this.token) {
          this.token++; // end any other scripts that are still running
          const ws = this.clock.waiters;
          this.clock.waiters = [];
          ws.forEach((w) => w.res(false));
          this.running = false;
          this.core.robot.rpmL = this.core.robot.rpmR = 0;
          this.h.highlight && this.h.highlight(null, 'all');
          this.h.onEnd && this.h.onEnd(ended);
        }
      }
    }

    stop() {
      this.token++;
      this.running = false;
      this.clock.cancelAll();
      this.h.highlight && this.h.highlight(null, 'all');
    }

    hl(id, lane) { this.h.highlight && this.h.highlight(id, lane); }

    async wait(sec, my) {
      const ok = await this.clock.wait(Math.max(sec, 0.001));
      if (!ok || my !== this.token) throw new StopSignal('stopped');
    }

    async execList(list, my, lane) {
      for (const b of list || []) await this.exec(b, my, lane);
    }

    /* reporters: numbers, strings or {k: ...} objects */
    ev(e) {
      if (e === null || e === undefined) return 0;
      if (typeof e !== 'object') return e;
      const c = this.core;
      switch (e.k) {
        case 'distance': return c.distance();
        case 'var': return this.core.vars[e.n] ?? 0;
        case 'cam_x': { const d = c.cameraDetect(); return d ? d.x : 0; }
        case 'cam_size': { const d = c.cameraDetect(); return d ? d.size : 0; }
        case 'join': return String(this.ev(e.a)) + String(this.ev(e.b));
        case 'add': return Number(this.ev(e.a)) + Number(this.ev(e.b));
        case 'sub': return Number(this.ev(e.a)) - Number(this.ev(e.b));
        case 'mul': return Number(this.ev(e.a)) * Number(this.ev(e.b));
        case 'div': return Number(this.ev(e.a)) / Number(this.ev(e.b));
        case 'round': return Math.round(Number(this.ev(e.a)));
        case 'rand': {
          const a = Number(this.ev(e.a)), b = Number(this.ev(e.b));
          return a + Math.floor(Math.random() * (b - a + 1));
        }
        default: return 0;
      }
    }

    evalCond(c) {
      const a = c.args || {};
      switch (c.op) {
        case 'line': return this.core.lineStatus() === a.pattern;
        case 'floor_color': return this.core.floorColor() === a.color;
        case 'cam_color': { const d = this.core.cameraDetect(); return !!d && d.color === a.color; }
        case 'cmp': {
          const x = this.ev(a.a), y = this.ev(a.b);
          if (a.cmp === '<') return Number(x) < Number(y);
          if (a.cmp === '>') return Number(x) > Number(y);
          return String(x) === String(y);
        }
        default: return false;
      }
    }

    async exec(b, my, lane) {
      if (my !== this.token) throw new StopSignal('stopped');
      const r = this.core.robot, a = b.args || {};
      this.hl(b.id, lane);

      switch (b.op) {
        case 'when_start':
          await this.wait(STEP, my);
          break;

        case 'forever':
          for (;;) {
            this.hl(b.id, lane);
            await this.wait(STEP / 2, my);
            await this.execList(b.body, my, lane);
          }

        case 'repeat': {
          const n = Number(this.ev(a.n));
          for (let i = 0; i < n; i++) {
            this.hl(b.id, lane);
            this.h.loopCount && this.h.loopCount(b.id, i + 1, n);
            await this.wait(STEP / 2, my);
            await this.execList(b.body, my, lane);
          }
          break;
        }

        case 'repeat_until':
          for (;;) {
            this.hl(b.id, lane);
            await this.wait(CHECK, my);
            const done = this.evalCond(b.cond);
            this.h.condResult && this.h.condResult(b.id, done);
            if (done) break;
            await this.execList(b.body, my, lane);
          }
          break;

        case 'if': {
          await this.wait(CHECK, my);
          const ok = this.evalCond(b.cond);
          this.h.condResult && this.h.condResult(b.id, ok);
          if (ok) await this.execList(b.body, my, lane);
          else if (b.else) await this.execList(b.else, my, lane);
          break;
        }

        case 'call': {
          const proc = this.procs[a.name];
          await this.wait(STEP / 2, my);
          if (proc) await this.execList(proc.slice(1), my, lane);
          this.hl(b.id, lane);
          break;
        }

        case 'set_var':
          this.core.vars[a.name] = this.ev(a.value);
          await this.wait(STEP, my);
          break;

        case 'change_var':
          this.core.vars[a.name] = Number(this.core.vars[a.name] || 0) + Number(this.ev(a.value));
          await this.wait(STEP, my);
          break;

        case 'led':
          if (a.color === 'random') {
            const pool = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink'];
            r.led = pool[Math.floor(Math.random() * pool.length)];
          } else r.led = a.color;
          await this.wait(STEP, my);
          break;

        case 'sound':
          this.h.sound && this.h.sound(a.name);
          await this.wait(STEP, my);
          break;

        case 'note':
          this.h.note && this.h.note(a.note, a.beats * BEAT);
          await this.wait(a.beats * BEAT, my);
          break;

        case 'display': {
          let v = this.ev(a.text);
          if (typeof v === 'number') v = Math.round(v * 10) / 10;
          r.display = String(v);
          await this.wait(STEP, my);
          break;
        }

        case 'cam_mode':
          r.camMode = a.mode;
          await this.wait(STEP, my);
          break;

        case 'pen':
          r.pen = !!a.down;
          await this.wait(STEP, my);
          break;

        case 'move':
          r.rpmL = Number(this.ev(a.l)); r.rpmR = Number(this.ev(a.r));
          await this.wait(STEP, my);
          break;

        case 'move_for':
          r.rpmL = Number(this.ev(a.l)); r.rpmR = Number(this.ev(a.r));
          await this.wait(Number(this.ev(a.sec)), my);
          r.rpmL = r.rpmR = 0;
          break;

        case 'turn': {
          const rpm = a.rpm || 40, from = r.h, deg = Number(this.ev(a.deg)), sgn = Math.sign(deg);
          this.h.onTurn && this.h.onTurn(from, deg);
          r.rpmL = sgn * rpm; r.rpmR = -sgn * rpm;
          const w = (2 * rpm * RPM2CMS) / WHEEL_BASE;
          await this.wait((Math.abs(deg) * D2R) / w, my);
          r.rpmL = r.rpmR = 0;
          r.h = norm360(from + deg); // encoder motors stop precisely
          break;
        }

        case 'stop_move':
          r.rpmL = r.rpmR = 0;
          await this.wait(STEP, my);
          break;

        case 'wait':
          await this.wait(Number(this.ev(a.sec)), my);
          break;

        case 'stop_all':
          r.rpmL = r.rpmR = 0;
          await this.wait(STEP, my);
          throw new StopSignal('stop_all');

        default:
          await this.wait(STEP, my);
      }
    }
  }

  G.MBotInterp = { SimClock, Interpreter, STEP, BEAT };
})(typeof window !== 'undefined' ? window : globalThis);
