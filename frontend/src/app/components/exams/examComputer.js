"use client";

// This computer's security key for printing question papers. It is made once and
// kept in this browser; its secret half cannot be read or sent anywhere. The
// server knows only the public half (backend: services/examComputers.js).

const DB = "kpt-exam-computer";
const STORE = "keys";
const ID = "device";
const ALGO = { name: "ECDSA", namedCurve: "P-256" };

const NO_KEY = "This browser cannot keep a security key. Use Chrome, and not an Incognito window.";

const openDb = () =>
  new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });

const read = (db) =>
  new Promise((resolve, reject) => {
    const r = db.transaction(STORE).objectStore(STORE).get(ID);
    r.onsuccess = () => resolve(r.result || null);
    r.onerror = () => reject(r.error);
  });

// Two tabs at once: the first key saved is the one both use
const saveFirst = (db, pair) =>
  new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    let kept = pair;
    const g = store.get(ID);
    g.onsuccess = () => {
      if (g.result) kept = g.result;
      else store.put(pair, ID);
    };
    tx.oncomplete = () => resolve(kept);
    tx.onerror = () => reject(tx.error);
  });

const base64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const hex = (bytes) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function keyPair() {
  if (!globalThis.crypto?.subtle || !globalThis.indexedDB) throw new Error(NO_KEY);
  try {
    const db = await openDb();
    try {
      const have = await read(db);
      if (have) return have;
      // not extractable: the secret half can only be used, never read
      const made = await crypto.subtle.generateKey(ALGO, false, ["sign", "verify"]);
      return await saveFirst(db, made);
    } finally {
      db.close();
    }
  } catch {
    throw new Error(NO_KEY);
  }
}

// -> { publicKey (JWK), keyId }
export async function computerKey() {
  const pair = await keyPair();
  const { kty, crv, x, y } = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const keyId = hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${x}.${y}`)));
  return { publicKey: { kty, crv, x, y }, keyId };
}

export async function signForPrint(message) {
  const pair = await keyPair();
  return base64url(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey, new TextEncoder().encode(message)));
}
