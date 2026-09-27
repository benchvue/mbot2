/* Export a demo as a real mBlock 5 project (.mblock).
 *
 * Only block IDs that were verified from a project saved by mBlock 5.6.0,
 * plus standard Scratch 3 blocks, are used. If a demo needs a block whose
 * mBlock ID is still unknown, export is refused and the block is named. */
(function (G) {
  'use strict';

  /* ---------- minimal ZIP writer (stored, no compression) ---------- */
  const CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return (bytes) => {
      let c = 0xffffffff;
      for (let i = 0; i < bytes.length; i++) c = t[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
      return (c ^ 0xffffffff) >>> 0;
    };
  })();

  function zip(files) {
    const enc = new TextEncoder();
    const parts = [], central = [];
    let offset = 0;
    const u16 = (v) => [v & 255, (v >>> 8) & 255];
    const u32 = (v) => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
    for (const f of files) {
      const name = enc.encode(f.name);
      const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
      const crc = CRC(data);
      const head = [0x50, 0x4b, 3, 4, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21),
        ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0)];
      parts.push(new Uint8Array(head), name, data);
      central.push([0x50, 0x4b, 1, 2, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21),
        ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...u16(0),
        ...u16(0), ...u16(0), ...u32(0), ...u32(offset)], name);
      offset += head.length + name.length + data.length;
    }
    let size = 0;
    central.forEach((c, i) => { if (i % 2 === 0) { parts.push(new Uint8Array(c)); size += c.length; } else { parts.push(c); size += c.length; } });
    parts.push(new Uint8Array([0x50, 0x4b, 5, 6, ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length),
      ...u32(size), ...u32(offset), ...u16(0)]));
    return new Blob(parts, { type: 'application/zip' });
  }

  const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

  /* ---------- which blocks can be exported ---------- */
  const OPS = new Set(['when_start', 'display', 'led', 'led_anim', 'sound', 'move_for', 'turn', 'wait',
    'repeat', 'forever', 'if', 'repeat_until', 'stop_all', 'set_var', 'change_var', 'call', 'define', 'pen']);
  const CONDS = new Set(['cmp']);
  const EXPRS = new Set(['var', 'join', 'add', 'sub', 'mul', 'div', 'rand']);

  const NEED = {
    move: (b) => (b.args.em1 !== undefined ? 'encoder motor EM1 ... RPM, encoder motor EM2 ... RPM' : 'moves [forward] at (50) RPM'),
    stop_move: () => 'stop encoder motor [all]',
    note: () => 'play note (60) for (0.25) beat',
    led_rgb: () => 'LED [all] displays R ( ) G ( ) B ( )',
    cam_mode: () => 'AI Camera 2.0: Switch to [ ] mode',
    tag_size: () => 'AI Camera 2.0: Set AprilTag size to (10) cm',
    line: () => "quad rgb sensor [1] L1, R1's [line] in status [ ] ?",
    floor_color: () => 'quad rgb sensor [1] probe [ ] detects [color] ?',
    distance: () => 'ultrasonic 2 [1] distance to an object (cm)',
    blob_count: () => 'AI Camera 2.0: Number of [ ] color blocks',
    blob_x: () => 'AI Camera 2.0: The [X Coordinate] of the blob with [Middle position]',
    blob_w: () => 'AI Camera 2.0: The [X Coordinate] of the blob with [Middle position]',
    tag_id: () => 'AI Camera 2.0: The identify result of the tag with [Middle position]',
  };

  function missing(demo) {
    const out = new Set();
    const ex = (e) => {
      if (!e || typeof e !== 'object') return;
      if (!EXPRS.has(e.k)) out.add(NEED[e.k] ? NEED[e.k]() : e.k);
      ex(e.a); ex(e.b);
    };
    const walk = (list) => (list || []).forEach((b) => {
      if (!OPS.has(b.op)) out.add(NEED[b.op] ? NEED[b.op](b) : b.op);
      Object.values(b.args || {}).forEach(ex);
      if (b.cond) {
        if (!CONDS.has(b.cond.op)) out.add(NEED[b.cond.op] ? NEED[b.cond.op]() : b.cond.op);
        Object.values(b.cond.args || {}).forEach(ex);
      }
      walk(b.body); walk(b.else);
    });
    demo.scripts.forEach(walk);
    return [...out];
  }

  /* ---------- Scratch 3 / mBlock block builder ---------- */
  function build(demo) {
    const blocks = {}, variables = {};
    const CH = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!#%()*+,-./:;=?@[]^_`{|}~';
    let seq = 0;
    const nid = () => {
      let s = '';
      for (let i = 0; i < 20; i++) s += CH[Math.floor(Math.random() * CH.length)];
      return s + (seq++).toString(36);
    };
    const varIds = {};
    const varId = (name) => {
      if (!varIds[name]) { varIds[name] = nid(); variables[varIds[name]] = [name, 0]; }
      return varIds[name];
    };
    const add = (id, opcode, parent, extra) => {
      blocks[id] = Object.assign({ opcode, next: null, parent, inputs: {}, fields: {}, shadow: false, topLevel: false }, extra || {});
      return id;
    };
    const menu = (parent, opcode, option, value) =>
      add(nid(), opcode, parent, { shadow: true, fields: { [option]: [value, null] } });

    // value inputs: 4 number, 5 positive number, 6 whole number, 10 text
    function value(v, prim, parent) {
      if (v === null || typeof v !== 'object') return [1, [prim, String(v)]];
      if (v.k === 'var') return [3, [12, v.n, varId(v.n)], [prim, '']];
      return [3, reporter(v, parent), [prim, '']];
    }
    function reporter(e, parent) {
      const id = nid();
      const bin = { add: 'operator_add', sub: 'operator_subtract', mul: 'operator_multiply', div: 'operator_divide' };
      if (e.k === 'join') {
        add(id, 'operator_join', parent);
        blocks[id].inputs = { STRING1: value(e.a, 10, id), STRING2: value(e.b, 10, id) };
      } else if (e.k === 'rand') {
        add(id, 'operator_random', parent);
        blocks[id].inputs = { FROM: value(e.a, 4, id), TO: value(e.b, 4, id) };
      } else if (bin[e.k]) {
        add(id, bin[e.k], parent);
        blocks[id].inputs = { NUM1: value(e.a, 4, id), NUM2: value(e.b, 4, id) };
      }
      return id;
    }
    function condition(c, parent) {
      const a = c.args, id = nid();
      const op = { '<': 'operator_lt', '>': 'operator_gt', '=': 'operator_equals' }[a.cmp];
      add(id, op, parent);
      blocks[id].inputs = { OPERAND1: value(a.a, 10, id), OPERAND2: value(a.b, 10, id) };
      return id;
    }

    function stack(list, parent) {
      let first = null, prev = null;
      for (const b of list || []) {
        const id = one(b, prev || parent);
        if (!id) continue;
        if (prev) blocks[prev].next = id; else first = id;
        blocks[id].parent = prev || parent;
        prev = id;
      }
      return first;
    }

    function one(b, parent) {
      const a = b.args || {}, id = nid();
      switch (b.op) {
        case 'pen': return null; // simulator only
        case 'display': {
          add(id, 'cyberpi.cyberpi_display_label_show_at_somewhere_with_size', parent, {
            fields: { fieldMenu_1: ['0', null], fieldMenu_2: ['center', null] },
          });
          const m = menu(id, 'cyberpi.cyberpi_display_label_show_at_somewhere_with_size_inputMenu_4_menu',
            'cyberpi.cyberpi_display_label_show_at_somewhere_with_size_inputMenu_4_menu_option', '16');
          blocks[id].inputs = { string_2: value(a.text, 10, id), inputMenu_4: [1, m] };
          return id;
        }
        case 'led': {
          add(id, 'cyberpi.cyberpi_led_show_single_with_color_2', parent);
          const m = menu(id, 'cyberpi.cyberpi_led_show_single_with_color_2_fieldMenu_1_menu',
            'cyberpi.cyberpi_led_show_single_with_color_2_fieldMenu_1_menu_option', '"all"');
          blocks[id].inputs = { fieldMenu_1: [1, m], color_1: [1, [9, a.hex]] };
          return id;
        }
        case 'led_anim':
          return add(id, 'cyberpi.cyberpi_play_led_animation_until', parent, { fields: { LED_animation: [a.name, null] } });
        case 'sound': {
          add(id, 'cyberpi.cyberpi_play_audio_3', parent);
          const m = menu(id, 'cyberpi.cyberpi_play_audio_3_file_name_menu',
            'cyberpi.cyberpi_play_audio_3_file_name_menu_option', a.name);
          blocks[id].inputs = { file_name: [1, m] };
          return id;
        }
        case 'move_for':
          add(id, 'mbot2.mbot2_move_direction_with_time', parent, { fields: { DIRECTION: [a.direction, null] } });
          blocks[id].inputs = { POWER: value(a.rpm, 4, id), TIME: value(a.sec, 4, id) };
          return id;
        case 'turn':
          // In the saved mBlock 5.6.0 file the "turns left" block stores fieldMenu_1 = "cw".
          add(id, 'mbot2.mbot2_cw_and_ccw_with_angle', parent, { fields: { fieldMenu_1: [a.deg < 0 ? 'cw' : 'ccw', null] } });
          blocks[id].inputs = { ANGLE: value(Math.abs(a.deg), 4, id) };
          return id;
        case 'wait':
          add(id, 'control_wait', parent);
          blocks[id].inputs = { DURATION: value(a.sec, 5, id) };
          return id;
        case 'repeat':
          add(id, 'control_repeat', parent);
          blocks[id].inputs = { TIMES: value(a.n, 6, id) };
          { const s = stack(b.body, id); if (s) blocks[id].inputs.SUBSTACK = [2, s]; }
          return id;
        case 'forever':
          add(id, 'control_forever', parent);
          { const s = stack(b.body, id); if (s) blocks[id].inputs.SUBSTACK = [2, s]; }
          return id;
        case 'repeat_until':
          add(id, 'control_repeat_until', parent);
          blocks[id].inputs.CONDITION = [2, condition(b.cond, id)];
          { const s = stack(b.body, id); if (s) blocks[id].inputs.SUBSTACK = [2, s]; }
          return id;
        case 'if': {
          add(id, b.else ? 'control_if_else' : 'control_if', parent);
          blocks[id].inputs.CONDITION = [2, condition(b.cond, id)];
          const s1 = stack(b.body, id); if (s1) blocks[id].inputs.SUBSTACK = [2, s1];
          if (b.else) { const s2 = stack(b.else, id); if (s2) blocks[id].inputs.SUBSTACK2 = [2, s2]; }
          return id;
        }
        case 'stop_all':
          return add(id, 'control_stop', parent, {
            fields: { STOP_OPTION: ['all', null] },
            mutation: { tagName: 'mutation', children: [], hasnext: 'false' },
          });
        case 'set_var':
          add(id, 'data_setvariableto', parent, { fields: { VARIABLE: [a.name, varId(a.name)] } });
          blocks[id].inputs = { VALUE: value(a.value, 10, id) };
          return id;
        case 'change_var':
          add(id, 'data_changevariableby', parent, { fields: { VARIABLE: [a.name, varId(a.name)] } });
          blocks[id].inputs = { VALUE: value(a.value, 4, id) };
          return id;
        case 'call':
          return add(id, 'procedures_call', parent, {
            mutation: { tagName: 'mutation', children: [], proccode: a.name, argumentids: '[]', warp: 'false' },
          });
        default:
          throw new Error('No mBlock ID for block: ' + b.op);
      }
    }

    demo.scripts.forEach((script, i) => {
      const x = 40 + i * 520, y = 40;
      const head = script[0], id = nid();
      if (head.op === 'define') {
        const proto = nid();
        add(id, 'procedures_definition', null, { topLevel: true, x, y });
        blocks[id].inputs = { custom_block: [1, proto] };
        add(proto, 'procedures_prototype', id, {
          shadow: true,
          mutation: { tagName: 'mutation', children: [], proccode: head.args.name, argumentids: '[]',
            argumentnames: '[]', argumentdefaults: '[]', warp: 'false' },
        });
      } else {
        add(id, 'cyberpi.cyberpi_when_button_press', null, {
          topLevel: true, x, y, fields: { fieldMenu_2: [head.args.button || 'a', null] },
        });
      }
      const first = stack(script.slice(1), id);
      if (first) blocks[id].next = first;
    });
    return { blocks, variables };
  }

  function exportMblock(demo) {
    const miss = missing(demo);
    if (miss.length) return { ok: false, missing: miss };
    const T = JSON.parse(JSON.stringify(G.MBLOCK_TEMPLATE));
    const { blocks, variables } = build(demo);
    const dev = T.project.targets.find((t) => t.deviceId === 'cyberpi');
    dev.blocks = blocks;
    dev.variables = variables;
    const files = [
      { name: 'project.json', data: JSON.stringify(T.project) },
      { name: 'mscratch.json', data: JSON.stringify(T.mscratch) },
      { name: 'mblock5', data: JSON.stringify({ version: '5.6.0', createdAt: Date.now() }) },
      ...Object.entries(T.assets).map(([name, data]) => ({ name, data: b64(data) })),
    ];
    const blob = zip(files);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `session${String(demo.session).padStart(2, '0')}_${demo.id}.mblock`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    return { ok: true };
  }

  G.MblockExport = { exportMblock, missing, build };
})(window);
