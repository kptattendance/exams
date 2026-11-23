// src/services/examComputers.js
//
// Checks that a question paper is printed on a computer approved by the COE /
// Admin (unit-tested in test/examComputers.test.js). The browser signs a one-time
// question with its own key; the server checks it with the stored public key.

import crypto from "node:crypto";

export const UNLOCK_MINUTES = 30;
export const CHALLENGE_MINUTES = 6; // long enough to type the verification code

// Only a P-256 public key is accepted -> { kty, crv, x, y } or null
export function cleanKey(jwk) {
  if (!jwk || jwk.kty !== "EC" || jwk.crv !== "P-256") return null;
  const part = /^[A-Za-z0-9_-]{43}$/;
  if (!part.test(String(jwk.x)) || !part.test(String(jwk.y))) return null;
  const key = { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y };
  try {
    crypto.createPublicKey({ key, format: "jwk" });
    return key;
  } catch {
    return null;
  }
}

export const keyIdOf = (key) => crypto.createHash("sha256").update(`${key.x}.${key.y}`).digest("hex");

// What people read out to each other: "A1B2-C3D4"
export const shortCode = (keyId) => `${keyId.slice(0, 4)}-${keyId.slice(4, 8)}`.toUpperCase();

export const proofMessage = ({ challengeId, nonce, paperId, userId }) => `exam-print|${challengeId}|${nonce}|${paperId}|${userId}`;

export function verifyProof(publicKey, message, signature) {
  try {
    const key = crypto.createPublicKey({ key: { kty: publicKey.kty, crv: publicKey.crv, x: publicKey.x, y: publicKey.y }, format: "jwk" });
    return crypto.verify("sha256", Buffer.from(message), { key, dsaEncoding: "ieee-p1363" }, Buffer.from(String(signature), "base64url"));
  } catch {
    return false;
  }
}

// Registered, or inside a short emergency unlock
export const computerAllowed = (computer, now = new Date()) =>
  Boolean(computer) && (computer.status === "ACTIVE" || (Boolean(computer.unlockedUntil) && new Date(computer.unlockedUntil) > now));
