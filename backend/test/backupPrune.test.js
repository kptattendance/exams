import test from "node:test";
import assert from "node:assert/strict";

import { planPrune } from "../src/services/backupJob.js";

// one backup every night at 2 AM India time for 300 days; the tidy-up runs just after tonight's backup
const now = new Date("2026-11-20T02:05:00+05:30");
const nightly = [];
for (let i = 0; i < 300; i++) nightly.push({ _id: `n${i}`, status: "OK", createdAt: new Date(now.getTime() - i * 86400000 - 5 * 60000) });

test("keeps 7 days, 4 weeks, 6 months – removes the rest", () => {
  const { remove } = planPrune(nightly, now);
  const kept = nightly.filter((b) => !remove.includes(b));
  assert.ok(kept.length <= 7 + 4 + 6, `kept ${kept.length}`);
  assert.ok(kept.length >= 12, `kept ${kept.length}`);
  // the newest 7 nights are all kept
  for (let i = 0; i < 7; i++) assert.ok(kept.includes(nightly[i]), `night ${i}`);
  // nothing older than about 6 months
  for (const b of kept) assert.ok(now - b.createdAt < 190 * 86400000);
});

test("a backup marked Keep is never removed, and failed ones go after 30 days", () => {
  const list = [...nightly, { _id: "old-keep", status: "OK", keep: true, createdAt: new Date("2025-01-01") }, { _id: "f1", status: "FAILED", createdAt: new Date("2026-09-01") }];
  const { remove, oldFailed } = planPrune(list, now);
  assert.ok(!remove.some((b) => b._id === "old-keep"));
  assert.deepEqual(oldFailed.map((b) => b._id), ["f1"]);
});

test("with only a few backups nothing recent is removed", () => {
  const few = nightly.slice(0, 3);
  assert.deepEqual(planPrune(few, now).remove, []);
});
