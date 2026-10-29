// src/services/practicalOrder.js
//
// Office order (PDF) for an EXTERNAL practical examiner: addressed to the
// examiner, with a copy to the Principal of his college so that he is relieved
// for the practical examinations. Emailed to the examiner and printed by the
// COE office. Kannada text is shaped by fontkit (Noto Sans Kannada); English
// parts use Noto Sans / Noto Serif. Fonts, logos and the COE's signature are in
// src/assets.

import "regenerator-runtime/runtime.js"; // needed by fontkit's Indic (Kannada) shaper
import { readFileSync } from "node:fs";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

const asset = (name) => readFileSync(new URL(`../assets/${name}`, import.meta.url));

export const ORDER_REF_PREFIX = "ಕೆಪಿಎಂ/29/ಸ್ವಾಯತ್ತತೆ (ಪರೀಕ್ಷೆ)";

const DEPT_FULL = {
  at: "Automobile Engineering",
  ch: "Chemical Engineering",
  ce: "Civil Engineering",
  cs: "Computer Science and Engineering",
  ec: "Electronics and Communication Engineering",
  ee: "Electrical and Electronics Engineering",
  me: "Mechanical Engineering",
  ps: "Polymer Technology",
  sc: "Science and English",
};
export const deptFull = (d) => DEPT_FULL[String(d || "").toLowerCase()] || String(d || "").toUpperCase();

const DESIGNATION_KN = {
  Lecturer: "ಉಪನ್ಯಾಸಕರು",
  "Senior Grade Lecturer": "ಹಿರಿಯ ಶ್ರೇಣಿ ಉಪನ್ಯಾಸಕರು",
  "Senior Lecturer": "ಹಿರಿಯ ಉಪನ್ಯಾಸಕರು",
  "Selection Grade Lecturer": "ಆಯ್ಕೆ ಶ್ರೇಣಿ ಉಪನ್ಯಾಸಕರು",
  HOD: "ವಿಭಾಗ ಮುಖ್ಯಸ್ಥರು",
  "Vice-Principal": "ಉಪ ಪ್ರಾಂಶುಪಾಲರು",
  Principal: "ಪ್ರಾಂಶುಪಾಲರು",
  "Guest Lecturer": "ಅತಿಥಿ ಉಪನ್ಯಾಸಕರು",
};

