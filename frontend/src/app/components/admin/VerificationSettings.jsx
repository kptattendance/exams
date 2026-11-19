"use client";

// Admin → Settings → Verification codes: the one-time codes asked before
// sensitive actions (deleting, decoding, user changes …) – switch them off for
// a while (e.g. when codes are not arriving) and on again. Sign-in codes are
// Clerk's and are not affected.

import { useCallback, useEffect, useState } from "react";

import { btn } from "../ui/Modal";
import { useConfirm, useToast } from "../ui/Feedback";
import { errMsg, useApi } from "../exams/shared";

export default function VerificationSettings() {
  const api = useApi();
  const toast = useToast();
  const confirm = useConfirm();
  const [s, setS] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setS((await api("get", "/settings/verification-codes")).data.data);
    } catch (e) {
      toast.error(errMsg(e, "Could not load the verification code setting."));
    }
  }, [api, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const change = async (on) => {
    if (!on) {
      const ok = await confirm({
        title: "Switch verification codes off?",
        message: "Sensitive actions (deleting, decoding, user changes …) will no longer ask for a code. Switch them on again as soon as possible.",
        confirmText: "Switch off",
        tone: "danger",
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      const r = await api("put", "/settings/verification-codes", { on });
      toast.success(r.data.message, 6000);
      await load();
    } catch (e) {
      toast.error(errMsg(e, "Could not save."));
    }
    setBusy(false);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 pb-6 sm:px-6 lg:px-7">
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="font-semibold text-slate-950">Verification codes</p>
        <p className="mt-1 text-sm text-slate-500">
          The one-time code asked before sensitive actions (deleting, decoding, user changes, backups …). Switch it off for a while if codes are
          not arriving, and on again afterwards. The sign-in code is not affected.
        </p>
        {s === null ? (
          <div className="mt-4 h-11 w-60 animate-pulse rounded-xl bg-slate-100" />
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className={`rounded-lg px-2.5 py-1 text-sm font-bold ${s.on ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
              {s.on ? "ON – codes are asked" : "OFF – no codes are asked"}
            </span>
            {s.on ? (
              <button disabled={busy} onClick={() => change(false)} className={btn.danger}>
                Switch off for now
              </button>
            ) : (
              <button disabled={busy} onClick={() => change(true)} className={btn.primary}>
                Switch on again
              </button>
            )}
            {!s.on && s.at && (
              <span className="text-xs text-slate-500">
                Off since {new Date(s.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} by {s.by}
              </span>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
