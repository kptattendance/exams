"use client";

// Verification code before sensitive actions – for every page at once.
//
// When the server answers 428 { stepUp: { scope } } this asks the user for the
// code sent to his mobile (or email), gets a short-lived pass from the server
// and repeats the original request. Passes are sent with every later request
// in the "X-Step-Up" header until they expire (backend: services/stepUp.js).
// It hooks into axios, so no page needs to change.

import { useEffect, useRef, useState } from "react";
import axios from "axios";

const API = process.env.NEXT_PUBLIC_API_URL || "";
const STORE = "kpt-step-up";

// scope -> { token, expiresAt }
const passes = new Map();
function loadPasses() {
  try {
    for (const [k, v] of Object.entries(JSON.parse(sessionStorage.getItem(STORE) || "{}"))) passes.set(k, v);
  } catch {}
}
function savePasses() {
  try {
    sessionStorage.setItem(STORE, JSON.stringify(Object.fromEntries(passes)));
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
const waiting = new Map(); // scope -> promise, so parallel requests share one prompt

export default function StepUpGate() {
  const [ask, setAsk] = useState(null); // { scope, label, auth, resolve }
  const installed = useRef(false);

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
  const [sent, setSent] = useState(null); // { requestId, channel, to, minutes }
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const headers = ask.auth ? { Authorization: ask.auth } : {};

  const send = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await axios.post(`${API}/api/otp/request`, { scope: ask.scope }, { headers });
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
      const r = await axios.post(`${API}/api/otp/verify`, { requestId: sent.requestId, code }, { headers });
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
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-xl">🔒</span>
        <h2 className="mt-3 text-lg font-bold tracking-tight text-slate-950">Verification needed</h2>
        <p className="mt-1 text-sm text-slate-600">
          For <b>{ask.label}</b>, type the 6-digit code{" "}
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
          autoFocus
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
            disabled={busy || !sent || code.length !== 6}
            className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy && sent ? "Checking…" : "Verify"}
          </button>
        </div>
        {sent && <p className="mt-3 text-[11px] text-slate-400">The code is valid for {sent.minutes} minutes. All verifications are logged.</p>}
      </form>
    </div>
  );
}
