import test from "node:test";
import assert from "node:assert/strict";

import { adminOnly, requireRole } from "../src/middlewares/requireRole.js";

// Runs a middleware and reports whether it let the request through
const run = (mw, role) => {
  let status = 0;
  let passed = false;
  const res = { status: (s) => ((status = s), { json: () => {} }) };
  mw({ user: role ? { role } : undefined }, res, () => (passed = true));
  return passed ? "next" : status;
};

test("requireRole lets the listed roles and the Admin through", () => {
  const coe = requireRole("coe", "acoe");
  assert.equal(run(coe, "coe"), "next");
  assert.equal(run(coe, "admin"), "next");
  assert.equal(run(coe, "office"), 403);
  assert.equal(run(coe, ""), 403);
  assert.equal(run(requireRole("qp_scrutinizer"), "admin"), "next");
});

test("adminOnly refuses everyone but the Admin", () => {
  assert.equal(run(adminOnly, "admin"), "next");
  for (const r of ["coe", "acoe", "principal", "office", "hod", "staff", undefined]) assert.equal(run(adminOnly, r), 403);
});
