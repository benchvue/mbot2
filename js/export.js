/* Export: mBlock 5 Python (Upload mode), printable block sheet (PNG), program JSON. */
(function (G) {
  'use strict';

  const RGB = {
    red: [255, 0, 0], orange: [255, 120, 0], yellow: [255, 200, 0], green: [0, 255, 0],
    cyan: [0, 255, 255], blue: [0, 0, 255], purple: [160, 0, 255], pink: [255, 80, 160],
    white: [255, 255, 255], black: [0, 0, 0], off: [0, 0, 0],
  };
  const SOUND = {
    beep: 'prompt-tone', start: 'start', hello: 'hello', yeah: 'yeah',
    alert: 'warning', ding: 'ring', meow: 'meow', success: 'level-up',
  };
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const midi = (n) => {
    const m = /^([A-G])(#?)(\d)$/.exec(n);
    return m ? 12 * (Number(m[3]) + 1) + NOTE[m[1]] + (m[2] ? 1 : 0) : 60;
  };
  const pyName = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'my_block';
  const pyStr = (s) => JSON.stringify(String(s));

  function expr(e) {
    if (e === null || e === undefined) return '0';
    if (typeof e === 'number') return String(e);
    if (typeof e === 'string') return pyStr(e);
    const bin = { add: '+', sub: '-', mul: '*', div: '/' };
    switch (e.k) {
      case 'distance': return 'mbuild.ultrasonic2.get(1)';
      case 'var': return pyName(e.n);
      case 'cam_x': return 'mbuild.smart_camera.get_sign_x(1, 1)';
      case 'cam_size': return 'mbuild.smart_camera.get_sign_wide(1, 1)';
      case 'join': return `str(${expr(e.a)}) + str(${expr(e.b)})`;
      case 'rand': return `random.randint(${expr(e.a)}, ${expr(e.b)})`;
      case 'round': return `round(${expr(e.a)})`;
      default: return bin[e.k] ? `(${expr(e.a)} ${bin[e.k]} ${expr(e.b)})` : '0';
    }
  }

  function cond(c) {
    const a = c.args || {};
    switch (c.op) {
      case 'line': {
        // quad RGB sensor ports: 1 = R2, 2 = R1, 3 = L1, 4 = L2
        const l = a.pattern[0] === '1', r = a.pattern[1] === '1';
        return `${l ? '' : 'not '}mbuild.quad_rgb_sensor.is_line(3) and ${r ? '' : 'not '}mbuild.quad_rgb_sensor.is_line(2)`;
      }
      case 'floor_color': return `mbuild.quad_rgb_sensor.get_color_sta(2) == ${pyStr(a.color)}`;
      case 'cam_color': return `mbuild.smart_camera.detect_sign(${a.sign || 1}, 1)`;
      case 'cmp': return `${expr(a.a)} ${a.cmp === '=' ? '==' : a.cmp} ${expr(a.b)}`;
      default: return 'False';
    }
  }

  function toPython(demo, course) {
    const vars = new Set();
    const scan = (list) => (list || []).forEach((b) => {
      if (b.op === 'set_var' || b.op === 'change_var') vars.add(pyName(b.args.name));
      scan(b.body); scan(b.else);
    });
    demo.scripts.forEach(scan);
    const globals = vars.size ? `global ${[...vars].join(', ')}` : null;

    let depth = 0;
    function stmts(list, ind) {
      const out = [];
      for (const b of list || []) out.push(...stmt(b, ind));
      if (!out.length) out.push(ind + 'pass');
      return out;
    }
    function stmt(b, ind) {
      const a = b.args || {};
      const I = ind, J = ind + '    ';
      switch (b.op) {
        case 'when_start': case 'define': return [];
        case 'forever': return [`${I}while True:`, ...stmts(b.body, J)];
        case 'repeat': {
          const v = depth++ ? `i${depth}` : 'count';
          const r = [`${I}for ${v} in range(${expr(a.n)}):`, ...stmts(b.body, J)];
          depth--;
          return r;
        }
        case 'repeat_until': return [`${I}while not (${cond(b.cond)}):`, ...stmts(b.body, J)];
        case 'if': {
          const out = [`${I}if ${cond(b.cond)}:`, ...stmts(b.body, J)];
          let e = b.else;
          while (e && e.length === 1 && e[0].op === 'if') {
            out.push(`${I}elif ${cond(e[0].cond)}:`, ...stmts(e[0].body, J));
            e = e[0].else;
          }
          if (e) out.push(`${I}else:`, ...stmts(e, J));
          return out;
        }
        case 'call': return [`${I}${pyName(a.name)}()`];
        case 'set_var': return [`${I}${pyName(a.name)} = ${expr(a.value)}`];
        case 'change_var': return [`${I}${pyName(a.name)} += ${expr(a.value)}`];
        case 'led':
          if (a.color === 'rainbow') return [`${I}cyberpi.led.play("rainbow")`];
          if (a.color === 'random') return [`${I}cyberpi.led.on(random.randint(0, 255), random.randint(0, 255), random.randint(0, 255), "all")`];
          return [`${I}cyberpi.led.on(${(RGB[a.color] || RGB.white).join(', ')}, "all")`];
        case 'sound': return [`${I}cyberpi.audio.play(${pyStr(SOUND[a.name] || a.name)})`];
        case 'note': return [`${I}cyberpi.audio.play_music(${midi(a.note)}, ${a.beats})  # ${a.note}`];
        case 'display': return [`${I}cyberpi.display.show_label(str(${expr(a.text)}), 16, "center", index=0)`];
        case 'cam_mode': return [`${I}mbuild.smart_camera.set_mode("color", 1)`];
        case 'pen': return [`${I}pass  # marker ${a.down ? 'down' : 'up'} (simulator only: tape a real marker to mBot2!)`];
        case 'move': return [`${I}drive(${expr(a.l)}, ${expr(a.r)})`];
        case 'move_for':
          if (a.l === a.r && a.l > 0) return [`${I}mbot2.forward(${a.l}, ${expr(a.sec)})`];
          if (a.l === a.r && a.l < 0) return [`${I}mbot2.backward(${-a.l}, ${expr(a.sec)})`];
          return [`${I}drive(${expr(a.l)}, ${expr(a.r)})`, `${I}time.sleep(${expr(a.sec)})`, `${I}mbot2.EM_stop()`];
        case 'turn': return [`${I}turn_degrees(${expr(a.deg)})  # negative = left`];
        case 'stop_move': return [`${I}mbot2.EM_stop()`];
        case 'wait': return [`${I}time.sleep(${expr(a.sec)})`];
        case 'stop_all': return [`${I}mbot2.EM_stop()`, `${I}return  # stop this program`];
        default: return [`${I}pass  # ${b.op}`];
      }
    }

    const L = [];
    L.push(`# ${course}`);
    L.push(`# Session ${demo.session}: ${demo.title}`);
    L.push('# Exported from the mBot2 class demo.');
    L.push('# How to use: mBlock 5 > connect mBot2 > Upload mode > Python tab > paste > Upload.');
    L.push('');
    L.push('import event, time, random, cyberpi, mbot2, mbuild');
    L.push('');
    L.push('');
    L.push('def drive(left, right):');
    L.push('    """EM1 = left wheel, EM2 = right wheel (EM2 is mirrored, so its sign flips)."""');
    L.push('    mbot2.EM_set_speed(left, 1)');
    L.push('    mbot2.EM_set_speed(-right, 2)');
    L.push('');
    L.push('');
    L.push('def turn_degrees(angle):');
    L.push('    mbot2.turn(angle, 50)');
    L.push('    time.sleep(abs(angle) / 90 * 0.7 + 0.1)');
    L.push('');
    if (vars.size) {
      L.push('');
      [...vars].forEach((v) => L.push(`${v} = 0`));
      L.push('');
    }
    demo.scripts.filter((s) => s[0].op === 'define').forEach((s) => {
      L.push('');
      L.push(`def ${pyName(s[0].args.name)}():  # My Block`);
      if (globals) L.push('    ' + globals);
      L.push(...stmts(s.slice(1), '    '));
      L.push('');
    });
    let n = 0;
    demo.scripts.filter((s) => s[0].op !== 'define').forEach((s) => {
      n++;
      L.push('');
      L.push('@event.start');
      L.push(`def on_start${n > 1 ? '_' + n : ''}():`);
      if (globals) L.push('    ' + globals);
      L.push(...stmts(s.slice(1), '    '));
      L.push('');
    });
    return L.join('\n');
  }

  function download(name, blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  const fileBase = (demo) => `session${String(demo.session).padStart(2, '0')}_${demo.id}`;

  function exportPython(demo, course) {
    download(fileBase(demo) + '.py', new Blob([toPython(demo, course)], { type: 'text/x-python' }));
  }

  function exportJSON(demo) {
    const clean = JSON.parse(JSON.stringify(demo, (k, v) => (k === 'id' && typeof v === 'string' && /^b\d+$/.test(v) ? undefined : v)));
    download(fileBase(demo) + '.json', new Blob([JSON.stringify(clean, null, 2)], { type: 'application/json' }));
  }

  /* Printable picture of the blocks (for worksheets / rebuilding in mBlock). */
  async function exportPNG(demo, course, blocksEl) {
    let css = '';
    for (const sheet of document.styleSheets) {
      try { for (const r of sheet.cssRules) css += r.cssText + '\n'; } catch (e) { /* cross-origin sheet */ }
    }
    const clone = blocksEl.cloneNode(true);
    clone.style.zoom = 1;
    clone.querySelectorAll('.active').forEach((el) => el.classList.remove('active'));
    clone.querySelectorAll('.cond-badge, .loop-count').forEach((el) => el.remove());

    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;left:-10000px;top:0;';
    const sheetEl = document.createElement('div');
    sheetEl.className = 'print-sheet';
    sheetEl.innerHTML = `<div class="ps-course">${course}</div><div class="ps-title">Session ${demo.session} · ${demo.title}</div>`;
    sheetEl.appendChild(clone);
    probe.appendChild(sheetEl);
    document.body.appendChild(probe);
    const w = Math.ceil(sheetEl.scrollWidth) + 2, h = Math.ceil(sheetEl.scrollHeight) + 2;
    const html = new XMLSerializer().serializeToString(sheetEl);
    probe.remove();

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
      `<foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml">` +
      `<style>${css.replace(/]]>/g, '')}</style>${html}</div></foreignObject></svg>`;
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    await img.decode();
    const scale = 2, canvas = document.createElement('canvas');
    canvas.width = w * scale; canvas.height = h * scale;
    const g = canvas.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, canvas.width, canvas.height);
    g.scale(scale, scale);
    g.drawImage(img, 0, 0);
    canvas.toBlob((blob) => download(fileBase(demo) + '_blocks.png', blob), 'image/png');
  }

  G.Exporter = { toPython, exportPython, exportJSON, exportPNG };
})(window);
