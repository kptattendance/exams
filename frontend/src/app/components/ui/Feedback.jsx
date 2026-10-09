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

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import Icon from "../shell/Icon";

const FeedbackContext = createContext(null);

export function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback(
    (type, message, ms = type === "error" ? 6000 : 4000) => {
      const id = ++idRef.current;
      setToasts((t) => [...t.slice(-3), { id, type, message }]);
      setTimeout(() => dismiss(id), ms);
      return id;
    },
    [dismiss]
  );

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
