/* world3d.js — Engine Địa Hình 3D (Three.js r147) cho SƠN TINH – THỦY TINH: Đại Chiến Núi và Nước (100% offline) */
(function (global) {
  "use strict";

  const CAM_MODES = ["🎥 3D Toàn cảnh", "🧭 Nhìn từ trên", "🔭 Cận cảnh sử thi"];
  const CELL = 2.0;
  const rand = (a, b) => a + Math.random() * (b - a);

  let H = null; // hooks từ index.html
  let active = false;
  let rafId = 0;
  let resizeObs = null;

  const W3 = {
    ready: false, failed: false,
    scene: null, camera: null, renderer: null, clock: null, container: null,
    envGroup: null, boardGroup: null, fxGroup: null, cursorGroup: null, laneDivGroup: null,
    seaMesh: null, clouds: [], swayTrees: [], shields: [], waterTiles: [],
    hitMeshes: [],         // mesh dùng raycast (cột nền + nước)
    tileViews: new Map(),  // "x,y" -> view object
    particles: [], rings: [],
    raycaster: null,
    partGeo: null,
    texCache: new Map(),
    coordTexCache: new Map(),
    camMode: 0,
    camTarget: null, camGoalTarget: null,
    camSph: { r: 22, theta: 0, phi: 0.78 },
    camGoalSph: { r: 22, theta: 0, phi: 0.78 },
    userOrbit: { theta: 0, phi: 0, rScale: 1 },
    shakeMag: 0, shakeTime: 0,
    mapRef: null,
    hoveredKey: "",
    // Shared geometries & materials
    boxGeo: null,
    elevMats: []
  };

  function groundTopY(elev) {
    const heights = [0.16, 0.56, 1.02, 1.54, 2.08, 2.66];
    const e = Math.max(0, Math.min(5, Math.round(elev)));
    return heights[e];
  }
  function waterTopY(wl) {
    if (wl <= 0) return 0.05;
    return 0.24 + wl * 0.44;
  }
  function cellPos(x, y, cols, rows) {
    return {
      wx: (x - (cols - 1) / 2) * CELL,
      wz: (y - (rows - 1) / 2) * CELL
    };
  }

  function makeTextSprite(text, { color = "#fef08a", bg = "", border = "", font = "900 38px Segoe UI, Arial, sans-serif", stroke = "#090d1a", scale = 0.62 } = {}) {
    const key = text + "|" + color + "|" + bg + "|" + border + "|" + font;
    let tex = W3.texCache.get(key);
    if (!tex) {
      const cv = document.createElement("canvas");
      const ctx = cv.getContext("2d");
      ctx.font = font;
      const m = ctx.measureText(text);
      const padX = bg ? 26 : 14;
      const w = Math.max(64, Math.ceil(m.width + padX * 2));
      const h = bg ? 66 : 60;
      cv.width = w; cv.height = h;
      ctx.font = font;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      if (bg) {
        const r = 16;
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.moveTo(r, 3); ctx.lineTo(w - r, 3); ctx.quadraticCurveTo(w - 3, 3, w - 3, r);
        ctx.lineTo(w - 3, h - r); ctx.quadraticCurveTo(w - 3, h - 3, w - r, h - 3);
        ctx.lineTo(r, h - 3); ctx.quadraticCurveTo(3, h - 3, 3, h - r);
        ctx.lineTo(3, r); ctx.quadraticCurveTo(3, 3, r, 3); ctx.closePath();
        ctx.fill();
        if (border) { ctx.strokeStyle = border; ctx.lineWidth = 5; ctx.stroke(); }
      }
      if (stroke && !bg) {
        ctx.lineWidth = 9; ctx.strokeStyle = stroke; ctx.lineJoin = "round";
        ctx.strokeText(text, w / 2, h / 2 + 2);
      }
      ctx.fillStyle = color;
      ctx.fillText(text, w / 2, h / 2 + 2);
      tex = new THREE.CanvasTexture(cv);
      tex.minFilter = THREE.LinearFilter;
      tex.userData = { aspect: w / h };
      W3.texCache.set(key, tex);
    }
    const aspect = tex.userData.aspect || 1;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sp = new THREE.Sprite(mat);
    sp.scale.set(scale * aspect, scale, 1);
    sp.renderOrder = 25;
    return sp;
  }

  function getCoordTex(label) {
    let tex = W3.coordTexCache.get(label);
    if (!tex) {
      const cv = document.createElement("canvas");
      cv.width = 96; cv.height = 54;
      const ctx = cv.getContext("2d");
      ctx.font = "900 32px Segoe UI, Arial, sans-serif";
      ctx.textAlign = "left"; ctx.textBaseline = "top";
      ctx.lineWidth = 6; ctx.strokeStyle = "rgba(8,15,30,0.92)"; ctx.lineJoin = "round";
      ctx.strokeText(label, 8, 8);
      ctx.fillStyle = "#f8fafc";
      ctx.fillText(label, 8, 8);
      tex = new THREE.CanvasTexture(cv);
      tex.minFilter = THREE.LinearFilter;
      W3.coordTexCache.set(label, tex);
    }
    return tex;
  }

  function clearGroup(g) {
    while (g.children.length) g.remove(g.children[0]);
  }

  /* ---------- Khởi tạo cảnh 3D Truyền thuyết Sơn Tinh – Thủy Tinh ---------- */
  function initScene(containerEl) {
    if (W3.ready || W3.failed) return W3.ready;
    if (typeof THREE === "undefined") { W3.failed = true; return false; }

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    } catch (e) {
      W3.failed = true;
      return false;
    }

    W3.container = containerEl;
    W3.renderer = renderer;
    renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
    const rect = containerEl.getBoundingClientRect();
    const w = Math.max(320, Math.floor(rect.width || 900));
    const h = Math.max(240, Math.floor(rect.height || 580));
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    containerEl.innerHTML = "";
    containerEl.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a2545);
    scene.fog = new THREE.FogExp2(0x0a2545, 0.0052);
    W3.scene = scene;

    const camera = new THREE.PerspectiveCamera(42, w / h, 0.2, 200);
    W3.camera = camera;
    W3.clock = new THREE.Clock();
    W3.raycaster = new THREE.Raycaster();
    W3.partGeo = new THREE.DodecahedronGeometry(1, 0);
    W3.boxGeo = new THREE.BoxGeometry(1, 1, 1);
    W3.camTarget = new THREE.Vector3(0, 0.4, 0);
    W3.camGoalTarget = new THREE.Vector3(0, 0.4, 0);

    // Ánh sáng hai nửa đối lập: Nắng vàng ấm phía Đông (Sơn Tinh) & Ánh lam giông phía Tây (Thủy Tinh)
    scene.add(new THREE.HemisphereLight(0x93c5fd, 0x0f172a, 0.56));
    const sunEast = new THREE.DirectionalLight(0xfffbeb, 1.05);
    sunEast.position.set(18, 22, 10);
    scene.add(sunEast);
    const stormWest = new THREE.DirectionalLight(0x38bdf8, 0.52);
    stormWest.position.set(-18, 12, -8);
    scene.add(stormWest);

    // Vật liệu địa hình rực rỡ, sắc nét theo độ cao 0..5
    W3.elevMats = [
      new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.9, metalness: 0.05 }),  // 0: đáy biển
      new THREE.MeshStandardMaterial({ color: 0x2f8540, roughness: 0.85, metalness: 0.04 }), // 1: đồng bằng cỏ xanh mướt
      new THREE.MeshStandardMaterial({ color: 0x1f6b33, roughness: 0.80, metalness: 0.06 }), // 2: đồi trung du xanh thẫm
      new THREE.MeshStandardMaterial({ color: 0x3b5e3c, roughness: 0.76, metalness: 0.10 }), // 3: núi đá rêu
      new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.70, metalness: 0.15 }), // 4: đỉnh núi đá
      new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.62, metalness: 0.18 })  // 5: đỉnh Tản Viên hùng vĩ
    ];

    W3.envGroup = new THREE.Group();
    W3.boardGroup = new THREE.Group();
    W3.laneDivGroup = new THREE.Group();
    W3.fxGroup = new THREE.Group();
    W3.cursorGroup = new THREE.Group();
    scene.add(W3.envGroup, W3.boardGroup, W3.laneDivGroup, W3.fxGroup, W3.cursorGroup);

    buildBackdrop();

    // Khung con trỏ 3D khi di chuột hoặc dùng phím mũi tên
    const curFrame = new THREE.Mesh(
      new THREE.RingGeometry(0.74, 0.92, 4),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.96, side: THREE.DoubleSide })
    );
    curFrame.rotation.x = -Math.PI / 2;
    curFrame.rotation.z = Math.PI / 4;
    const curBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.78, 1.5, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfde047, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false })
    );
    curBeam.position.y = 0.75;
    W3.cursorGroup.add(curFrame, curBeam);
    W3.cursorGroup.visible = false;

    bindPointerEvents(renderer.domElement);
    if (typeof ResizeObserver !== "undefined") {
      resizeObs = new ResizeObserver(() => resize());
      resizeObs.observe(containerEl);
    }
    global.addEventListener("resize", resize);

    W3.ready = true;
    return true;
  }

  /* ---------- Ngoại cảnh Sử Thi: Biển Tây cuộn sóng + Dãy núi Tản Viên Đông + Mây ---------- */
  function buildBackdrop() {
    clearGroup(W3.envGroup);
    W3.clouds = [];

    // Mặt đại dương mênh mông xung quanh chiến trường
    const seaGeo = new THREE.PlaneGeometry(140, 110, 12, 10);
    const seaMat = new THREE.MeshPhongMaterial({
      color: 0x0c4a6e, emissive: 0x082f49, emissiveIntensity: 0.35,
      shininess: 75, specular: 0x38bdf8, transparent: true, opacity: 0.92
    });
    const sea = new THREE.Mesh(seaGeo, seaMat);
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -0.18;
    W3.envGroup.add(sea);
    W3.seaMesh = sea;

    // Dãy núi Tản Viên hùng vĩ làm hậu cảnh phía Đông (phải)
    const mtMat = new THREE.MeshStandardMaterial({ color: 0x164e36, roughness: 0.85 });
    const mtCap = new THREE.MeshStandardMaterial({ color: 0xd1fae5, roughness: 0.7 });
    [
      { x: 14.5, z: -7.5, r: 4.5, h: 7.2 },
      { x: 16.5, z: 0.5, r: 5.5, h: 9.2 },
      { x: 14.8, z: 7.8, r: 4.2, h: 6.4 },
      { x: 11.2, z: -11.2, r: 3.6, h: 4.8 },
      { x: 11.5, z: 11.0, r: 3.8, h: 5.2 }
    ].forEach(d => {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(d.r, d.h, 7), mtMat);
      cone.position.set(d.x, d.h / 2 - 0.5, d.z);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(d.r * 0.30, d.h * 0.28, 7), mtCap);
      cap.position.set(d.x, d.h * 0.86 - 0.5, d.z);
      W3.envGroup.add(cone, cap);
    });

    // Đá ngầm & cột sóng phía Tây (trái — lãnh địa Thủy Tinh)
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.7 });
    [
      { x: -13.5, z: -5.5, s: 1.8 },
      { x: -15.0, z: 2.2, s: 2.4 },
      { x: -13.0, z: 7.4, s: 1.6 }
    ].forEach(d => {
      const r = new THREE.Mesh(new THREE.DodecahedronGeometry(d.s, 0), rockMat);
      r.scale.set(1.2, 1.6, 1.0);
      r.position.set(d.x, d.s * 0.4 - 0.3, d.z);
      W3.envGroup.add(r);
    });

    // Mây nhẹ trôi trên bầu trời
    const cloudMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.32 });
    for (let i = 0; i < 7; i++) {
      const cg = new THREE.Group();
      for (let j = 0; j < 3; j++) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(rand(1.0, 1.7), 8, 6), cloudMat);
        puff.position.set((j - 1) * 1.3, rand(-0.2, 0.3), rand(-0.4, 0.4));
        puff.scale.set(1.3, 0.65, 1.0);
        cg.add(puff);
      }
      cg.position.set(rand(-18, 18), rand(7.5, 10.5), rand(-14, -7));
      W3.envGroup.add(cg);
      W3.clouds.push({ g: cg, spd: rand(0.25, 0.55) });
    }
  }

  /* ---------- Camera & Orbit ---------- */
  function computeCameraGoal() {
    const G = H.getState();
    const m = G.map;
    if (!m) return;
    const span = Math.max(m.cols * 1.02, m.rows * 1.3);
    const baseR = span * 2.25 + 4.8;
    if (W3.camMode === 0) {
      // 3D Toàn cảnh (nhìn đẹp toàn bộ 8x6, thấy rõ độ cao núi & mực nước)
      W3.camGoalTarget.set(0, 0.45, 0.25);
      W3.camGoalSph = { r: baseR * 0.98, theta: 0, phi: 0.78 };
    } else if (W3.camMode === 1) {
      // Nhìn từ trên xuống (chiến thuật dễ đọc tọa độ A1-H6)
      W3.camGoalTarget.set(0, 0.2, 0);
      W3.camGoalSph = { r: baseR * 1.08, theta: 0, phi: 0.16 };
    } else {
      // Góc thấp sử thi (nhìn ngang tầm sóng thần & núi Tản Viên)
      W3.camGoalTarget.set(0, 0.85, 0.4);
      W3.camGoalSph = { r: baseR * 0.86, theta: -0.26, phi: 1.08 };
    }
  }

  function applyCamera(dt) {
    const k = Math.min(1, dt * 6.5);
    W3.camTarget.lerp(W3.camGoalTarget, k);
    const goalR = W3.camGoalSph.r * W3.userOrbit.rScale;
    const goalTheta = W3.camGoalSph.theta + W3.userOrbit.theta;
    const goalPhi = Math.max(0.14, Math.min(1.22, W3.camGoalSph.phi + W3.userOrbit.phi));

    W3.camSph.r += (goalR - W3.camSph.r) * k;
    W3.camSph.theta += (goalTheta - W3.camSph.theta) * k;
    W3.camSph.phi += (goalPhi - W3.camSph.phi) * k;

    const { r, theta, phi } = W3.camSph;
    let sx = 0, sy = 0, sz = 0;
    if (W3.shakeTime > 0) {
      W3.shakeTime = Math.max(0, W3.shakeTime - dt);
      const amp = W3.shakeMag * (W3.shakeTime * 2.4);
      sx = rand(-amp, amp); sy = rand(-amp * 0.6, amp * 0.6); sz = rand(-amp, amp);
    }

    W3.camera.position.set(
      W3.camTarget.x + r * Math.sin(phi) * Math.sin(theta) + sx,
      W3.camTarget.y + r * Math.cos(phi) + sy,
      W3.camTarget.z + r * Math.sin(phi) * Math.cos(theta) + sz
    );
    W3.camera.lookAt(W3.camTarget);
  }

  /* ---------- Raycasting & Điều khiển chuột ---------- */
  function getHitCell(clientX, clientY) {
    if (!W3.ready || !W3.hitMeshes.length) return null;
    const rect = W3.renderer.domElement.getBoundingClientRect();
    const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((clientY - rect.top) / rect.height) * 2 + 1;
    W3.raycaster.setFromCamera({ x: nx, y: ny }, W3.camera);
    const hits = W3.raycaster.intersectObjects(W3.hitMeshes, false);
    if (!hits.length) return null;
    return hits[0].object.userData;
  }

  function bindPointerEvents(dom) {
    let dragging = false, moved = 0, lastX = 0, lastY = 0;
    dom.addEventListener("contextmenu", e => e.preventDefault());

    dom.addEventListener("pointerdown", e => {
      if (!active) return;
      dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY;
      try { dom.setPointerCapture(e.pointerId); } catch (_) {}
    });

    dom.addEventListener("pointermove", e => {
      if (!active) return;
      if (dragging) {
        const dx = e.clientX - lastX, dy = e.clientY - lastY;
        moved += Math.hypot(dx, dy);
        lastX = e.clientX; lastY = e.clientY;
        if (moved > 5) {
          W3.userOrbit.theta -= dx * 0.0065;
          W3.userOrbit.phi = Math.max(-0.52, Math.min(0.42, W3.userOrbit.phi - dy * 0.0045));
          dom.style.cursor = "grabbing";
        }
        return;
      }
      const G = H.getState();
      if (G.phase !== "pick") { dom.style.cursor = "grab"; return; }
      const hit = getHitCell(e.clientX, e.clientY);
      if (!hit) { dom.style.cursor = "grab"; W3.hoveredKey = ""; return; }
      const hk = hit.x + "," + hit.y;
      if (G.validSet && G.validSet.has(hk)) {
        dom.style.cursor = "pointer";
        if (hk !== W3.hoveredKey) {
          W3.hoveredKey = hk;
          H.onHoverCell(hit.x, hit.y);
        }
      } else {
        dom.style.cursor = "grab";
        W3.hoveredKey = "";
      }
    });

    const endDrag = e => {
      if (!dragging) return;
      dragging = false;
      try { dom.releasePointerCapture(e.pointerId); } catch (_) {}
      dom.style.cursor = "grab";
      if (moved < 7) {
        const hit = getHitCell(e.clientX, e.clientY);
        if (hit) H.onSelectCell(hit.x, hit.y);
      }
    };
    dom.addEventListener("pointerup", endDrag);
    dom.addEventListener("pointercancel", endDrag);

    dom.addEventListener("wheel", e => {
      if (!active) return;
      e.preventDefault();
      W3.userOrbit.rScale = Math.max(0.62, Math.min(1.55, W3.userOrbit.rScale + e.deltaY * 0.0008));
    }, { passive: false });
  }

  /* ---------- Dựng Mô Hình Công Trình 3D (Đê, Rừng, Bản Làng, Đỉnh Núi) ---------- */
  function buildPeakMesh(elev) {
    const g = new THREE.Group();
    if (elev < 3) return g;
    const h = elev === 3 ? 0.58 : elev === 4 ? 0.92 : 1.28;
    const col = elev >= 5 ? 0x64748b : elev === 4 ? 0x475569 : 0x3f6212;
    const main = new THREE.Mesh(
      new THREE.ConeGeometry(0.76, h, 6),
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.72, metalness: 0.12 })
    );
    main.position.y = h / 2 - 0.04;
    g.add(main);
    if (elev >= 4) {
      const cap = new THREE.Mesh(
        new THREE.ConeGeometry(0.30, h * 0.34, 6),
        new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.5 })
      );
      cap.position.y = h * 0.84 - 0.04;
      g.add(cap);
    }
    return g;
  }

  function buildDikeMesh(level) {
    const g = new THREE.Group();
    if (level <= 0) return g;
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.65, metalness: 0.15 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.75 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.35, metalness: 0.6 });

    const wallH = level >= 2 ? 0.86 : 0.54;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.28, wallH, CELL - 0.18), stoneMat);
    wall.position.set(-CELL * 0.38, wallH / 2, 0);
    g.add(wall);

    // Hàng cọc gỗ gia cố đê
    for (let i = -2; i <= 2; i++) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, wallH + 0.18, 6), woodMat);
      post.position.set(-CELL * 0.38, (wallH + 0.18) / 2, i * 0.34);
      g.add(post);
    }
    // Thanh gỗ ngang liên kết
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, CELL - 0.14), level >= 2 ? goldMat : woodMat);
    rail.position.set(-CELL * 0.38, wallH + 0.02, 0);
    g.add(rail);

    if (level >= 2) {
      // Chòi canh hộ đê cấp 2 mái ngói vàng rực rỡ
      const tower = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.42, 0.44), woodMat);
      tower.position.set(-CELL * 0.36, wallH + 0.22, 0);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.30, 4), goldMat);
      roof.rotation.y = Math.PI / 4;
      roof.position.set(-CELL * 0.36, wallH + 0.56, 0);
      g.add(tower, roof);
    }
    return g;
  }

  function buildForestMesh(level, isVillage) {
    const g = new THREE.Group();
    if (level <= 0) return g;
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.88 });
    const leaf1 = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.72 });
    const leaf2 = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.65 });

    const coords = isVillage
      ? (level >= 2 ? [[-0.58, -0.58], [0.58, -0.58], [0.58, 0.58]] : [[0.56, -0.56], [0.56, 0.56]])
      : (level >= 2
          ? [[-0.38, -0.42], [0.40, -0.36], [0.02, 0.04], [-0.42, 0.44], [0.42, 0.42]]
          : [[-0.36, -0.30], [0.36, -0.18], [0.02, 0.38]]);

    coords.forEach(([tx, tz], idx) => {
      const tree = new THREE.Group();
      const s = level >= 2 ? (idx === 2 ? 1.15 : 0.96) : 0.86;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * s, 0.09 * s, 0.34 * s, 6), trunkMat);
      trunk.position.y = 0.17 * s;
      const c1 = new THREE.Mesh(new THREE.ConeGeometry(0.30 * s, 0.52 * s, 7), leaf1);
      c1.position.y = 0.52 * s;
      const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.22 * s, 0.42 * s, 7), leaf2);
      c2.position.y = 0.80 * s;
      tree.add(trunk, c1, c2);
      tree.position.set(tx, 0, tz);
      g.add(tree);
      W3.swayTrees.push({ obj: tree, phase: rand(0, 6.28) });
    });
    return g;
  }

  function buildVillageMesh(cell) {
    const g = new THREE.Group();
    const flooded = !!cell.flooded;
    const wallMat = new THREE.MeshStandardMaterial({ color: flooded ? 0x94a3b8 : 0xfef3c7, roughness: 0.6 });
    const roofMat = new THREE.MeshStandardMaterial({
      color: flooded ? 0x7f1d1d : 0xdc2626,
      emissive: flooded ? 0x450a0a : 0x7f1d1d,
      emissiveIntensity: flooded ? 0.25 : 0.18,
      roughness: 0.45
    });
    const yardMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.85 });

    // Sân đình
    const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.82, 0.07, 12), yardMat);
    yard.position.y = 0.035;
    g.add(yard);

    // Nhà lớn mái ngói đỏ (Đình làng)
    const h1 = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.34, 0.44), wallMat);
    h1.position.set(-0.08, 0.22, -0.10);
    const r1 = new THREE.Mesh(new THREE.ConeGeometry(0.48, 0.32, 4), roofMat);
    r1.rotation.y = Math.PI / 4;
    r1.position.set(-0.08, 0.54, -0.10);

    // Nhà nhỏ bên cạnh
    const h2 = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.26, 0.34), wallMat);
    h2.position.set(0.34, 0.18, 0.28);
    const r2 = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.24, 4), roofMat);
    r2.rotation.y = Math.PI / 4;
    r2.position.set(0.34, 0.42, 0.28);

    // Cửa sổ vàng ấm khi an toàn
    if (!flooded) {
      const win = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.12, 0.46),
        new THREE.MeshBasicMaterial({ color: 0xfde047 })
      );
      win.position.set(-0.08, 0.20, -0.10);
      g.add(win);
    }

    g.add(h1, r1, h2, r2);

    // Khiên Thần Rừng bảo vệ làng
    if (cell.shield > 0) {
      const sh = new THREE.Mesh(
        new THREE.TorusGeometry(0.84, 0.055, 8, 28),
        new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.92 })
      );
      sh.rotation.x = Math.PI / 2;
      sh.position.y = 0.28;
      g.add(sh);
      W3.shields.push({ obj: sh, phase: rand(0, 6.28) });
    }

    // Biển tên bản làng nổi phía trên
    const lblText = flooded ? `🌊 ${cell.villageName} (NGẬP!)` : `🏘️ ${cell.villageName}`;
    const sp = makeTextSprite(lblText, {
      color: flooded ? "#fef2f2" : "#fef9c3",
      bg: flooded ? "rgba(185,28,28,0.92)" : "rgba(20,83,45,0.9)",
      border: flooded ? "#fca5a5" : "#fde047",
      scale: 0.46,
      font: "900 30px Segoe UI, Arial, sans-serif"
    });
    sp.position.y = 1.25;
    g.add(sp);
    return g;
  }

  /* ---------- Dựng toàn bộ Bản Đồ 8x6 ---------- */
  function rebuild() {
    if (!W3.ready) return;
    const G = H.getState();
    const m = G.map;
    if (!m) return;

    clearGroup(W3.boardGroup);
    clearGroup(W3.laneDivGroup);
    W3.hitMeshes = [];
    W3.tileViews.clear();
    W3.swayTrees = [];
    W3.shields = [];
    W3.waterTiles = [];

    const totalW = m.cols * CELL;
    const totalH = m.rows * CELL;

    // Bệ khung nền đại dương/địa chất
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(totalW + 1.8, 0.55, totalH + 1.8),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8, metalness: 0.25 })
    );
    frame.position.y = -0.28;
    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(totalW + 1.94, 0.10, totalH + 1.94),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.4, metalness: 0.65 })
    );
    trim.position.y = -0.02;
    W3.boardGroup.add(frame, trim);

    // Biển hiệu hai phe ở 2 đầu Tây (Thủy Tinh) & Đông (Sơn Tinh)
    const westSign = makeTextSprite("🌊 THỦY TINH (BIỂN ĐÔNG)", {
      color: "#e0f2fe", bg: "rgba(3,105,161,0.9)", border: "#38bdf8", scale: 0.56
    });
    westSign.position.set(-totalW / 2 - 1.35, 1.85, 0);
    const eastSign = makeTextSprite("⛰️ SƠN TINH (NÚI TẢN VIÊN)", {
      color: "#fef9c3", bg: "rgba(21,128,61,0.9)", border: "#fde047", scale: 0.56
    });
    eastSign.position.set(totalW / 2 + 1.45, 2.35, 0);
    W3.boardGroup.add(westSign, eastSign);

    // Nhãn cột A..H (trên) và hàng 1..6 (trái)
    for (let x = 0; x < m.cols; x++) {
      const p = cellPos(x, 0, m.cols, m.rows);
      const sp = makeTextSprite("ABCDEFGH"[x], { color: "#fde047", scale: 0.58 });
      sp.position.set(p.wx, 0.68, -totalH / 2 - 0.68);
      W3.boardGroup.add(sp);
    }
    for (let y = 0; y < m.rows; y++) {
      const p = cellPos(0, y, m.cols, m.rows);
      const sp = makeTextSprite(String(y + 1), { color: "#fde047", scale: 0.58 });
      sp.position.set(-totalW / 2 - 0.68, 0.68, p.wz);
      W3.boardGroup.add(sp);
    }

    // Dải chia cánh Bắc (1-3) / cánh Nam (4-6) cho chế độ 4 đội
    const divLine = new THREE.Mesh(
      new THREE.BoxGeometry(totalW + 0.5, 0.08, 0.12),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.65 })
    );
    divLine.position.set(0, 0.12, 0);
    const northTag = makeTextSprite("🌊 DÒNG BẮC (1–3)", { color: "#bae6fd", bg: "rgba(2,132,199,0.82)", border: "#7dd3fc", scale: 0.42 });
    northTag.position.set(-totalW / 2 - 1.45, 0.95, -totalH * 0.25);
    const southTag = makeTextSprite("🌊 DÒNG NAM (4–6)", { color: "#c4b5fd", bg: "rgba(79,70,229,0.82)", border: "#a5b4fc", scale: 0.42 });
    southTag.position.set(-totalW / 2 - 1.45, 0.95, totalH * 0.25);
    W3.laneDivGroup.add(divLine, northTag, southTag);

    const lblGeo = new THREE.PlaneGeometry(0.64, 0.36);
    // Khung viền vuông rỗng (bán kính góc 1.16..1.28 -> cạnh ~1.81) ôm sát mép ô, không phủ mờ mặt cỏ/làng
    const hlGeo = new THREE.RingGeometry(1.16, 1.28, 4);

    for (let y = 0; y < m.rows; y++) {
      for (let x = 0; x < m.cols; x++) {
        const c = m.cells[y][x];
        const p = cellPos(x, y, m.cols, m.rows);

        // Khối địa hình (chiều cao co giãn mượt theo elevation)
        const initH = groundTopY(c.elev);
        const colMesh = new THREE.Mesh(W3.boxGeo, W3.elevMats[c.elev] || W3.elevMats[1]);
        colMesh.scale.set(CELL - 0.08, initH, CELL - 0.08);
        colMesh.position.set(p.wx, initH / 2, p.wz);
        colMesh.userData = { x, y };
        W3.boardGroup.add(colMesh);
        W3.hitMeshes.push(colMesh);

        // Khối nước bán trong suốt (dâng mượt theo waterLevel)
        const wMat = new THREE.MeshPhongMaterial({
          color: c.waterLevel >= 3 ? 0x0369a1 : 0x0284c7,
          emissive: 0x082f49, emissiveIntensity: 0.30,
          transparent: true, opacity: 0.80, shininess: 120, specular: 0xe0f2fe
        });
        const initW = waterTopY(c.waterLevel);
        const waterMesh = new THREE.Mesh(W3.boxGeo, wMat);
        waterMesh.scale.set(CELL - 0.04, initW, CELL - 0.04);
        waterMesh.position.set(p.wx, initW / 2, p.wz);
        waterMesh.visible = c.waterLevel > 0;
        waterMesh.userData = { x, y };
        W3.boardGroup.add(waterMesh);
        W3.hitMeshes.push(waterMesh);
        W3.waterTiles.push({ mesh: waterMesh, x, y, phase: x * 0.65 + y * 0.85, baseTop: initW });

        // Nhãn tọa độ góc ô (tự nổi trên bề mặt cao nhất của ô)
        const lblMesh = new THREE.Mesh(
          lblGeo,
          new THREE.MeshBasicMaterial({ map: getCoordTex(H.coordLabel(x, y)), transparent: true, opacity: 0.88, depthWrite: false })
        );
        lblMesh.rotation.x = -Math.PI / 2;
        lblMesh.position.set(p.wx - CELL * 0.28, Math.max(initH, initW) + 0.035, p.wz - CELL * 0.30);
        W3.boardGroup.add(lblMesh);

        // Khung viền sáng ô mục tiêu hợp lệ (rỗng ở giữa)
        const hlMat = new THREE.MeshBasicMaterial({ color: 0xfde047, transparent: true, opacity: 0.62, side: THREE.DoubleSide, depthWrite: false });
        const hlMesh = new THREE.Mesh(hlGeo, hlMat);
        hlMesh.rotation.x = -Math.PI / 2;
        hlMesh.rotation.z = Math.PI / 4;
        hlMesh.position.set(p.wx, Math.max(initH, initW) + 0.04, p.wz);
        hlMesh.visible = false;
        W3.boardGroup.add(hlMesh);

        // Nhóm công trình gắn trên đỉnh đất (Peak, Dike, Forest, Village)
        const topGroup = new THREE.Group();
        topGroup.position.set(p.wx, initH, p.wz);
        W3.boardGroup.add(topGroup);

        W3.tileViews.set(x + "," + y, {
          x, y, wx: p.wx, wz: p.wz,
          colMesh, waterMesh, wMat, lblMesh, hlMesh, hlMat, topGroup,
          curGroundH: initH, targetGroundH: initH,
          curWaterH: initW, targetWaterH: initW,
          topKey: ""
        });
      }
    }

    W3.mapRef = m;
    W3.userOrbit = { theta: 0, phi: 0, rScale: 1 };
    computeCameraGoal();
    W3.camTarget.copy(W3.camGoalTarget);
    W3.camSph = { ...W3.camGoalSph };

    sync();
  }

  /* ---------- Đồng bộ trạng thái game -> cảnh 3D ---------- */
  function sync() {
    if (!W3.ready) return;
    const G = H.getState();
    const m = G.map;
    if (!m) return;

    if (W3.mapRef !== m || W3.tileViews.size !== m.cols * m.rows) {
      rebuild();
      return;
    }

    W3.laneDivGroup.visible = G.teams.length === 4;

    const curT = G.teams[G.cur];
    const hlColor = curT ? (curT.side === "son" ? "#4ade80" : "#38bdf8") : "#fde047";
    let propsChanged = false;

    for (let y = 0; y < m.rows; y++) {
      for (let x = 0; x < m.cols; x++) {
        const c = m.cells[y][x];
        const k = x + "," + y;
        const v = W3.tileViews.get(k);
        if (!v) continue;

        v.targetGroundH = groundTopY(c.elev);
        v.colMesh.material = W3.elevMats[Math.max(0, Math.min(5, c.elev))] || W3.elevMats[1];

        v.targetWaterH = waterTopY(c.waterLevel);
        v.waterMesh.visible = c.waterLevel > 0;
        if (c.waterLevel > 0) {
          v.wMat.color.setHex(c.waterLevel >= 4 ? 0x075985 : c.waterLevel >= 2 ? 0x0284c7 : 0x0ea5e9);
          v.wMat.opacity = c.flooded ? 0.80 : 0.72;
        }

        // Highlight khung viền ô mục tiêu hợp lệ cho hành động đang chọn
        const can = G.phase === "pick" && G.validSet && G.validSet.has(k);
        v.hlMesh.visible = can;
        if (can) {
          v.hlMat.color.set(hlColor);
          v.hlMat.opacity = 0.65;
        }

        // Cập nhật công trình 3D trên mặt đất nếu có thay đổi
        const tKey = `${c.elev}|${c.dike}|${c.forest}|${c.village ? 1 : 0}|${c.flooded ? 1 : 0}|${c.shield}`;
        if (tKey !== v.topKey) {
          v.topKey = tKey;
          clearGroup(v.topGroup);
          if (c.village) {
            v.topGroup.add(buildVillageMesh(c));
          } else if (c.elev >= 3) {
            v.topGroup.add(buildPeakMesh(c.elev));
          }
          if (c.dike > 0) v.topGroup.add(buildDikeMesh(c.dike));
          if (c.forest > 0) v.topGroup.add(buildForestMesh(c.forest, !!c.village));
          propsChanged = true;
        }
      }
    }

    if (propsChanged) {
      const inScene = obj => {
        let p = obj;
        while (p.parent) p = p.parent;
        return p === W3.scene;
      };
      W3.swayTrees = W3.swayTrees.filter(it => inScene(it.obj));
      W3.shields = W3.shields.filter(it => inScene(it.obj));
    }

    // Con trỏ 3D tại ô đang chọn
    if (G.phase === "pick" && G.cursor) {
      const cv = W3.tileViews.get(G.cursor.x + "," + G.cursor.y);
      if (cv) {
        const top = Math.max(cv.targetGroundH, cv.waterMesh.visible ? cv.targetWaterH : 0) + 0.08;
        W3.cursorGroup.position.set(cv.wx, top, cv.wz);
        W3.cursorGroup.visible = true;
      }
    } else {
      W3.cursorGroup.visible = false;
    }
  }

  /* ---------- Hiệu Ứng Phép Thuật 3D ---------- */
  function fxAction(kind, cells) {
    if (!W3.ready || !active || !cells || !cells.length) return;
    const palettes = {
      mountain: ["#a16207", "#fde047", "#4ade80", "#94a3b8"],
      fortress: ["#fde047", "#22c55e", "#cbd5e1", "#ffffff"],
      dike:     ["#f59e0b", "#cbd5e1", "#fef08a"],
      forest:   ["#22c55e", "#4ade80", "#86efac", "#fde047"],
      shield:   ["#34d399", "#fde047", "#ffffff"],
      flood:    ["#0ea5e9", "#38bdf8", "#e0f2fe"],
      whirlpool:["#0284c7", "#818cf8", "#38bdf8", "#ffffff"],
      tsunami:  ["#0369a1", "#38bdf8", "#e0f2fe", "#a855f7"]
    };
    const cols = palettes[kind] || ["#fde047", "#38bdf8", "#ffffff"];
    const heavy = ["tsunami", "fortress", "whirlpool", "mountain"].includes(kind);

    cells.forEach(({ x, y }) => {
      const v = W3.tileViews.get(x + "," + y);
      if (!v) return;
      const topY = Math.max(v.targetGroundH, v.waterMesh.visible ? v.targetWaterH : 0) + 0.35;
      const cnt = heavy ? 28 : 18;
      for (let i = 0; i < cnt; i++) {
        const mesh = new THREE.Mesh(
          W3.partGeo,
          new THREE.MeshBasicMaterial({ color: cols[i % cols.length], transparent: true, opacity: 1 })
        );
        const sz = rand(0.08, heavy ? 0.22 : 0.16);
        mesh.scale.setScalar(sz);
        mesh.position.set(v.wx + rand(-0.5, 0.5), topY, v.wz + rand(-0.5, 0.5));
        W3.fxGroup.add(mesh);
        const ang = rand(0, Math.PI * 2);
        const spd = rand(1.2, heavy ? 4.8 : 3.4);
        W3.particles.push({
          mesh, vx: Math.cos(ang) * spd, vy: rand(2.4, heavy ? 6.2 : 4.4), vz: Math.sin(ang) * spd,
          life: 0, maxLife: rand(0.65, 1.2), baseSize: sz
        });
      }

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.26, 0.46, 24),
        new THREE.MeshBasicMaterial({ color: cols[0], transparent: true, opacity: 0.92, side: THREE.DoubleSide })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(v.wx, topY + 0.05, v.wz);
      W3.fxGroup.add(ring);
      W3.rings.push({ mesh: ring, life: 0, maxLife: 0.78, maxScale: heavy ? 4.2 : 2.8 });
    });

    if (heavy) {
      W3.shakeMag = kind === "tsunami" || kind === "fortress" ? 0.28 : 0.18;
      W3.shakeTime = 0.42;
    }
  }

  /* ---------- Vòng lặp Animation 3D mượt ---------- */
  function animate() {
    if (!active) { rafId = 0; return; }
    rafId = requestAnimationFrame(animate);
    if (!W3.ready) return;
    if (H.isPaused && H.isPaused()) return;

    const dt = Math.min(0.05, W3.clock.getDelta());
    const t = W3.clock.elapsedTime;

    applyCamera(dt);

    // Mây trôi nhẹ
    for (let i = 0; i < W3.clouds.length; i++) {
      const c = W3.clouds[i];
      c.g.position.x += c.spd * dt;
      if (c.g.position.x > 22) c.g.position.x = -22;
    }

    // Nội suy chiều cao núi & mực nước mượt mà sau từng lượt + gợn sóng nước 3D
    const lerpK = Math.min(1, dt * 5.2);
    W3.tileViews.forEach(v => {
      if (Math.abs(v.targetGroundH - v.curGroundH) > 0.004) {
        v.curGroundH += (v.targetGroundH - v.curGroundH) * lerpK;
        v.colMesh.scale.y = v.curGroundH;
        v.colMesh.position.y = v.curGroundH / 2;
        v.topGroup.position.y = v.curGroundH;
      }
      if (v.waterMesh.visible) {
        v.curWaterH += (v.targetWaterH - v.curWaterH) * lerpK;
        const wave = Math.sin(t * 2.8 + v.x * 0.75 + v.y * 0.6) * 0.05;
        const h = Math.max(0.12, v.curWaterH + wave);
        v.waterMesh.scale.y = h;
        v.waterMesh.position.y = h / 2;
      }
      const surf = Math.max(v.curGroundH, v.waterMesh.visible ? v.curWaterH + 0.06 : 0);
      v.lblMesh.position.y = surf + 0.035;
      v.hlMesh.position.y = surf + 0.042;
    });

    // Cây rừng đung đưa nhẹ theo gió
    for (let i = 0; i < W3.swayTrees.length; i++) {
      const tr = W3.swayTrees[i];
      tr.obj.rotation.z = Math.sin(t * 2.1 + tr.phase) * 0.055;
    }
    // Vòng khiên Thần Rừng xoay sáng
    for (let i = 0; i < W3.shields.length; i++) {
      const sh = W3.shields[i];
      sh.obj.rotation.z = t * 1.4 + sh.phase;
      sh.obj.position.y = 0.28 + Math.sin(t * 3 + sh.phase) * 0.06;
    }

    if (W3.cursorGroup.visible) {
      const s = 1 + Math.sin(t * 5.4) * 0.06;
      W3.cursorGroup.scale.set(s, 1, s);
    }

    // Hạt FX 3D
    for (let i = W3.particles.length - 1; i >= 0; i--) {
      const pt = W3.particles[i];
      pt.life += dt;
      if (pt.life >= pt.maxLife) {
        W3.fxGroup.remove(pt.mesh);
        pt.mesh.material.dispose();
        W3.particles.splice(i, 1);
        continue;
      }
      pt.vy -= 9.5 * dt;
      pt.mesh.position.x += pt.vx * dt;
      pt.mesh.position.y = Math.max(0.1, pt.mesh.position.y + pt.vy * dt);
      pt.mesh.position.z += pt.vz * dt;
      const frac = 1 - pt.life / pt.maxLife;
      pt.mesh.scale.setScalar(pt.baseSize * frac);
      pt.mesh.material.opacity = frac;
    }

    // Vòng sóng lan tỏa 3D
    for (let i = W3.rings.length - 1; i >= 0; i--) {
      const rg = W3.rings[i];
      rg.life += dt;
      if (rg.life >= rg.maxLife) {
        W3.fxGroup.remove(rg.mesh);
        rg.mesh.geometry.dispose();
        rg.mesh.material.dispose();
        W3.rings.splice(i, 1);
        continue;
      }
      const p = rg.life / rg.maxLife;
      const sc = 1 + (rg.maxScale - 1) * p;
      rg.mesh.scale.set(sc, sc, 1);
      rg.mesh.material.opacity = (1 - p) * 0.88;
    }

    W3.renderer.render(W3.scene, W3.camera);
  }

  function resize() {
    if (!W3.ready || !W3.container) return;
    const rect = W3.container.getBoundingClientRect();
    const w = Math.max(240, Math.floor(rect.width));
    const h = Math.max(180, Math.floor(rect.height));
    W3.camera.aspect = w / h;
    W3.camera.updateProjectionMatrix();
    W3.renderer.setSize(w, h, false);
  }

  function setActive(on, containerEl, hooks) {
    if (hooks) H = hooks;
    if (on) {
      if (!initScene(containerEl)) return false;
      active = true;
      resize();
      sync();
      if (!rafId) {
        W3.clock.getDelta();
        rafId = requestAnimationFrame(animate);
      }
      return true;
    } else {
      active = false;
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      return true;
    }
  }

  function cycleCamera() {
    W3.camMode = (W3.camMode + 1) % CAM_MODES.length;
    W3.userOrbit = { theta: 0, phi: 0, rScale: 1 };
    computeCameraGoal();
    return CAM_MODES[W3.camMode];
  }

  global.World3D = {
    setActive,
    isActive: () => active && W3.ready,
    rebuild,
    sync,
    fxAction,
    cycleCamera,
    getCameraLabel: () => CAM_MODES[W3.camMode],
    resize
  };
})(window);
