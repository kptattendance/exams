"use client";

// The COE's and the Principal's signatures for printing (hall tickets only).
// They are private: fetched from the server by signed-in staff and kept only
// in this open page (blob: links). Nothing is in the code or the public folder.
// The Admin uploads them in Admin → Settings → Signatures.
//
//   const sig = useSignatures();   sig.coe = { title, name, src } (src may be "")

import { useEffect, useState } from "react";

import { useApi } from "../exams/shared";

const EMPTY = { coe: { title: "COE", name: "", src: "" }, principal: { title: "Principal", name: "", src: "" } };

export function useSignatures() {
  const api = useApi();
  const [sig, setSig] = useState(EMPTY);

  useEffect(() => {
    let alive = true;
    const made = [];
    (async () => {
      try {
        const info = (await api("get", "/signatures")).data.data;
        const out = {};
        for (const who of Object.keys(EMPTY)) {
          const v = info[who] || {};
          let src = "";
          if (v.uploaded) {
            try {
              const r = await api("get", `/signatures/${who}/image`, undefined, { responseType: "blob" });
              src = URL.createObjectURL(r.data);
              made.push(src);
            } catch {
              // no image – the line is printed without it
            }
          }
          out[who] = { title: v.title || EMPTY[who].title, name: v.name || "", src };
        }
        if (alive) setSig(out);
      } catch {
        // not allowed / offline – lines without signatures
      }
    })();
    return () => {
      alive = false;
      made.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [api]);

  return sig;
}
