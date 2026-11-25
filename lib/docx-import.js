/*
 * docx-import.js — Đọc đề Toán từ file Word (.docx) cho game giáo dục và ngân hàng câu hỏi lớp học.
 * - Công thức MathType / Equation 3.0 (OLE) -> LaTeX (qua MTEF2TeX), công thức Word (OMML) -> LaTeX.
 * - Nhận PHẦN I (trắc nghiệm A–D), PHẦN II (Đúng/Sai a–d), PHẦN III (trả lời ngắn).
 * - Đáp án đúng: chữ cái được GẠCH CHÂN hoặc TÔ ĐỎ (A., a)...), hoặc dòng "Đáp án: ..." / "Trả lời: ...".
 * - "Câu N" gõ tay hoặc đánh số tự động của Word đều được.
 * Dùng: DocxImport.importDocx(arrayBuffer, { JSZip, CFB, MTEF2TeX, DOMParser }) -> Promise<kết quả>
 */
(function (root) {
  "use strict";
  const OBJ = ""; // ký tự giữ chỗ cho công thức / ảnh khi dò nhãn

  /* ---------------- tiện ích DOM (chạy được với DOMParser của trình duyệt & xmldom) ---------------- */
  const kids = el => { const a = []; for (let n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 1) a.push(n); return a; };
  const tagOf = el => el.nodeName; // dạng "w:r", "m:oMath"…
  const local = el => el.localName || el.nodeName.replace(/^.*:/, "");
  const child = (el, name) => { for (const k of kids(el)) if (tagOf(k) === name) return k; return null; };
  const attr = (el, name) => el ? (el.getAttribute(name) || "") : "";
  const byTag = (el, name) => Array.from(el.getElementsByTagName(name));
  const textOf = el => { let s = ""; for (const t of byTag(el, "m:t")) s += t.textContent; return s; };

  function isRedish(hex) {
    if (!/^[0-9a-f]{6}$/i.test(hex)) return false;
    const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
    return r >= 0xB0 && g <= 0x70 && b <= 0x70;
  }

  /* ---------------- OMML -> LaTeX ---------------- */
  function ommlFactory(uni) {
    const ACC = { "̂": "\\widehat", "^": "\\widehat", "⃗": "\\overrightarrow", "→": "\\overrightarrow", "̃": "\\widetilde",
      "~": "\\widetilde", "̅": "\\overline", "¯": "\\overline", "̇": "\\dot", "̈": "\\ddot", "⃖": "\\overleftarrow", "←": "\\overleftarrow", "⃡": "\\overleftrightarrow" };
    const FENCE = c => ({ "(": "(", ")": ")", "[": "[", "]": "]", "{": "\\{", "}": "\\}", "|": "|", "‖": "\\|", "⟨": "\\langle", "⟩": "\\rangle", "〈": "\\langle", "〉": "\\rangle", "⌊": "\\lfloor", "⌋": "\\rfloor", "⌈": "\\lceil", "⌉": "\\rceil", "": "." }[c] ?? c);
    function conv(el) {
      if (!el) return "";
      switch (tagOf(el)) {
        case "m:oMath": case "m:e": case "m:num": case "m:den": case "m:sub": case "m:sup": case "m:deg": case "m:fName": case "m:lim":
        case "m:box": case "m:borderBox": case "m:phant": case "m:oMathPara":
          return kids(el).map(conv).join("");
        case "m:r": {
          const t = textOf(el);
          const rpr = child(el, "m:rPr");
          const nor = rpr && (child(rpr, "m:nor") || attr(child(rpr, "m:sty"), "m:val") === "p");
          if (nor && /[^\x00-\x7F]|[a-zA-Z]{2,}\s/.test(t) && !/^[a-z]+$/.test(t.trim())) return "\\text{" + t.replace(/[{}\\$]/g, "") + "}";
          return uni(t);
        }
        case "m:f": {
          const type = attr(child(child(el, "m:fPr") || el, "m:type"), "m:val");
          const a = conv(child(el, "m:num")), b = conv(child(el, "m:den"));
          return type === "lin" ? a + "/" + b : "\\dfrac{" + a + "}{" + b + "}";
        }
        case "m:sSup": return conv(child(el, "m:e")) + "^{" + conv(child(el, "m:sup")) + "}";
        case "m:sSub": return conv(child(el, "m:e")) + "_{" + conv(child(el, "m:sub")) + "}";
        case "m:sSubSup": return conv(child(el, "m:e")) + "_{" + conv(child(el, "m:sub")) + "}^{" + conv(child(el, "m:sup")) + "}";
        case "m:sPre": return "{}_{" + conv(child(el, "m:sub")) + "}^{" + conv(child(el, "m:sup")) + "}" + conv(child(el, "m:e"));
        case "m:rad": {
          const pr = child(el, "m:radPr"); const hide = attr(child(pr || el, "m:degHide"), "m:val");
          const deg = conv(child(el, "m:deg"));
          return (deg && hide !== "1" && hide !== "on" ? "\\sqrt[" + deg + "]{" : "\\sqrt{") + conv(child(el, "m:e")) + "}";
        }
        case "m:d": {
          const pr = child(el, "m:dPr");
          const g = (n, d) => { const c = pr && child(pr, n); return c ? attr(c, "m:val") : d; };
          const beg = g("m:begChr", "("), end = g("m:endChr", ")"), sep = g("m:sepChr", "|");
          const es = kids(el).filter(k => tagOf(k) === "m:e").map(conv);
          return "\\left" + FENCE(beg) + " " + es.join(sep === "|" ? "\\mid " : uni(sep)) + " \\right" + FENCE(end);
        }
        case "m:nary": {
          const pr = child(el, "m:naryPr");
          const chr = pr && child(pr, "m:chr") ? attr(child(pr, "m:chr"), "m:val") : "∫";
          const op = uni(chr).trim() || "\\int";
          const lo = conv(child(el, "m:sub")), hi = conv(child(el, "m:sup"));
          const lim = /\\(sum|prod|bigcup|bigcap|coprod)/.test(op) ? "\\limits" : "";
          return op + lim + (lo ? "_{" + lo + "}" : "") + (hi ? "^{" + hi + "}" : "") + " " + conv(child(el, "m:e"));
        }
        case "m:func": {
          const n = conv(child(el, "m:fName")).trim();
          const known = /^(sin|cos|tan|cot|log|ln|lg|exp|lim|max|min)$/.test(n.replace(/\\/g, "")) ? "\\" + n.replace(/\\/g, "") + " " : n + " ";
          return known + conv(child(el, "m:e"));
        }
        case "m:acc": {
          const pr = child(el, "m:accPr"); const c = pr && child(pr, "m:chr") ? attr(child(pr, "m:chr"), "m:val") : "̂";
          const cmd = ACC[c] || "\\widehat";
          return cmd + "{" + conv(child(el, "m:e")) + "}";
        }
        case "m:bar": {
          const pr = child(el, "m:barPr"); const pos = pr && child(pr, "m:pos") ? attr(child(pr, "m:pos"), "m:val") : "top";
          return (pos === "bot" ? "\\underline{" : "\\overline{") + conv(child(el, "m:e")) + "}";
        }
        case "m:groupChr": {
          const pr = child(el, "m:groupChrPr"); const pos = pr && child(pr, "m:pos") ? attr(child(pr, "m:pos"), "m:val") : "bot";
          return (pos === "top" ? "\\overbrace{" : "\\underbrace{") + conv(child(el, "m:e")) + "}";
        }
        case "m:limLow": {
          const base = conv(child(el, "m:e")).trim(), lim = conv(child(el, "m:lim"));
          return /^\\(lim|max|min|sup|inf)\s*$/.test(base) ? base.trim() + "\\limits_{" + lim + "}" : "\\underset{" + lim + "}{" + base + "}";
        }
        case "m:limUpp": return "\\overset{" + conv(child(el, "m:lim")) + "}{" + conv(child(el, "m:e")) + "}";
        case "m:m": {
          const rows = kids(el).filter(k => tagOf(k) === "m:mr").map(r => kids(r).filter(k => tagOf(k) === "m:e").map(conv).join(" & "));
          const cols = rows.length ? (rows[0].match(/ & /g) || []).length + 1 : 1;
          return "\\begin{array}{" + "c".repeat(cols) + "}" + rows.join(" \\\\ ") + "\\end{array}";
        }
        case "m:eqArr": return "\\begin{array}{l}" + kids(el).filter(k => tagOf(k) === "m:e").map(conv).join(" \\\\ ") + "\\end{array}";
        default:
          if (/Pr$/.test(tagOf(el))) return "";
          return kids(el).map(conv).join("");
      }
    }
    return el => conv(el).replace(/\s+/g, " ").trim();
  }

  /* ---------------- Đánh số tự động của Word ---------------- */
  function numberingFactory(numXml, stylesXml, P) {
    const absLvls = {}, numAbs = {}, numStart = {}, styleNum = {};
    if (numXml) {
      const d = P.parseFromString(numXml, "application/xml");
      for (const a of byTag(d, "w:abstractNum")) {
        const id = attr(a, "w:abstractNumId"); const lv = {};
        for (const l of kids(a).filter(k => tagOf(k) === "w:lvl")) {
          lv[attr(l, "w:ilvl")] = { fmt: attr(child(l, "w:numFmt"), "w:val") || "decimal", text: attr(child(l, "w:lvlText"), "w:val"), start: +attr(child(l, "w:start"), "w:val") || 1 };
        }
        absLvls[id] = lv;
      }
      for (const n of byTag(d, "w:num")) {
        const id = attr(n, "w:numId"); numAbs[id] = attr(child(n, "w:abstractNumId"), "w:val");
        for (const o of byTag(n, "w:lvlOverride")) { const so = child(o, "w:startOverride"); if (so) numStart[id + ":" + attr(o, "w:ilvl")] = +attr(so, "w:val"); }
      }
    }
    if (stylesXml) {
      const d = P.parseFromString(stylesXml, "application/xml");
      const styles = {};
      for (const s of byTag(d, "w:style")) styles[attr(s, "w:styleId")] = s;
      const resolve = (id, depth) => {
        const s = styles[id]; if (!s || depth > 5) return null;
        const ppr = child(s, "w:pPr"); const np = ppr && child(ppr, "w:numPr");
        if (np) return { numId: attr(child(np, "w:numId"), "w:val"), ilvl: attr(child(np, "w:ilvl"), "w:val") || "0" };
        const based = child(s, "w:basedOn"); return based ? resolve(attr(based, "w:val"), depth + 1) : null;
      };
      for (const id in styles) { const r = resolve(id, 0); if (r) styleNum[id] = r; }
    }
    const counters = {}, seenNum = {};
    const toAlpha = n => { let s = ""; while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); } return s; };
    const toRoman = n => { const m = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]]; let s = ""; for (const [v, r] of m) while (n >= v) { s += r; n -= v; } return s; };
    const fmtNum = (n, f) => f === "upperLetter" ? toAlpha(n) : f === "lowerLetter" ? toAlpha(n).toLowerCase() : f === "upperRoman" ? toRoman(n) : f === "lowerRoman" ? toRoman(n).toLowerCase() : f === "bullet" || f === "none" ? "" : String(n);
    return function label(p) {
      const ppr = child(p, "w:pPr"); if (!ppr) return null;
      let np = child(ppr, "w:numPr"), numId, ilvl;
      if (np) { numId = attr(child(np, "w:numId"), "w:val"); ilvl = attr(child(np, "w:ilvl"), "w:val") || "0"; }
      else { const ps = child(ppr, "w:pStyle"); const sn = ps && styleNum[attr(ps, "w:val")]; if (!sn) return null; numId = sn.numId; ilvl = sn.ilvl; }
      if (!numId || numId === "0") return null;
      const abs = numAbs[numId]; const lv = absLvls[abs] && absLvls[abs][ilvl]; if (!lv) return null;
      if (lv.fmt === "bullet" || lv.fmt === "none") return null;
      const key = abs;
      counters[key] = counters[key] || {};
      if (!seenNum[numId] && numStart[numId + ":" + ilvl] !== undefined) counters[key][ilvl] = numStart[numId + ":" + ilvl] - 1;
      seenNum[numId] = true;
      if (counters[key][ilvl] === undefined) counters[key][ilvl] = lv.start - 1;
      counters[key][ilvl]++;
      for (const k in counters[key]) if (+k > +ilvl) delete counters[key][k];
      let text = lv.text || "%" + (+ilvl + 1) + ".";
      text = text.replace(/%(\d)/g, (_, d) => {
        const L = String(+d - 1); const l2 = absLvls[abs][L] || lv;
        const n = counters[key][L] !== undefined ? counters[key][L] : l2.start;
        return fmtNum(n, l2.fmt);
      });
      return { text, fmt: lv.fmt, ilvl: +ilvl };
    };
  }

  /* ---------------- Đọc file ---------------- */
  async function importDocx(buf, deps) {
    const { JSZip, CFB, MTEF2TeX } = deps;
    const P = new deps.DOMParser();
    const zip = await JSZip.loadAsync(buf);
    const read = async name => { const f = zip.file(name); return f ? f.async("string") : null; };
    const docXml = await read("word/document.xml");
    if (!docXml) throw new Error("Không phải file Word .docx hợp lệ (thiếu word/document.xml).");
    const relsXml = await read("word/_rels/document.xml.rels") || "";
    const rels = {};
    for (const r of byTag(P.parseFromString(relsXml, "application/xml"), "Relationship")) rels[attr(r, "Id")] = attr(r, "Target");
    const numLabel = numberingFactory(await read("word/numbering.xml"), await read("word/styles.xml"), P);
    const omml = ommlFactory(s => MTEF2TeX.uni(s));
    const stats = { mathtype: 0, omml: 0, mathFail: 0, images: 0, imgSkipped: 0, warnings: [] };
    const images = {};
    const imgCache = {};
    const mediaPath = t => t.startsWith("/") ? t.slice(1) : (t.startsWith("word/") ? t : "word/" + t.replace(/^\.\//, ""));

    async function imageAtom(rid) {
      const target = rels[rid]; if (!target) return null;
      const path = mediaPath(target);
      if (imgCache[path] !== undefined) return imgCache[path];
      const ext = (path.split(".").pop() || "").toLowerCase();
      const mime = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", bmp: "image/bmp", webp: "image/webp", svg: "image/svg+xml" }[ext];
      const f = zip.file(path);
      if (!f || !mime) { stats.imgSkipped++; imgCache[path] = { k: "skip", ext }; return imgCache[path]; }
      const b64 = await f.async("base64");
      const id = "i" + (Object.keys(images).length + 1).toString(36) + Math.random().toString(36).slice(2, 6);
      images[id] = "data:" + mime + ";base64," + b64;
      stats.images++;
      imgCache[path] = { k: "img", id };
      return imgCache[path];
    }
    async function oleAtom(objEl) {
      const ole = byTag(objEl, "o:OLEObject")[0];
      const prog = attr(ole, "ProgID");
      const rid = attr(ole, "r:id");
      if (ole && /^Equation/i.test(prog) && rels[rid]) {
        const f = zip.file(mediaPath(rels[rid]));
        if (f) {
          try {
            const bin = await f.async("uint8array");
            const cfb = CFB.read(bin, { type: "array" });
            const en = CFB.find(cfb, "Equation Native");
            if (en) {
              const r = MTEF2TeX.convert(new Uint8Array(en.content));
              stats.mathtype++;
              return { k: "math", tex: r.tex };
            }
          } catch (e) { /* rơi xuống ảnh dự phòng */ }
        }
        stats.mathFail++;
      }
      const im = byTag(objEl, "v:imagedata")[0];
      if (im) { const a = await imageAtom(attr(im, "r:id")); if (a && a.k === "img") return a; }
      return { k: "text", c: "[?]" };
    }

    // Biến 1 đoạn (w:p) thành dãy "nguyên tử": {k:'c', c, m(đánh dấu)} | {k:'math', tex, m} | {k:'img', id, m}
    async function paraAtoms(p) {
      const atoms = [];
      const pushText = (s, m) => { for (const c of s) atoms.push({ k: "c", c, m }); };
      async function walk(el, mark) {
        for (const n of kids(el)) {
          const t = tagOf(n);
          if (t === "w:r" && child(n, "w:rPr") && child(child(n, "w:rPr"), "w:vanish")) continue;
          if (t === "w:pPr" || t === "w:rPr" || t === "w:del" || t === "w:proofErr" || t === "w:bookmarkStart" || t === "w:bookmarkEnd" || t === "mc:Fallback") continue;
          if (t === "m:oMath" || t === "m:oMathPara") {
            try { const tex = omml(n); if (tex) { atoms.push({ k: "math", tex, m: false }); stats.omml++; } } catch (e) { stats.mathFail++; }
            continue;
          }
          if (t === "w:r") {
            const rpr = child(n, "w:rPr");
            let m = false;
            if (rpr) {
              const u = child(rpr, "w:u"); if (u && attr(u, "w:val") !== "none") m = true;
              const c = child(rpr, "w:color"); if (c && isRedish(attr(c, "w:val"))) m = true;
            }
            for (const r of kids(n)) {
              const rt = tagOf(r);
              if (rt === "w:t") pushText(r.textContent, m);
              else if (rt === "w:tab" || rt === "w:ptab") pushText("\t", m);
              else if (rt === "w:br" || rt === "w:cr") { if (attr(r, "w:type") !== "page") pushText("\n", false); }
              else if (rt === "w:noBreakHyphen") pushText("-", m);
              else if (rt === "w:sym") {
                const code = parseInt(attr(r, "w:char"), 16); const font = attr(r, "w:font");
                const tex = MTEF2TeX.symbolChar(code, font);
                if (tex) atoms.push({ k: "math", tex, m });
              }
              else if (rt === "w:object") { const a = await oleAtom(r); if (a.k === "text") pushText(a.c, m); else atoms.push(Object.assign(a, { m })); }
              else if (rt === "w:drawing" || rt === "w:pict" || rt === "mc:AlternateContent") {
                const blips = byTag(r, "a:blip").filter(b => !hasAncestor(b, "mc:Fallback"));
                const vimg = byTag(r, "v:imagedata").filter(b => !hasAncestor(b, "mc:Fallback"));
                let any = false;
                for (const b of blips) { const a = await imageAtom(attr(b, "r:embed")); if (a && a.k === "img") { atoms.push({ k: "img", id: a.id, m }); any = true; } }
                if (!any) for (const b of vimg) { const a = await imageAtom(attr(b, "r:id")); if (a && a.k === "img") { atoms.push({ k: "img", id: a.id, m }); any = true; } }
                // chữ trong khung text box
                if (!blips.length && !vimg.length) for (const tb of byTag(r, "w:txbxContent")) for (const pp of byTag(tb, "w:p")) { await walk(pp, false); pushText(" ", false); }
              }
            }
            continue;
          }
          if (t === "w:hyperlink" || t === "w:ins" || t === "w:smartTag" || t === "w:sdt" || t === "w:sdtContent" || t === "w:customXml" || t === "w:fldSimple" || t === "mc:AlternateContent" || t === "mc:Choice") {
            await walk(n, mark); continue;
          }
        }
      }
      await walk(p, false);
      return atoms;
    }
    function hasAncestor(el, name) { for (let a = el.parentNode; a; a = a.parentNode) if (a.nodeName === name) return true; return false; }

    const doc = P.parseFromString(docXml, "application/xml");
    const body = byTag(doc, "w:body")[0];
    const paras = byTag(body, "w:p").filter(p => !hasAncestor(p, "mc:Fallback") && !hasAncestor(p, "w:txbxContent"));

    // Tách thành các dòng logic
    const lines = [];
    for (const p of paras) {
      const atoms = await paraAtoms(p);
      const lab = numLabel(p);
      let cur = [];
      if (lab && lab.text) { for (const c of lab.text + " ") cur.push({ k: "c", c, m: false }); }
      const flush = () => { lines.push({ atoms: cur, num: lab, isNumbered: !!lab }); cur = []; };
      for (const a of atoms) { if (a.k === "c" && a.c === "\n") { flush(); continue; } cur.push(a); }
      flush();
    }
    const result = parseLines(lines, stats);
    result.images = images;
    result.stats = stats;
    result.text = toText(result.questions);
    // bỏ ảnh không dùng đến
    const used = new Set((result.text.match(/\[\[img:([\w]+)\]\]/g) || []).map(s => s.slice(6, -2)));
    for (const id of Object.keys(images)) if (!used.has(id)) delete images[id];
    stats.images = Object.keys(images).length;
    return result;
  }

  /* ---------------- Phân tích cấu trúc đề ---------------- */
  const sv = atoms => atoms.map(a => a.k === "c" ? a.c : OBJ).join("");
  function trimAtoms(atoms) {
    let s = 0, e = atoms.length;
    while (s < e && atoms[s].k === "c" && /\s/.test(atoms[s].c)) s++;
    while (e > s && atoms[e - 1].k === "c" && /\s/.test(atoms[e - 1].c)) e--;
    return atoms.slice(s, e);
  }
  function toStr(atoms) {
    let out = "";
    for (const a of atoms) {
      if (a.k === "c") out += a.c === "\t" ? " " : (a.c === "$" ? "\\$" : a.c);
      else if (a.k === "math") out += a.tex ? "$" + a.tex + "$" : "";
      else if (a.k === "img") out += "[[img:" + a.id + "]]";
    }
    return out.replace(/[  ]{2,}/g, " ").replace(/\$\s*\$/g, "").trim();
  }
  const RX = {
    part: /^\s*PH[ẦẦA]N\s+(III|II|I|3|2|1)\b/i,
    q: /^\s*C[âa]u\s*(\d+)\s*(\[[^\]]*\]|\([^)]*\))?\s*[.:)]?\s*/i,
    sol: /^\s*(L[ờo]i\s*gi[ảa]i|H[ướư]{1,2}ng\s*d[ẫa]n(\s*gi[ảa]i)?|B[àa]i\s*gi[ảa]i)\s*[:.]?\s*/i,
    ans: /^\s*(Đáp\s*án|Dap\s*an|Trả\s*lời|Tra\s*loi|ĐA|KQ|Kết\s*quả)\s*[:.]\s*/i,
    tag: /^\s*[\[(]\s*(NB|TH|VD|VDC|NB\d|TH\d|VD\d)\s*[\])]\s*/i
  };
  const markedRange = (atoms, s, e) => { let any = false; for (let i = s; i < e; i++) if (atoms[i] && atoms[i].m) any = true; return any; };
  const allMarked = (atoms, s, e) => { let n = 0; for (let i = s; i < e; i++) { const a = atoms[i]; if (a.k === "c" && /\s|[.;,]/.test(a.c)) continue; if (!a.m) return false; n++; } return n > 0; };

  // Tìm nhãn A. B. C. D. liên tiếp trên 1 dòng; trả về [{letter, s(label start), b(content start)}]
  function findLabels(atoms, upper) {
    const s = sv(atoms);
    const L = upper ? "ABCDEF" : "abcdef";
    const out = [];
    const first = s.search(/\S/);
    const m0 = s.slice(first).match(upper ? /^([A-F])\s*[.):]/ : /^([a-f])\s*\)/);
    if (!m0) return out;
    let k = L.indexOf(m0[1]);
    out.push({ letter: m0[1], s: first, b: first + m0[0].length });
    for (;;) {
      k++; if (k >= L.length) break;
      const re = upper ? new RegExp("(^|[\\s.;" + OBJ + ")])" + L[k] + "\\s*[.):]", "g") : new RegExp("(^|[\\s.;" + OBJ + "])" + L[k] + "\\s*\\)", "g");
      re.lastIndex = out[out.length - 1].b;
      const m = re.exec(s);
      if (!m) break;
      const ls = m.index + m[1].length;
      out.push({ letter: L[k], s: ls, b: m.index + m[0].length });
    }
    return out;
  }
  function stripTrailDot(atoms) { atoms = trimAtoms(atoms); const l = atoms[atoms.length - 1]; if (l && l.k === "c" && (l.c === "." || l.c === ";")) atoms = trimAtoms(atoms.slice(0, -1)); return atoms; }
  function stripTag(atoms) { const s = sv(atoms); const m = s.match(RX.tag); return m ? atoms.slice(m[0].length) : atoms; }

  function parseLines(lines, stats) {
    const qs = [];
    let part = 0, cur = null, mode = "stem";
    const newQ = (stemAtoms, num) => { cur = { part, stem: [stemAtoms], opts: [], st: [], ans: null, ansAtoms: null, exp: [], num }; qs.push(cur); mode = "stem"; };
    for (const ln of lines) {
      let atoms = ln.atoms;
      const s = sv(atoms);
      if (!s.trim()) continue;
      let m;
      if ((m = s.match(RX.part))) { part = { I: 1, II: 2, III: 3, 1: 1, 2: 2, 3: 3 }[m[1].toUpperCase()]; cur = null; continue; }
      const numberedQ = ln.isNumbered && ln.num && (ln.num.fmt === "decimal" || /c[âa]u/i.test(ln.num.text)) && ln.num.ilvl === 0;
      if ((m = s.match(RX.q)) && !(mode === "exp" && cur && !/^\s*C[âa]u/i.test(s))) {
        newQ(stripTag(trimAtoms(atoms.slice(m[0].length))), +m[1]); continue;
      }
      if (numberedQ && !(cur && mode === "exp" && ln.num && ln.num.fmt !== "decimal")) {
        const lab = ln.num.text.length + 1;
        newQ(stripTag(trimAtoms(atoms.slice(lab))), null); continue;
      }
      if (!cur) continue; // phần đầu đề (tên trường, tiêu đề…)
      if ((m = s.match(RX.sol))) {
        mode = "exp";
        const rest = trimAtoms(atoms.slice(m[0].length));
        if (sv(rest).trim()) {
          const m2 = sv(rest).match(RX.ans);
          if (m2) { cur.ansAtoms = trimAtoms(rest.slice(m2[0].length)); } else cur.exp.push(rest);
        }
        continue;
      }
      if ((m = s.match(RX.ans))) { cur.ansAtoms = stripTrailDot(atoms.slice(m[0].length)); continue; }
      if (mode === "exp") { cur.exp.push(trimAtoms(atoms)); continue; }
      // Phương án A. B. C. D.
      const labs = findLabels(atoms, true);
      if (labs.length && (labs[0].letter === "A" || cur.opts.length)) {
        labs.forEach((l, i) => {
          const end = i + 1 < labs.length ? labs[i + 1].s : atoms.length;
          const content = stripTrailDot(atoms.slice(l.b, end));
          const idx = l.letter.charCodeAt(0) - 65;
          const mark = markedRange(atoms, l.s, l.b) || allMarked(atoms, l.b, end);
          cur.opts[idx] = { atoms: content, mark };
        });
        continue;
      }
      // Ý a) b) c) d)
      const sl = findLabels(atoms, false);
      if (sl.length && (sl[0].letter === "a" || cur.st.length)) {
        sl.forEach((l, i) => {
          const end = i + 1 < sl.length ? sl[i + 1].s : atoms.length;
          const content = stripTrailDot(stripTag(trimAtoms(atoms.slice(l.b, end))));
          cur.st[l.letter.charCodeAt(0) - 97] = { atoms: content, mark: markedRange(atoms, l.s, l.b) };
        });
        continue;
      }
      // dòng tiếp theo của đề
      if (cur.opts.length && !cur.st.length) { const o = cur.opts[cur.opts.length - 1]; if (o && !sv(atoms).match(/^\s*$/)) { cur.stem.push(trimAtoms(atoms)); continue; } }
      if (cur.st.length) { const o = cur.st[cur.st.length - 1]; o.atoms = o.atoms.concat([{ k: "c", c: " ", m: false }], trimAtoms(atoms)); continue; }
      cur.stem.push(trimAtoms(atoms));
    }

    // Hoàn thiện từng câu
    const out = [];
    qs.forEach((q, n) => {
      const name = "Câu " + (n + 1);
      const stem = q.stem.map(toStr).filter(Boolean).join("\n");
      const exp = q.exp.map(toStr).filter(Boolean).join("\n");
      const opts = q.opts.filter(Boolean);
      const holes = q.opts.length !== opts.length;
      const ansStr = q.ansAtoms ? toStr(q.ansAtoms) : "";
      let type = q.part === 2 || (q.st.length >= 2 && opts.length < 2) ? "tf" : (q.part === 3 || opts.length <= 1 && !q.st.length ? "short" : "mc");
      if (type === "tf" && q.st.length < 2) type = opts.length >= 2 ? "mc" : "short";
      if (type === "mc" && opts.length < 2) type = "short";
      if (type === "mc") {
        let ans = opts.findIndex(o => o.mark);
        if (opts.filter(o => o.mark).length > 1) stats.warnings.push(name + ": có nhiều hơn 1 phương án được đánh dấu, đã lấy phương án đầu.");
        if (ans < 0 && /^[A-F]\b/.test(ansStr.trim())) ans = ansStr.trim().charCodeAt(0) - 65;
        if (ans < 0) stats.warnings.push(name + ": chưa thấy đáp án đúng (gạch chân / tô đỏ chữ A, B, C, D) — hãy thêm dòng “Đáp án: …”.");
        if (holes) stats.warnings.push(name + ": thiếu phương án ở giữa.");
        out.push({ type, stem, opts: opts.map(o => toStr(o.atoms)), ans, exp });
      } else if (type === "tf") {
        const st = q.st.filter(Boolean);
        let truth = st.map(x => x.mark);
        if (!truth.some(Boolean)) {
          // thử đọc từ lời giải "a) Đúng" / "a) Sai" hoặc "Đáp án: Đ S S Đ"
          const fromAns = (ansStr.match(/[ĐSDđsd]/g) || []).map(c => /[ĐDđd]/.test(c));
          const fromExp = st.map((_, i) => { const re = new RegExp("(^|\\n)\\s*" + "abcdef"[i] + "\\)\\s*(Đúng|Sai)", "i"); const mm = exp.match(re); return mm ? /đúng/i.test(mm[2]) : null; });
          if (fromAns.length === st.length) truth = fromAns;
          else if (fromExp.every(x => x !== null)) truth = fromExp;
          else stats.warnings.push(name + " (Đúng/Sai): không thấy ý nào được gạch chân — đang coi tất cả là Sai, hãy kiểm tra lại.");
        }
        out.push({ type, stem, st: st.map(x => toStr(x.atoms)), truth, exp });
      } else {
        let answer = ansStr;
        if (!answer && opts.length === 1) answer = toStr(opts[0].atoms); // mẫu TN MIX: "A. 22,4"
        if (!answer) { const mm = exp.match(/(?:^|\n)\s*(?:Đáp\s*án|Trả\s*lời|ĐS)\s*[:.]\s*([^\n]+)/i); if (mm) answer = mm[1].trim(); }
        if (!answer) stats.warnings.push(name + " (Trả lời ngắn): chưa thấy đáp án — hãy thêm dòng “Đáp án: …”.");
        out.push({ type: "short", stem, answer, exp });
      }
    });
    return { questions: out };
  }

  /* ---------------- Xuất ra định dạng chữ của game ---------------- */
  function toText(questions) {
    const oneLine = s => s.replace(/\n+/g, "\n");
    return questions.map((q, i) => {
      const n = i + 1;
      const L = [];
      if (q.type === "mc") {
        L.push(`Câu ${n}: ${oneLine(q.stem)}`);
        q.opts.forEach((o, k) => L.push(`${"ABCDEF"[k]}. ${o.replace(/\n/g, " ")}`));
        L.push(`Đáp án: ${q.ans >= 0 ? "ABCDEF"[q.ans] : "?"}`);
      } else if (q.type === "tf") {
        L.push(`Câu ${n} [Đúng/Sai]: ${oneLine(q.stem)}`);
        q.st.forEach((s, k) => L.push(`${"abcdef"[k]}) ${s.replace(/\n/g, " ")}`));
        L.push(`Đáp án: ${q.truth.map(t => t ? "Đ" : "S").join(" ")}`);
      } else {
        L.push(`Câu ${n} [Trả lời ngắn]: ${oneLine(q.stem)}`);
        L.push(`Đáp án: ${q.answer || "?"}`);
      }
      if (q.exp) L.push(`Giải: ${q.exp}`);
      return L.join("\n");
    }).join("\n\n");
  }

  const api = { importDocx, parseLines, toText };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.DocxImport = api;
})(typeof window !== "undefined" ? window : this);
