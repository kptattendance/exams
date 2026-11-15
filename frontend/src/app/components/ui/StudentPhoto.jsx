"use client";

// A student's photo in a list: a small round picture; click it to see it
// large, with ✕ to close (Esc or a click outside closes it too).
// Cloudinary photos are loaded small for the list and larger only when opened.
//
//   <StudentPhoto url={s.imageUrl} name={s.name} />

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const sized = (url = "", w) =>
  /res\.cloudinary\.com\/.+\/image\/upload\//.test(url) ? url.replace("/image/upload/", `/image/upload/c_fill,g_face,w_${w},h_${Math.round(w * 1.25)},q_auto,f_auto/`) : url;
const initials = (name = "") =>
  String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

export default function StudentPhoto({ url, name = "", size = 36 }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!url)
    return (
      <span style={{ width: size, height: size }} className="flex shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-500">
        {initials(name) || "?"}
      </span>
    );

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title="Click to enlarge" className="shrink-0 rounded-full ring-1 ring-slate-200 hover:ring-2 hover:ring-blue-400">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={sized(url, size * 2)} alt="" loading="lazy" decoding="async" style={{ width: size, height: size }} className="rounded-full object-cover" />
      </button>
      {open &&
        createPortal(
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4" onClick={() => setOpen(false)} role="dialog" aria-modal="true">
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sized(url, 480)} alt={name} className="max-h-[80vh] max-w-[90vw] rounded-2xl bg-white object-contain shadow-2xl" />
              {name && <p className="mt-2 text-center text-sm font-semibold text-white">{name}</p>}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="absolute -right-3 -top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white text-xl font-bold text-slate-700 shadow-lg hover:bg-slate-100"
              >
                ×
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
