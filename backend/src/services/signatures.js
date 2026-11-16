// src/services/signatures.js
//
// Signatures of the COE and the Principal, printed on hall tickets (and the
// COE's on the practical examiners' office orders).
// Kept PRIVATE: in Cloudinary as "authenticated" images (no public link) and
// served only through the server to signed-in staff. Never in the code or on
// GitHub. The Admin uploads / replaces them (and the names) in Settings.
//
// Setting "signatures": { coe: { name, publicId, version, at, by }, principal: {…} }

import axios from "axios";

import cloudinary from "../config/cloudinary.js";
import Setting from "../models/Setting.js";

// coeSeal: the COE's signature with the seal and address, on the office orders
export const SIGNERS = { coe: "COE", principal: "Principal", coeSeal: "COE signature with seal (office orders)" };
const KEY = "signatures";

export async function readSignatures() {
  const s = await Setting.findById(KEY).lean();
  return s?.value || {};
}

async function write(value, by) {
  await Setting.updateOne({ _id: KEY }, { $set: { value, updatedBy: by } }, { upsert: true });
}

// a short-lived signed link, used only by the server
const signedUrl = (v) => cloudinary.url(v.publicId, { type: "authenticated", sign_url: true, secure: true, version: v.version, format: "png" });

// -> { buffer, contentType } or null (none uploaded)
export async function signatureImage(who) {
  const v = (await readSignatures())[who];
  if (!v?.publicId) return null;
  const r = await axios.get(signedUrl(v), { responseType: "arraybuffer", timeout: 15000 });
  return { buffer: Buffer.from(r.data), contentType: r.headers["content-type"] || "image/png" };
}

// upload (or replace) the image and/or change the name
export async function saveSignature(who, { buffer = null, name, by = "" } = {}) {
  const all = await readSignatures();
  const cur = { ...(all[who] || {}) };
  if (name !== undefined) cur.name = String(name).trim().slice(0, 80);
  if (buffer) {
    const up = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          { type: "authenticated", folder: "kpt-private/signatures", public_id: `${who}-signature`, overwrite: true, invalidate: true, format: "png", resource_type: "image" },
          (err, res) => (err ? reject(err) : resolve(res))
        )
        .end(buffer);
    });
    cur.publicId = up.public_id;
    cur.version = up.version;
  }
  cur.at = new Date();
  cur.by = by;
  await write({ ...all, [who]: cur }, by);
  return cur;
}

export async function removeSignature(who, by = "") {
  const all = await readSignatures();
  const v = all[who];
  if (v?.publicId) await cloudinary.uploader.destroy(v.publicId, { type: "authenticated", invalidate: true }).catch(() => {});
  const { [who]: _gone, ...rest } = all;
  await write(rest, by);
}

// what the pages may know: names and whether an image is there (never the link)
export const publicView = (all) =>
  Object.fromEntries(Object.keys(SIGNERS).map((k) => [k, { title: SIGNERS[k], name: all[k]?.name || "", uploaded: Boolean(all[k]?.publicId), at: all[k]?.at || null }]));
