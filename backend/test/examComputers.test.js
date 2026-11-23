import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { PDFDocument } from "pdf-lib";

import { cleanKey, computerAllowed, keyIdOf, proofMessage, shortCode, verifyProof } from "../src/services/examComputers.js";
import { stampPdf } from "../src/services/examDay.js";

const makeKey = () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
  return { jwk: publicKey.export({ format: "jwk" }), privateKey };
};
const sign = (privateKey, message) => crypto.sign("sha256", Buffer.from(message), { key: privateKey, dsaEncoding: "ieee-p1363" }).toString("base64url");

test("only a real P-256 public key is accepted", () => {
  const { jwk } = makeKey();
  assert.deepEqual(cleanKey({ ...jwk, d: "secret" }), { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y });
  assert.equal(cleanKey({ ...jwk, crv: "P-384" }), null);
  assert.equal(cleanKey({ ...jwk, x: "short" }), null);
  assert.equal(cleanKey({ ...jwk, x: "A".repeat(43) }), null);
  assert.equal(cleanKey(null), null);
});

test("a print is accepted only when signed by that computer, for that exact request", () => {
  const a = makeKey();
  const b = makeKey();
  const message = proofMessage({ challengeId: "c1", nonce: "n", paperId: "p1", userId: "u1" });
  const signature = sign(a.privateKey, message);
  assert.equal(verifyProof(cleanKey(a.jwk), message, signature), true);
  assert.equal(verifyProof(cleanKey(b.jwk), message, signature), false, "another computer");
  assert.equal(verifyProof(cleanKey(a.jwk), proofMessage({ challengeId: "c1", nonce: "n", paperId: "p2", userId: "u1" }), signature), false, "another paper");
  assert.equal(verifyProof(cleanKey(a.jwk), proofMessage({ challengeId: "c1", nonce: "n", paperId: "p1", userId: "u2" }), signature), false, "another person");
  assert.equal(verifyProof(cleanKey(a.jwk), message, "rubbish"), false);
});

test("registered computers work; others only during an emergency unlock", () => {
  const now = new Date("2026-11-26T09:00:00+05:30");
  const later = new Date(now.getTime() + 60000);
  const earlier = new Date(now.getTime() - 60000);
  assert.equal(computerAllowed({ status: "ACTIVE" }, now), true);
  assert.equal(computerAllowed({ status: "REQUESTED" }, now), false);
  assert.equal(computerAllowed({ status: "REMOVED" }, now), false);
  assert.equal(computerAllowed({ status: "REQUESTED", unlockedUntil: later }, now), true);
  assert.equal(computerAllowed({ status: "REQUESTED", unlockedUntil: earlier }, now), false);
  assert.equal(computerAllowed(null, now), false);
});

test("the computer's short code is stable", () => {
  const { jwk } = makeKey();
  const id = keyIdOf(cleanKey(jwk));
  assert.match(id, /^[0-9a-f]{64}$/);
  assert.match(shortCode(id), /^[0-9A-F]{4}-[0-9A-F]{4}$/);
});

test("the watermark fits a long name on portrait and landscape pages", async () => {
  const doc = await PDFDocument.create();
  doc.addPage([595, 842]);
  doc.addPage([842, 595]);
  const out = await stampPdf(Buffer.from(await doc.save()), "Printed by someone", "A VERY LONG NAME OF THE PERSON WHO PRINTED THIS PAPER - CHIEF EXAMINER");
  assert.equal((await PDFDocument.load(out)).getPageCount(), 2);
});
