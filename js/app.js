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
  const WARN = { obstacle: 20, parking: 35, train: 15 };

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
  function selectDemo(id) {
    resetRun();
    demo = demos.find((d) => d.id === id);
    core.setWorld(demo.world);
    view.render(demo);
    scene.loadWorld(demo.world, demo.camera);
    els.inset.hidden = !demo.camera;
    els.detBox.hidden = true;

    els.rail.querySelectorAll('.sess').forEach((b) => b.setAttribute('aria-current', b.dataset.id === id));
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
    if (demo.camera) add('cam', 'Smart camera');
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
        : (LED_CSS[r.led] || '#d7dce3');
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
        ? `<span class="swatch" style="background:${LED_CSS[c.color]}"></span>${c.color}${demo.world === 'ball' ? ` <small>x ${c.x} · w ${c.size}</small>` : ` <small>${c.dist.toFixed(0)} cm</small>`}`
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
      `${S.dirName(from)} → <b>${S.dirName(to)}</b><br>` +
      `🧭 Now north is <b>${S.northRel(to)}</b> of the robot`;
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
  els.pause.onclick = pause;
  els.stop.onclick = stop;
  els.speed.onchange = () => { speed = parseFloat(els.speed.value); };
  els.sound.onclick = () => {
    RobotAudio.enabled = !RobotAudio.enabled;
    els.sound.textContent = RobotAudio.enabled ? '🔊' : '🔇';
    els.sound.setAttribute('aria-pressed', RobotAudio.enabled);
  };

  let zoom = 0.9;
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
      if (b.dataset.x === 'py') Exporter.exportPython(demo, course);
      if (b.dataset.x === 'json') Exporter.exportJSON(demo);
      if (b.dataset.x === 'png') {
        try { await Exporter.exportPNG(demo, course, els.blocks); }
        catch (err) { console.error(err); alert('This browser could not create the picture. Try Chrome or Edge.'); }
      }
    };
  });

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

  /* ---------- start ---------- */
  Promise.resolve(window.MBOT_DATA)
    .then((data) => {
      if (!data) throw new Error('data/demos.js is missing');
      demos = data.demos;
      course = data.course || course;
      $('courseTitle').textContent = course;
      document.title = course;
      data.curriculum.forEach((c) => {
        const d = demos.find((x) => x.id === c.demo);
        const li = document.createElement('li');
        const b = document.createElement('button');
        b.className = 'sess';
        b.title = c.desc;
        const icon = d ? d.emoji : c.n === 1 ? '🔧' : '🚀';
        const stars = d ? '★'.repeat(d.level) + '☆'.repeat(5 - d.level) : c.n === 1 ? 'hands-on build' : 'your idea';
        b.innerHTML = `<span class="n"><span>Session ${c.n}</span><span>${icon}</span></span><span class="t">${c.title}</span><span class="lv">${stars}</span>`;
        if (d) { b.dataset.id = d.id; b.onclick = () => selectDemo(d.id); }
        else b.disabled = true;
        li.appendChild(b);
        els.rail.appendChild(li);
      });
      const want = location.hash.slice(1);
      selectDemo(demos.some((d) => d.id === want) ? want : demos[0].id);
      requestAnimationFrame(frame);
    })
    .catch((err) => {
      console.error(err);
      els.title.textContent = 'Could not load the demos';
      els.summary.textContent = 'Check that data/demos.js is next to index.html.';
    });
})();
