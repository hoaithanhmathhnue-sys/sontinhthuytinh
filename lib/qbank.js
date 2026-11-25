/*
 * qbank.js — Ngân hàng câu hỏi dùng chung cho game giáo dục lớp học
 *  - Đọc câu hỏi dạng chữ (trắc nghiệm A–D, Đúng/Sai, trả lời ngắn), công thức $…$, ảnh [[img:id]]
 *  - Lưu đề trong trình duyệt (localStorage) + ảnh (IndexedDB) theo namespace từng game
 *  - KaTeX (offline trước, CDN dự phòng), khung "Soạn câu hỏi" có nhập file Word (.docx), xem trước
 *  - Âm thanh Web Audio cơ bản và hạt hiệu ứng canvas
 * Dùng: <script src="lib/qbank.js" data-store="ten-game.v1" data-db="ten-game"></script>  ->  window.QB
 *       Hoặc đặt window.QB_CONFIG = { storeKey, dbName, defaultText } trước khi nạp script.
 */
(function (root) {
  "use strict";
  const QB = {};
  const CUR_SCRIPT = typeof document !== "undefined" ? document.currentScript : null;
  const CFG = (root.QB_CONFIG && typeof root.QB_CONFIG === "object") ? root.QB_CONFIG : {};
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const LETTERS = "ABCDEF";
  QB.esc = esc;
  QB.LETTERS = LETTERS;
  QB.sleep = ms => new Promise(r => setTimeout(r, ms));
  QB.rand = (a, b) => a + Math.random() * (b - a);
  QB.pick = arr => arr[Math.floor(Math.random() * arr.length)];
  QB.shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  /* =================== Câu mẫu =================== */
  QB.DEFAULT_TEXT = String.raw`Câu 1: Đạo hàm của hàm số $y = x^3 - 3x^2 + 2$ là
A. $y' = 3x^2 - 6x$
B. $y' = 3x^2 - 6x + 2$
C. $y' = x^2 - 6x$
D. $y' = 3x^2 - 3x$
Đáp án: A
Giải: $(x^n)' = n\,x^{n-1}$ và đạo hàm của hằng số bằng $0$, nên $y' = 3x^2 - 6x$.

Câu 2: Tính tích phân $$I = \int_0^1 2x\,dx$$
A. $I = 2$
B. $I = 1$
C. $I = \dfrac{1}{2}$
D. $I = 0$
Đáp án: B
Giải: $I = x^2\Big|_0^1 = 1 - 0 = 1$.

Câu 3: Giá trị của giới hạn $$\lim_{x \to 0} \frac{\sin 3x}{x}$$ bằng
A. $0$
B. $1$
C. $3$
D. $\dfrac{1}{3}$
Đáp án: C
Giải: $\dfrac{\sin 3x}{x} = 3 \cdot \dfrac{\sin 3x}{3x} \to 3 \cdot 1 = 3$ khi $x \to 0$.

Câu 4: Nghiệm của phương trình $\log_2(x - 1) = 3$ là
A. $x = 7$
B. $x = 8$
C. $x = 9$
D. $x = 10$
Đáp án: C
Giải: Điều kiện $x > 1$. Ta có $x - 1 = 2^3 = 8 \Rightarrow x = 9$ (thỏa mãn).

Câu 5: Trong không gian $Oxyz$, cho $\vec{a} = (1;\,2;\,-2)$. Độ dài của $\vec{a}$ bằng
A. $3$
B. $9$
C. $\sqrt{5}$
D. $1$
Đáp án: A
Giải: $|\vec{a}| = \sqrt{1^2 + 2^2 + (-2)^2} = \sqrt{9} = 3$.

Câu 6 [Đúng/Sai]: Cho hàm số $f(x) = x^2 - 4x + 3$.
a) $f(1) = 0$
b) Đồ thị hàm số có trục đối xứng là đường thẳng $x = -2$
c) Hàm số đồng biến trên khoảng $(2;\,+\infty)$
d) Giá trị nhỏ nhất của hàm số trên $\mathbb{R}$ bằng $-1$
Đáp án: Đ S Đ Đ
Giải: a) $f(1) = 1 - 4 + 3 = 0$.
b) Trục đối xứng là $x = -\dfrac{b}{2a} = 2$.
c) $a = 1 > 0$ nên hàm số đồng biến trên $(2;\,+\infty)$.
d) $f(2) = 4 - 8 + 3 = -1$ là giá trị nhỏ nhất.

Câu 7 [Trả lời ngắn]: Có bao nhiêu cách chọn 2 học sinh từ một nhóm gồm 6 học sinh?
Đáp án: 15
Giải: $C_6^2 = \dfrac{6 \cdot 5}{2} = 15$.`;
  if (typeof CFG.defaultText === "string" && CFG.defaultText.trim()) QB.DEFAULT_TEXT = CFG.defaultText;
  QB.setDefaultText = text => { if (typeof text === "string") QB.DEFAULT_TEXT = text; };

  /* =================== Hiển thị chữ + công thức + ảnh =================== */
  QB.images = {};
  // Ảnh đứng riêng một dòng là hình minh hoạ -> đặt bên phải (class "fig")
  QB.rich = (s, imgs) => {
    const img = (id, cls) => { const src = (imgs || QB.images)[id]; return src ? `<img class="qimg${cls}" src="${src}" alt="">` : `<span class="qb-noimg">[ảnh]</span>`; };
    const figs = [];
    const body = esc(s)
      .replace(/(^|\n)[ \t]*((?:\[\[img:\w+\]\][ \t]*)+)(?=\n|$)/g, (m, nl, toks) => { toks.match(/\w+(?=\]\])/g).forEach(id => figs.push(img(id, " fig"))); return nl; })
      .replace(/\[\[img:(\w+)\]\]/g, (m, id) => img(id, ""))
      .replace(/\n{2,}/g, "\n").replace(/^\n+|\n+$/g, "");
    return figs.join("") + body;
  };
  QB.loadScript = src => new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });

  // Đường dẫn thư mục chứa qbank.js (để tìm katex/ và lib/ dù trang ở đâu)
  const BASE = (() => { const s = CUR_SCRIPT && CUR_SCRIPT.src; return s ? s.replace(/lib\/qbank\.js(\?.*)?$/, "") : (CFG.base || ""); })();
  QB.BASE = BASE;
  const KATEX_CDN = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/";
  const katexWaiters = [];
  QB.onKatex = fn => { if (window.renderMathInElement) fn(); else katexWaiters.push(fn); };
  (function loadKatex() {
    const css = document.createElement("link"); css.rel = "stylesheet"; css.href = BASE + "katex/katex.min.css";
    css.onerror = () => { css.onerror = null; css.href = KATEX_CDN + "katex.min.css"; };
    document.head.appendChild(css);
    (async () => {
      try { await QB.loadScript(BASE + "katex/katex.min.js"); await QB.loadScript(BASE + "katex/auto-render.min.js"); }
      catch (e) {
        try { if (!window.katex) await QB.loadScript(KATEX_CDN + "katex.min.js"); await QB.loadScript(KATEX_CDN + "contrib/auto-render.min.js"); }
        catch (e2) { console.warn("Không tải được KaTeX, công thức sẽ hiện dạng chữ."); }
      }
      katexWaiters.splice(0).forEach(fn => { try { fn(); } catch (e) { console.warn(e); } });
    })();
  })();
  QB.renderMath = el => {
    if (!el) return;
    if (!window.renderMathInElement) { QB.onKatex(() => QB.renderMath(el)); return; }
    try {
      window.renderMathInElement(el, {
        delimiters: [{ left: "$$", right: "$$", display: true }, { left: "\\[", right: "\\]", display: true },
          { left: "$", right: "$", display: false }, { left: "\\(", right: "\\)", display: false }],
        throwOnError: false, strict: "ignore"
      });
    } catch (e) { console.warn(e); }
  };

  /* =================== Đọc câu hỏi dạng chữ =================== */
  const TF_TRUE = /^(đ|đúng|dung|d|t|true|1)$/i, TF_FALSE = /^(s|sai|f|false|0)$/i;
  QB.parse = function parseQuestions(text) {
    const lines = String(text || "").replace(/\r/g, "").split("\n");
    const raw = []; let cur = null, field = null;
    const RX_Q = /^c[âa]u\s*\d*\s*(\[[^\]]*\]|\([^)]*\))?\s*[:.)]\s*(.*)$/iu;
    const RX_OPT = /^(\*)?\s*([A-F])\s*[.)]\s*(.*)$/u;
    const RX_ST = /^(\*)?\s*([a-f])\s*\)\s*(.*)$/u;
    const RX_ANS = /^(đáp\s*án|dap\s*an|trả\s*lời|tra\s*loi)\s*[:.]\s*(.*)$/iu;
    const RX_EXP = /^(lời\s*giải|loi\s*giai|giải|giai|hướng\s*dẫn)\s*[:.]\s*(.*)$/iu;
    const add = q => { raw.push(q); return q; };
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      let m;
      if ((m = line.match(RX_Q))) { cur = add({ q: m[2], tag: m[1] || "", opts: [], st: [], stMark: [], mark: -1, ansRaw: "", exp: "" }); field = "q"; continue; }
      if (!cur) { cur = add({ q: line, tag: "", opts: [], st: [], stMark: [], mark: -1, ansRaw: "", exp: "" }); field = "q"; continue; }
      if ((m = line.match(RX_ANS))) { cur.ansRaw = m[2].trim(); if (field !== "exp") field = null; continue; }
      if (field === "exp") { cur.exp += "\n" + line; continue; }
      if ((m = line.match(RX_EXP))) { cur.exp = m[2]; field = "exp"; continue; }
      if ((m = line.match(RX_OPT))) { const i = m[2].charCodeAt(0) - 65; cur.opts[i] = m[3]; if (m[1]) cur.mark = i; field = "o" + i; continue; }
      if ((m = line.match(RX_ST))) { const i = m[2].charCodeAt(0) - 97; cur.st[i] = m[3]; cur.stMark[i] = !!m[1]; field = "s" + i; continue; }
      if (field === "q") cur.q += "\n" + line;
      else if (field && field[0] === "o") cur.opts[+field.slice(1)] += " " + line;
      else if (field && field[0] === "s") cur.st[+field.slice(1)] += " " + line;
      else cur.q += "\n" + line;
    }
    const questions = [], errors = [];
    const holes = arr => { for (let i = 0; i < arr.length; i++) if (arr[i] === undefined) return true; return false; };
    raw.forEach((q, k) => {
      const name = "Câu " + (k + 1);
      const tagTF = /đúng|sai/i.test(q.tag), tagShort = /ngắn|ngan|điền|dien/i.test(q.tag);
      let type = tagTF ? "tf" : tagShort ? "short" : (q.opts.length >= 2 ? "mc" : (q.st.length >= 2 ? "tf" : "short"));
      if (type === "tf" && q.st.length < 2 && q.opts.length >= 2) type = "mc";
      const base = { q: q.q.trim(), exp: q.exp.trim() };
      if (!base.q) { errors.push(name + ": thiếu nội dung câu hỏi."); return; }
      if (type === "mc") {
        let ans = q.mark;
        if (ans < 0 && /^[A-F]\b/i.test(q.ansRaw)) ans = q.ansRaw.toUpperCase().charCodeAt(0) - 65;
        if (holes(q.opts)) errors.push(name + ": các phương án phải liên tiếp A, B, C, … (đang thiếu chữ cái).");
        else if (ans < 0) errors.push(name + ": chưa có đáp án đúng (dòng “Đáp án: B” hoặc dấu * trước phương án).");
        else if (ans >= q.opts.length) errors.push(name + ": đáp án " + LETTERS[ans] + " không có trong các phương án.");
        else questions.push({ type, ...base, opts: q.opts.map(o => o.trim()), ans });
      } else if (type === "tf") {
        if (q.st.length < 2 || holes(q.st)) { errors.push(name + " (Đúng/Sai): cần các ý a), b), … liên tiếp."); return; }
        let truth = q.stMark.map(Boolean);
        if (q.ansRaw) {
          const toks = q.ansRaw.split(/[\s,;\-–]+/).filter(Boolean).map(t => t.replace(/^[a-f]\)?[:.]?/i, "") || t);
          const vals = toks.map(t => TF_TRUE.test(t) ? true : TF_FALSE.test(t) ? false : null).filter(v => v !== null);
          if (vals.length === q.st.length) truth = vals;
          else { errors.push(name + ` (Đúng/Sai): “Đáp án” cần ${q.st.length} giá trị Đ/S, ví dụ “Đ S S Đ”.`); return; }
        } else if (!q.stMark.some(Boolean)) { errors.push(name + " (Đúng/Sai): chưa có dòng “Đáp án: Đ S …” (hoặc dấu * trước ý đúng)."); return; }
        questions.push({ type, ...base, st: q.st.map(s => s.trim()), truth: q.st.map((_, i) => !!truth[i]) });
      } else {
        if (!q.ansRaw || q.ansRaw === "?") { errors.push(name + " (Trả lời ngắn): chưa có dòng “Đáp án: …”."); return; }
        questions.push({ type: "short", ...base, answer: q.ansRaw });
      }
    });
    return { questions, errors, total: raw.length };
  };
  // Tách lời giải "a) … b) …" của câu Đúng/Sai theo từng ý
  QB.splitExp = function (exp, n) {
    if (!exp) return [];
    const pos = []; let from = 0;
    for (let i = 0; i < n; i++) {
      const re = new RegExp("(^|\\s)" + "abcdef"[i] + "\\)", "g"); re.lastIndex = from;
      const m = re.exec(exp); if (!m) return [];
      pos.push(m.index + m[1].length); from = m.index + m[0].length;
    }
    return pos.map((p, i) => exp.slice(p, i + 1 < n ? pos[i + 1] : exp.length).trim());
  };
  QB.countRounds = qs => qs.reduce((s, q) => s + (q.type === "tf" ? q.st.length : 1), 0);
  // Chuyển câu hỏi thành các "lượt chơi": mỗi ý Đúng/Sai là 1 lượt
  QB.buildRounds = function (questions, { shuffleQ = false, shuffleA = false } = {}) {
    let qs = questions.slice();
    if (shuffleQ) QB.shuffle(qs);
    const rounds = [];
    qs.forEach((q, n) => {
      const label = "Câu " + (n + 1);
      if (q.type === "mc") {
        let opts = q.opts.slice(), ans = q.ans;
        if (shuffleA) { const order = QB.shuffle(opts.map((_, i) => i)); opts = order.map(i => q.opts[i]); ans = order.indexOf(q.ans); }
        rounds.push({ kind: "mc", label, q: q.q, opts, ans, exp: q.exp });
      } else if (q.type === "tf") {
        const parts = QB.splitExp(q.exp, q.st.length);
        q.st.forEach((s, i) => rounds.push({ kind: "tf", label: label + "abcdef"[i], letter: "abcdef"[i], q: q.q, stmt: s, opts: ["Đúng", "Sai"], ans: q.truth[i] ? 0 : 1, exp: parts[i] || q.exp }));
      } else rounds.push({ kind: "short", label, q: q.q, answer: q.answer, exp: q.exp });
    });
    return rounds;
  };

  /* =================== Lưu trữ trong trình duyệt =================== */
  const STORE_KEY = (CUR_SCRIPT && CUR_SCRIPT.dataset && CUR_SCRIPT.dataset.store) || CFG.storeKey || "edu-game-qbank.v1";
  const DB_NAME = (CUR_SCRIPT && CUR_SCRIPT.dataset && CUR_SCRIPT.dataset.db) || CFG.dbName || STORE_KEY.replace(/\.v\d+$/, "");
  QB.STORE_KEY = STORE_KEY;
  QB.DB_NAME = DB_NAME;
  function readRaw() { try { const s = JSON.parse(localStorage.getItem(STORE_KEY)); return s && typeof s === "object" ? s : {}; } catch (e) { return {}; } }
  function writeRaw(obj) { try { localStorage.setItem(STORE_KEY, JSON.stringify(obj)); return true; } catch (e) { alert("Không lưu được vào trình duyệt (bộ nhớ đầy hoặc bị chặn). Dữ liệu chỉ dùng được trong lần mở này."); return false; } }
  QB.getText = () => { const r = readRaw(); return typeof r.text === "string" ? r.text : QB.DEFAULT_TEXT; };
  QB.saveText = text => { const r = readRaw(); r.text = text; return writeRaw(r); };
  // Cài đặt trận đấu (lưu cùng chỗ với đề)
  QB.getSettings = (game, defaults) => {
    const r = readRaw();
    return { ...defaults, ...((r.games || {})[game] || {}) };
  };
  QB.saveSettings = (game, settings) => {
    const r = readRaw();
    r.games = r.games || {}; r.games[game] = settings;
    if (typeof r.text !== "string") r.text = QB.getText();
    return writeRaw(r);
  };
  const IDB = (() => {
    let dbp = null;
    const open = () => dbp || (dbp = new Promise((res, rej) => {
      try { const r = indexedDB.open(DB_NAME, 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }
      catch (e) { rej(e); }
    }));
    return {
      async get(k) { const db = await open(); return new Promise((res, rej) => { const q = db.transaction("kv").objectStore("kv").get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); },
      async set(k, v) { const db = await open(); return new Promise((res, rej) => { const tx = db.transaction("kv", "readwrite"); tx.objectStore("kv").put(v, k); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); }
    };
  })();
  QB.imagesReady = IDB.get("images").then(v => { if (v && typeof v === "object") QB.images = v; return QB.images; }).catch(() => QB.images);
  QB.saveImages = async imgs => { QB.images = imgs; try { await IDB.set("images", imgs); return true; } catch (e) { return false; } };
  QB.usedImageIds = text => new Set((String(text).match(/\[\[img:(\w+)\]\]/g) || []).map(s => s.slice(6, -2)));

  /* =================== Nhập file Word =================== */
  QB.ensureImportLibs = async () => {
    if (!window.JSZip) await QB.loadScript(BASE + "lib/jszip.min.js");
    if (!window.CFB) await QB.loadScript(BASE + "lib/cfb.min.js");
    if (!window.MTEF2TeX) await QB.loadScript(BASE + "lib/mtef2tex.js");
    if (!window.DocxImport) await QB.loadScript(BASE + "lib/docx-import.js");
  };
  QB.importDocx = async file => {
    await QB.ensureImportLibs();
    return DocxImport.importDocx(await file.arrayBuffer(), { JSZip, CFB, MTEF2TeX, DOMParser });
  };

  /* =================== Âm thanh cơ bản (Web Audio) =================== */
  QB.audio = (() => {
    let ctx = null, master = null, noiseBuf = null, muted = false;
    function init() {
      if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      ctx = new AC(); master = ctx.createGain(); master.gain.value = muted ? 0 : .7;
      const comp = ctx.createDynamicsCompressor(); master.connect(comp); comp.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    function tone(f, { dur = .2, type = "sine", vol = .3, to = null, delay = 0, attack = .006, vib = 0 } = {}) {
      if (!ctx) return;
      const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      o.connect(g); g.connect(master);
      if (vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = vib; lg.gain.value = f * .06; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + .05); }
      o.start(t); o.stop(t + dur + .05);
    }
    function noise({ dur = .3, vol = .3, type = "lowpass", freq = 1000, to = null, q = 1, delay = 0 } = {}) {
      if (!ctx) return;
      const t = ctx.currentTime + delay, s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(freq, t); if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
      const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + .05);
    }
    const seq = (notes, opt) => notes.forEach(([f, d, dur]) => tone(f, { ...opt, delay: d, dur }));
    return { init, tone, noise, seq, get muted() { return muted; }, toggle() { muted = !muted; if (master) master.gain.value = muted ? 0 : .7; return muted; } };
  })();

  /* =================== Hạt hiệu ứng (canvas phủ toàn màn hình) =================== */
  QB.fx = (() => {
    let c = null, g = null, W = 0, H = 0, parts = [], running = false, last = 0, confettiStop = 0;
    function ensure() {
      if (c) return;
      c = document.createElement("canvas");
      c.style.cssText = "position:fixed;inset:0;z-index:70;pointer-events:none";
      document.body.appendChild(c); g = c.getContext("2d");
      const resize = () => { const dpr = Math.min(window.devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; c.width = W * dpr; c.height = H * dpr; c.style.width = W + "px"; c.style.height = H + "px"; g.setTransform(dpr, 0, 0, dpr, 0, 0); };
      addEventListener("resize", resize); resize();
    }
    function add(p) {
      ensure();
      parts.push(Object.assign({ vx: 0, vy: 0, grav: 0, drag: 1, life: 1, fade: .4, size: 5, rot: 0, vr: 0, shape: "circle", color: "#fff", shrink: false }, p));
      if (parts.length > 1500) parts.splice(0, parts.length - 1500);
      if (!running) { running = true; last = performance.now(); requestAnimationFrame(loop); }
    }
    function loop(t) {
      const dt = Math.min(.05, (t - last) / 1000); last = t;
      g.clearRect(0, 0, W, H);
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]; p.life -= dt;
        if (p.life <= 0) { parts.splice(i, 1); continue; }
        p.vx *= p.drag; p.vy *= p.drag; p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
        const a = Math.min(1, p.life / p.fade); g.globalAlpha = a; g.fillStyle = p.color;
        if (p.shape === "rect") { g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); g.restore(); }
        else if (p.shape === "star") {
          g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.beginPath();
          for (let k = 0; k < 10; k++) { const r = k % 2 ? p.size * .45 : p.size; const an = k * Math.PI / 5; g.lineTo(Math.cos(an) * r, Math.sin(an) * r); }
          g.closePath(); g.fill(); g.restore();
        } else if (p.shape === "ring") { g.strokeStyle = p.color; g.lineWidth = Math.max(1, p.size * .25 * a); g.beginPath(); g.arc(p.x, p.y, p.size * (1.6 - a), 0, Math.PI * 2); g.stroke(); }
        else { g.beginPath(); g.arc(p.x, p.y, Math.max(.5, p.size * (p.shrink ? a : 1)), 0, Math.PI * 2); g.fill(); }
      }
      g.globalAlpha = 1;
      if (parts.length) requestAnimationFrame(loop); else { running = false; g.clearRect(0, 0, W, H); }
    }
    function burst(x, y, { n = 50, colors = ["#fff"], speed = 450, size = [3, 8], life = [.5, 1.1], grav = 700, shape = "circle", drag = .985, up = .25 } = {}) {
      for (let i = 0; i < n; i++) {
        const an = Math.random() * Math.PI * 2, sp = speed * (.3 + Math.random() * .7);
        add({ x, y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp - speed * up, grav, drag, life: QB.rand(life[0], life[1]), fade: .35, size: QB.rand(size[0], size[1]),
          color: QB.pick(colors), shape: shape === "mix" ? QB.pick(["circle", "star", "rect"]) : shape, vr: QB.rand(-10, 10) });
      }
    }
    function confetti(seconds = 3.5) {
      ensure();
      const colors = ["#ef4444", "#f59e0b", "#fde047", "#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#ffffff"];
      const end = performance.now() + seconds * 1000, t0 = performance.now();
      (function spawn() {
        if (confettiStop > t0) return;
        for (let i = 0; i < 8; i++) add({ x: QB.rand(0, W), y: -20, vx: QB.rand(-80, 80), vy: QB.rand(120, 320), grav: 160, drag: .995, life: QB.rand(2.5, 4.5), fade: .6,
          size: QB.rand(9, 16), color: QB.pick(colors), shape: Math.random() < .75 ? "rect" : "star", rot: QB.rand(0, 6), vr: QB.rand(-8, 8) });
        if (performance.now() < end) setTimeout(spawn, 60);
      })();
    }
    return { add, burst, confetti, clear() { parts.length = 0; confettiStop = performance.now(); } };
  })();

  /* =================== Khung "Soạn câu hỏi" dùng chung =================== */
  const EDITOR_CSS = `
.qb-ov{position:fixed;inset:0;z-index:80;display:grid;place-items:center;padding:16px;background:rgba(15,23,42,.55);backdrop-filter:blur(4px);font-family:"Segoe UI",system-ui,Roboto,Arial,sans-serif;color:#0f172a}
.qb-hidden{display:none!important}
.qb-modal{width:min(1320px,100%);height:min(94vh,960px);background:#fff;border-radius:24px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 30px 80px rgba(2,6,23,.45);position:relative;animation:qbIn .3s ease-out}
@keyframes qbIn{from{transform:translateY(24px);opacity:0}to{transform:none;opacity:1}}
.qb-head{display:flex;align-items:center;gap:10px;padding:12px 20px;border-bottom:1px solid #e2e8f0}
.qb-head h2{margin:0;font-size:clamp(18px,1.6vw,26px)}
.qb-x{margin-left:auto;border:0;background:#f1f5f9;border-radius:10px;width:38px;height:38px;font-size:18px;cursor:pointer}
.qb-body{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1.8fr) minmax(0,1fr);gap:18px;padding:14px 20px}
.qb-left{display:flex;flex-direction:column;min-height:0;gap:10px}
.qb-tabs{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.qb-tab{border:0;background:#f1f5f9;border-radius:10px;padding:8px 14px;font:inherit;font-weight:800;color:#334155;cursor:pointer}
.qb-tab.on{background:#0f172a;color:#fff}
.qb-import{margin-left:auto;border:0;border-radius:10px;padding:8px 14px;font:inherit;font-weight:800;background:linear-gradient(180deg,#34d399,#059669);color:#fff;box-shadow:0 3px 0 #047857;cursor:pointer}
.qb-text{flex:1;min-height:0;width:100%;resize:none;border:2px solid #cbd5e1;border-radius:14px;padding:12px 14px;font-family:Consolas,"Cascadia Mono","Courier New",monospace;font-size:14.5px;line-height:1.55;color:#0f172a;background:#f8fafc;box-sizing:border-box}
.qb-text:focus{outline:none;border-color:#3b82f6;background:#fff}
.qb-prev{flex:1;min-height:0;overflow:auto;border:2px solid #cbd5e1;border-radius:14px;padding:12px 14px;background:#f8fafc}
.qb-q{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:10px 14px;margin-bottom:10px;font-size:16px;line-height:1.5}
.qb-q .h{font-weight:900;margin-bottom:4px}
.qb-q .t{font-weight:700;color:#475569;background:#f1f5f9;border-radius:8px;padding:1px 8px;margin-left:6px;font-size:13px}
.qb-q .stem{white-space:pre-line}
.qb-q ul{margin:6px 0 0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:4px 16px}
.qb-q li{padding:2px 6px;border-radius:8px}
.qb-q li.ok{background:#dcfce7;font-weight:700}
.qb-q li b{margin-right:4px}
.qb-q .ans{margin-top:6px;font-weight:700;color:#166534}
.qb-q .exp{margin-top:6px;color:#475569;white-space:pre-line;font-size:14.5px;border-top:1px dashed #e2e8f0;padding-top:6px}
.qb-q img.qimg{max-height:160px;max-width:100%;vertical-align:middle}
.qb-q img.qimg.fig{float:right;max-width:38%;margin:0 0 .4em 1em}
.qb-q.err{background:#fef2f2;border-color:#fecaca}
.qb-status{font-size:14px;line-height:1.5;max-height:8em;overflow:auto;border-radius:12px;padding:8px 12px;background:#f0fdf4;color:#166534;border:1px solid #bbf7d0}
.qb-status.err{background:#fef2f2;color:#991b1b;border-color:#fecaca}
.qb-imp{border:2px solid #34d399;background:#ecfdf5;border-radius:14px;padding:10px 14px;font-size:14.5px;line-height:1.5}
.qb-imp h3{margin:0 0 4px;font-size:16px}
.qb-imp .warn{color:#9a3412;max-height:7em;overflow:auto;margin:4px 0}
.qb-imp .row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
.qb-drop{position:absolute;inset:0;z-index:5;display:grid;place-items:center;background:rgba(16,185,129,.15);border:4px dashed #10b981;border-radius:24px;font-size:28px;font-weight:900;color:#065f46;pointer-events:none}
.qb-right{overflow:auto;display:flex;flex-direction:column;gap:11px;min-height:0}
.qb-right .field label{display:block;font-weight:700;font-size:14px;margin-bottom:4px;color:#334155}
.qb-right .field input,.qb-right .field select{width:100%;box-sizing:border-box;border:2px solid #cbd5e1;border-radius:10px;padding:7px 10px;font:inherit;font-size:15px}
.qb-right .two{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.qb-right .chk{display:flex;gap:8px;align-items:center;font-weight:600;font-size:15px}
.qb-right .chk input{width:18px;height:18px}
.qb-right .tnames{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.qb-right .tnames input{width:100%;box-sizing:border-box;border:2px solid var(--tc);border-radius:10px;padding:5px 8px;font:inherit;font-size:14px}
.qb-right .sec{font-weight:900;font-size:13px;letter-spacing:.06em;color:#64748b;text-transform:uppercase;margin-top:4px}
.qb-hint{background:#f8fafc;border:1px dashed #cbd5e1;border-radius:12px;padding:10px 12px;font-size:13px;line-height:1.55;color:#334155}
.qb-hint pre{margin:6px 0 0;white-space:pre-wrap;font-family:Consolas,"Courier New",monospace;font-size:12.5px;background:#fff;border-radius:8px;padding:8px;border:1px solid #e2e8f0}
.qb-foot{display:flex;gap:10px;align-items:center;padding:12px 20px;border-top:1px solid #e2e8f0;flex-wrap:wrap}
.qb-foot .sp{flex:1}
.qb-btn{border:0;border-radius:12px;padding:10px 18px;font:inherit;font-weight:800;font-size:15px;cursor:pointer}
.qb-btn.primary{background:#2563eb;color:#fff}
.qb-btn.ghost{background:#f1f5f9;color:#0f172a}
.qb-btn.green{background:#059669;color:#fff}
.qb-noimg{background:#f1f5f9;border-radius:8px;padding:0 6px;color:#64748b}
@media (max-width:820px){.qb-body{grid-template-columns:1fr}}`;
  const EDITOR_HTML = `
<div class="qb-modal" role="dialog" aria-label="Soạn câu hỏi">
  <div class="qb-head"><h2>✎ Soạn câu hỏi &amp; cài đặt</h2><button class="qb-x" data-qb="close" title="Đóng (Esc)">✕</button></div>
  <div class="qb-body">
    <div class="qb-left">
      <div class="qb-tabs">
        <button class="qb-tab on" data-qb="tabText">✎ Soạn dạng chữ</button>
        <button class="qb-tab" data-qb="tabPrev">👁 Xem trước</button>
        <button class="qb-import" data-qb="import" title="Đề Word có công thức MathType / Equation, đáp án gạch chân hoặc tô đỏ">📄 Nhập file Word (.docx)</button>
        <input type="file" class="qb-hidden" data-qb="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document">
      </div>
      <div class="qb-imp qb-hidden" data-qb="imp"></div>
      <textarea class="qb-text" data-qb="text" spellcheck="false"></textarea>
      <div class="qb-prev qb-hidden" data-qb="prev"></div>
      <div class="qb-status" data-qb="status"></div>
    </div>
    <div class="qb-right">
      <div data-qb="settings"></div>
      <div class="qb-hint">
        <b>Nhập file Word:</b> đề theo mẫu TN MIX (PHẦN I, II, III). Đáp án đúng <b>gạch chân</b> hoặc <b>tô đỏ</b> chữ A/B/C/D; ý Đúng ở phần II gạch chân a), b)…; phần III ghi “Đáp án: …” (hoặc “A. 22,4”). Công thức MathType, Equation 3.0 và công thức Word được chuyển tự động, không cần mạng.
        <br><b>Tự gõ:</b>
<pre>Câu 1: Đạo hàm của $y = x^2$ là
A. $2x$
B. $x$
C. $2$
D. $x^2$
Đáp án: A
Giải: $(x^n)' = n x^{n-1}$

Câu 2 [Đúng/Sai]: Cho $f(x)=x^2$.
a) $f(1)=1$
b) $f(-1)=-1$
Đáp án: Đ S

Câu 3 [Trả lời ngắn]: $2^{10}$ bằng?
Đáp án: 1024</pre>
      </div>
    </div>
  </div>
  <div class="qb-foot">
    <button class="qb-btn ghost" data-qb="reset">Khôi phục câu mẫu</button>
    <span class="sp"></span>
    <button class="qb-btn ghost" data-qb="cancel">Huỷ</button>
    <button class="qb-btn primary" data-qb="save">Lưu &amp; về màn hình bắt đầu</button>
  </div>
  <div class="qb-drop qb-hidden" data-qb="drop">Thả file Word (.docx) vào đây</div>
</div>`;
  let ED = null;  // { root, el(name), opts, images, pending }
  function buildEditor() {
    if (ED) return ED;
    const st = document.createElement("style"); st.textContent = EDITOR_CSS; document.head.appendChild(st);
    const root = document.createElement("div"); root.className = "qb-ov qb-hidden"; root.innerHTML = EDITOR_HTML; document.body.appendChild(root);
    const el = n => root.querySelector(`[data-qb="${n}"]`);
    ED = { root, el, opts: {}, images: {}, pending: null };
    el("close").onclick = () => closeEditor(false);
    el("cancel").onclick = () => closeEditor(false);
    el("save").onclick = () => closeEditor(true);
    el("tabText").onclick = () => setTab("text");
    el("tabPrev").onclick = () => setTab("prev");
    el("import").onclick = () => el("file").click();
    el("file").onchange = e => { importFile(e.target.files[0]); e.target.value = ""; };
    el("text").addEventListener("input", check);
    el("text").addEventListener("keydown", e => { if (e.key === "Tab") { e.preventDefault(); const t = e.target, p = t.selectionStart; t.setRangeText("  ", p, t.selectionEnd, "end"); } });
    el("settings").addEventListener("input", check);
    el("settings").addEventListener("change", check);
    el("reset").onclick = () => {
      if (!confirm("Thay toàn bộ nội dung bằng câu mẫu" + (ED.opts.reset ? " và cài đặt mặc định" : "") + "?")) return;
      el("text").value = QB.DEFAULT_TEXT;
      if (ED.opts.reset) ED.opts.reset(el("settings"));
      check(); if (!el("prev").classList.contains("qb-hidden")) renderPreview();
    };
    const modal = root.querySelector(".qb-modal"), hint = el("drop"); let depth = 0;
    modal.addEventListener("dragenter", e => { if ([...e.dataTransfer.types].includes("Files")) { depth++; hint.classList.remove("qb-hidden"); } });
    modal.addEventListener("dragleave", () => { depth = Math.max(0, depth - 1); if (!depth) hint.classList.add("qb-hidden"); });
    modal.addEventListener("dragover", e => e.preventDefault());
    modal.addEventListener("drop", e => { e.preventDefault(); depth = 0; hint.classList.add("qb-hidden"); const f = e.dataTransfer.files[0]; if (f) importFile(f); });
    addEventListener("keydown", e => { if (QB.editorOpen() && e.key === "Escape") closeEditor(false); }, true);
    return ED;
  }
  QB.editorOpen = () => !!ED && !ED.root.classList.contains("qb-hidden");
  /*
   * opts: { title, settingsHtml, fill(rootEl), read(rootEl) -> settings, warnings(parseResult, settings) -> string[],
   *         reset(rootEl), onSave(settings), onClose(saved) }
   */
  QB.openEditor = async function (opts = {}) {
    buildEditor();
    await QB.imagesReady;
    ED.opts = opts;
    ED.images = { ...QB.images };
    ED.pending = null;
    ED.root.querySelector(".qb-head h2").textContent = opts.title || "✎ Soạn câu hỏi & cài đặt";
    ED.el("imp").classList.add("qb-hidden");
    ED.el("text").value = QB.getText();
    ED.el("settings").innerHTML = opts.settingsHtml || "";
    if (opts.fill) opts.fill(ED.el("settings"));
    ED.root.classList.remove("qb-hidden");
    setTab("text");
    check();
    ED.el("text").focus();
  };
  function readSettings() { return ED.opts.read ? ED.opts.read(ED.el("settings")) : {}; }
  function check() {
    const r = QB.parse(ED.el("text").value);
    const c = { mc: 0, tf: 0, short: 0 }; r.questions.forEach(q => c[q.type]++);
    const rounds = QB.countRounds(r.questions);
    let html = `✔ Đọc được <b>${r.questions.length}</b> câu hợp lệ (${c.mc} trắc nghiệm, ${c.tf} đúng/sai, ${c.short} trả lời ngắn) → <b>${rounds}</b> lượt chơi.`;
    const warn = [...r.errors];
    if (ED.opts.warnings) { try { warn.push(...ED.opts.warnings(r, readSettings(), rounds)); } catch (e) {} }
    if (!r.questions.length) warn.unshift("Chưa có câu hỏi hợp lệ nào.");
    if (warn.length) html += "<br>⚠ " + warn.map(esc).join("<br>⚠ ");
    const el = ED.el("status"); el.innerHTML = html; el.classList.toggle("err", warn.length > 0);
    return r;
  }
  function setTab(t) {
    ED.el("tabText").classList.toggle("on", t === "text"); ED.el("tabPrev").classList.toggle("on", t === "prev");
    ED.el("text").classList.toggle("qb-hidden", t !== "text"); ED.el("prev").classList.toggle("qb-hidden", t !== "prev");
    if (t === "prev") renderPreview();
  }
  function renderPreview() {
    const r = QB.parse(ED.el("text").value), im = ED.images;
    const TY = { mc: "Trắc nghiệm", tf: "Đúng/Sai", short: "Trả lời ngắn" };
    const html = r.questions.map((q, i) => {
      let b = `<div class="stem">${QB.rich(q.q, im)}</div>`;
      if (q.type === "mc") b += `<ul>${q.opts.map((o, k) => `<li class="${k === q.ans ? "ok" : ""}"><b>${LETTERS[k]}.</b>${QB.rich(o, im)}</li>`).join("")}</ul>`;
      else if (q.type === "tf") b += `<ul>${q.st.map((s, k) => `<li class="${q.truth[k] ? "ok" : ""}"><b>${"abcdef"[k]})</b>${QB.rich(s, im)} — <i>${q.truth[k] ? "Đúng" : "Sai"}</i></li>`).join("")}</ul>`;
      else b += `<div class="ans">Đáp án: ${QB.rich(q.answer, im)}</div>`;
      if (q.exp) b += `<div class="exp"><b>Giải:</b> ${QB.rich(q.exp, im)}</div>`;
      return `<div class="qb-q"><div class="h">Câu ${i + 1}<span class="t">${TY[q.type]}</span></div>${b}</div>`;
    }).join("") + (r.errors.length ? `<div class="qb-q err"><b>Câu chưa hợp lệ (không đưa vào trận):</b><br>${r.errors.map(esc).join("<br>")}</div>` : "");
    const pv = ED.el("prev"); pv.innerHTML = html || "<p>Chưa có câu hỏi.</p>"; QB.renderMath(pv);
  }
  async function importFile(file) {
    if (!file) return;
    if (!/\.docx$/i.test(file.name)) { alert("Chỉ nhận file Word dạng .docx (nếu là .doc, hãy mở bằng Word rồi Lưu thành .docx)."); return; }
    const box = ED.el("imp");
    box.classList.remove("qb-hidden");
    box.innerHTML = `<h3>⏳ Đang đọc “${esc(file.name)}”…</h3>`;
    try {
      const res = await QB.importDocx(file);
      const c = { mc: 0, tf: 0, short: 0 }; res.questions.forEach(q => c[q.type]++);
      const s = res.stats;
      if (!res.questions.length) { box.innerHTML = `<h3>⚠ Không tìm thấy câu hỏi nào trong “${esc(file.name)}”.</h3>Hãy kiểm tra file có các dòng “Câu 1.”, “A.”, “B.”… hoặc câu đánh số tự động.`; return; }
      ED.pending = res;
      box.innerHTML = `<h3>📄 ${esc(file.name)}: đọc được ${res.questions.length} câu</h3>
        ${c.mc} trắc nghiệm · ${c.tf} đúng/sai · ${c.short} trả lời ngắn · ${s.mathtype} công thức MathType${s.omml ? " · " + s.omml + " công thức Word" : ""} · ${s.images} ảnh
        ${s.mathFail ? `<br>⚠ ${s.mathFail} công thức không đọc được (hiện “[?]” — sửa tay trong ô soạn).` : ""}
        ${s.imgSkipped ? `<br>⚠ ${s.imgSkipped} hình dạng WMF/EMF không hiển thị được trên trình duyệt (đã bỏ qua).` : ""}
        ${s.warnings.length ? `<div class="warn">⚠ ${s.warnings.map(esc).join("<br>⚠ ")}</div>` : ""}
        <div class="row"><button class="qb-btn green" data-act="replace">Thay toàn bộ câu hỏi</button><button class="qb-btn ghost" data-act="append">Thêm vào cuối</button><button class="qb-btn ghost" data-act="cancel">Bỏ qua</button></div>`;
      box.querySelector('[data-act="replace"]').onclick = () => applyImport(false);
      box.querySelector('[data-act="append"]').onclick = () => applyImport(true);
      box.querySelector('[data-act="cancel"]').onclick = () => { ED.pending = null; box.classList.add("qb-hidden"); };
    } catch (e) {
      console.error(e);
      box.innerHTML = `<h3>⚠ Không đọc được file.</h3>${esc(e.message || e)}<br>Hãy chắc chắn đây là file .docx (Word 2007 trở lên).`;
    }
  }
  QB.importFileInEditor = importFile;
  function applyImport(append) {
    if (!ED.pending) return;
    Object.assign(ED.images, ED.pending.images);
    const ta = ED.el("text");
    ta.value = append && ta.value.trim() ? ta.value.trim() + "\n\n" + ED.pending.text : ED.pending.text;
    ED.pending = null;
    ED.el("imp").classList.add("qb-hidden");
    check(); setTab("prev");
  }
  QB.applyImportInEditor = applyImport;
  async function closeEditor(save) {
    let settings = null;
    if (save) {
      const r = check();
      if (!r.questions.length) { alert("Chưa có câu hỏi hợp lệ nào. Vui lòng kiểm tra lại."); return; }
      const text = ED.el("text").value;
      QB.saveText(text);
      settings = readSettings();
      const used = QB.usedImageIds(text), imgs = {};
      for (const id of used) if (ED.images[id]) imgs[id] = ED.images[id];
      const ok = await QB.saveImages(imgs);
      if (!ok && used.size) alert("Không lưu được ảnh vào trình duyệt — ảnh chỉ hiện trong lần mở này.");
      if (ED.opts.onSave) ED.opts.onSave(settings);
    }
    ED.root.classList.add("qb-hidden");
    if (ED.opts.onClose) ED.opts.onClose(!!save);
  }
  QB.closeEditor = closeEditor;

  root.QB = QB;
})(window);
