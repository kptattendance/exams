import test from "node:test";
import assert from "node:assert/strict";

import { asHodScope, isEvening, shiftOf, shiftQuery, studentShift, sheetShift } from "../src/services/evening.js";

const run = (user, extra = {}) => {
  const req = { user: { ...user }, headers: {}, query: {}, body: {}, ...extra };
  asHodScope(req, {}, () => {});
  return req;
};

test("186 register numbers are the evening college", () => {
  assert.equal(isEvening("186EE25001"), true);
  assert.equal(isEvening("103EE25001"), false);
  assert.equal(shiftOf("186ME26003"), "EVENING");
  assert.equal(shiftOf("103CS26001"), "DAY");
});

test("the Evening Principal acts as HOD of evening students of the chosen department", () => {
  const req = run({ role: "evening_principal" }, { headers: { "x-department": "me" } });
  assert.equal(req.user.role, "hod");
  assert.equal(req.user.department, "me");
  assert.equal(sheetShift(req), "EVENING");
  assert.deepEqual(shiftQuery(req), { shift: "EVENING" });
  assert.ok(studentShift(req).registerNumber.test("186ME26001"));
  // a department that has no evening college falls back to the first one
  assert.equal(run({ role: "evening_principal" }, { headers: { "x-department": "cs" } }).user.department, "ee");
});

test("a day HOD sees only day students and the day sheet; COE is not limited", () => {
  const req = run({ role: "hod", department: "ee" });
  assert.equal(req.user.department, "ee");
  assert.equal(sheetShift(req), "DAY");
  assert.deepEqual(shiftQuery(req), { shift: { $ne: "EVENING" } });
  const rx = studentShift(req).registerNumber.$not;
  assert.equal(rx.test("186EE25001"), true); // excluded
  const coe = run({ role: "coe" });
  assert.deepEqual(studentShift(coe), {});
  assert.deepEqual(shiftQuery(coe), {});
  assert.deepEqual(shiftQuery(run({ role: "coe" }, { query: { shift: "EVENING" } })), { shift: "EVENING" });
});