// "2026-11-20" or a Date -> "20-11-2026"
export const dmy = (d) => {
  if (!d) return "";
  const x = typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T00:00:00+05:30`) : new Date(d);
  return x.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Kolkata" }).replace(/\//g, "-");
};

// June onwards belongs to the new academic year: 2025-26
const academicYear = (d) => {
  const x = new Date(d);
  const start = x.getMonth() >= 5 ? x.getFullYear() : x.getFullYear() - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
};

const REFERENCES = [
  "ಸರ್ಕಾರದ ಆದೇಶ ಸಂಖ್ಯೆ ಇಡಿ. 72 ಡಿಟಿಇ 2024 “Regulation for Autonomous Polytechnic College 2025” ದಿ: 19.10.2025.",
  "ಸರ್ಕಾರದ ಆದೇಶ ಸಂಖ್ಯೆ ಇಡಿ.72 ಡಿಟಿಇ 2024 ಕರ್ನಾಟಕ (ಸರ್ಕಾರಿ) ಪಾಲಿಟೆಕ್ನಿಕ್ ಸ್ವಾಯತ್ತತೆ ನೀಡಿ ಆದೇಶ ದಿನಾಂಕ 19.10.25",
  "ನಿರ್ದೇಶಕರು, ತಾಂತ್ರಿಕ ಶಿಕ್ಷಣ ನಿರ್ದೇಶನಾಲಯ, ಬೆಂಗಳೂರು ಇವರ ಅಧ್ಯಕ್ಷತೆಯಲ್ಲಿ ನಡೆದ ಆಡಳಿತ ಮಂಡಳಿ ಸಭೆಯ ನಡಾವಳಿ ದಿ:12.12.2025",
  "ಕರ್ನಾಟಕ (ಸರ್ಕಾರಿ) ಪಾಲಿಟೆಕ್ನಿಕ್ (ಸ್ವಾಯತ್ತ), ಮಂಗಳೂರು ಇದರ ಶೈಕ್ಷಣಿಕ ನಿಯಮಗಳು ಮತ್ತು ನಿಯಂತ್ರಣ - ಡಿಪ್ಲೊಮಾ ಎಂಜಿನಿಯರಿಂಗ್",
  "ಕರ್ನಾಟಕ (ಸರ್ಕಾರಿ) ಪಾಲಿಟೆಕ್ನಿಕ್ (ಸ್ವಾಯತ್ತ), ಮಂಗಳೂರು ಇದರ ಪರೀಕ್ಷಾ ಕೈಪಿಡಿ – 2025",
];

const PARA_1 =
  "ಮೇಲ್ಕಂಡ ವಿಷಯಕ್ಕೆ ಸಂಬಂಧಿಸಿದಂತೆ, ಉಲ್ಲೇಖ (1)ರ ಆದೇಶದ ಪ್ರಕಾರ ಕರ್ನಾಟಕ ಸರ್ಕಾರವು ತಾಂತ್ರಿಕ ಶಿಕ್ಷಣ ಇಲಾಖೆ ಅಡಿಯಲ್ಲಿ ಕಾರ್ಯನಿರ್ವಹಿಸಲು ಪಾಲಿಟೆಕ್ನಿಕ್ ಸಂಸ್ಥೆಗಳ ಶೈಕ್ಷಣಿಕ ಮತ್ತು ಆಡಳಿತಾತ್ಮಕ ಚಟುವಟಿಕೆಗಳನ್ನು ಪಾರದರ್ಶಕವಾಗಿ ಮತ್ತು ಪರಿಣಾಮಕಾರಿಯಾಗಿ ನಿರ್ವಹಿಸುವ ಉದ್ದೇಶದಿಂದ “ಸ್ವಾಯತ್ತ ಪಾಲಿಟೆಕ್ನಿಕ್ ಕಾಲೇಜು ನಿಯಮಾವಳಿ 2025” ನ್ನು ಜಾರಿಗೊಳಿಸಿದೆ.";
const PARA_2 =
  "ಉಲ್ಲೇಖ (2) ರ ಆದೇಶದಲ್ಲಿ, ಸರ್ಕಾರವು ಉಲ್ಲೇಖ (1) ರ ಆದೇಶದಲ್ಲಿ ವಿಧಿಸಲಾದ ನಿಯಮಾವಳಿಗಳನ್ನು ಪಾಲಿಸುವ ಷರತ್ತಿಗೆ ಒಳಪಟ್ಟು ನಮ್ಮ ಸಂಸ್ಥೆಗೆ ಮುಂದಿನ 5 (ಐದು) ವರ್ಷಗಳ ಕಾಲ ಶೈಕ್ಷಣಿಕ ಸ್ವಾಯತ್ತ ಸ್ಥಾನಮಾನ ನೀಡುವ ಬಗ್ಗೆ ಆಡಳಿತಾತ್ಮಕ ಅನುಮೋದನೆ ನೀಡಿ ಆದೇಶಿಸಿದೆ. ದಿನಾಂಕ 12.12.2025 ರಂದು ನಡೆದ ನಿರ್ದೇಶಕರು, ತಾಂತ್ರಿಕ ಶಿಕ್ಷಣ ನಿರ್ದೇಶನಾಲಯ ಇವರ ಅಧ್ಯಕ್ಷತೆಯ ಆಡಳಿತ ಮಂಡಳಿಯ ಉಲ್ಲೇಖ (3) ರ ಸಭೆಯಲ್ಲಿ, ನಮ್ಮ ಸಂಸ್ಥೆಯ ಸ್ವಾಯತ್ತ ಶೈಕ್ಷಣಿಕ ನಿಯಮಗಳು (ಉಲ್ಲೇಖ (4)), ಶೈಕ್ಷಣಿಕ ಕ್ಯಾಲೆಂಡರ್, ಪರೀಕ್ಷಾ ಕೈಪಿಡಿ (ಉಲ್ಲೇಖ (5)), ಮತ್ತು ಐಕ್ಯೂಎಸಿ ಕೋಶದ ನಿಯಮಾವಳಿ ಮೊದಲಾದವುಗಳನ್ನು ಮಂಡಿಸಿ ಅನುಮೋದನೆ ಪಡೆಯಲಾಗಿದೆ.";

// ------------------------------------------------------------------ text layout

const PAGE = { w: 595.28, h: 841.89 };
const M = { left: 54, right: 48, top: 34, bottom: 74 };
const INK = rgb(0.07, 0.07, 0.07);
const RED = rgb(0.75, 0, 0);
const BLUE = rgb(0.12, 0.3, 0.61);
const NAVY = rgb(0.11, 0.09, 0.26);

const KANNADA = /[ಀ-೿‌‍]+/g;

// One word -> runs of the same script: [{ text, font }]
function runsOf(pieces, F) {
  const out = [];
  for (const { t, b } of pieces) {
    let last = 0;
    for (const m of t.matchAll(KANNADA)) {
      if (m.index > last) out.push({ text: t.slice(last, m.index), font: b ? F.laB : F.la });
      out.push({ text: m[0], font: b ? F.knB : F.kn });
      last = m.index + m[0].length;
    }
    if (last < t.length) out.push({ text: t.slice(last), font: b ? F.laB : F.la });
  }
  return out;
}

// parts: string | [{ t, b }] -> words, each a list of pieces
function wordsOf(parts) {
  const list = typeof parts === "string" ? [{ t: parts, b: false }] : parts;
  const words = [];
  let cur = [];
  for (const { t, b } of list)
    for (const bit of String(t).split(/(\s+)/)) {
      if (!bit) continue;
      if (/^\s+$/.test(bit)) {
        if (cur.length) words.push(cur);
        cur = [];
      } else cur.push({ t: bit, b: Boolean(b) });
    }
  if (cur.length) words.push(cur);
  return words;
}

class Writer {
  constructor(doc, F, footer) {
    this.doc = doc;
    this.F = F;
    this.footer = footer;
    this.pages = 0;
    this.newPage();
  }

  newPage() {
    this.page = this.doc.addPage([PAGE.w, PAGE.h]);
    this.pages++;
    this.y = PAGE.h - M.top;
    this.footer(this);
    if (this.pages > 1) {
      this.center(`-${this.pages}-`, { size: 11 });
      this.y -= 6;
    }
  }

  ensure(h) {
    if (this.y - h < M.bottom) this.newPage();
  }

  width(runs, size) {
    return runs.reduce((w, r) => w + r.font.widthOfTextAtSize(r.text, size), 0);
  }

  drawRuns(runs, x, y, size, color) {
    for (const r of runs) {
      this.page.drawText(r.text, { x, y, size, font: r.font, color });
      x += r.font.widthOfTextAtSize(r.text, size);
    }
  }

  // Lines of a paragraph that fits in `width` (first line `indent` shorter)
  lines(parts, size, width, indent = 0) {
    const space = this.F.la.widthOfTextAtSize(" ", size);
    const out = [];
    let line = [];
    let w = 0;
    for (const word of wordsOf(parts)) {
      const runs = runsOf(word, this.F);
      const ww = this.width(runs, size);
      const room = width - (out.length ? 0 : indent);
      if (line.length && w + space + ww > room) {
        out.push({ words: line, w });
        line = [];
        w = 0;
      }
      line.push({ runs, w: ww });
      w += (line.length > 1 ? space : 0) + ww;
    }
    if (line.length) out.push({ words: line, w });
    return out;
  }

  // align: left | center | right | justify
  para(parts, { size = 11.5, x = M.left, width = PAGE.w - M.left - M.right, indent = 0, align = "left", gap = 1.55, color = INK, after = 4 } = {}) {
    const space = this.F.la.widthOfTextAtSize(" ", size);
    const lines = this.lines(parts, size, width, indent);
    lines.forEach((ln, i) => {
      this.ensure(size * gap);
      this.y -= size * gap;
      const first = i === 0 ? indent : 0;
      const room = width - first;
      const last = i === lines.length - 1;
      let gapW = space;
      let lx = x + first;
      if (align === "justify" && !last && ln.words.length > 1) gapW = space + (room - ln.w) / (ln.words.length - 1);
      else if (align === "center") lx = x + (width - ln.w) / 2;
      else if (align === "right") lx = x + width - ln.w;
      for (const wd of ln.words) {
        this.drawRuns(wd.runs, lx, this.y, size, color);
        lx += wd.w + gapW;
      }
    });
    this.y -= after;
  }

  center(text, opts = {}) {
    this.para(text, { align: "center", after: 0, ...opts });
  }

  rule(thick = 1.2, color = NAVY) {
    this.page.drawLine({ start: { x: M.left, y: this.y }, end: { x: PAGE.w - M.right, y: this.y }, thickness: thick, color });
  }
}

// ------------------------------------------------------------------ the order

// Loads fonts and images once per document
async function setup(doc) {
  doc.registerFontkit(fontkit);
  const font = (f) => doc.embedFont(asset(`fonts/${f}`), { subset: true });
  const [kn, knB, la, laB, serif, serifB] = await Promise.all([
    font("NotoSansKannada-Regular.ttf"),
    font("NotoSansKannada-Bold.ttf"),
    font("NotoSans-Regular.ttf"),
    font("NotoSans-Bold.ttf"),
    font("NotoSerif-Regular.ttf"),
    font("NotoSerif-Bold.ttf"),
  ]);
  const img = async (name, kind) => {
    try {
      return kind === "jpg" ? await doc.embedJpg(asset(name)) : await doc.embedPng(asset(name));
    } catch {
      return null; // a missing picture must not stop the order
    }
  };
  return {
    F: { kn, knB, la, laB, serif, serifB },
    crest: await img("logo-crest.jpg", "jpg"),
    jubilee: await img("logo-jubilee.png", "png"),
    emblem: await img("logo-emblem.png", "png"),
    signature: await img("coe-signature.png", "png"),
  };
}

function letterhead(W, { F, crest, jubilee, emblem }) {
  const top = W.y;
  const side = 74;
  const draw = (im, x) => {
    if (!im) return;
    const h = side;
    const w = (im.width / im.height) * h;
    W.page.drawImage(im, { x: x === "left" ? M.left : PAGE.w - M.right - w, y: top - h - 6, width: w, height: h });
  };
  draw(crest, "left");
  draw(jubilee, "right");
  if (emblem) {
    const h = 34;
    const w = (emblem.width / emblem.height) * h;
    W.page.drawImage(emblem, { x: (PAGE.w - w) / 2, y: top - h, width: w, height: h });
  }
  W.y = top - 36;
  const line = (text, font, size, color) => {
    W.y -= size + 2.2;
    const w = font.widthOfTextAtSize(text, size);
    W.page.drawText(text, { x: (PAGE.w - w) / 2, y: W.y, size, font, color });
  };
  line("GOVERNMENT OF KARNATAKA", F.serifB, 12, INK);
  line("DEPARTMENT OF COLLEGIATE AND TECHNICAL EDUCATION", F.serifB, 11, INK);
  line("KARNATAKA (GOVT.) POLYTECHNIC, MANGALURU", F.serifB, 13.5, RED);
  line("(First Autonomous Polytechnic in India from AICTE New Delhi)", F.serifB, 10, BLUE);
  line("Kadri Hills, Mangaluru– 575004, Dakshina Kannada, Karnataka", F.serif, 10, INK);
  W.y -= 6;
  W.rule(1.8);
  W.y -= 4;
}

function footer(W) {
  const { page } = W;
  const F = W.F;
  const y0 = M.bottom - 22;
  page.drawLine({ start: { x: M.left, y: y0 + 14 }, end: { x: PAGE.w - M.right, y: y0 + 14 }, thickness: 1.2, color: NAVY });
  const line = (runs, y, size, color) => {
    const w = W.width(runs, size);
    W.drawRuns(runs, (PAGE.w - w) / 2, y, size, color);
  };
  line(runsOf([{ t: "ಕರ್ನಾಟಕ (ಸರ್ಕಾರಿ) ಪಾಲಿಟೆಕ್ನಿಕ್, ಮಂಗಳೂರು", b: true }], F), y0, 9.5, RED);
  line(runsOf([{ t: "ಕದ್ರಿ ಹಿಲ್ಸ್, ಮಂಗಳೂರು - 575004, ದಕ್ಷಿಣ ಕನ್ನಡ, ಕರ್ನಾಟಕ", b: false }], F), y0 - 13, 9, INK);
  line(runsOf([{ t: "Phone No. 0824 – 3516910 / 2211636, E-Mail: kptmng@gmail.com", b: false }], F), y0 - 25, 9, INK);
}

// A table row whose cells wrap; returns the row height
function tableRow(W, cols, cells, { size = 10.5, bold = false, pad = 5 } = {}) {
  const prepared = cells.map((c, i) => W.lines([{ t: String(c ?? ""), b: bold }], size, cols[i] - pad * 2));
  const lh = size * 1.5;
  const h = Math.max(...prepared.map((l) => l.length)) * lh + pad * 2;
  W.ensure(h);
  let x = M.left;
  const top = W.y;
  prepared.forEach((lines, i) => {
    W.page.drawRectangle({ x, y: top - h, width: cols[i], height: h, borderColor: INK, borderWidth: 0.8 });
    let y = top - pad - (h - pad * 2 - lines.length * lh) / 2;
    for (const ln of lines) {
      y -= lh;
      let lx = x + (cols[i] - ln.w) / 2;
      for (const wd of ln.words) {
        W.drawRuns(wd.runs, lx, y + size * 0.35, size, INK);
        lx += wd.w + W.F.la.widthOfTextAtSize(" ", size);
      }
    }
    x += cols[i];
  });
  W.y = top - h;
}

// The college for the copy to the Principal: { code, name }
//   from the faculty record, or parsed from a typed "345 – Govt. Polytechnic, X"
export function collegeParts(ext = {}, user = null) {
  if (user?.collegeCode) return { code: user.collegeCode, name: user.collegeName || "" };
  const m = String(ext.college || "").match(/^\s*(\d{2,4})\s*[–—-]\s*(.+)$/);
  return m ? { code: m[1], name: m[2].trim() } : { code: "", name: String(ext.college || "").trim() };
}

// One order (one or more pages) into `doc`.
//   order: { exam: { name }, panel, college: { code, name }, date, from, to, start }
function drawOrder(doc, A, { exam, panel, college = {}, date = new Date(), from = "", to = "", start = "" }) {
  const F = A.F;
  const W = new Writer(doc, F, footer);
  const ext = panel.external || {};
  const designation = ext.designation || "Lecturer";
  const designationKn = DESIGNATION_KN[designation] || "ಉಪನ್ಯಾಸಕರು";
  const department = deptFull(ext.department || panel.department);
  const collegeName = college.name || ext.college || "";
  const full = PAGE.w - M.left - M.right;

  letterhead(W, A);

  // reference number (left) and office (right)
  const yTop = W.y;
  W.para(`ನಂ: ${ORDER_REF_PREFIX}/${academicYear(date)}`, { size: 10.5, width: full / 2, after: 0 });
  W.y = yTop;
  W.para("ಪರೀಕ್ಷಾ ನಿಯಂತ್ರಕರ ಕಚೇರಿ,", { size: 10.5, align: "right", after: 0 });
  W.para("ಕರ್ನಾಟಕ(ಸರ್ಕಾರಿ) ಪಾಲಿಟೆಕ್ನಿಕ್(ಸ್ವಾಯತ್ತ)", { size: 10.5, align: "right", after: 0 });
  W.para(`ಮಂಗಳೂರು, ದಿನಾಂಕ: ${dmy(date)}.`, { size: 10.5, align: "right", after: 6 });

  // to the examiner
  W.para("ರಿಗೆ,", { size: 11, after: 0 });
  W.para([{ t: ext.name || "", b: true }], { size: 11, x: M.left + 28, width: full - 28, after: 0 });
  W.para(`${designationKn}, ${department},`, { size: 11, x: M.left + 28, width: full - 28, after: 0 });
  W.para([{ t: collegeName ? `${collegeName}.` : "________________________", b: false }], { size: 11, x: M.left + 28, width: full - 28, after: 6 });

  // subject and references
  const label = (text) => {
    const y = W.y;
    W.para(text, { size: 11, x: M.left + 28, width: 60, after: 0 });
    W.y = y;
  };
  label("ವಿಷಯ:-");
  W.para([{ t: `${exam.name} ಡಿಪ್ಲೋಮ ಸೆಮಿಸ್ಟರ್ ಪ್ರಾಯೋಗಿಕ ಪರೀಕ್ಷೆಗಳಿಗೆ ಬಾಹ್ಯ ಪರೀಕ್ಷಕರಾಗಿ ನಿಯೋಜಿಸುವ ಬಗ್ಗೆ.`, b: true }], { size: 11, x: M.left + 92, width: full - 92, after: 3 });
  label("ಉಲ್ಲೇಖ:-");
  REFERENCES.forEach((r, i) => {
    const y = W.y;
    W.para(`${i + 1}.`, { size: 10.5, x: M.left + 92, width: 16, after: 0 });
    W.y = y;
    W.para(r, { size: 10.5, x: M.left + 110, width: full - 110, after: 0, gap: 1.45 });
  });
  W.center("-----------", { size: 10.5 });
  W.y -= 4;

  const body = { size: 11, align: "justify", indent: 36, after: 5 };
  W.para(PARA_1, body);
  W.para(PARA_2, body);
  const period = from && to ? `ದಿನಾಂಕ ${dmy(from)} ರಿಂದ ${dmy(to)} ರವರೆಗೆ` : "ಮುಂದೆ ತಿಳಿಸಲಾಗುವ ದಿನಾಂಕಗಳಂದು";
  W.para(
    `ಮೇಲ್ಕಂಡ ವಿಷಯಕ್ಕೆ ಸಂಬಂಧಿಸಿದಂತೆ ${exam.name} ಪ್ರಾಯೋಗಿಕ ಪರೀಕ್ಷೆಗಳನ್ನು ${period} ನಮ್ಮ ಸಂಸ್ಥೆಯಲ್ಲಿ ನಡೆಸಲಾಗುವುದು. ಸದರಿ ಪ್ರಾಯೋಗಿಕ ಪರೀಕ್ಷೆಗಳಿಗೆ ತಮ್ಮನ್ನು ಬಾಹ್ಯ ಪರೀಕ್ಷಕರಾಗಿ (External Examiner) ನಿಯೋಜಿಸಲಾಗಿದೆ. ಕೋಷ್ಟಕ - 1 ರಲ್ಲಿ ನಮೂದಿಸಿದ ದಿನಾಂಕದಂದು ನಮ್ಮ ಸಂಸ್ಥೆಗೆ ಹಾಜರಾಗಿ ಪರೀಕ್ಷಾ ಕಾರ್ಯವನ್ನು ನಿರ್ವಹಿಸಲು ಸೂಚಿಸಿದೆ.`,
    { ...body, after: 8 }
  );

  // Table 1
  W.ensure(110);
  W.center([{ t: "ಕೋಷ್ಟಕ - 1", b: true }], { size: 11 });
  W.y -= 6;
  const cols = [40, 104, 80, 92, 92, full - 408];
  tableRow(W, cols, ["ಕ್ರ.ಸಂ", "ಉಪನ್ಯಾಸಕರ ಹೆಸರು", "ಪದನಾಮ", "ವಿಭಾಗದ ಹೆಸರು", "ಸಂಸ್ಥೆಯ ಹೆಸರು", "ಪರೀಕ್ಷಾ ಪ್ರಾರಂಭ ದಿನಾಂಕ"], { bold: true });
  tableRow(W, cols, ["1", ext.name || "", designation, department, collegeName, start ? dmy(start) : "ಮುಂದೆ ತಿಳಿಸಲಾಗುವುದು"]);

  // signature
  const sig = A.signature;
  const sw = 190;
  const sh = sig ? (sig.height / sig.width) * sw : 60;
  W.ensure(sh + 70);
  W.y -= 16;
  if (sig) W.page.drawImage(sig, { x: PAGE.w - M.right - sw, y: W.y - sh, width: sw, height: sh });
  else {
    W.para("ಪರೀಕ್ಷಾ ನಿಯಂತ್ರಕರು", { size: 11, align: "right", after: 0 });
    W.para([{ t: "CONTROLLER OF EXAMINATION", b: true }], { size: 11, align: "right", after: 0 });
  }
  W.y -= sig ? sh : 0;

  // copy to the Principal of his college
  W.y -= 6;
  W.para("ಪ್ರತಿಗಳು:", { size: 11, after: 0 });
  W.para(
    `1) ಪ್ರಾಂಶುಪಾಲರು, ${college.code ? `ಸಂಸ್ಥೆಯ ಕೋಡ್: ${college.code}, ` : ""}${collegeName || "________________"} — ಮಾಹಿತಿಗಾಗಿ ಹಾಗೂ ಸದರಿ ಉಪನ್ಯಾಸಕರನ್ನು ಪ್ರಾಯೋಗಿಕ ಪರೀಕ್ಷಾ ಕಾರ್ಯಕ್ಕೆ ಬಿಡುಗಡೆಗೊಳಿಸಲು ಕೋರಿದೆ.`,
    { size: 11, x: M.left + 24, width: full - 24, after: 0 }
  );
}

// orders: [{ exam, panel, college, date, from, to, start }] -> PDF bytes (one order after another)
export async function practicalOrdersPdf(orders) {
  const doc = await PDFDocument.create();
  doc.setTitle("Office order – Practical examiner");
  doc.setAuthor("Controller of Examination, Karnataka (Govt.) Polytechnic, Mangaluru");
  const A = await setup(doc);
  for (const o of orders) drawOrder(doc, A, o);
  return Buffer.from(await doc.save());
}
