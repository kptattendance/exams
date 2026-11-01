"use client";

// Toast messages and confirmation dialogs that match the app's design.
// Replaces the browser's alert(), confirm() and prompt().
//
//   const toast = useToast();
//   toast.success("Saved.");   toast.error("Could not save.");   toast.info("…");
//
//   const confirm = useConfirm();
//   const ok = await confirm({
//     title: "Undo this import?",
//     message: "This removes 64 students…",
//     confirmText: "Undo import",
//     tone: "danger",            // "danger" | "primary"
//     requireText: "UNDO",       // optional: user must type this first
//   });
//
// <FeedbackProvider> is already placed in AppShell, so every signed-in
// page can use these hooks.
//
// Messages are shown as a SweetAlert popup in the middle of the screen (not
// a small toast in a corner), so nobody misses them: errors stay until OK is
// clicked, success / info close by themselves. alert() is shown the same way,
// and usePopupMessage(error) pops up a page's own error / message text.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";

import Icon from "../shell/Icon";

const TITLE = { success: "Done", error: "Please check", info: "Information" };
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// One popup: type "success" | "error" | "info"
export function popup(type, message, ms) {
  if (message === undefined || message === null || message === "") return;
  if (typeof window === "undefined") return;
  const error = type === "error";
  Swal.fire({
    icon: TITLE[type] ? type : "info",
    title: TITLE[type] || TITLE.info,
    html: `<div style="white-space:pre-line;font-size:15px;line-height:1.5">${esc(message)}</div>`,
    confirmButtonText: "OK",
    confirmButtonColor: "#0f172a",
    timer: error ? undefined : Math.max(Number(ms) || 0, 3500),
    timerProgressBar: !error,
  });
}

// A page's own error / message state: pops up whenever it gets a new text
export function usePopupMessage(message, type = "error") {
  useEffect(() => {
    if (message) popup(type, message);
  }, [message, type]);
}

// alert("…") from older pages: error or success guessed from the words
const ALERT_ERROR = /fail|error|could not|couldn't|cannot|can't|invalid|missing|not allowed|denied|please|wrong|unable/i;
const ALERT_OK = /success|saved|deleted|updated|created|added|done|sent|uploaded/i;

const FeedbackContext = createContext(null);

