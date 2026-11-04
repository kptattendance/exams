"use client";

// Verification code before sensitive actions – for every page at once.
//
// When the server answers 428 { stepUp: { scope } } this asks the user for the
// code sent to his mobile (or email), gets a short-lived pass from the server
// and repeats the original request. Passes are sent with every later request
// in the "X-Step-Up" header until they expire (backend: services/stepUp.js).
// It hooks into axios, so no page needs to change.

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import axios from "axios";

const API = process.env.NEXT_PUBLIC_API_URL || "";
const STORE = "kpt-step-up";

// scope -> { token, expiresAt }
const passes = new Map();
// A delete is confirmed by typing DELETE and a fresh code; its pass is kept
// only in this open page (never saved), so a reload asks again.
const ONLY_IN_PAGE = new Set(["delete"]);
function loadPasses() {
  try {
    for (const [k, v] of Object.entries(JSON.parse(sessionStorage.getItem(STORE) || "{}"))) if (!ONLY_IN_PAGE.has(k)) passes.set(k, v);
  } catch {}
}
function savePasses() {
  try {
    sessionStorage.setItem(STORE, JSON.stringify(Object.fromEntries([...passes].filter(([k]) => !ONLY_IN_PAGE.has(k)))));
  } catch {}
}
const validTokens = () =>
  [...passes.values()].filter((p) => new Date(p.expiresAt).getTime() > Date.now() + 5000).map((p) => p.token);

// The 428 body may arrive as JSON, a Blob (downloads) or an ArrayBuffer
async function stepUpOf(error) {
  if (error?.response?.status !== 428) return null;
  let d = error.response.data;
  try {
    if (typeof Blob !== "undefined" && d instanceof Blob) d = JSON.parse(await d.text());
    else if (d instanceof ArrayBuffer) d = JSON.parse(new TextDecoder().decode(d));
  } catch {
    return null;
  }
  return d?.stepUp || null;
}

let openPrompt = null; // set by the mounted component

// The sign-in token (Clerk) lives only about a minute. Waiting for the code
// usually takes longer, so the code check and the repeated request must use a
// fresh token – not the one the first request carried (that gave
// "Unauthorized. No authenticated Clerk user found." with a correct code).
let freshToken = null; // set by the mounted component
async function authHeader(fallback) {
  try {
    const t = freshToken ? await freshToken() : null;
    if (t) return `Bearer ${t}`;
  } catch {
    // fall back to the token of the first request
  }
  return fallback || null;
}
const waiting = new Map(); // scope -> promise, so parallel requests share one prompt

export default function StepUpGate() {
  const [ask, setAsk] = useState(null); // { scope, label, auth, resolve }
  const installed = useRef(false);
  const { getToken } = useAuth();

  useEffect(() => {
    freshToken = () => getToken();
    return () => {
      freshToken = null;
    };
  }, [getToken]);

  useEffect(() => {
    if (installed.current) return;
    installed.current = true;
    loadPasses();
    openPrompt = (info) => new Promise((resolve) => setAsk({ ...info, resolve }));

    const reqId = axios.interceptors.request.use((config) => {
      if (API && String(config.url || "").startsWith(API)) {
        const tokens = validTokens();
        if (tokens.length) {
          config.headers = config.headers || {};
          config.headers["X-Step-Up"] = tokens.join(",");
        }
      }
      return config;
    });

    const resId = axios.interceptors.response.use(undefined, async (error) => {
      const step = await stepUpOf(error);
      const config = error.config;
      if (!step || !config || config._stepUpTried || !openPrompt) throw error;
      const auth = config.headers?.Authorization || config.headers?.authorization;
      if (!waiting.has(step.scope)) {
        waiting.set(
          step.scope,
          openPrompt({ scope: step.scope, label: step.label, auth }).finally(() => waiting.delete(step.scope))
        );
      }
      const ok = await waiting.get(step.scope);
      if (!ok) throw Object.assign(error, { message: "Verification cancelled." });
      config._stepUpTried = true;
      // repeat it with a fresh sign-in token (the first one may have expired meanwhile)
      if (auth) {
        const fresh = await authHeader(auth);
        if (typeof config.headers?.set === "function") config.headers.set("Authorization", fresh);
        else {
          delete config.headers.authorization;
          config.headers.Authorization = fresh;
        }
      }
      return axios(config);
    });

    return () => {
      axios.interceptors.request.eject(reqId);
      axios.interceptors.response.eject(resId);
      openPrompt = null;
    };
  }, []);

  if (!ask) return null;
  return (
    <CodeDialog
      ask={ask}
      onDone={(ok) => {
        ask.resolve(ok);
        setAsk(null);
      }}
    />
  );
}

