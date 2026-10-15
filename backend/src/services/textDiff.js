// src/services/textDiff.js
//
// Line-by-line comparison of two texts, like "git diff": which lines were
// removed and which were added. Used to tell a paper setter what the
// scrutiniser changed. Unit-tested in test/textDiff.test.js.

// Paragraphs of a document's plain text, empty lines dropped
export const linesOf = (text) =>
  String(text || "")
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

// -> [{ op: "same" | "removed" | "added", text }]  (longest common subsequence)
export function diffLines(before, after) {
  const a = before;
  const b = after;
  const n = a.length;
  const m = b.length;
  // lcs[i][j] = length of the common part of a[i..] and b[j..]
  const lcs = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const out = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ op: "same", text: a[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ op: "removed", text: a[i++] });
    } else {
      out.push({ op: "added", text: b[j++] });
    }
  }
  while (i < n) out.push({ op: "removed", text: a[i++] });
  while (j < m) out.push({ op: "added", text: b[j++] });
  return out;
}

// The changes only, each with the line before it for context.
// -> { changes: [{ op, text, after }], added, removed }
export function changeRecord(beforeText, afterText) {
  const diff = diffLines(linesOf(beforeText), linesOf(afterText));
  const changes = [];
  let last = "";
  for (const d of diff) {
    if (d.op === "same") last = d.text;
    else changes.push({ op: d.op, text: d.text, after: last });
  }
  return {
    changes,
    added: changes.filter((c) => c.op === "added").length,
    removed: changes.filter((c) => c.op === "removed").length,
  };
}
