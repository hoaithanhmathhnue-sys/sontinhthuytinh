/*
 * mtef2tex.js — Chuyển công thức MathType / Equation Editor 3.0 (luồng "Equation Native",
 * định dạng MTEF v3 và v5) sang LaTeX để hiển thị bằng KaTeX. Chạy hoàn toàn offline.
 * Dùng: MTEF2TeX.convert(Uint8Array của luồng Equation Native) -> { tex, source, unknown[] }
 */
(function (root) {
  "use strict";

  /* ---------------- Bảng ký tự ---------------- */
  const SYM = {
    0x2212: "-", 0x2013: "-", 0x00B1: "\\pm ", 0x2213: "\\mp ", 0x00D7: "\\times ", 0x00F7: "\\div ",
    0x22C5: "\\cdot ", 0x00B7: "\\cdot ", 0x2219: "\\cdot ", 0x2022: "\\bullet ", 0x2217: "*", 0x2218: "\\circ ",
    0x2264: "\\le ", 0x2265: "\\ge ", 0x2260: "\\ne ", 0x2248: "\\approx ", 0x2261: "\\equiv ", 0x223C: "\\sim ",
    0x2245: "\\cong ", 0x2243: "\\simeq ", 0x221D: "\\propto ", 0x226A: "\\ll ", 0x226B: "\\gg ", 0x2266: "\\leqq ", 0x2267: "\\geqq ",
    0x2192: "\\to ", 0x2190: "\\leftarrow ", 0x2194: "\\leftrightarrow ", 0x21D2: "\\Rightarrow ", 0x21D0: "\\Leftarrow ",
    0x21D4: "\\Leftrightarrow ", 0x2191: "\\uparrow ", 0x2193: "\\downarrow ", 0x21A6: "\\mapsto ", 0x27F9: "\\Longrightarrow ",
    0x27FA: "\\Longleftrightarrow ", 0x21C4: "\\rightleftarrows ", 0x21CC: "\\rightleftharpoons ",
    0x2208: "\\in ", 0x2209: "\\notin ", 0x220B: "\\ni ", 0x2282: "\\subset ", 0x2283: "\\supset ", 0x2286: "\\subseteq ",
    0x2287: "\\supseteq ", 0x2284: "\\not\\subset ", 0x2285: "\\not\\supset ", 0x2288: "\\nsubseteq ", 0x228A: "\\subsetneq ",
    0x222A: "\\cup ", 0x2229: "\\cap ", 0x2205: "\\varnothing ", 0x00D8: "\\varnothing ", 0x2216: "\\setminus ",
    0x2200: "\\forall ", 0x2203: "\\exists ", 0x2204: "\\nexists ", 0x00AC: "\\neg ", 0x2227: "\\wedge ", 0x2228: "\\vee ",
    0x221E: "\\infty ", 0x2202: "\\partial ", 0x2207: "\\nabla ", 0x2206: "\\Delta ", 0x2220: "\\angle ", 0x2221: "\\measuredangle ",
    0x22A5: "\\perp ", 0x27C2: "\\perp ", 0x2225: "\\parallel ", 0x2226: "\\nparallel ", 0x2026: "\\ldots ", 0x22EF: "\\cdots ",
    0x22EE: "\\vdots ", 0x22F1: "\\ddots ", 0x2032: "'", 0x2033: "''", 0x2034: "'''", 0x00B0: "^{\\circ}",
    0x211D: "\\mathbb{R}", 0x2115: "\\mathbb{N}", 0x2124: "\\mathbb{Z}", 0x211A: "\\mathbb{Q}", 0x2102: "\\mathbb{C}",
    0x2211: "\\sum ", 0x220F: "\\prod ", 0x2210: "\\coprod ", 0x222B: "\\int ", 0x222C: "\\iint ", 0x222D: "\\iiint ", 0x222E: "\\oint ",
    0x22C3: "\\bigcup ", 0x22C2: "\\bigcap ", 0x221A: "\\surd ", 0x2295: "\\oplus ", 0x2297: "\\otimes ", 0x2299: "\\odot ",
    0x2329: "\\langle ", 0x232A: "\\rangle ", 0x27E8: "\\langle ", 0x27E9: "\\rangle ", 0x2016: "\\| ",
    0x230A: "\\lfloor ", 0x230B: "\\rfloor ", 0x2308: "\\lceil ", 0x2309: "\\rceil ", 0x2113: "\\ell ", 0x210F: "\\hbar ",
    0x25B3: "\\triangle ", 0x25A1: "\\square ", 0x2235: "\\because ", 0x2234: "\\therefore ",
    0x2223: "\\mid ", 0x2224: "\\nmid ", 0x226E: "\\not< ", 0x226F: "\\not> ", 0x2270: "\\nleq ", 0x2271: "\\ngeq ",
    0x21C0: "\\rightharpoonup ", 0x2322: "\\frown ", 0x2323: "\\smile ",
    0x2003: "\\quad ", 0x2002: "\\enspace ", 0x2009: "\\,", 0x200A: "\\,", 0x2005: "\\;", 0x2006: "\\,", 0x200B: "", 0x00A0: "~",
    0x2061: "", 0x2062: "", 0x2063: "", 0x2064: "", 0x0300: "", 0x2044: "/", 0x2215: "/", 0x2012: "-", 0x2014: "-",
    0x2018: "`", 0x2019: "'", 0x201C: "``", 0x201D: "''"
  };
  // Khoảng trắng & ký hiệu vùng riêng của MathType (MT Extra)
  const PUA = {
    0xEF00: "", 0xEF01: "\\,", 0xEF02: "\\,", 0xEF03: "\\:", 0xEF04: "\\;", 0xEF05: "\\quad ", 0xEF06: "\\qquad ",
    0xEF07: "", 0xEF08: "\\,", 0xEF09: "\\!", 0xEF0A: "", 0xEF0B: "",
    0xEB00: "", 0xEB01: "", 0xEC00: "\\to ", 0xEC01: "\\leftarrow ", 0xEC02: "\\leftrightarrow ", 0xEE00: "", 0xEE01: "",
    0xE900: "\\cdots ", 0xE901: "\\ldots ", 0xE902: "\\vdots ", 0xE903: "\\ddots ", 0xE904: "\\ddots ",
    0xF8E7: "-", 0xF8F1: "", 0xF8F2: "", 0xF8F3: "", 0xF8F4: "", 0xF8F5: "", 0xF8F6: "", 0xF8F7: "", 0xF8F8: "", 0xF8F9: "",
    0xF8FA: "", 0xF8FB: "", 0xF8FC: "", 0xF8FD: "", 0xF8FE: ""
  };
  const GREEK = {
    0x03B1: "alpha", 0x03B2: "beta", 0x03B3: "gamma", 0x03B4: "delta", 0x03B5: "varepsilon", 0x03F5: "epsilon",
    0x03B6: "zeta", 0x03B7: "eta", 0x03B8: "theta", 0x03D1: "vartheta", 0x03B9: "iota", 0x03BA: "kappa",
    0x03BB: "lambda", 0x03BC: "mu", 0x03BD: "nu", 0x03BE: "xi", 0x03BF: "o", 0x03C0: "pi", 0x03D6: "varpi",
    0x03C1: "rho", 0x03F1: "varrho", 0x03C3: "sigma", 0x03C2: "varsigma", 0x03C4: "tau", 0x03C5: "upsilon",
    0x03C6: "varphi", 0x03D5: "phi", 0x03C7: "chi", 0x03C8: "psi", 0x03C9: "omega",
    0x0393: "Gamma", 0x0394: "Delta", 0x0398: "Theta", 0x039B: "Lambda", 0x039E: "Xi", 0x03A0: "Pi",
    0x03A3: "Sigma", 0x03A5: "Upsilon", 0x03A6: "Phi", 0x03A8: "Psi", 0x03A9: "Omega", 0x2126: "Omega", 0x00B5: "mu"
  };
  const GREEK_UP_LATIN = { 0x0391: "A", 0x0392: "B", 0x0395: "E", 0x0396: "Z", 0x0397: "H", 0x0399: "I", 0x039A: "K", 0x039C: "M", 0x039D: "N", 0x039F: "O", 0x03A1: "P", 0x03A4: "T", 0x03A7: "X" };
  // Font Symbol (Equation Editor 3.0 lưu mã 8-bit của font Symbol)
  const SYMBOL_FONT = {
    0x22: 0x2200, 0x24: 0x2203, 0x27: 0x220B, 0x2A: 0x2217, 0x2D: 0x2212, 0x40: 0x2245,
    0x41: 0x0391, 0x42: 0x0392, 0x43: 0x03A7, 0x44: 0x0394, 0x45: 0x0395, 0x46: 0x03A6, 0x47: 0x0393, 0x48: 0x0397, 0x49: 0x0399,
    0x4A: 0x03D1, 0x4B: 0x039A, 0x4C: 0x039B, 0x4D: 0x039C, 0x4E: 0x039D, 0x4F: 0x039F, 0x50: 0x03A0, 0x51: 0x0398, 0x52: 0x03A1,
    0x53: 0x03A3, 0x54: 0x03A4, 0x55: 0x03A5, 0x56: 0x03C2, 0x57: 0x03A9, 0x58: 0x039E, 0x59: 0x03A8, 0x5A: 0x0396, 0x5C: 0x2234,
    0x5E: 0x22A5, 0x61: 0x03B1, 0x62: 0x03B2, 0x63: 0x03C7, 0x64: 0x03B4, 0x65: 0x03B5, 0x66: 0x03C6, 0x67: 0x03B3, 0x68: 0x03B7,
    0x69: 0x03B9, 0x6A: 0x03D5, 0x6B: 0x03BA, 0x6C: 0x03BB, 0x6D: 0x03BC, 0x6E: 0x03BD, 0x6F: 0x03BF, 0x70: 0x03C0, 0x71: 0x03B8,
    0x72: 0x03C1, 0x73: 0x03C3, 0x74: 0x03C4, 0x75: 0x03C5, 0x76: 0x03D6, 0x77: 0x03C9, 0x78: 0x03BE, 0x79: 0x03C8, 0x7A: 0x03B6,
    0x7E: 0x223C, 0xA2: 0x2032, 0xA3: 0x2264, 0xA5: 0x221E, 0xAB: 0x2194, 0xAC: 0x2190, 0xAD: 0x2191, 0xAE: 0x2192, 0xAF: 0x2193,
    0xB0: 0x00B0, 0xB1: 0x00B1, 0xB2: 0x2033, 0xB3: 0x2265, 0xB4: 0x00D7, 0xB5: 0x221D, 0xB6: 0x2202, 0xB7: 0x2022, 0xB8: 0x00F7,
    0xB9: 0x2260, 0xBA: 0x2261, 0xBB: 0x2248, 0xBC: 0x2026, 0xC4: 0x2297, 0xC5: 0x2295, 0xC6: 0x2205, 0xC7: 0x2229, 0xC8: 0x222A,
    0xC9: 0x2283, 0xCA: 0x2287, 0xCB: 0x2284, 0xCC: 0x2282, 0xCD: 0x2286, 0xCE: 0x2208, 0xCF: 0x2209, 0xD0: 0x2220, 0xD1: 0x2207,
    0xD6: 0x221A, 0xD7: 0x22C5, 0xD8: 0x00AC, 0xD9: 0x2227, 0xDA: 0x2228, 0xDB: 0x21D4, 0xDC: 0x21D0, 0xDD: 0x21D1, 0xDE: 0x21D2,
    0xDF: 0x21D3, 0xE1: 0x2329, 0xE5: 0x2211, 0xF1: 0x232A, 0xF2: 0x222B
  };
  const FUNCS = new Set(["sin", "cos", "tan", "cot", "sec", "csc", "log", "ln", "lg", "lim", "max", "min", "exp", "sinh", "cosh",
    "tanh", "coth", "arcsin", "arccos", "arctan", "sup", "inf", "det", "gcd", "deg", "dim", "ker", "arg", "Pr", "hom", "liminf", "limsup"]);

  /* ---------------- Đọc nhị phân ---------------- */
  class Reader {
    constructor(b, p) { this.b = b; this.p = p || 0; }
    get eof() { return this.p >= this.b.length; }
    u8() { if (this.p >= this.b.length) throw new Error("EOF"); return this.b[this.p++]; }
    u16() { const v = this.b[this.p] | (this.b[this.p + 1] << 8); this.p += 2; if (this.p > this.b.length) throw new Error("EOF"); return v; }
    str() { let s = ""; for (;;) { const c = this.u8(); if (!c) return s; s += String.fromCharCode(c); } }
  }

  /* ---------------- Phân tích MTEF v5 ---------------- */
  function parseV5(r, ctx) {
    function nudge(opt) { if (opt & 0x08) { const dx = r.u8(), dy = r.u8(); if (dx === 128 && dy === 128) { r.u16(); r.u16(); } } }
    function ruler() { const tag = r.u8(); if (tag !== 7) throw new Error("ruler"); const n = r.u8(); for (let i = 0; i < n; i++) { r.u8(); r.u16(); } }
    function dims() { const n = r.u8(); let cnt = 0, hi = true, byte = 0; const nib = () => { if (hi) { byte = r.u8(); hi = false; return byte >> 4; } hi = true; return byte & 15; }; while (cnt < n) { nib(); for (;;) { if (nib() === 15) break; } cnt++; } }
    // Đọc 1 bản ghi; trả về nút cấu trúc hoặc null (bản ghi định nghĩa / bỏ qua), hoặc "END"
    function record() {
      const start = r.p;
      const tag = r.u8();
      switch (tag) {
        case 0: return "END";
        case 1: { // LINE
          const o = r.u8(); nudge(o);
          if (o & 0x04) r.u16();
          if (o & 0x02) ruler();
          if (o & 0x01) return { t: "line", nul: true, items: [] };
          return { t: "line", items: list() };
        }
        case 2: { // CHAR
          const o = r.u8(); nudge(o);
          const tf = r.u8() - 128;
          let code = null;
          if (!(o & 0x20)) code = r.u16();
          let f8 = null, f16 = null;
          if (o & 0x04) f8 = r.u8();
          if (o & 0x10) f16 = r.u16();
          if (code === null) code = f16 !== null ? f16 : (f8 !== null ? f8 : 32);
          const ch = { t: "char", tf, code, emb: [], fstart: !!(o & 0x02) };
          if (o & 0x01) { for (;;) { const e = record(); if (e === "END") break; if (e && e.t === "emb") ch.emb.push(e.e); } }
          return ch;
        }
        case 3: { // TMPL
          const o = r.u8(); nudge(o);
          const sel = r.u8();
          let v = r.u8(); if (v & 0x80) { v = (v & 0x7F) | (r.u8() << 8); }
          r.u8(); // template options
          return { t: "tmpl", sel, v, items: list() };
        }
        case 4: { // PILE
          const o = r.u8(); nudge(o);
          const ha = r.u8(); r.u8();
          if (o & 0x02) ruler();
          return { t: "pile", ha, items: list() };
        }
        case 5: { // MATRIX
          const o = r.u8(); nudge(o);
          r.u8(); const hj = r.u8(); r.u8();
          const rows = r.u8(), cols = r.u8();
          r.p += Math.ceil((rows + 1) * 2 / 8) + Math.ceil((cols + 1) * 2 / 8);
          return { t: "matrix", rows, cols, hj, items: list() };
        }
        case 6: { const o = r.u8(); nudge(o); return { t: "emb", e: r.u8() }; }
        case 7: { const n = r.u8(); for (let i = 0; i < n; i++) { r.u8(); r.u16(); } return null; }
        case 8: { r.u8(); r.u8(); return null; } // FONT_STYLE_DEF
        case 9: { const l = r.u8(); if (l === 101) r.u16(); else if (l === 100) { r.u8(); r.u16(); } else r.u8(); return null; }
        case 10: case 11: case 12: case 13: case 14: return null;
        case 15: { r.u8(); return null; } // COLOR
        case 16: { const o = r.u8(); const n = (o & 1) ? 4 : 3; for (let i = 0; i < n; i++) r.u16(); if (o & 4) r.str(); return null; }
        case 17: { r.u8(); r.str(); return null; } // FONT_DEF
        case 18: { r.u8(); dims(); dims(); const n = r.u8(); for (let i = 0; i < n; i++) { if (r.u8()) r.u8(); } return null; } // EQN_PREFS
        case 19: { r.str(); return null; } // ENCODING_DEF
        default: {
          if (tag >= 100) { // bản ghi mở rộng: [tag][độ dài][dữ liệu]; MathType 7 lưu mã TeX gốc ở đây
            const len = r.u8();
            let peek = ""; for (let i = 0; i < 18 && r.p + i < r.b.length; i++) peek += String.fromCharCode(r.b[r.p + i]);
            if (peek === "TeX Input Language") { r.str(); const t = r.str(); if (t) ctx.texSource = decodeUtf8(t); }
            else r.p += len;
            return null;
          }
          throw new Error("Bản ghi lạ " + tag + " tại " + start);
        }
      }
    }
    function list() { const out = []; for (;;) { if (r.eof) return out; const x = record(); if (x === "END") return out; if (x) out.push(x); } }
    const top = [];
    while (!r.eof) { const x = record(); if (x === "END") continue; if (x) top.push(x); }
    return top;
  }

  /* ---------------- Phân tích MTEF v3 (Equation Editor 3.0) ---------------- */
  function parseV3(r) {
    function nudge(o) { if (o & 0x8) { const dx = r.u8(), dy = r.u8(); if (dx === 128 && dy === 128) { r.u16(); r.u16(); } } }
    function rulerRec() { const n = r.u8(); for (let i = 0; i < n; i++) { r.u8(); r.u16(); } }
    function record() {
      const tagb = r.u8(); const tag = tagb & 0x0F, o = tagb >> 4;
      switch (tag) {
        case 0: return "END";
        case 1: { nudge(o); if (o & 0x4) r.u16(); if (o & 0x2) { r.u8(); rulerRec(); } if (o & 0x1) return { t: "line", nul: true, items: [] }; return { t: "line", items: list() }; }
        case 2: { nudge(o); const tf = r.u8() - 128; let code = r.u16(); if (tf === 6 || (tf < 0 && code < 256)) { if (SYMBOL_FONT[code]) code = SYMBOL_FONT[code]; }
          const ch = { t: "char", tf, code, emb: [] };
          if (o & 0x2) { for (;;) { const e = record(); if (e === "END") break; if (e && e.t === "emb") ch.emb.push(e.e); } }
          return ch; }
        case 3: { nudge(o); const sel = r.u8(), v = r.u8(); r.u8(); return { t: "tmpl", sel, v, items: list() }; }
        case 4: { nudge(o); const ha = r.u8(); r.u8(); if (o & 0x2) { r.u8(); rulerRec(); } return { t: "pile", ha, items: list() }; }
        case 5: { nudge(o); r.u8(); const hj = r.u8(); r.u8(); const rows = r.u8(), cols = r.u8(); r.p += Math.ceil((rows + 1) * 2 / 8) + Math.ceil((cols + 1) * 2 / 8); return { t: "matrix", rows, cols, hj, items: list() }; }
        case 6: { nudge(o); return { t: "emb", e: r.u8() }; }
        case 7: { rulerRec(); return null; }
        case 8: { r.u8(); r.u8(); r.str(); return null; }
        case 9: { const l = r.u8(); if (l === 101) r.u16(); else if (l === 100) { r.u8(); r.u16(); } else r.u8(); return null; }
        case 10: case 11: case 12: case 13: case 14: return null;
        default: throw new Error("Bản ghi v3 lạ " + tag);
      }
    }
    function list() { const out = []; for (;;) { if (r.eof) return out; const x = record(); if (x === "END") return out; if (x) out.push(x); } }
    const top = [];
    while (!r.eof) { const x = record(); if (x === "END") continue; if (x) top.push(x); }
    return top;
  }

  function decodeUtf8(s) {
    try { const bytes = new Uint8Array([...s].map(c => c.charCodeAt(0))); return new TextDecoder("utf-8").decode(bytes); } catch (e) { return s; }
  }

  /* ---------------- Sinh LaTeX ---------------- */
  function Gen(unknown) {
    const isLetter = c => (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
    const escText = s => s.replace(/[\\{}$&#%_^~]/g, m => ({ "\\": "\\backslash ", "{": "\\{", "}": "\\}", "$": "\\$", "&": "\\&", "#": "\\#", "%": "\\%", "_": "\\_", "^": "\\^{}", "~": "\\~{}" }[m]));

    function charTex(ch) {
      let c = ch.code;
      const tf = ch.tf;
      if (PUA[c] !== undefined) return PUA[c];
      if (GREEK[c]) return "\\" + GREEK[c] + " ";
      if (GREEK_UP_LATIN[c]) return GREEK_UP_LATIN[c];
      if (SYM[c] !== undefined) return SYM[c];
      if (c < 128) {
        const s = String.fromCharCode(c);
        if (isLetter(c)) return tf === 7 ? "\\mathbf{" + s + "}" : s;
        if (c === 32) return "";
        switch (s) {
          case "{": return "\\{"; case "}": return "\\}"; case "%": return "\\%"; case "#": return "\\#";
          case "&": return "\\&"; case "$": return "\\$"; case "_": return "\\_"; case "~": return "\\sim ";
          case "\\": return "\\backslash "; case "^": return "\\wedge "; case "<": return "<"; case ">": return ">";
        }
        return s;
      }
      if (c >= 0xE000 && c <= 0xF8FF) { unknown.push(c); return ""; }
      // chữ có dấu tiếng Việt hoặc ký tự khác
      if (/\p{L}/u.test(String.fromCodePoint(c))) return "\\text{" + String.fromCodePoint(c) + "}";
      unknown.push(c);
      return String.fromCodePoint(c);
    }
    function embellish(tex, embs) {
      for (const e of embs) {
        switch (e) {
          case 2: tex = "\\dot{" + tex + "}"; break;
          case 3: tex = "\\ddot{" + tex + "}"; break;
          case 4: tex = "\\dddot{" + tex + "}"; break;
          case 5: tex = tex + "'"; break;
          case 6: tex = tex + "''"; break;
          case 7: tex = "{}'" + tex; break;
          case 8: tex = "\\tilde{" + tex + "}"; break;
          case 9: tex = "\\hat{" + tex + "}"; break;
          case 10: tex = tex.trim() === "=" ? "\\ne " : "\\not " + tex; break;
          case 11: tex = "\\vec{" + tex + "}"; break;
          case 12: tex = "\\overleftarrow{" + tex + "}"; break;
          case 13: tex = "\\overleftrightarrow{" + tex + "}"; break;
          case 14: tex = "\\overset{\\rightharpoonup}{" + tex + "}"; break;
          case 15: tex = "\\overset{\\leftharpoonup}{" + tex + "}"; break;
          case 16: tex = "\\cancel{" + tex + "}"; break;
          case 17: tex = "\\overline{" + tex + "}"; break;
          case 18: tex = tex + "'''"; break;
          case 19: tex = "\\overset{\\frown}{" + tex + "}"; break;
          case 20: tex = "\\overset{\\smile}{" + tex + "}"; break;
          case 21: tex = "\\cancel{" + tex + "}"; break;
          case 24: tex = "\\ddot{" + tex + "}"; break;
          case 25: case 26: case 27: case 28: tex = "\\underset{.}{" + tex + "}"; break;
          case 29: tex = "\\underline{" + tex + "}"; break;
          case 30: tex = "\\utilde{" + tex + "}"; break;
          case 33: tex = "\\underrightarrow{" + tex + "}"; break;
          case 34: tex = "\\underleftarrow{" + tex + "}"; break;
          case 35: tex = "\\underleftrightarrow{" + tex + "}"; break;
          default: break;
        }
      }
      return tex;
    }
    function fenceTex(ch, left) {
      if (!ch) return ".";
      const c = ch.code;
      const m = { 0x28: "(", 0x29: ")", 0x5B: "[", 0x5D: "]", 0x7B: "\\{", 0x7D: "\\}", 0x7C: "|", 0x2016: "\\|", 0x2225: "\\|",
        0x27E8: "\\langle", 0x27E9: "\\rangle", 0x2329: "\\langle", 0x232A: "\\rangle", 0x3008: "\\langle", 0x3009: "\\rangle",
        0x230A: "\\lfloor", 0x230B: "\\rfloor", 0x2308: "\\lceil", 0x2309: "\\rceil", 0x27E6: "[\\![", 0x27E7: "]\\!]",
        0x2223: "|", 0xEC07: "|", 0xEC08: "|", 0xEC09: "\\|", 0xEC0A: "\\|", 0xEC00: "\\langle", 0xEC01: "\\rangle" };
      if (m[c]) return m[c];
      if (c === 0x2329 || c === 0x3C) return "\\langle";
      if (c === 0x3E) return "\\rangle";
      return left ? "." : ".";
    }
    // depth: mức lồng phân số / chỉ số, để chọn \dfrac hay \frac
    function seq(items, d) {
      let out = "";
      let i = 0;
      const tail = () => out.replace(/\s+$/, "");
      while (i < items.length) {
        const it = items[i];
        if (it.t === "char") {
          if (it.tf === 1 && !GREEK[it.code] && (it.code >= 0x80 ? /\p{L}|\s/u.test(String.fromCodePoint(it.code)) : /[\w\s.,:;!?()\/'"-]/.test(String.fromCharCode(it.code)))) {
            // chữ thường (Text style)
            let s = "";
            while (i < items.length && items[i].t === "char" && items[i].tf === 1 && !items[i].emb.length && items[i].code !== 0x7B && items[i].code !== 0x7D && !SYM[items[i].code] && !PUA[items[i].code]) { s += String.fromCodePoint(items[i].code); i++; }
            if (!s) { out += embellish(charTex(it), it.emb); i++; continue; }
            if (/^[\d.,\s]+$/.test(s) || /^[()\[\];:,.\s]+$/.test(s)) out += s.replace(/\s+/g, "\\ ");
            else if (/^[a-z]+$/.test(s.trim()) && (FUNCS.has(s.trim()) || /^(tg|cotg|arctg|arccotg)$/.test(s.trim()))) out += funcName(s.trim());
            else out += "\\text{" + escText(s) + "}";
            continue;
          }
          if (it.tf === 2 && isLetter(it.code)) {
            let s = "";
            while (i < items.length && items[i].t === "char" && items[i].tf === 2 && isLetter(items[i].code) && !items[i].emb.length && (s === "" || !items[i].fstart)) { s += String.fromCharCode(items[i].code); i++; }
            out += funcName(s);
            continue;
          }
          out += embellish(charTex(it), it.emb);
          i++;
          continue;
        }
        if (it.t === "tmpl" && (it.sel === 27 || it.sel === 28 || it.sel === 29)) {
          const ls = it.items.filter(x => x.t === "line" || x.t === "pile" || x.t === "matrix");
          const sub = ls[0] ? node(ls[0], d + 1) : "", sup = ls[1] ? node(ls[1], d + 1) : "";
          if (!tail() || /[=+\-(,\[{<>]$/.test(tail())) out += "{}";
          if (sub) out += "_{" + sub + "}";
          if (sup) out += "^{" + sup + "}";
          i++;
          continue;
        }
        out += node(it, d);
        i++;
      }
      return out;
    }
    function funcName(s) {
      // MathType có thể gộp: "sin" + "x" kiểu chữ function; tách tên hàm quen thuộc ở đầu
      if (FUNCS.has(s)) return "\\" + s + " ";
      if (s === "tg" || s === "cotg" || s === "arctg" || s === "arccotg" || s === "cosec") return "\\operatorname{" + s + "}";
      for (const f of ["arcsin", "arccos", "arctan", "sin", "cos", "tan", "cot", "log", "ln", "lim", "max", "min"]) {
        if (s.startsWith(f) && s.length > f.length) return "\\" + f + " " + s.slice(f.length);
      }
      if (s.length === 1) return s;
      return "\\mathrm{" + s + "}";
    }
    function lines(items) { return items.filter(x => x.t === "line" || x.t === "pile" || x.t === "matrix"); }
    function chars(items) { return items.filter(x => x.t === "char"); }
    function isNull(x) { return !x || (x.t === "line" && (x.nul || !x.items.length)); }
    function node(n, d) {
      if (!n) return "";
      switch (n.t) {
        case "line": return n.nul ? "" : seq(n.items, d);
        case "char": return embellish(charTex(n), n.emb);
        case "pile": {
          const al = { 1: "l", 2: "c", 3: "r", 4: "l", 5: "r" }[n.ha] || "l";
          const rows = lines(n.items).map(x => node(x, d));
          if (rows.length <= 1) return rows[0] || "";
          return "\\begin{array}{" + al + "}" + rows.join(" \\\\ ") + "\\end{array}";
        }
        case "matrix": {
          const cells = lines(n.items).map(x => node(x, d));
          const rows = [];
          for (let r = 0; r < n.rows; r++) rows.push(cells.slice(r * n.cols, r * n.cols + n.cols).join(" & "));
          const al = { 1: "l", 2: "c", 3: "r" }[n.hj] || "c";
          return "\\begin{array}{" + al.repeat(n.cols) + "}" + rows.join(" \\\\ ") + "\\end{array}";
        }
        case "tmpl": return tmpl(n, d);
      }
      return "";
    }
    function tmpl(n, d) {
      const L = lines(n.items), C = chars(n.items), v = n.v;
      const s = i => node(L[i], d);
      switch (n.sel) {
        case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7: case 8: case 9: {
          let lc = null, rc = null;
          if (n.sel === 9) { lc = C[0]; rc = C[1]; }
          else {
            const hasL = (v & 1) || v === 0, hasR = (v & 2) || v === 0;
            let k = 0;
            if (hasL) lc = C[k++];
            if (hasR) rc = C[k++];
            if (!C.length) {
              const def = { 0: ["\\langle", "\\rangle"], 1: ["(", ")"], 2: ["\\{", "\\}"], 3: ["[", "]"], 4: ["|", "|"], 5: ["\\|", "\\|"], 6: ["\\lfloor", "\\rfloor"], 7: ["\\lceil", "\\rceil"], 8: ["[\\![", "]\\!]"] }[n.sel];
              return "\\left" + (hasL ? def[0] : ".") + " " + s(0) + " \\right" + (hasR ? def[1] : ".");
            }
          }
          return "\\left" + fenceTex(lc, true) + " " + s(0) + " \\right" + fenceTex(rc, false);
        }
        case 10: { // căn
          const idx = isNull(L[1]) ? "" : s(1);
          return idx ? "\\sqrt[" + idx + "]{" + s(0) + "}" : "\\sqrt{" + s(0) + "}";
        }
        case 11: { // phân số
          const a = node(L[0], d + 1), b = node(L[1], d + 1);
          if (v & 2) return a + "/" + b;
          return (d === 0 && !(v & 1) ? "\\dfrac{" : "\\frac{") + a + "}{" + b + "}";
        }
        case 12: return "\\underline{" + s(0) + "}";
        case 13: return "\\overline{" + s(0) + "}";
        case 14: { // mũi tên có chữ
          const top = isNull(L[0]) ? "" : s(0), bot = isNull(L[1]) ? "" : s(1);
          const kind = v & 0x3;
          const cmd = kind === 2 ? "\\xleftarrow" : kind === 3 ? "\\xleftrightarrow" : "\\xrightarrow";
          return cmd + (bot ? "[" + bot + "]" : "") + "{" + top + "}";
        }
        case 15: { // tích phân: [biểu thức, cận dưới, cận trên, ký hiệu]
          const cnt = (v & 3) || 1, loop = v & 0x4;
          const sym = loop ? (cnt === 2 ? "\\oiint" : cnt === 3 ? "\\oiiint" : "\\oint") : (cnt === 2 ? "\\iint" : cnt === 3 ? "\\iiint" : "\\int");
          return bigop(sym, L, d, false);
        }
        case 16: return bigop("\\sum", L, d, true);
        case 17: return bigop("\\prod", L, d, true);
        case 18: return bigop("\\coprod", L, d, true);
        case 19: return bigop("\\bigcup", L, d, true);
        case 20: return bigop("\\bigcap", L, d, true);
        case 21: case 22: { // toán tử có cận (không có thân)
          const op = C.length ? charTex(C[C.length - 1]).trim() || "\\int" : (n.sel === 21 ? "\\int" : "\\sum");
          const lo = isNull(L[0]) ? "" : s(0), hi = isNull(L[1]) ? "" : s(1);
          return op + (n.sel === 22 ? "\\limits" : "") + (lo ? "_{" + lo + "}" : "") + (hi ? "^{" + hi + "}" : "") + " ";
        }
        case 23: { // lim
          const main = s(0).trim() || "\\lim";
          const lo = isNull(L[1]) ? "" : node(L[1], d + 1), hi = isNull(L[2]) ? "" : node(L[2], d + 1);
          const op = /^\\(lim|max|min|sup|inf)\s*$/.test(main) ? main.trim() + "\\limits" : "\\mathop{" + main + "}\\limits";
          return op + (lo ? "_{" + lo + "}" : "") + (hi ? "^{" + hi + "}" : "") + " ";
        }
        case 24: case 25: { // ngoặc nhọn / vuông ngang
          const lab = isNull(L[1]) ? "" : s(1);
          const top = v & 1;
          if (n.sel === 24) return top ? "\\overbrace{" + s(0) + "}" + (lab ? "^{" + lab + "}" : "") : "\\underbrace{" + s(0) + "}" + (lab ? "_{" + lab + "}" : "");
          return top ? "\\overbracket{" + s(0) + "}" : "\\underbracket{" + s(0) + "}";
        }
        case 26: return "\\overline{\\left){" + s(0) + "}\\right.}";
        case 30: return "\\left\\langle " + s(0) + " \\right|";
        case 31: { // vectơ
          const left = v & 1, right = v & 2;
          const under = v & 0x8;
          const harp = v & 0x4;
          const body = s(0);
          if (harp) return "\\overset{\\rightharpoonup}{" + body + "}";
          if (left && right) return (under ? "\\underleftrightarrow{" : "\\overleftrightarrow{") + body + "}";
          if (left && !right) return (under ? "\\underleftarrow{" : "\\overleftarrow{") + body + "}";
          return (under ? "\\underrightarrow{" : "\\overrightarrow{") + body + "}";
        }
        case 32: return "\\widetilde{" + s(0) + "}";
        case 33: return "\\widehat{" + s(0) + "}";
        case 34: return "\\overset\\frown{" + s(0) + "}";
        case 35: return s(0);
        case 36: return "\\cancel{" + s(0) + "}";
        case 37: return "\\boxed{" + s(0) + "}";
        default: return L.map(x => node(x, d)).join(" ");
      }
    }
    function bigop(sym, L, d, limits) {
      const body = node(L[0], d), lo = isNull(L[1]) ? "" : node(L[1], d + 1), hi = isNull(L[2]) ? "" : node(L[2], d + 1);
      return sym + (limits ? "\\limits" : "") + (lo ? "_{" + lo + "}" : "") + (hi ? "^{" + hi + "}" : "") + " " + body;
    }
    return { node, seq };
  }

  function tidy(t) {
    return t.replace(/\s+/g, " ").replace(/ ([}\])])/g, "$1").replace(/\\left\. \\right\./g, "")
      .replace(/\^\{\^\{\\circ\}\}/g, "^{\\circ}")
      .replace(/(\d),(?=\d)/g, "$1{,}") // dấu phẩy thập phân kiểu Việt Nam
      .trim();
  }

  function convert(bytes) {
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    let p = 0;
    // Header OLE 28 byte của luồng Equation Native
    const hdr = b[0] | (b[1] << 8);
    if (hdr >= 12 && hdr <= 64 && (b[hdr] === 5 || b[hdr] === 3 || b[hdr] === 4 || b[hdr] === 2)) p = hdr;
    const ver = b[p];
    const r = new Reader(b, p);
    const ctx = { texSource: null };
    const unknown = [];
    let top;
    if (ver === 5 || ver === 4) {
      r.u8(); r.u8(); r.u8(); r.u8(); r.u8(); r.str(); r.u8();
      top = parseV5(r, ctx);
    } else if (ver === 3 || ver === 2) {
      r.u8(); r.u8(); r.u8(); r.u8(); r.u8();
      top = parseV3(r);
    } else throw new Error("Không nhận ra phiên bản MTEF " + ver);
    const g = Gen(unknown);
    const tex = tidy(top.map(n => g.node(n, 0)).join(" "));
    return { tex, source: ctx.texSource, unknown, version: ver };
  }

  // Chuỗi Unicode (công thức Word OMML) -> LaTeX
  function uni(str) {
    const g = Gen([]);
    let out = "", txt = "";
    const flush = () => { if (txt) { out += "\\text{" + txt + "}"; txt = ""; } };
    for (const ch of String(str)) {
      const c = ch.codePointAt(0);
      if (c > 0x7F && /\p{L}/u.test(ch) && !GREEK[c] && !GREEK_UP_LATIN[c] && !SYM[c]) { txt += ch; continue; }
      flush();
      if (c === 32) { out += " "; continue; }
      out += g.node({ t: "char", tf: 3, code: c, emb: [] }, 0);
    }
    flush();
    return out;
  }
  // Ký tự chèn bằng Insert > Symbol (w:sym) của font Symbol
  function symbolChar(code, font) {
    if (!/symbol/i.test(font || "")) return "";
    const c = SYMBOL_FONT[code & 0xFF] || ((code & 0xFF) < 128 ? (code & 0xFF) : 0);
    if (!c) return "";
    return Gen([]).node({ t: "char", tf: 6, code: c, emb: [] }, 0).trim();
  }

  const api = { convert, uni, symbolChar };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MTEF2TeX = api;
})(typeof window !== "undefined" ? window : this);