export function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  // shown as a popup in the middle of the screen (see popup above)
  const push = useCallback((type, message, ms) => {
    const id = ++idRef.current;
    popup(type, message, ms);
    return id;
  }, []);

  // A person's photo anywhere on the site opens full screen when clicked
  // (photos are the cropped "object-cover" images; data-zoom / data-no-zoom
  // switch it on or off for any other image). Print / PDF pages are outside.
  const [photo, setPhoto] = useState(null); // { src, alt }
  useEffect(() => {
    const onClick = (e) => {
      const img = e.target instanceof HTMLImageElement ? e.target : null;
      if (!img || !img.src || img.closest("[data-no-zoom]")) return;
      const isPhoto = img.hasAttribute("data-zoom") || String(img.className || "").includes("object-cover");
      if (!isPhoto || /\.svg(\?|$)/i.test(img.src)) return;
      e.preventDefault();
      e.stopPropagation();
      setPhoto({ src: img.currentSrc || img.src, alt: img.alt || "" });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  useEffect(() => {
    if (!photo) return;
    const onKey = (e) => e.key === "Escape" && setPhoto(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [photo]);

  // alert() on any page becomes the same popup
  useEffect(() => {
    const original = window.alert;
    window.alert = (m) => popup(ALERT_ERROR.test(String(m)) ? "error" : ALERT_OK.test(String(m)) ? "success" : "info", String(m ?? ""));
    return () => {
      window.alert = original;
    };
  }, []);

  // Stable object, so pages can safely use it in effect dependencies
  const toast = useMemo(
    () => ({
      success: (m, ms) => push("success", m, ms),
      error: (m, ms) => push("error", m, ms),
      info: (m, ms) => push("info", m, ms),
    }),
    [push]
  );

  const confirm = useCallback(
    (opts) =>
      new Promise((resolve) => {
        setDialog({ ...opts, resolve });
      }),
    []
  );

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  const close = (result) => {
    dialog?.resolve(result);
    setDialog(null);
  };

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <Toasts toasts={toasts} onDismiss={dismiss} />
      {dialog && <ConfirmDialog {...dialog} onClose={close} />}
      {photo && (
        <div className="fixed inset-0 z-[95] flex flex-col items-center justify-center bg-slate-950/90 p-4" role="dialog" aria-modal="true" onClick={() => setPhoto(null)}>
          <button onClick={() => setPhoto(null)} className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-2xl leading-none text-white hover:bg-white/20" aria-label="Close photo">
            ×
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.src} alt={photo.alt} data-no-zoom className="max-h-[85vh] max-w-[92vw] rounded-2xl object-contain shadow-2xl" />
          {photo.alt && <p className="mt-3 text-sm font-semibold text-white">{photo.alt}</p>}
        </div>
      )}
    </FeedbackContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(FeedbackContext);
  // Fallback so a page outside the provider never crashes
  return (
    ctx?.toast || {
      success: (m) => console.log(m),
      error: (m) => console.error(m),
      info: (m) => console.log(m),
    }
  );
}

export function useConfirm() {
  const ctx = useContext(FeedbackContext);
  return ctx?.confirm || (async (o) => window.confirm(`${o.title}\n\n${o.message || ""}`));
}

// ------------------------------------------------------------------ toasts

const TOAST_STYLE = {
  success: { icon: "check", ring: "bg-emerald-50 text-emerald-700" },
  error: { icon: "close", ring: "bg-red-50 text-red-600" },
  info: { icon: "list", ring: "bg-blue-50 text-blue-700" },
};

function Toasts({ toasts, onDismiss }) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:px-6"
    >
      {toasts.map((t) => {
        const st = TOAST_STYLE[t.type];
        return (
          <div
            key={t.id}
            role={t.type === "error" ? "alert" : "status"}
            className="kpt-toast pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-xl"
          >
            <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${st.ring}`}>
              <Icon name={st.icon} className="h-4 w-4" strokeWidth={2.25} />
            </span>
            <p className="flex-1 pt-1 text-sm leading-5 text-slate-800">{t.message}</p>
            <button
              onClick={() => onDismiss(t.id)}
              className="-mr-1 flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Dismiss"
            >
              <Icon name="close" className="h-4 w-4" />
            </button>
          </div>
        );
      })}
      <style>{`
        .kpt-toast{animation:kpt-toast-in .22s ease-out}
        @keyframes kpt-toast-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
      `}</style>
    </div>
  );
}

// ------------------------------------------------------------------ dialog

function ConfirmDialog({ title, message, confirmText = "Confirm", cancelText = "Cancel", tone = "primary", requireText, onClose }) {
  const [typed, setTyped] = useState("");
  const inputRef = useRef(null);
  const confirmRef = useRef(null);

  useEffect(() => {
    (requireText ? inputRef : confirmRef).current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [requireText, onClose]);

  const danger = tone === "danger";
  const ready = !requireText || typed.trim().toUpperCase() === requireText.toUpperCase();

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="kpt-fade absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]" onClick={() => onClose(false)} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) onClose(true);
        }}
        className="kpt-pop relative w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl"
      >
        <span
          className={`flex h-12 w-12 items-center justify-center rounded-full ${
            danger ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-700"
          }`}
        >
          <Icon name={danger ? "logout" : "shield"} className="h-6 w-6" />
        </span>
        <h2 className="mt-4 text-lg font-bold tracking-tight text-slate-950">{title}</h2>
        {message && <div className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">{message}</div>}

        {requireText && (
          <label className="mt-5 block">
            <span className="text-sm text-slate-700">
              Type <span className="font-bold tracking-wide text-slate-950">{requireText}</span> to confirm
            </span>
            <input
              ref={inputRef}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              className="mt-2 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm uppercase tracking-wide outline-none focus:border-slate-500 focus:ring-4 focus:ring-slate-100"
            />
          </label>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => onClose(false)}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {cancelText}
          </button>
          <button
            ref={confirmRef}
            type="submit"
            disabled={!ready}
            className={`rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 ${
              danger ? "bg-red-600 hover:bg-red-700" : "bg-slate-950 hover:bg-slate-800"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </form>
      <style>{`
        .kpt-fade{animation:kpt-fade .18s ease-out}
        .kpt-pop{animation:kpt-pop .2s ease-out}
        @keyframes kpt-fade{from{opacity:0}to{opacity:1}}
        @keyframes kpt-pop{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}
      `}</style>
    </div>
  );
}
