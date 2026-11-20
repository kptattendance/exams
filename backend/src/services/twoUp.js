// src/services/twoUp.js
//
// Question paper page setting: the PDF the COE saved from Word is laid out
// two pages side by side on A4 landscape (pages 1–2 on the front, 3–4 on the
// back – print double-sided, "flip on short edge"). An odd last page leaves the
// right half blank.
//
// Nothing inside a page is changed or redrawn: each page is placed whole (as
// it came from Word – text, symbols, equations and figures stay exactly as they
// are), only shrunk to fit its half. trimMm cuts away that much of the EMPTY
// white margin on every side first, so the page is shrunk less.

import { PDFDocument } from "pdf-lib";

const MM = 72 / 25.4;
const A4_LANDSCAPE = [841.89, 595.28];
const OUTER = 5 * MM; // paper edge to page
const GUTTER = 6 * MM; // between the two pages

export async function twoUp(buffer, { trimMm = 12 } = {}) {
  const src = await PDFDocument.load(buffer);
  const out = await PDFDocument.create();
  const [W, H] = A4_LANDSCAPE;
  const cellW = (W - 2 * OUTER - GUTTER) / 2;
  const cellH = H - 2 * OUTER;
  const trim = Math.max(0, Math.min(40, Number(trimMm) || 0)) * MM;
  const pages = src.getPages();
  let scaleUsed = 1;

  for (let i = 0; i < pages.length; i += 2) {
    const sheet = out.addPage([W, H]);
    for (let k = 0; k < 2 && i + k < pages.length; k++) {
      const page = pages[i + k];
      const { x: bx, y: by, width: pw, height: ph } = page.getMediaBox();
      const t = Math.min(trim, pw / 4, ph / 4);
      const box = { left: bx + t, bottom: by + t, right: bx + pw - t, top: by + ph - t };
      const embedded = await out.embedPage(page, box);
      const w = box.right - box.left;
      const h = box.top - box.bottom;
      const scale = Math.min(cellW / w, cellH / h);
      scaleUsed = Math.min(scaleUsed, scale);
      sheet.drawPage(embedded, {
        x: OUTER + k * (cellW + GUTTER) + (cellW - w * scale) / 2,
        y: OUTER + (cellH - h * scale), // from the top of the half
        width: w * scale,
        height: h * scale,
      });
    }
  }
  out.setTitle(src.getTitle() || "Question paper");
  return { pdf: Buffer.from(await out.save()), pages: pages.length, sheets: Math.ceil(pages.length / 4), scale: Math.round(scaleUsed * 100) };
}
