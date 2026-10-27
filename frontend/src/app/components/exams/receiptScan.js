// Read a fee receipt / UPI screenshot / bank slip photo in the browser and
// pick out the transaction number, amount and date. Nothing is uploaded –
// the text is read on this computer (tesseract.js), and the office checks
// the filled-in boxes before saving.
//
//   const { txnNo, amount, paidOn, text } = await scanReceipt(file, (p) => setProgress(p));

let workerPromise = null;

async function getWorker(onProgress) {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      return createWorker("eng", 1, {
        logger: (m) => m.status === "recognizing text" && onProgress?.(Math.round(m.progress * 100)),
      });
    })().catch((e) => {
      workerPromise = null;
      throw e;
    });
  }
  return workerPromise;
}

export async function scanReceipt(file, onProgress) {
  const worker = await getWorker(onProgress);
  const { data } = await worker.recognize(file);
  const text = data?.text || "";
  return { ...parseReceipt(text), text };
}

// ------------------------------------------------------------------ parsing

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n) => String(n).padStart(2, "0");
const iso = (y, m, d) => {
  y = Number(y) < 100 ? 2000 + Number(y) : Number(y);
  m = Number(m);
  d = Number(d);
  if (!(y > 2000 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return "";
  return `${y}-${pad(m)}-${pad(d)}`;
};

function findTxn(lines, text) {
  // Label followed by the number, on the same line or the next one
  const label =
    /(utr|u\.t\.r|upi\s*ref|ref(erence)?\s*(no|number|id)?|txn|transaction\s*(id|no|number|ref)?|receipt\s*(no|number)|challan\s*(no|number)?|bank\s*ref|rrn|order\s*id|payment\s*id)/i;
  for (let i = 0; i < lines.length; i++) {
    if (!label.test(lines[i])) continue;
    const after = lines[i].replace(/^.*?(utr|ref(erence)?|txn|transaction|receipt|challan|rrn|order|payment)[^:#\-\s]*\s*(id|no|number)?\.?\s*[:#\-]?\s*/i, "");
    for (const candidate of [after, lines[i + 1] || ""]) {
      const m = candidate.match(/[A-Z0-9][A-Z0-9\-/]{3,}/i);
      if (m && /\d{3,}/.test(m[0])) return m[0].replace(/[-/]+$/, "");
    }
  }
  // UPI UTR numbers are 12 digits
  const utr = text.match(/\b\d{12}\b/);
  return utr ? utr[0] : "";
}

function findAmount(lines) {
  const money = /(?:₹|rs\.?|inr|amount|amt|paid|total)\s*[:\-]?\s*₹?\s*([0-9][0-9,]*(?:\.\d{1,2})?)/gi;
  const found = [];
  for (const line of lines) {
    for (const m of line.matchAll(money)) {
      const n = Number(m[1].replace(/,/g, ""));
      if (Number.isFinite(n) && n > 0 && n < 1000000) found.push({ n, strong: /amount|total|paid/i.test(line) });
    }
  }
  if (!found.length) return "";
  const strong = found.filter((f) => f.strong);
  return String(Math.max(...(strong.length ? strong : found).map((f) => f.n)));
}

function findDate(text) {
  let m = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/); // 12-11-2026 (Indian order)
  if (m) return iso(m[3], m[2], m[1]);
  m = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3})[a-z]*,?\s+(\d{2,4})\b/); // 12 Nov 2026
  if (m && MONTHS[m[2].toLowerCase()]) return iso(m[3], MONTHS[m[2].toLowerCase()], m[1]);
  m = text.match(/\b([A-Za-z]{3})[a-z]*\s+(\d{1,2}),?\s+(\d{4})\b/); // Nov 12, 2026
  if (m && MONTHS[m[1].toLowerCase()]) return iso(m[3], MONTHS[m[1].toLowerCase()], m[2]);
  m = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/); // 2026-11-12
  if (m) return iso(m[1], m[2], m[3]);
  return "";
}

export function parseReceipt(text) {
  const lines = String(text)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const paidOn = findDate(text);
  const today = new Date().toISOString().slice(0, 10);
  return {
    txnNo: findTxn(lines, text),
    amount: findAmount(lines),
    paidOn: paidOn && paidOn <= today ? paidOn : "",
  };
}
