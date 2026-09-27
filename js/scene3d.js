/* 3D scene: worlds, mBot2 model, user camera controls, smart-camera view */
(function (G) {
  'use strict';
  const S = G.MBotSim;
  const D2R = S.D2R;

  const COLOR_HEX = {
    blue: 0x2563eb, yellow: 0xfacc15, red: 0xdc2626, green: 0x22c55e, white: 0xf5f7fa,
    orange: 0xf97316, cyan: 0x06b6d4, purple: 0xa855f7, pink: 0xec4899,
  };
  const CSS_HEX = (c) => '#' + (COLOR_HEX[c] || 0x999999).toString(16).padStart(6, '0');

  function mat(color, opts) {
    return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.55, metalness: 0.05 }, opts || {}));
  }

  function textSprite(text, color, size, bg) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    if (bg) {
      g.fillStyle = bg; g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = color;
    g.font = '800 76px Pretendard, "Malgun Gothic", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 64, 70);
    const tex = new THREE.CanvasTexture(c);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    sp.scale.set(size, size, 1);
    return sp;
  }

  class Scene3D {
    constructor(container) {
      this.container = container;
      const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true }));
      r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      r.setClearColor(0xffffff, 1);
      r.shadowMap.enabled = true;
      r.shadowMap.type = THREE.PCFSoftShadowMap;
      r.outputEncoding = THREE.sRGBEncoding;
      container.prepend(r.domElement);

      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0xffffff);
      this.scene.fog = new THREE.Fog(0xffffff, 700, 1600);

      this.camera = new THREE.PerspectiveCamera(45, 1, 1, 4000);
      this.camera.position.set(0, 180, 220);

      const ctl = (this.controls = new THREE.OrbitControls(this.camera, r.domElement));
      ctl.enableDamping = true;
      ctl.dampingFactor = 0.09;
      ctl.screenSpacePanning = false; // pan along the ground like a map
      ctl.minDistance = 25;
      ctl.maxDistance = 900;
      ctl.maxPolarAngle = Math.PI * 0.48;
      this.setMouseMode('orbit');

      // lights
      this.scene.add(new THREE.HemisphereLight(0xffffff, 0xdfe6ee, 0.75));
      const sun = new THREE.DirectionalLight(0xffffff, 0.75);
      sun.position.set(90, 220, 140);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      Object.assign(sun.shadow.camera, { left: -220, right: 220, top: 220, bottom: -220, near: 10, far: 600 });
      sun.shadow.bias = -0.0005;
      this.scene.add(sun);

      // ground + 10 cm grid
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), mat(0xffffff, { roughness: 1 }));
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      this.scene.add(ground);
      const grid = new THREE.GridHelper(800, 80, 0xd9dfe7, 0xedf0f4);
      grid.position.y = 0.02;
      this.scene.add(grid);

      this.worldGroup = new THREE.Group();
      this.scene.add(this.worldGroup);
      this.compassGroup = new THREE.Group();
      this.scene.add(this.compassGroup);

      // north arrow above the robot
      this.northArrow = this.buildNorthArrow();
      this.scene.add(this.northArrow);

      // smart camera point of view
      this.robotCam = new THREE.PerspectiveCamera(58, 250 / 186, 0.5, 800);

      this.follow = false;
      this.anim = null;
      this.cardMeshes = new Map();
      this.screenText = null;

      new ResizeObserver(() => this.resize()).observe(container);
      this.resize();
    }

    resize() {
      const w = this.container.clientWidth, h = this.container.clientHeight;
      if (!w || !h) return;
      this.renderer.setSize(w, h, false);
      this.renderer.domElement.style.width = w + 'px';
      this.renderer.domElement.style.height = h + 'px';
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }

    /* ---------- mouse modes ---------- */
    setMouseMode(mode) {
      this.mouseMode = mode;
      const M = THREE.MOUSE;
      this.controls.mouseButtons = mode === 'map'
        ? { LEFT: M.PAN, MIDDLE: M.ROTATE, RIGHT: M.DOLLY }      // Cesium map style
        : { LEFT: M.ROTATE, MIDDLE: M.DOLLY, RIGHT: M.PAN };     // 3D orbit style
    }

    /* ---------- worlds ---------- */
    loadWorld(name, withCamera) {
      this.worldName = name;
      this.withCamera = withCamera;
      const wg = this.worldGroup;
      while (wg.children.length) wg.remove(wg.children[0]);
      while (this.compassGroup.children.length) this.compassGroup.remove(this.compassGroup.children[0]);
      this.cardMeshes.clear();
      this.penCanvas = null; this.ballMesh = null; this.catMesh = null; this.lastPen = null;

      const world = S.WORLDS[name];
      if (world.track) this.buildLineMat(world);
      else if (world.floor) this.buildFloor(world.floor, !!world.canvasFloor);
      if (world.road) this.buildRoad(world);
      if (world.stage) this.buildStage();
      if (name === 'parking') this.buildParkingPaint();

      for (const o of world.obstacles) this.buildBox(o);
      for (const c of world.cards || []) this.buildCard(c);
      if (name === 'camera') this.buildStartPad(world.start);
      if (world.ball) this.buildBall(world.ball);
      if (world.cat) this.buildCat();

      const R = world.road ? 185 : world.track ? 125 : 165;
      this.buildGroundCompass(R);

      if (this.robot) this.scene.remove(this.robot.group);
      this.robot = this.buildRobot(withCamera, name);
      this.scene.add(this.robot.group);

      this.homeView = world.view;
      this.resetView(true);
    }

    /* ----- floors ----- */
    buildFloor(f, drawable) {
      let material;
      if (drawable) {
        const PX = 5, c = document.createElement('canvas');
        c.width = f.w * PX; c.height = f.d * PX;
        const tex = new THREE.CanvasTexture(c);
        tex.encoding = THREE.sRGBEncoding;
        tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        this.penCanvas = { c, g: c.getContext('2d'), tex, PX, w: f.w, d: f.d, bg: f.color };
        this.clearPen();
        material = new THREE.MeshStandardMaterial({ map: tex, roughness: 1 });
      } else material = mat(new THREE.Color(f.color), { roughness: 1 });
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(f.w, f.d), material);
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = 0.05;
      floor.receiveShadow = true;
      this.worldGroup.add(floor);
      this.buildGrid(f.w, f.d, 0, 0, 0.09); // 10 cm grid on the floor itself (also over the marker paper)
    }

    buildGrid(w, d, cx, cz, y) {
      const pts = [];
      for (let x = -w / 2; x <= w / 2 + 0.01; x += 10) pts.push(cx + x, y, cz - d / 2, cx + x, y, cz + d / 2);
      for (let z = -d / 2; z <= d / 2 + 0.01; z += 10) pts.push(cx - w / 2, y, cz + z, cx + w / 2, y, cz + z);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      const lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xcfd6df, transparent: true, opacity: 0.9 }));
      this.worldGroup.add(lines);
      return lines;
    }

    clearPen() {
      const p = this.penCanvas;
      if (!p) return;
      p.g.fillStyle = '#fbfcfd'; p.g.fillRect(0, 0, p.c.width, p.c.height);
      p.g.strokeStyle = '#e3e8ee'; p.g.lineWidth = 1;
      for (let x = 0; x <= p.w; x += 10) { p.g.beginPath(); p.g.moveTo(x * p.PX, 0); p.g.lineTo(x * p.PX, p.c.height); p.g.stroke(); }
      for (let z = 0; z <= p.d; z += 10) { p.g.beginPath(); p.g.moveTo(0, z * p.PX); p.g.lineTo(p.c.width, z * p.PX); p.g.stroke(); }
      p.tex.needsUpdate = true;
      this.lastPen = null;
    }

    drawPen(x, z, color) {
      const p = this.penCanvas;
      const X = (v) => (v + p.w / 2) * p.PX, Z = (v) => (v + p.d / 2) * p.PX;
      if (this.lastPen) {
        p.g.strokeStyle = color; p.g.lineWidth = 1.4 * p.PX; p.g.lineCap = 'round';
        p.g.beginPath(); p.g.moveTo(X(this.lastPen.x), Z(this.lastPen.z)); p.g.lineTo(X(x), Z(z)); p.g.stroke();
        p.tex.needsUpdate = true;
      }
      this.lastPen = { x, z };
    }

    buildRoad(world) {
      const r = world.road, len = r.z0 - r.z1;
      const road = new THREE.Mesh(new THREE.PlaneGeometry(r.w, len), mat(0x4b5563, { roughness: 1 }));
      road.rotation.x = -Math.PI / 2;
      road.position.set(0, 0.07, (r.z0 + r.z1) / 2);
      road.receiveShadow = true;
      this.worldGroup.add(road);
      for (const side of [-1, 1]) {
        const edge = new THREE.Mesh(new THREE.PlaneGeometry(1.2, len), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        edge.rotation.x = -Math.PI / 2;
        edge.position.set(side * (r.w / 2 - 1.5), 0.09, (r.z0 + r.z1) / 2);
        this.worldGroup.add(edge);
      }
      for (const p of world.patches) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.d), new THREE.MeshStandardMaterial({ color: COLOR_HEX[p.color], roughness: 0.9 }));
        m.rotation.x = -Math.PI / 2;
        m.position.set(p.x, 0.1, p.z);
        this.worldGroup.add(m);
        if (p.color !== 'blue') this.buildTrafficLight(r.w / 2 + 8, p.z, p.color);
        else this.buildFinishFlag(p.z - p.d / 2 - 2, r.w);
      }
    }

    buildTrafficLight(x, z, color) {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 26, 10), mat(0x6b7280));
      pole.position.y = 13; pole.castShadow = true;
      g.add(pole);
      const box = new THREE.Mesh(new THREE.BoxGeometry(5, 14, 4), mat(0x1f2937));
      box.position.set(0, 30, 0); box.castShadow = true;
      g.add(box);
      ['red', 'yellow', 'green'].forEach((c, i) => {
        const on = c === color;
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.5, 16, 12), new THREE.MeshStandardMaterial({
          color: on ? COLOR_HEX[c] : 0x374151, emissive: on ? COLOR_HEX[c] : 0x000000, emissiveIntensity: on ? 1 : 0,
        }));
        lamp.position.set(-2.1, 34.5 - i * 4.5, 0);
        g.add(lamp);
      });
      this.worldGroup.add(g);
    }

    buildFinishFlag(z, w) {
      const c = document.createElement('canvas');
      c.width = 256; c.height = 32;
      const g = c.getContext('2d');
      for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) {
        g.fillStyle = (i + j) % 2 ? '#111' : '#fff'; g.fillRect(i * 16, j * 16, 16, 16);
      }
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c) }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(0, 0.12, z);
      this.worldGroup.add(m);
      const banner = textSprite('🏁', '#111', 18);
      banner.position.set(0, 26, z - 4);
      this.worldGroup.add(banner);
    }

    buildStage() {
      const stage = new THREE.Mesh(new THREE.CylinderGeometry(45, 45, 0.3, 64), mat(0xf1e8ff, { roughness: 0.8 }));
      stage.position.y = 0.15; stage.receiveShadow = true;
      this.worldGroup.add(stage);
      const ring = new THREE.Mesh(new THREE.RingGeometry(43, 45, 64), new THREE.MeshBasicMaterial({ color: 0xa855f7 }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.35;
      this.worldGroup.add(ring);
      const notes = ['♪', '♫', '♬', '♩'];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const sp = textSprite(notes[i % 4], ['#a855f7', '#ec4899', '#3b82f6', '#f97316'][i % 4], 12);
        sp.position.set(Math.cos(a) * 62, 14 + (i % 2) * 6, Math.sin(a) * 62);
        this.worldGroup.add(sp);
      }
      this.stageLights = [];
      for (let i = 0; i < 3; i++) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(18, 70, 32, 1, true),
          new THREE.MeshBasicMaterial({ color: [0xec4899, 0x3b82f6, 0xfacc15][i], transparent: true, opacity: 0.09, depthWrite: false, side: THREE.DoubleSide }));
        cone.position.set((i - 1) * 30, 35, -20);
        this.worldGroup.add(cone);
        this.stageLights.push(cone);
      }
    }

    buildParkingPaint() {
      const paint = (w, d, x, z, color) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ color }));
        m.rotation.x = -Math.PI / 2; m.position.set(x, 0.1, z);
        this.worldGroup.add(m);
      };
      paint(1.5, 60, -28, -32, 0xfacc15);
      paint(1.5, 60, 28, -32, 0xfacc15);
      paint(20, 3, 0, -48, 0x22c55e);
      const p = textSprite('P', '#1f6fd1', 16, 'rgba(255,255,255,0.95)');
      p.position.set(0, 34, -62);
      this.worldGroup.add(p);
    }

    buildBall(b) {
      const c = document.createElement('canvas');
      c.width = 128; c.height = 64;
      const g = c.getContext('2d');
      g.fillStyle = '#e11d2e'; g.fillRect(0, 0, 128, 64);
      g.fillStyle = '#ffffff'; g.fillRect(0, 28, 128, 8);
      const tex = new THREE.CanvasTexture(c);
      this.ballMesh = new THREE.Mesh(new THREE.SphereGeometry(b.radius, 32, 20), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 }));
      this.ballMesh.castShadow = true;
      this.worldGroup.add(this.ballMesh);
      const path = new THREE.Mesh(new THREE.RingGeometry(b.r - 0.4, b.r + 0.4, 96),
        new THREE.MeshBasicMaterial({ color: 0xfca5a5, transparent: true, opacity: 0.6 }));
      path.rotation.x = -Math.PI / 2; path.position.set(b.cx, 0.1, b.cz);
      this.worldGroup.add(path);
    }

    buildCat() {
      const g = new THREE.Group();
      const fur = mat(0xf59e0b, { roughness: 0.9 });
      const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
      add(new THREE.BoxGeometry(8, 6, 13), fur, 0, 5, 0);
      add(new THREE.BoxGeometry(7, 6, 6), fur, 0, 10, 7);
      for (const sx of [-2.2, 2.2]) {
        const ear = add(new THREE.ConeGeometry(1.4, 3, 4), fur, sx, 14.2, 7);
        ear.rotation.y = Math.PI / 4;
        add(new THREE.SphereGeometry(0.7, 8, 6), mat(0x111827), sx * 0.7, 11, 10.05);
      }
      const tail = add(new THREE.CylinderGeometry(0.8, 0.8, 10, 8), fur, 0, 9, -8);
      tail.rotation.x = -0.6;
      for (const [x, z] of [[-2.5, -4.5], [2.5, -4.5], [-2.5, 4.5], [2.5, 4.5]]) add(new THREE.BoxGeometry(2, 3, 2), fur, x, 1.5, z);
      const tag = textSprite('🐱', '#000', 10);
      tag.position.set(0, 22, 0);
      g.add(tag);
      g.rotation.y = -Math.PI / 2; // looking east, sitting across the track
      this.catMesh = g;
      this.worldGroup.add(g);
    }

    buildLineMat(world) {
      const W = 200, H = 120, PX = 10;
      const c = document.createElement('canvas');
      c.width = W * PX; c.height = H * PX;
      const g = c.getContext('2d');
      const X = (x) => (x + W / 2) * PX, Z = (z) => (z + H / 2) * PX;
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height);
      g.strokeStyle = '#dfe5ec'; g.lineWidth = 2;
      for (let x = 0; x <= W; x += 10) { g.beginPath(); g.moveTo(x * PX, 0); g.lineTo(x * PX, c.height); g.stroke(); }
      for (let z = 0; z <= H; z += 10) { g.beginPath(); g.moveTo(0, z * PX); g.lineTo(c.width, z * PX); g.stroke(); }
      g.strokeStyle = '#cfd6df'; g.lineWidth = 12; g.strokeRect(6, 6, c.width - 12, c.height - 12);

      const { half, r, width } = S.TRACK;
      g.strokeStyle = '#111418'; g.lineWidth = width * PX; g.lineJoin = 'round';
      g.beginPath();
      g.moveTo(X(-half), Z(-r));
      g.lineTo(X(half), Z(-r));
      g.arc(X(half), Z(0), r * PX, -Math.PI / 2, Math.PI / 2);
      g.lineTo(X(-half), Z(r));
      g.arc(X(-half), Z(0), r * PX, Math.PI / 2, Math.PI * 1.5);
      g.closePath();
      g.stroke();

      for (const p of world.patches || []) {
        g.fillStyle = CSS_HEX(p.color);
        g.fillRect(X(p.x - p.w / 2), Z(p.z - p.d / 2), p.w * PX, p.d * PX);
        g.fillStyle = '#166534';
        g.font = '800 44px Pretendard, sans-serif';
        g.textAlign = 'center';
        g.fillText(p.station + ' Stn', X(p.x), Z(p.z + (p.z > 0 ? 14 : -10)));
        g.textAlign = 'start';
      }
      // start line
      const s = world.start;
      g.fillStyle = '#16a34a';
      g.fillRect(X(s.x) - 8, Z(s.z) - 90, 16, 180);
      g.font = '800 64px Pretendard, sans-serif';
      g.fillText('START', X(s.x) - 90, Z(s.z) + 150);
      g.fillStyle = '#9aa6b4';
      g.font = '700 56px Pretendard, sans-serif';
      g.fillText(world.patches ? 'mBot2 Railway' : 'mBot2 Line Track', X(-35), Z(8));

      const tex = new THREE.CanvasTexture(c);
      tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      tex.encoding = THREE.sRGBEncoding;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.06;
      m.receiveShadow = true;
      this.worldGroup.add(m);
    }

    buildBox(o) {
      const color = o.wall ? 0xdfe4ea : new THREE.Color(o.color);
      const geo = new THREE.BoxGeometry(o.w, o.h, o.d);
      const m = new THREE.Mesh(geo, mat(color, { roughness: 0.7 }));
      m.position.set(o.x, o.h / 2, o.z);
      m.castShadow = !o.wall; m.receiveShadow = true;
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({ color: o.wall ? 0xc5ced8 : 0x7b8794, transparent: true, opacity: 0.5 }));
      m.add(edges);
      this.worldGroup.add(m);
    }

    buildCard(card) {
      const c = document.createElement('canvas');
      c.width = 260; c.height = 180;
      const g = c.getContext('2d');
      g.fillStyle = CSS_HEX(card.color); g.fillRect(0, 0, 260, 180);
      g.fillStyle = '#ffffff'; g.fillRect(8, 8, 244, 164);
      // AprilTag-like marker: black border + fixed bit pattern per tag number
      const S0 = 18, cell = 18, ox = 16, oy = 18;
      g.fillStyle = '#000'; g.fillRect(ox, oy, cell * 8, cell * 8);
      g.fillStyle = '#fff'; g.fillRect(ox + cell, oy + cell, cell * 6, cell * 6);
      let seed = (card.tag || 1) * 2654435761 >>> 0;
      g.fillStyle = '#000';
      for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 4; xx++) {
        seed = (seed * 1103515245 + 12345) >>> 0;
        if (seed & 0x10000) g.fillRect(ox + cell * (2 + xx), oy + cell * (2 + yy), cell, cell);
      }
      void S0;
      g.fillStyle = '#111827'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = '900 64px Pretendard, sans-serif';
      g.fillText(String(card.tag || ''), 212, 66);
      g.font = '800 26px Pretendard, sans-serif';
      g.fillStyle = CSS_HEX(card.color);
      g.fillText(card.icon + ' ' + card.label, 212, 128);
      const tex = new THREE.CanvasTexture(c);
      tex.encoding = THREE.sRGBEncoding;
      const back = mat(0xe5e9ef);
      const front = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 });
      const board = new THREE.Mesh(new THREE.BoxGeometry(S.CARD_W, S.CARD_H, 0.8), [back, back, back, back, front, back]);
      board.position.set(card.x, S.CARD_BOTTOM + S.CARD_H / 2, card.z);
      board.rotation.y = Math.PI - card.face * D2R;
      board.castShadow = true;
      this.worldGroup.add(board);

      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, S.CARD_BOTTOM + 2, 12), mat(0x9aa5b1));
      const n = S.fwd(card.face);
      post.position.set(card.x - n.x * 0.8, (S.CARD_BOTTOM + 2) / 2, card.z - n.z * 0.8);
      this.worldGroup.add(post);
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 0.8, 20), mat(0x9aa5b1));
      foot.position.set(post.position.x, 0.4, post.position.z);
      this.worldGroup.add(foot);
      this.cardMeshes.set(card, board);
    }

    buildStartPad(s) {
      const pad = new THREE.Mesh(new THREE.CircleGeometry(14, 40), mat(0xdcfce7, { roughness: 1 }));
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(s.x, 0.08, s.z);
      this.worldGroup.add(pad);
      const ring = new THREE.Mesh(new THREE.RingGeometry(13, 14, 40), mat(0x16a34a));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(s.x, 0.1, s.z);
      this.worldGroup.add(ring);
    }

    buildGroundCompass(R) {
      const g = this.compassGroup;
      const labels = [['N', 0, '#e0342b'], ['E', 90, '#7a8696'], ['S', 180, '#7a8696'], ['W', 270, '#7a8696']];
      for (const [t, h, col] of labels) {
        const sp = textSprite(t, col, t === 'N' ? 26 : 18, 'rgba(255,255,255,0.9)');
        const f = S.fwd(h);
        sp.position.set(f.x * (R + 18), 8, f.z * (R + 18));
        g.add(sp);
      }
      // north arrow painted on the ground
      const shape = new THREE.Shape();
      shape.moveTo(0, 16); shape.lineTo(-8, 0); shape.lineTo(-3, 0); shape.lineTo(-3, -12);
      shape.lineTo(3, -12); shape.lineTo(3, 0); shape.lineTo(8, 0); shape.closePath();
      const arrow = new THREE.Mesh(new THREE.ShapeGeometry(shape),
        new THREE.MeshBasicMaterial({ color: 0xe0342b, transparent: true, opacity: 0.85 }));
      arrow.rotation.x = -Math.PI / 2;
      arrow.position.set(0, 0.12, -R + 2);
      g.add(arrow);
    }

    buildNorthArrow() {
      const g = new THREE.Group();
      const red = new THREE.MeshBasicMaterial({ color: 0xe0342b });
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 8, 10), red);
      shaft.rotation.x = Math.PI / 2;
      g.add(shaft);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(1.6, 4, 16), red);
      tip.rotation.x = -Math.PI / 2;
      tip.position.z = -5.5;
      g.add(tip);
      const n = textSprite('N', '#e0342b', 7, 'rgba(255,255,255,0.95)');
      n.position.set(0, 0, -11);
      g.add(n);
      return g;
    }

    /* ---------- mBot2 model ---------- */
    buildRobot(withCamera, worldName) {
      const group = new THREE.Group();
      const body = new THREE.Group();
      group.add(body);

      const blue = mat(0x1f6fd1, { metalness: 0.35, roughness: 0.4 });
      const dark = mat(0x2a3039, { roughness: 0.7 });
      const silver = mat(0xc9d1db, { metalness: 0.6, roughness: 0.3 });

      const add = (geo, m, x, y, z, parent) => {
        const mesh = new THREE.Mesh(geo, m);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        (parent || body).add(mesh);
        return mesh;
      };

      // chassis
      add(new THREE.BoxGeometry(11, 1, 14), blue, 0, 2.8, 0);
      add(new THREE.BoxGeometry(0.5, 4.2, 12.5), blue, -5.3, 4.6, 0.5);
      add(new THREE.BoxGeometry(0.5, 4.2, 12.5), blue, 5.3, 4.6, 0.5);
      add(new THREE.BoxGeometry(10.6, 0.6, 11), blue, 0, 6.9, 1);
      add(new THREE.BoxGeometry(3, 3, 4.2), dark, -3.4, 4.6, 2.5);
      add(new THREE.BoxGeometry(3, 3, 4.2), dark, 3.4, 4.6, 2.5);
      add(new THREE.BoxGeometry(6.5, 2.2, 5), dark, 0, 4.4, -2); // battery

      // wheels
      const wheels = [];
      for (const side of [-1, 1]) {
        const wg = new THREE.Group();
        wg.position.set(side * 6.9, S.WHEEL_R, 2.5);
        const tire = new THREE.Mesh(new THREE.CylinderGeometry(S.WHEEL_R, S.WHEEL_R, 2.4, 28), mat(0x1c2026, { roughness: 0.9 }));
        tire.rotation.z = Math.PI / 2; tire.castShadow = true;
        wg.add(tire);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 2.6, 20), blue);
        hub.rotation.z = Math.PI / 2;
        wg.add(hub);
        for (let k = 0; k < 3; k++) { // spokes so rotation is visible
          const spoke = new THREE.Mesh(new THREE.BoxGeometry(2.7, 3.8, 0.5), mat(0xffffff));
          spoke.rotation.x = (k * Math.PI) / 3;
          wg.add(spoke);
        }
        body.add(wg);
        wheels.push(wg);
      }
      add(new THREE.SphereGeometry(1.1, 16, 12), silver, 0, 1.1, -5.4); // ball caster

      // CyberPi (tilted board + screen + 5 LEDs)
      const cp = new THREE.Group();
      cp.position.set(0, 8.1, 3.2);
      cp.rotation.x = 0.4;
      body.add(cp);
      add(new THREE.BoxGeometry(5.8, 0.7, 7.6), mat(0xf1f3f6), 0, 0, 0, cp);
      const sc = document.createElement('canvas');
      sc.width = sc.height = 128;
      const stex = new THREE.CanvasTexture(sc);
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 3.8), new THREE.MeshBasicMaterial({ map: stex }));
      screen.rotation.x = -Math.PI / 2;
      screen.position.set(0, 0.37, -0.8);
      cp.add(screen);
      const leds = [];
      for (let i = 0; i < 5; i++) {
        const m = new THREE.MeshStandardMaterial({ color: 0xd7dce3, emissive: 0x000000, roughness: 0.3 });
        const led = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), m);
        led.position.set(-2.2 + i * 1.1, 0.4, 2.8);
        cp.add(led);
        leds.push(m);
      }

      // ultrasonic sensor 2 (the robot's "eyes")
      const us = new THREE.Group();
      us.position.set(0, 4.8, -7.8);
      body.add(us);
      add(new THREE.BoxGeometry(6, 2.8, 0.6), mat(0xf5f7fa), 0, 0, 0, us);
      const eyeRings = [];
      for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 1.3, 20), silver);
        eye.rotation.x = Math.PI / 2;
        eye.position.set(side * 1.5, 0, -0.8);
        us.add(eye);
        const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.8, 20), mat(0x39424e));
        pupil.position.set(side * 1.5, 0, -1.46);
        pupil.rotation.y = Math.PI;
        us.add(pupil);
        const ringM = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0ea5e9, emissiveIntensity: 0.6 });
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.18, 8, 24), ringM);
        ring.position.set(side * 1.5, 0, -0.35);
        us.add(ring);
        eyeRings.push(ringM);
      }

      // quad RGB sensor (underneath)
      add(new THREE.BoxGeometry(5.2, 0.4, 1.6), dark, 0, 1.3, -7);
      const quad = [];
      for (const x of [-3.3, -1.0, 1.0, 3.3].map((v) => v * 0.62)) {
        const m = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x666666 });
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), m);
        dot.position.set(x, 1.0, -7);
        body.add(dot);
        quad.push(m);
      }

      // smart camera (optional)
      let camLed = null;
      if (withCamera) {
        add(new THREE.BoxGeometry(1, 4.4, 1), dark, 0, 9.2, -4.2);
        add(new THREE.BoxGeometry(4.6, 3.4, 2.6), mat(0x20252c), 0, 12.4, -4.6);
        const lens = add(new THREE.CylinderGeometry(1.1, 1.1, 0.8, 24),
          new THREE.MeshStandardMaterial({ color: 0x1e3a8a, metalness: 0.5, roughness: 0.15, emissive: 0x1d4ed8, emissiveIntensity: 0.25 }),
          0, 12.4, -6.1);
        lens.rotation.x = Math.PI / 2;
        camLed = new THREE.MeshStandardMaterial({ color: 0x7c5cff, emissive: 0x7c5cff, emissiveIntensity: 0.6 });
        add(new THREE.SphereGeometry(0.35, 10, 8), camLed, 1.6, 13.5, -5.95);
        this.robotCam.position.set(0, 12.4, -6.6);
        this.robotCam.rotation.set(-0.1, 0, 0);
        group.add(this.robotCam);
      }

      // heading arrow on the ground
      const shape = new THREE.Shape();
      shape.moveTo(0, 21); shape.lineTo(-4, 14); shape.lineTo(4, 14); shape.closePath();
      const headArrow = new THREE.Mesh(new THREE.ShapeGeometry(shape),
        new THREE.MeshBasicMaterial({ color: 0xff8a00, transparent: true, opacity: 0.85, depthWrite: false }));
      headArrow.rotation.x = -Math.PI / 2;
      headArrow.position.y = 0.2;
      group.add(headArrow);

      // sensor visualisation
      let beam = null, fov = null;
      if (['obstacle', 'parking', 'train'].includes(worldName)) {
        const bg = new THREE.BoxGeometry(0.6, 0.6, 1);
        bg.translate(0, 0, -0.5);
        beam = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.75 }));
        beam.position.set(0, 4.8, -8.6);
        group.add(beam);
      }
      if (withCamera) {
        fov = new THREE.Mesh(new THREE.CircleGeometry(35, 24, Math.PI / 2 - 30 * D2R, 60 * D2R),
          new THREE.MeshBasicMaterial({ color: 0x7c5cff, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }));
        fov.rotation.x = -Math.PI / 2;
        fov.position.set(0, 0.18, -6);
        group.add(fov);
      }

      return { group, wheels, leds, screen: { canvas: sc, tex: stex }, eyeRings, quad, camLed, headArrow, beam, fov, angL: 0, angR: 0 };
    }

    drawScreen(text) {
      if (text === this.screenText) return;
      this.screenText = text;
      const { canvas, tex } = this.robot.screen;
      const g = canvas.getContext('2d');
      g.fillStyle = '#10151c'; g.fillRect(0, 0, 128, 128);
      g.fillStyle = '#e8f1ff';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = '800 22px Pretendard, sans-serif';
      const words = String(text || '').split(' ');
      const lines = []; let cur = '';
      for (const w of words) {
        const t = cur ? cur + ' ' + w : w;
        if (g.measureText(t).width > 112 && cur) { lines.push(cur); cur = w; } else cur = t;
      }
      if (cur) lines.push(cur);
      lines.slice(0, 4).forEach((l, i, a) => g.fillText(l, 64, 64 + (i - (a.length - 1) / 2) * 26));
      tex.needsUpdate = true;
    }

    /* ---------- per-frame update ---------- */
    update(core, simDt, realDt, sensors) {
      const r = core.robot, R = this.robot;
      R.group.position.set(r.x, 0, r.z);
      R.group.rotation.y = -r.h * D2R;

      R.angL -= (r.rpmL * 2 * Math.PI / 60) * simDt;
      R.angR -= (r.rpmR * 2 * Math.PI / 60) * simDt;
      R.wheels[0].rotation.x = R.angL;
      R.wheels[1].rotation.x = R.angR;

      // LED
      const t = performance.now() / 1000;
      R.leds.forEach((m, i) => {
        let c = null;
        if (r.led === 'rainbow') c = new THREE.Color().setHSL(((t * 0.6 + i / 5) % 1), 0.9, 0.55);
        else if (COLOR_HEX[r.led] !== undefined) c = new THREE.Color(COLOR_HEX[r.led]);
        else if (r.led && r.led.startsWith('rgb')) c = new THREE.Color(r.led);
        if (c) { m.color.copy(c); m.emissive.copy(c); m.emissiveIntensity = 0.9; }
        else { m.color.setHex(0xd7dce3); m.emissive.setHex(0x000000); }
      });

      this.drawScreen(r.display);

      // quad RGB sensor lights
      const ls = sensors.line;
      [ls.L2, ls.L1, ls.R1, ls.R2].forEach((on, i) => {
        R.quad[i].emissive.setHex(on ? 0xef4444 : 0x555555);
        R.quad[i].color.setHex(on ? 0xef4444 : 0xffffff);
      });

      if (R.beam) {
        const d = Math.min(sensors.distance, 150);
        R.beam.scale.z = Math.max(d, 0.1);
        const warn = sensors.distance < (sensors.warn || 20);
        R.beam.material.color.setHex(warn ? 0xef4444 : 0x22c55e);
        R.eyeRings.forEach((m) => m.emissive.setHex(warn ? 0xef4444 : 0x0ea5e9));
      }

      // moving things in the world
      if (this.ballMesh && core.ball) {
        this.ballMesh.position.set(core.ball.x, S.WORLDS.ball.ball.radius, core.ball.z);
        this.ballMesh.rotation.y = -core.ball.a * 3;
        this.ballMesh.rotation.x += simDt * 1.4;
      }
      if (this.catMesh && core.cat) this.catMesh.position.set(core.cat.x, 0, core.cat.z);
      if (this.worldName === 'stage' && this.stageLights) {
        this.stageLights.forEach((c, i) => { c.rotation.z = Math.sin(t * 1.3 + i * 2) * 0.35; });
      }
      if (this.penCanvas) {
        if (r.pen) this.drawPen(r.x, r.z, r.led && COLOR_HEX[r.led] !== undefined && r.led !== 'white' ? CSS_HEX(r.led) : '#1f2a37');
        else this.lastPen = null;
      }
      if (R.fov) {
        const det = sensors.camera;
        R.fov.material.color.setHex(det ? COLOR_HEX[det.color] : 0x7c5cff);
        R.fov.material.opacity = det ? 0.28 : 0.12;
      }

      // north arrow above the robot
      this.northArrow.position.set(r.x, withinY(this.withCamera), r.z);

      // follow the robot
      if (this.follow && !this.anim) {
        const tgt = this.controls.target;
        const k = 1 - Math.pow(0.001, realDt);
        const dx = (r.x - tgt.x) * k, dz = (r.z - tgt.z) * k;
        tgt.x += dx; tgt.z += dz;
        this.camera.position.x += dx; this.camera.position.z += dz;
      }

      // camera animation
      if (this.anim) {
        const a = this.anim;
        a.t = Math.min(1, a.t + realDt / a.dur);
        const e = a.t < 0.5 ? 2 * a.t * a.t : 1 - Math.pow(-2 * a.t + 2, 2) / 2;
        this.camera.position.lerpVectors(a.fromPos, a.toPos, e);
        this.controls.target.lerpVectors(a.fromTgt, a.toTgt, e);
        if (a.t >= 1) this.anim = null;
      }
      this.controls.autoRotate = !!this.turntable;
      this.controls.autoRotateSpeed = 2.2;
      this.controls.update();
    }

    /* compass heading the user's view is facing (north = 0, clockwise) */
    viewHeading() {
      const d = new THREE.Vector3().subVectors(this.controls.target, this.camera.position);
      if (Math.hypot(d.x, d.z) < 1e-6) return 0;
      return S.norm360(Math.atan2(d.x, -d.z) / D2R);
    }

    animateTo(pos, tgt, dur) {
      this.anim = {
        fromPos: this.camera.position.clone(), toPos: pos,
        fromTgt: this.controls.target.clone(), toTgt: tgt,
        t: 0, dur: dur || 0.7,
      };
    }

    resetView(instant) {
      const v = this.homeView;
      const pos = new THREE.Vector3(...v.pos), tgt = new THREE.Vector3(...v.target);
      if (instant) { this.camera.position.copy(pos); this.controls.target.copy(tgt); this.controls.update(); }
      else this.animateTo(pos, tgt);
    }

    topView() {
      const tgt = this.controls.target.clone();
      const dist = Math.max(220, this.camera.position.distanceTo(tgt));
      this.animateTo(new THREE.Vector3(tgt.x, dist, tgt.z + 0.5), tgt);
    }

    northUp() {
      const tgt = this.controls.target.clone();
      const off = new THREE.Vector3().subVectors(this.camera.position, tgt);
      const sph = new THREE.Spherical().setFromVector3(off);
      sph.theta = 0; // camera south of target => north is up on screen
      const pos = new THREE.Vector3().setFromSpherical(sph).add(tgt);
      this.animateTo(pos, tgt, 0.6);
    }

    /* ---------- render ---------- */
    render(detection, insetEl, detBoxEl, detLabelEl) {
      const r = this.renderer;
      const w = this.container.clientWidth, h = this.container.clientHeight;
      r.setScissorTest(false);
      r.setViewport(0, 0, w, h);
      r.render(this.scene, this.camera);

      if (!this.withCamera || !insetEl || insetEl.hidden) return;
      // size & place the camera view from the inset box (it moves on phones)
      const cr = this.container.getBoundingClientRect(), er = insetEl.getBoundingClientRect(), bw = 3;
      const iw = Math.round(er.width - 2 * bw), ih = Math.round(er.height - 2 * bw);
      const ix = Math.round(er.left - cr.left + bw), iy = Math.round(cr.bottom - er.bottom + bw);
      if (Math.abs(this.robotCam.aspect - iw / ih) > 0.01) { this.robotCam.aspect = iw / ih; this.robotCam.updateProjectionMatrix(); }
      const R = this.robot;
      const helpers = [R.fov, R.headArrow, this.northArrow, this.compassGroup];
      helpers.forEach((o) => o && (o.visible = false));
      r.setScissorTest(true);
      r.setScissor(ix, iy, iw, ih);
      r.setViewport(ix, iy, iw, ih);
      r.render(this.scene, this.robotCam);
      r.setScissorTest(false);
      r.setViewport(0, 0, w, h);
      helpers.forEach((o) => o && (o.visible = true));

      // detection box
      const mesh = detection && (this.cardMeshes.get(detection.obj) || this.ballMesh);
      if (!mesh) { detBoxEl.hidden = true; return; }
      const box = new THREE.Box3().setFromObject(mesh);
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let k = 0; k < 8; k++) {
        const p = new THREE.Vector3(
          k & 1 ? box.max.x : box.min.x, k & 2 ? box.max.y : box.min.y, k & 4 ? box.max.z : box.min.z,
        ).project(this.robotCam);
        const px = (p.x * 0.5 + 0.5) * iw, py = (1 - (p.y * 0.5 + 0.5)) * ih;
        x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
      }
      x0 = Math.max(2, x0); y0 = Math.max(2, y0); x1 = Math.min(iw - 2, x1); y1 = Math.min(ih - 2, y1);
      Object.assign(detBoxEl.style, { left: x0 + 'px', top: y0 + 'px', width: (x1 - x0) + 'px', height: (y1 - y0) + 'px' });
      detLabelEl.textContent = this.ballMesh
        ? `red block  x=${detection.x}  w=${detection.size}`
        : `AprilTag ${detection.tag}  ${detection.confidence}%`;
      detBoxEl.hidden = false;
    }
  }

  function withinY(hasCam) { return hasCam ? 26 : 20; }

  G.Scene3D = Scene3D;
})(window);
