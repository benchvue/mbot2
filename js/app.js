/* App: session picker, run/pause/stop, simulation loop, compass, sensor panel, export. */
(function () {
  'use strict';
  const S = window.MBotSim;
  const { SimClock, Interpreter } = window.MBotInterp;
  const $ = (id) => document.getElementById(id);

  const els = {
    rail: $('rail'), title: $('demoTitle'), summary: $('demoSummary'), concepts: $('demoConcepts'),
    challenge: $('challengeText'), blocks: $('blocks'), play: $('btnPlay'), pause: $('btnPause'), stop: $('btnStop'),
    speed: $('speedSel'), sound: $('btnSound'), status: $('statusPill'), cpScreen: $('cpScreen'),
    cpLeds: $('cpLeds').children, readouts: $('readouts'), compass: $('compass'),
    rose: $('compassRose'), needle: $('robotNeedle'), ticks: $('compassTicks'),
    cRead: $('compassRead'), cNorth: $('compassNorth'), toast: $('turnToast'),
    inset: $('camInset'), detBox: $('detBox'), detLabel: $('detLabel'), hint: $('hint'),
    follow: $('btnFollow'), top: $('btnTop'), reset: $('btnReset'), mode: $('btnMode'),
    exportBtn: $('btnExport'), exportMenu: $('exportMenu'),
  };

  const LED_CSS = {
    green: '#22c55e', red: '#ef4444', blue: '#3b82f6', yellow: '#facc15', white: '#ffffff',
    orange: '#f97316', cyan: '#06b6d4', purple: '#a855f7', pink: '#ec4899',
  };
  const WARN = { obstacle: 20, parking: 35, train: 15, corridor: 20, person: 30 };

  let course = document.title, demos = [], demo = null;
  let state = 'idle'; // idle | running | paused | done
  let speed = 1, busy = false, simAcc = 0, last = performance.now();

  const core = new S.SimCore('arena');
  const clock = new SimClock();
  const view = new BlockView(els.blocks);
  const scene = new Scene3D($('viewport'));

  const interp = new Interpreter(core, clock, {
    highlight: (id, lane) => view.highlight(id, lane),
    condResult: (id, ok) => view.condResult(id, ok),
    loopCount: (id, i, n) => view.loopCount(id, i, n),
    sound: (name) => RobotAudio.play(name),
    note: (n, sec) => RobotAudio.note(n, sec / speed),
    onTurn: (from, deg) => showTurnToast(from, deg),
    onEnd: (reason) => setState(reason === 'error' ? 'idle' : 'done'),
  });

  /* compass ticks */
  for (let a = 0; a < 360; a += 30) {
    const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    const r0 = a % 90 === 0 ? 38 : 41;
    l.setAttribute('x1', 0); l.setAttribute('y1', -r0); l.setAttribute('x2', 0); l.setAttribute('y2', -45);
    l.setAttribute('stroke', '#b8c2ce'); l.setAttribute('stroke-width', a % 90 === 0 ? 2 : 1.2);
    l.setAttribute('transform', `rotate(${a})`);
    els.ticks.appendChild(l);
  }

  /* ---------- state ---------- */
  function setState(s) {
    state = s;
    els.status.textContent = { idle: 'Ready', running: 'Running', paused: 'Paused', done: 'Finished' }[s];
    els.status.className = 'status ' + s;
    els.play.disabled = s === 'running';
    els.play.querySelector('span').textContent = s === 'paused' ? 'Resume' : 'Run';
    els.pause.disabled = s !== 'running';
    els.stop.disabled = s === 'idle';
    $('btnRunMini').textContent = s === 'running' ? '⏸ Pause' : s === 'paused' ? '▶ Resume' : '▶ Run';
  }

  function play() {
    RobotAudio.unlock();
    if (state === 'paused') { setState('running'); return; }
    if (state === 'running') return;
    if (state === 'done') resetRun();
    view.clearMarks();
    setState('running');
    interp.start({ scripts: demo.scripts });
  }

  function pause() { if (state === 'running') setState('paused'); }

  function resetRun() {
    interp.stop();
    core.reset();
    view.clearMarks();
    scene.screenText = null;
    scene.clearPen();
  }

  function stop() {
    resetRun();
    setState('idle');
    hideToast();
  }

  /* ---------- session picker ---------- */
  const BUILD_DEMO = {
    id: 'build', session: 1, title: 'Build Day', emoji: '🔧', world: 'stage', camera: false, level: 0,
    scripts: [],
    summary: 'Unbox the kit, check every part, measure the screws, and build your own mBot2 step by step.',
    concepts: ['Parts & tools', 'Following instructions', 'Teamwork'],
    challenge: 'Finish all 11 steps, then press button A on CyberPi to say hello to your new robot!',
  };

  function selectDemo(id) {
    resetRun();
    demo = id === 'build' ? BUILD_DEMO : demos.find((d) => d.id === id);
    const isBuild = id === 'build';
    document.body.classList.toggle('build-mode', isBuild);
    scene.turntable = false;
    core.setWorld(demo.world);
    view.render(demo);
    scene.loadWorld(demo.world, demo.camera);
    els.inset.hidden = !demo.camera;
    els.detBox.hidden = true;

    els.rail.querySelectorAll('.sess').forEach((b) => b.setAttribute('aria-current', b.dataset.id === id));
    if ($('railSel').options.length) $('railSel').value = id;
    els.title.textContent = `Session ${demo.session} · ${demo.emoji} ${demo.title}`;
    els.summary.textContent = demo.summary;
    els.challenge.textContent = demo.challenge;
    els.concepts.innerHTML = '';
    demo.concepts.forEach((c) => {
      const s = document.createElement('span'); s.textContent = c; els.concepts.appendChild(s);
    });
    buildReadouts();
    setState('idle');
    hideToast();
    history.replaceState(null, '', '#' + id);
  }

  /* ---------- sensor panel ---------- */
  let ro = {};
  function buildReadouts() {
    els.readouts.innerHTML = '';
    ro = {};
    const add = (key, label) => {
      const d = document.createElement('div');
      d.className = 'ro';
      d.innerHTML = `<div class="k">${label}</div><div class="v"></div>`;
      els.readouts.appendChild(d);
      ro[key] = d.querySelector('.v');
    };
    const w = demo.world;
    if (w === 'line' || w === 'train') add('line', 'Quad RGB line sensors');
    if (w === 'traffic' || w === 'train') add('color', 'Quad RGB color');
    if (WARN[w]) add('dist', 'Ultrasonic sensor 2');
    if (demo.camera) add('cam', 'AI Camera 2.0');
    if (JSON.stringify(demo.scripts).includes('"set_var"')) add('vars', 'Variables');
    add('wheels', 'Encoder motors EM1 / EM2');
    add('heading', 'Robot heading (gyro)');
    if (Object.keys(ro).length < 6) add('odo', 'Distance travelled');
  }

  let lastHud = 0;
  function updateHud(sensors, now) {
    if (now - lastHud < 90) return;
    lastHud = now;
    const r = core.robot, t = now / 1000;
    els.cpScreen.textContent = r.display || '…';
    [...els.cpLeds].forEach((el, i) => {
      el.style.background = r.led === 'rainbow'
        ? `hsl(${((t * 0.6 + i / 5) % 1) * 360} 90% 55%)`
        : (LED_CSS[r.led] || (r.led && r.led.startsWith('rgb') ? r.led : '#d7dce3'));
    });
    if (ro.line) {
      const l = sensors.line, names = ['L2', 'L1', 'R1', 'R2'];
      ro.line.innerHTML = [l.L2, l.L1, l.R1, l.R2]
        .map((on, i) => `<span class="linebit ${on ? 'on' : ''}">${names[i]}</span>`).join('');
    }
    if (ro.color) {
      const c = core.floorColor();
      ro.color.innerHTML = `<span class="swatch" style="background:${c === 'white' ? '#fff' : c === 'black' ? '#111' : LED_CSS[c]}"></span>${c}`;
    }
    if (ro.dist) {
      const d = sensors.distance, pct = Math.min(100, (d / 150) * 100);
      ro.dist.innerHTML = `${d >= 300 ? '300+' : d.toFixed(1)}<small>cm</small><span class="bar ${d < sensors.warn ? 'warn' : ''}"><i style="width:${pct}%"></i></span>`;
    }
    if (ro.cam) {
      const c = sensors.camera;
      ro.cam.innerHTML = c
        ? (c.pose ? `person <small>x ${c.x}</small>` : core.ball
          ? `<span class="swatch" style="background:#e11d2e"></span>red blob <small>x ${c.x} · w ${c.size}</small>`
          : `AprilTag ${c.tag} <small>${c.dist.toFixed(0)} cm</small>`)
        : 'nothing <small>searching</small>';
    }
    if (ro.vars) {
      const entries = Object.entries(core.vars);
      ro.vars.innerHTML = entries.length
        ? entries.map(([k, v]) => `<span class="var">${k} = ${typeof v === 'number' ? Math.round(v * 10) / 10 : v}</span>`).join('')
        : '<small>not set yet</small>';
    }
    ro.wheels.innerHTML = `${Math.round(r.rpmL)} / ${Math.round(r.rpmR)}<small>RPM</small>`;
    ro.heading.innerHTML = `${String(Math.round(r.h) % 360).padStart(3, '0')}°<small>${S.dirName(r.h)}</small>`;
    if (ro.odo) ro.odo.innerHTML = `${(r.odometer / 100).toFixed(2)}<small>m</small>`;
  }

  /* ---------- compass ---------- */
  function updateCompass() {
    const camH = scene.viewHeading(), h = core.robot.h;
    els.rose.setAttribute('transform', `rotate(${-camH})`);
    els.needle.setAttribute('transform', `rotate(${h - camH})`);
    els.cRead.textContent = `Robot ${String(Math.round(h) % 360).padStart(3, '0')}° ${S.dirShort(h)}`;
    els.cNorth.textContent = `North is ${S.northRel(h)}`;
  }

  let toastTimer = null;
  function showTurnToast(from, deg) {
    const to = S.norm360(from + deg);
    const side = deg < 0 ? '↰ Turning left' : '↱ Turning right';
    els.toast.innerHTML =
      `<b>${side} ${Math.abs(deg)}°</b><br>` +
      `${S.dirName(from)} → <b>${S.dirName(to)}</b><br class="extra">` +
      `<span class="extra">🧭 Now north is <b>${S.northRel(to)}</b> of the robot</span>`;
    els.toast.classList.add('show');
    els.compass.classList.add('flash');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 2600 / Math.max(speed, 0.5));
  }
  function hideToast() {
    els.toast.classList.remove('show');
    els.compass.classList.remove('flash');
  }

  /* ---------- simulation loop ---------- */
  const settle = (() => {
    const ch = new MessageChannel(), q = [];
    ch.port1.onmessage = () => { const r = q.shift(); r && r(); };
    return () => new Promise((r) => { q.push(r); ch.port2.postMessage(0); });
  })();

  async function advance(dt) {
    let rem = dt, guard = 0;
    while (rem > 1e-9 && guard++ < 5000) {
      if (clock.flushDue()) {
        await settle();
        if (state !== 'running') return;
        continue;
      }
      const nd = clock.nextDue();
      let s = Math.min(rem, 0.01);
      if (nd !== null) s = Math.max(1e-4, Math.min(s, nd - clock.t));
      core.step(s);
      clock.t += s;
      rem -= s;
      simAcc += s;
    }
    if (clock.flushDue()) await settle();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const realDt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (state === 'running' && !busy) {
      busy = true;
      advance(realDt * speed).catch(console.error).finally(() => { busy = false; });
    }
    const sensors = {
      line: core.lineSensors(),
      distance: WARN[demo.world] ? core.distance() : 300,
      warn: WARN[demo.world] || 20,
      camera: demo.camera ? core.cameraDetect() : null,
    };
    scene.update(core, simAcc, realDt, sensors);
    simAcc = 0;
    updateCompass();
    updateHud(sensors, now);
    scene.render(sensors.camera, els.inset, els.detBox, els.detLabel);
  }

  /* ---------- controls ---------- */
  els.play.onclick = play;
  $('btnRunMini').onclick = () => (state === 'running' ? pause() : play());
  els.pause.onclick = pause;
  els.stop.onclick = stop;
  els.speed.onchange = () => { speed = parseFloat(els.speed.value); };
  els.sound.onclick = () => {
    RobotAudio.enabled = !RobotAudio.enabled;
    els.sound.textContent = RobotAudio.enabled ? '🔊' : '🔇';
    els.sound.setAttribute('aria-pressed', RobotAudio.enabled);
  };

  let zoom = window.matchMedia('(max-width: 820px)').matches ? 0.75 : 0.9;
  els.blocks.style.zoom = zoom;
  $('zoomVal').textContent = Math.round(zoom * 100) + '%';
  const setZoom = (z) => {
    zoom = Math.min(1.4, Math.max(0.6, Math.round(z * 10) / 10));
    els.blocks.style.zoom = zoom;
    $('zoomVal').textContent = Math.round(zoom * 100) + '%';
  };
  $('zoomIn').onclick = () => setZoom(zoom + 0.1);
  $('zoomOut').onclick = () => setZoom(zoom - 0.1);

  // export menu
  const closeMenu = () => { els.exportMenu.hidden = true; els.exportBtn.setAttribute('aria-expanded', false); };
  els.exportBtn.onclick = (e) => {
    e.stopPropagation();
    els.exportMenu.hidden = !els.exportMenu.hidden;
    els.exportBtn.setAttribute('aria-expanded', !els.exportMenu.hidden);
  };
  document.addEventListener('click', closeMenu);
  els.exportMenu.querySelectorAll('button').forEach((b) => {
    b.onclick = async (e) => {
      e.stopPropagation();
      closeMenu();
      if (b.dataset.x === 'mblock') {
        const r = MblockExport.exportMblock(demo);
        if (!r.ok) showMissing(r.missing);
      }
      if (b.dataset.x === 'py') Exporter.exportPython(demo, course);
      if (b.dataset.x === 'json') Exporter.exportJSON(demo);
      if (b.dataset.x === 'png') {
        try { await Exporter.exportPNG(demo, course, els.blocks); }
        catch (err) { console.error(err); alert('This browser could not create the picture. Try Chrome or Edge.'); }
      }
    };
  });

  function showMissing(list) {
    const dlg = $('missingDlg');
    $('missingList').innerHTML = list.map((m) => `<li>${m.replace(/</g, '&lt;')}</li>`).join('');
    dlg.showModal();
  }
  $('missingClose').onclick = () => $('missingDlg').close();

  // show / hide the block program (more room for the robot)
  $('btnBlocks').onclick = () => {
    const hidden = document.body.classList.toggle('blocks-hidden');
    $('btnBlocks').setAttribute('aria-pressed', !hidden);
    $('btnBlocks').textContent = hidden ? '🧩 Show blocks' : '🧩 Hide blocks';
    setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
  };

  els.follow.onclick = () => {
    scene.follow = !scene.follow;
    els.follow.setAttribute('aria-pressed', scene.follow);
  };
  els.top.onclick = () => scene.topView();
  els.reset.onclick = () => {
    scene.follow = false;
    els.follow.setAttribute('aria-pressed', false);
    scene.resetView(false);
  };
  els.compass.onclick = () => scene.northUp();

  const HINTS = {
    orbit: 'Left-drag: rotate  |  Right-drag: move  |  Wheel: zoom',
    map: 'Left-drag: move  |  Right-drag or wheel: zoom  |  Ctrl+drag: rotate',
  };
  function setMode(m) {
    scene.setMouseMode(m);
    els.mode.textContent = m === 'map' ? '🖱 Mouse: map (Cesium)' : '🖱 Mouse: 3D orbit';
    els.hint.textContent = HINTS[m];
  }
  els.mode.onclick = () => setMode(scene.mouseMode === 'map' ? 'orbit' : 'map');
  setMode('orbit');

  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'SELECT') return;
    if (e.code === 'Space') { e.preventDefault(); state === 'running' ? pause() : play(); }
    if (e.code === 'Escape') { stop(); closeMenu(); }
  });

  /* ---------- real-size screw ruler ---------- */
  const SCREWS = [
    { name: 'M4 × 25 mm', len: 25, d: 4, head: 7, hh: 2.8, pitch: 0.7 },
    { name: 'M4 × 14 mm', len: 14, d: 4, head: 7, hh: 2.8, pitch: 0.7 },
    { name: 'M2.5 × 12 mm', len: 12, d: 2.5, head: 4.5, hh: 1.8, pitch: 0.45 },
    { name: 'M4 × 8 mm', len: 8, d: 4, head: 7, hh: 2.8, pitch: 0.7 },
  ];
  const CARD_MM = 85.6; // ISO ID-1 card (bank card / most student ID cards)

  function renderRuler(body) {
    // default: phones ≈ 6 CSS px per mm (iPhone 460 ppi at 3×), desktops 96 dpi
    const phone = window.matchMedia('(max-width: 820px)').matches && 'ontouchstart' in window;
    let px = phone ? 6.0 : 96 / 25.4;
    try { px = parseFloat(localStorage.getItem('mbot2-mm-px')) || px; } catch (e) { /* ignore */ }
    body.innerHTML = `
      <p class="bg-lead"><b>Which screw is which?</b> Lay a screw flat on the screen: put the bottom of the head on the
      <b>0</b> line and see which mark the tip reaches. Length is measured <b>without</b> the head.</p>
      <div class="ruler-wrap"><svg id="rulerSvg"></svg></div>
      <details class="calib" ${localStorage.getItem('mbot2-mm-px') ? '' : 'open'}>
        <summary>Make the ruler real size (do this once per screen)</summary>
        <p>Stand a bank card or student ID card <b>upright</b> on the screen (long side up/down). Move the slider until
        the blue box is exactly as <b>tall</b> as the card.</p>
        <div class="calib-row"><button class="rm-btn" id="calibMinus" aria-label="Smaller">−</button>
          <input type="range" id="calib" min="2" max="9" step="0.01" value="${px}">
          <button class="rm-btn" id="calibPlus" aria-label="Bigger">+</button></div>
        <div class="card-box" id="cardBox"><span>85.6 mm<br>card<br>height</span></div>
      </details>`;
    const svg = body.querySelector('#rulerSvg'), slider = body.querySelector('#calib'), box = body.querySelector('#cardBox');
    const draw = () => {
      const k = px, left = 14 * k, top = 8, rowH = Math.max(12 * k, 42);
      const W = left + 30 * k + 20, H = top + 10 * k + 12 + SCREWS.length * rowH + 10;
      let g = `<rect x="${left}" y="${top}" width="${30 * k}" height="${10 * k}" fill="#fff7d6" stroke="#b8860b"/>`;
      for (let mm = 0; mm <= 30; mm++) {
        const x = left + mm * k, h = mm % 10 === 0 ? 7 * k : mm % 5 === 0 ? 5 * k : 3 * k;
        g += `<line x1="${x}" y1="${top}" x2="${x}" y2="${top + h}" stroke="#1f2a37" stroke-width="${mm % 5 ? 0.8 : 1.4}"/>`;
        if (mm % 5 === 0) g += `<text x="${x + 2}" y="${top + 9.4 * k}" font-size="${Math.max(10, 2.6 * k)}" fill="#1f2a37">${mm}</text>`;
      }
      g += `<text x="${left + 30 * k - 2}" y="${top + 9.4 * k}" font-size="${Math.max(9, 2.2 * k)}" text-anchor="end" fill="#8a6d1a">mm</text>`;
      const y0 = top + 10 * k + 12;
      g += `<line x1="${left}" y1="${top}" x2="${left}" y2="${H - 6}" stroke="#e0342b" stroke-width="2"/>`;
      SCREWS.forEach((sc, i) => {
        const cy = y0 + i * rowH + rowH / 2, xe = left + sc.len * k;
        g += `<line x1="${xe}" y1="${top}" x2="${xe}" y2="${cy + sc.d * k / 2 + 4}" stroke="#94a3b8" stroke-dasharray="3 3"/>`;
        // head (left of 0) + shank (0 → length)
        g += `<rect x="${left - sc.hh * k}" y="${cy - sc.head * k / 2}" width="${sc.hh * k}" height="${sc.head * k}" rx="${sc.hh * k * 0.45}" fill="#9aa5b1" stroke="#475569"/>`;
        g += `<rect x="${left}" y="${cy - sc.d * k / 2}" width="${sc.len * k}" height="${sc.d * k}" fill="#cbd5e1" stroke="#475569"/>`;
        for (let t = sc.pitch; t < sc.len; t += sc.pitch) {
          const x = left + t * k;
          g += `<line x1="${x}" y1="${cy - sc.d * k / 2}" x2="${x + sc.pitch * k * 0.6}" y2="${cy + sc.d * k / 2}" stroke="#64748b" stroke-width="0.7"/>`;
        }
        g += `<text x="${xe + 6}" y="${cy + 4}" font-size="13" font-weight="800" fill="#1f2a37">${sc.name}</text>`;
      });
      svg.setAttribute('width', W + 90); svg.setAttribute('height', H);
      svg.setAttribute('viewBox', `0 0 ${W + 90} ${H}`);
      svg.innerHTML = g;
      box.style.height = CARD_MM * k + 'px';   // upright card: 85.6 mm tall
      box.style.width = 53.98 * k + 'px';
    };
    const setPx = (v) => {
      px = Math.min(9, Math.max(2, v));
      slider.value = px;
      try { localStorage.setItem('mbot2-mm-px', String(px)); } catch (e) { /* ignore */ }
      draw();
    };
    slider.oninput = () => setPx(parseFloat(slider.value));
    body.querySelector('#calibMinus').onclick = () => setPx(px - 0.02);
    body.querySelector('#calibPlus').onclick = () => setPx(px + 0.02);
    draw();
  }

  /* ---------- Session 1: Build Day guide ---------- */
  function buildGuide(g) {
    if (!g) return;
    const tabs = $('buildTabs'), body = $('buildBody');
    const KEY = 'mbot2-build-progress';
    let done = {};
    try { done = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { done = {}; }
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(done)); } catch (e) { /* ignore */ } };
    const pages = [{ key: 'parts', label: 'Parts list' }, { key: 'ruler', label: '📏 Screw ruler' }]
      .concat(g.steps.map((img, i) => ({ key: 'step' + (i + 1), label: 'Step ' + (i + 1), img })))
      .concat([{ key: 'done', label: 'Completed', img: g.completed }, { key: 'camera', label: '🎥 AI Camera 2.0' }]);
    let cur = 0;

    function progress() {
      const n = g.steps.filter((_, i) => done['step' + (i + 1)]).length;
      $('buildProgress').style.width = (n / g.steps.length) * 100 + '%';
      $('buildCount').textContent = `${n} / ${g.steps.length} steps done`;
      [...tabs.children].forEach((t, i) => t.classList.toggle('done', !!done[pages[i].key]));
    }

    function show(i) {
      cur = i;
      const pg = pages[i];
      [...tabs.children].forEach((t, j) => t.setAttribute('aria-selected', j === i));
      tabs.children[i].scrollIntoView({ block: 'nearest', inline: 'nearest' });
      if (pg.key === 'camera') {
        body.innerHTML = `<div class="bg-step-head"><h3>🎥 Add AI Camera 2.0</h3></div>
          <p class="bg-lead">Your mBot2 is built. Now give it eyes! AI Camera 2.0 is used from Session 7 to Session 11.</p>
          <ol class="cam-steps">
            <li>Attach the block adapter to the camera.</li>
            <li>Install the bracket on the front of mBot2.</li>
            <li>Mount AI Camera 2.0 on the bracket.</li>
            <li>Connect the mBuild cable. <b>Check the connector: front and back must match.</b></li>
          </ol>
          <p><a class="tbtn play" href="${g.camera_guide}" target="_blank" rel="noopener">Open the official camera guide with pictures ↗</a></p>`;
      } else if (pg.key === 'ruler') {
        renderRuler(body);
      } else if (pg.key === 'parts') {
        const found = g.parts.filter((p) => done['part:' + p[0]]).length;
        body.innerHTML = `<p class="bg-lead">Check that you have every part before you start. Tap a part when you find it. <b>${found} / ${g.parts.length}</b> found.</p>
          <div class="parts">${g.parts.map((p) => `
            <button class="part ${done['part:' + p[0]] ? 'found' : ''}" data-part="${p[0]}">
              <img src="${g.img_base}${p[1]}" alt="${p[0]}" loading="lazy" referrerpolicy="no-referrer">
              <span>${p[0]}</span></button>`).join('')}</div>`;
        body.querySelectorAll('.part').forEach((b) => {
          b.onclick = () => { done['part:' + b.dataset.part] = !done['part:' + b.dataset.part]; save(); show(0); };
        });
      } else {
        const isDone = pg.key === 'done';
        body.innerHTML = `
          <div class="bg-step-head"><h3>${isDone ? '🎉 Completed!' : pg.label + ' of ' + g.steps.length}</h3>
            ${isDone ? '' : `<label class="bg-check"><input type="checkbox" ${done[pg.key] ? 'checked' : ''}> I finished this step</label>`}</div>
          <div class="bg-img"><img src="${g.img_base}${pg.img}" alt="${pg.label}" referrerpolicy="no-referrer"
            onerror="this.outerHTML='<div class=&quot;bg-fallback&quot;>Picture could not load here. <a href=&quot;${g.source}&quot; target=&quot;_blank&quot; rel=&quot;noopener&quot;>Open ${pg.label} in the official guide ↗</a></div>'"></div>
          ${isDone ? '<p class="bg-lead">Great job! Turn on CyberPi, connect it to mBlock 5, and get ready for Session 2.</p>' : ''}`;
        const cb = body.querySelector('input');
        if (cb) cb.onchange = () => { done[pg.key] = cb.checked; save(); progress(); if (cb.checked && i < pages.length - 1) setTimeout(() => show(i + 1), 350); };
      }
      $('buildPrev').disabled = i === 0;
      $('buildNext').disabled = i === pages.length - 1;
      progress();
    }

    tabs.innerHTML = '';
    pages.forEach((pg, i) => {
      const t = document.createElement('button');
      t.className = 'btab'; t.textContent = pg.label; t.setAttribute('role', 'tab');
      t.onclick = () => show(i);
      tabs.appendChild(t);
    });
    $('buildPrev').onclick = () => show(Math.max(0, cur - 1));
    $('buildNext').onclick = () => show(Math.min(pages.length - 1, cur + 1));
    $('buildSource').href = g.source;
    show(0);
  }

  /* ---------- start ---------- */
  Promise.resolve(window.MBOT_DATA)
    .then((data) => {
      if (!data) throw new Error('data/demos.js is missing');
      demos = data.demos;
      course = data.course || course;
      $('courseTitle').textContent = course;
      document.title = course;
      data.curriculum.forEach((c) => {
        const d = c.demo === 'build' ? BUILD_DEMO : demos.find((x) => x.id === c.demo);
        const li = document.createElement('li');
        const b = document.createElement('button');
        b.className = 'sess';
        b.title = c.desc;
        const icon = d ? d.emoji : c.n === 1 ? '🔧' : '🚀';
        const stars = d && d.level ? '★'.repeat(d.level) + '☆'.repeat(5 - d.level) : c.n === 1 ? 'hands-on build' : 'your idea';
        b.innerHTML = `<span class="n"><span>Session ${c.n}</span><span>${icon}</span></span><span class="t">${c.title}</span><span class="lv">${stars}</span>`;
        if (d) { b.dataset.id = d.id; b.onclick = () => selectDemo(d.id); }
        else b.disabled = true;
        li.appendChild(b);
        els.rail.appendChild(li);
      });
      const sel = $('railSel');
      data.curriculum.forEach((c) => {
        const o = document.createElement('option');
        o.value = c.demo || '';
        o.disabled = !c.demo;
        o.textContent = `Session ${c.n} · ${c.title}${c.demo ? '' : ' (no demo)'}`;
        sel.appendChild(o);
      });
      sel.onchange = () => sel.value && selectDemo(sel.value);
      const stepSess = (d) => {
        const opts = [...sel.options];
        let i = sel.selectedIndex + d;
        while (opts[i] && opts[i].disabled) i += d;
        if (opts[i]) { sel.selectedIndex = i; selectDemo(opts[i].value); }
      };
      $('railPrev').onclick = () => stepSess(-1);
      $('railNext').onclick = () => stepSess(1);
      buildGuide(data.build);
      const want = location.hash.slice(1);
      selectDemo(want === 'build' || demos.some((d) => d.id === want) ? want : demos[0].id);
      requestAnimationFrame(frame);
    })
    .catch((err) => {
      console.error(err);
      els.title.textContent = 'Could not load the demos';
      els.summary.textContent = 'Check that data/demos.js is next to index.html.';
    });
})();
