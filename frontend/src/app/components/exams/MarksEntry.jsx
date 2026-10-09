"use client";

// Exam clerk: type the marks from a valuer's award list.
// Only dummy numbers appear here. Press Enter to jump to the next box.

import { useCallback, useEffect, useRef, useState } from "react";

import Icon from "../shell/Icon";
import { btn } from "../ui/Modal";
import { useToast } from "../ui/Feedback";
import { errMsg, useApi } from "./shared";

const NEED = {
  FIRST: { label: "First entry", chip: "bg-slate-100 text-slate-700" },
  SECOND: { label: "Second entry", chip: "bg-blue-50 text-blue-700" },
  RESOLVE: { label: "Fix mismatches", chip: "bg-red-50 text-red-700" },
  DONE: { label: "Done", chip: "bg-emerald-50 text-emerald-700" },
};
const ROUND = { 1: "1st valuation", 2: "2nd valuation", 3: "3rd valuation" };

export default function MarksEntry() {
  const api = useApi();
  const toast = useToast();
  const [list, setList] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [number, setNumber] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await api("get", "/marks-entry/packets");
      setList(r.data.data);
    } catch (e) {
      setList([]);
      toast.error(errMsg(e, "Could not load packets."));
    }
  }, [api, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const find = async (e) => {
    e.preventDefault();
    try {
      const r = await api("get", "/marks-entry/find", undefined, { params: { number } });
      setOpenId(r.data.data._id);
      setNumber("");
    } catch (err) {
      toast.error(errMsg(err, "Packet not found."));
    }
  };

  if (openId) {
    return (
      <EntryScreen
        id={openId}
        onClose={(changed) => {
          setOpenId(null);
          if (changed) load();
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-7">
      <h2 className="text-2xl font-bold tracking-tight text-slate-950">Marks entry</h2>
      <p className="mt-1 text-sm text-slate-500">Type the packet number printed on the award list, or pick a packet below.</p>

      <form onSubmit={find} className="mt-5 flex gap-2">
        <input
          value={number}
          onChange={(e) => setNumber(e.target.value.toUpperCase())}
          autoFocus
          placeholder="e.g. 25CS31T0-P03"
          className="h-12 flex-1 rounded-2xl border border-slate-300 bg-white px-4 text-base font-semibold uppercase tracking-wide outline-none focus:border-slate-500 focus:ring-4 focus:ring-slate-100"
        />
        <button disabled={!number.trim()} className={btn.primary}>
          Open
        </button>
      </form>

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {list === null && <div className="h-40 animate-pulse" />}
        {list?.length === 0 && <p className="px-4 py-10 text-center text-sm text-slate-500">Nothing to type right now.</p>}
        <ul className="divide-y divide-slate-100">
          {list?.map((p) => (
            <li key={p._id}>
              <button onClick={() => setOpenId(p._id)} className="flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-slate-50 sm:flex-row sm:items-center">
                <span className="w-48 font-semibold tabular-nums text-slate-950">{p.number}</span>
                <span className="min-w-0 flex-1 text-sm text-slate-600">
                  {p.paperName} · {ROUND[p.round]} · {p.count} scripts{p.valuer && ` · ${p.valuer}`}
                </span>
                <span className={`self-start rounded-full px-2.5 py-1 text-xs font-semibold sm:self-center ${NEED[p.need].chip}`}>{NEED[p.need].label}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function EntryScreen({ id, onClose }) {
  const api = useApi();
  const toast = useToast();
  const [p, setP] = useState(null);
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const refs = useRef([]);

  const load = useCallback(async () => {
    try {
      const r = await api("get", `/marks-entry/packets/${id}`);
      setP(r.data.data);
      setValues({});
      setErrors({});
    } catch (e) {
      toast.error(errMsg(e, "Could not open the packet."));
      onClose(false);
    }
  }, [api, id, toast, onClose]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (p && p.need !== "DONE") setTimeout(() => refs.current[0]?.focus(), 50);
  }, [p]);

  if (!p) return <div className="mx-auto mt-6 h-64 max-w-3xl animate-pulse rounded-2xl bg-white" />;

  const rows = p.need === "RESOLVE" ? p.mismatches.map((m) => m.dummy) : p.dummies;
  const check = (v) => {
    if (v === undefined || String(v).trim() === "") return "empty";
    const n = Number(v);
    if (!Number.isFinite(n)) return "not a number";
    if (n < 0 || n > p.rawMax) return `0–${p.rawMax}`;
    if (Math.round(n * 2) !== n * 2) return "whole or half";
    return "";
  };
  const filled = rows.filter((d) => !check(values[d])).length;

  const save = async () => {
    const errs = {};
    for (const d of rows) {
      const e = check(values[d]);
      if (e) errs[d] = e;
    }
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast.error(`${Object.keys(errs).length} marks are missing or wrong.`);
      return;
    }
    setBusy(true);
    try {
      const r = await api("post", `/marks-entry/packets/${id}`, { marks: Object.fromEntries(rows.map((d) => [d, Number(values[d])])) });
      const st = r.data.data.status;
      if (st === "MISMATCH") {
        toast.error(r.data.message, 8000);
        await load();
      } else {
        toast.success(r.data.message || "Saved.", 6000);
        onClose(true);
      }
    } catch (e) {
      const list = e?.response?.data?.errors;
      if (list) setErrors(Object.fromEntries(list.map((x) => [x.dummy, x.error])));
      toast.error(errMsg(e, "Could not save."));
    }
    setBusy(false);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 pb-28 sm:px-6 lg:px-7">
      <button onClick={() => onClose(false)} className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900">
        <Icon name="chevronLeft" className="h-4 w-4" />
        All packets
      </button>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-bold tabular-nums tracking-tight text-slate-950">{p.number}</h2>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${NEED[p.need].chip}`}>{NEED[p.need].label}</span>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        {p.code} {p.paperName} · {ROUND[p.round]} · {p.count} scripts · marks out of {p.rawMax}
        {p.valuer && ` · valuer ${p.valuer}`}
      </p>

      {p.locked && <p className="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-600">This paper is decoded. Marks are locked.</p>}

      {p.need === "SECOND" && (
        <p className="mt-4 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <b>Second entry.</b> Type the same award list again without looking at the first entry. Any difference will be shown to you.
        </p>
      )}
      {p.need === "RESOLVE" && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-900">
          <b>The two entries differ for {p.mismatches.length} script{p.mismatches.length > 1 ? "s" : ""}.</b> Look at the award list and type the correct mark.
        </p>
      )}

      {p.need === "DONE" ? (
        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <ul className="grid grid-cols-2 divide-x divide-y divide-slate-100 sm:grid-cols-3">
            {p.dummies.map((d) => (
              <li key={d} className="flex justify-between px-4 py-2 text-sm">
                <span className="font-semibold tracking-wider">{d}</span>
                <span className="tabular-nums">{p.final?.[d]}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        !p.locked && (
          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <ul className="divide-y divide-slate-100">
              {rows.map((d, i) => {
                const m = p.need === "RESOLVE" ? p.mismatches.find((x) => x.dummy === d) : null;
                // show a wrong value as soon as it is typed (empty boxes only on Save)
                const err = errors[d] || (values[d] !== undefined && values[d] !== "" ? check(values[d]) : "");
                return (
                  <li key={d} className={`flex items-center gap-3 px-4 py-2 ${err ? "bg-red-50" : ""}`}>
                    <span className="w-8 text-xs tabular-nums text-slate-400">{i + 1}</span>
                    <span className="w-24 font-bold tracking-wider text-slate-900">{d}</span>
                    {m && (
                      <span className="text-xs text-slate-500">
                        1st: <b className="text-slate-800">{m.first}</b> · 2nd: <b className="text-slate-800">{m.second}</b>
                      </span>
                    )}
                    <input
                      ref={(el) => (refs.current[i] = el)}
                      inputMode="decimal"
                      value={values[d] ?? ""}
                      onChange={(e) => {
                        setValues((v) => ({ ...v, [d]: e.target.value }));
                        if (errors[d]) setErrors((x) => ({ ...x, [d]: "" }));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (i + 1 < rows.length) refs.current[i + 1]?.focus();
                          else save();
                        }
                      }}
                      aria-label={`Marks for ${d}`}
                      className={`ml-auto h-10 w-24 rounded-xl border px-3 text-right text-base font-semibold tabular-nums outline-none focus:ring-4 focus:ring-slate-100 ${
                        err ? "border-red-400" : "border-slate-300 focus:border-slate-500"
                      }`}
                    />
                    <span className="w-24 text-xs text-red-600">{err}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )
      )}

      {p.need !== "DONE" && !p.locked && (
        <div className="fixed inset-x-0 bottom-20 z-40 px-4 lg:bottom-6 lg:left-[268px]">
          <div className="mx-auto flex max-w-xl items-center gap-3 rounded-2xl bg-slate-950 px-4 py-3 text-white shadow-2xl">
            <p className="flex-1 text-sm">
              {filled} of {rows.length} typed
            </p>
            <button onClick={save} disabled={busy} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-slate-100 disabled:opacity-50">
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
