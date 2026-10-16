import test from "node:test";
import assert from "node:assert/strict";

import { issuePass, hasPass, requireStepUp, indianMobile } from "../src/services/stepUp.js";

test("a pass works only for its user and scope, and not after it expires", () => {
  const p = issuePass("user_a", "fees");
  assert.equal(hasPass(p.token, "user_a", "fees"), true);
  assert.equal(hasPass(p.token, "user_b", "fees"), false);
  assert.equal(hasPass(p.token, "user_a", "qp"), false);
  assert.equal(hasPass(`other.1.x, ${p.token}`, "user_a", "fees"), true); // several passes in one header
  const [scope, , sig] = p.token.split(".");
  assert.equal(hasPass(`${scope}.${Date.now() - 1000}.${sig}`, "user_a", "fees"), false); // expired / tampered
  assert.equal(hasPass("", "user_a", "fees"), false);
});

test("the guard answers 428 without a pass", () => {
  let status = 0;
  let body = null;
  const res = { status: (s) => ((status = s), res), json: (b) => (body = b) };
  let passed = false;
  requireStepUp("qp")({ headers: {}, user: { id: "u" } }, res, () => (passed = true));
  assert.equal(passed, false);
  assert.equal(status, 428);
  assert.equal(body.stepUp.scope, "qp");

  const p = issuePass("u", "qp");
  requireStepUp("qp")({ headers: { "x-step-up": p.token }, user: { id: "u" } }, res, () => (passed = true));
  assert.equal(passed, true);
});

test("Indian mobile numbers", () => {
  assert.equal(indianMobile("98450 12345"), "919845012345");
  assert.equal(indianMobile("+91-98450-12345"), "919845012345");
  assert.equal(indianMobile("09845012345"), "919845012345");
  assert.equal(indianMobile("2211636"), null); // landline without STD code
  assert.equal(indianMobile(""), null);
});
