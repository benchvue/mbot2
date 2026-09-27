/* CyberPi speaker stand-in: simple WebAudio sound effects and notes. */
(function (G) {
  'use strict';
  let ctx = null, enabled = true;

  function ac() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, start, dur, type = 'square', vol = 0.08) {
    const c = ac(), o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq;
    const t = c.currentTime + start;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, 0.03));
    o.connect(g).connect(c.destination);
    o.start(t); o.stop(t + dur + 0.03);
  }

  function slide(f0, f1, dur, type = 'sine', vol = 0.1) {
    const c = ac(), o = c.createOscillator(), g = c.createGain(), t = c.currentTime;
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t); o.stop(t + dur + 0.03);
  }

  const seq = (notes, step, type, vol) => notes.forEach((f, i) => tone(f, i * step, step * 0.9, type, vol));

  const SOUNDS = {
    beep: () => tone(988, 0, 0.14),
    start: () => seq([523, 659, 784], 0.09, 'triangle', 0.1),
    hello: () => { slide(300, 520, 0.18, 'triangle'); setTimeout(() => slide(420, 700, 0.22, 'triangle'), 200); },
    yeah: () => slide(350, 900, 0.35, 'sawtooth', 0.05),
    alert: () => { tone(880, 0, 0.1, 'sawtooth', 0.05); tone(660, 0.12, 0.12, 'sawtooth', 0.05); },
    ding: () => { tone(1319, 0, 0.35, 'sine', 0.12); tone(1047, 0.3, 0.5, 'sine', 0.12); },
    meow: () => slide(700, 420, 0.45, 'triangle', 0.1),
    success: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i * 0.12, i === 5 ? 0.35 : 0.11, 'triangle', 0.1)),
  };

  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function noteFreq(n) {
    const m = /^([A-G])(#?)(\d)$/.exec(n);
    if (!m) return 440;
    const midi = 12 * (Number(m[3]) + 1) + NOTE[m[1]] + (m[2] ? 1 : 0);
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  G.RobotAudio = {
    play(name) { if (enabled && SOUNDS[name]) { try { SOUNDS[name](); } catch (e) { /* ignore */ } } },
    note(n, sec) { if (enabled) { try { tone(noteFreq(n), 0, sec * 0.9, 'triangle', 0.12); } catch (e) { /* ignore */ } } },
    unlock() { try { ac(); } catch (e) { /* ignore */ } },
    set enabled(v) { enabled = v; },
    get enabled() { return enabled; },
  };
})(window);