function CodeDialog({ ask, onDone }) {
  const del = ask.scope === "delete";
  const [typed, setTyped] = useState(""); // a delete: "DELETE" typed first
  const [sent, setSent] = useState(null); // { requestId, channel, to, minutes }
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const headers = async () => {
    const a = await authHeader(ask.auth);
    return a ? { Authorization: a } : {};
  };

  const send = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await axios.post(`${API}/api/otp/request`, { scope: ask.scope }, { headers: await headers() });
      setSent(r.data);
      setCode("");
    } catch (e) {
      setError(e.response?.data?.error || "Could not send the code.");
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e) => {
    e?.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await axios.post(`${API}/api/otp/verify`, { requestId: sent.requestId, code }, { headers: await headers() });
      passes.set(r.data.scope, { token: r.data.token, expiresAt: r.data.expiresAt });
      savePasses();
      onDone(true);
    } catch (err) {
      setError(err.response?.data?.error || "Could not verify.");
    } finally {
      setBusy(false);
    }
  };

  // Send the first code straight away
  useEffect(() => {
    send();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]" onClick={() => !busy && onDone(false)} />
      <form onSubmit={verify} className="relative w-full max-w-sm rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl">
        <span className={`flex h-11 w-11 items-center justify-center rounded-full text-xl ${del ? "bg-red-50" : "bg-blue-50"}`}>{del ? "⚠️" : "🔒"}</span>
        <h2 className="mt-3 text-lg font-bold tracking-tight text-slate-950">{del ? "Confirm the delete" : "Verification needed"}</h2>
        {del && (
          <>
            <p className="mt-1 text-sm text-red-800">
              You are about to <b>delete records</b>. This cannot be undone. Make sure this is really what you want.
            </p>
            <label className="mt-3 block text-sm font-semibold text-slate-800">
              1. Type <b>DELETE</b>
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoFocus
                autoComplete="off"
                className="mt-1 h-11 w-full rounded-xl border border-red-200 px-3 text-sm font-semibold uppercase tracking-wide outline-none focus:border-red-400"
              />
            </label>
          </>
        )}
        <p className="mt-3 text-sm text-slate-600">
          {del ? <b>2. </b> : null}For <b>{ask.label}</b>, type the 6-digit code{" "}
          {sent ? (
            <>
              sent by {sent.channel === "sms" ? "SMS" : "email"} to <b>{sent.to}</b>.
            </>
          ) : (
            "we are sending you…"
          )}
        </p>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus={!del}
          disabled={!sent}
          placeholder="••••••"
          className="mt-4 h-12 w-full rounded-xl border border-slate-300 text-center text-xl font-bold tracking-[0.5em] outline-none focus:border-slate-500 disabled:bg-slate-50"
        />
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="mt-5 flex items-center gap-2">
          <button type="button" disabled={busy} onClick={send} className="text-xs font-semibold text-blue-700 hover:underline disabled:opacity-40">
            Send a new code
          </button>
          <span className="flex-1" />
          <button type="button" disabled={busy} onClick={() => onDone(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !sent || code.length !== 6 || (del && typed.trim().toUpperCase() !== "DELETE")}
            className={`rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40 ${del ? "bg-red-600" : "bg-slate-950"}`}
          >
            {busy && sent ? "Checking…" : del ? "Delete" : "Verify"}
          </button>
        </div>
        {sent && <p className="mt-3 text-[11px] text-slate-400">The code is valid for {sent.minutes} minutes. All verifications are logged.</p>}
      </form>
    </div>
  );
}
