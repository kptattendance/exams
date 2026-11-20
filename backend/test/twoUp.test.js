import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, StandardFonts } from "pdf-lib";

import { twoUp } from "../src/services/twoUp.js";

async function samplePdf(pages) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= pages; i++) doc.addPage([595.28, 841.89]).drawText(`Question page ${i}`, { x: 72, y: 760, size: 12, font });
  return Buffer.from(await doc.save());
}

test("two A4 pages side by side on A4 landscape; an odd last page leaves the right half blank", async () => {
  const r = await twoUp(await samplePdf(5), { trimMm: 12 });
  const out = await PDFDocument.load(r.pdf);
  assert.equal(out.getPageCount(), 3); // 1–2, 3–4, 5
  const { width, height } = out.getPage(0).getSize();
  assert.ok(width > height); // landscape
  assert.equal(Math.round(width), 842);
  assert.equal(r.pages, 5);
  assert.equal(r.sheets, 2); // printed double-sided
  assert.ok(r.scale >= 70 && r.scale <= 90, `scale ${r.scale}`); // trimming the white margin enlarges it
});

test("without trimming the pages are shrunk to about 70%", async () => {
  const r = await twoUp(await samplePdf(2), { trimMm: 0 });
  assert.ok(r.scale >= 65 && r.scale <= 72, `scale ${r.scale}`);
});
