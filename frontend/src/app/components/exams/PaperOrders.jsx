"use client";

// Appointment orders of question paper setters, for the office to print and
// post. Lists who sets which paper; the papers themselves are never shown here.

import { useCallback, useEffect, useState } from "react";

import { useToast } from "../ui/Feedback";
import { errMsg, useApi } from "./shared";

// Odd semesters are examined Nov/Dec, even semesters May/June
const defaultSession = () => {
  const d = new Date();
  return d.getMonth() >= 6 ? `NOV-${d.getFullYear()}` : `MAY-${d.getFullYear()}`;
};
const fmt = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default function PaperOrders() {
  const api = useApi();
  const toast = useToast();
  const [session, setSession] = useState(defaultSession);
  const [orders, setOrders] = useState(null);

  const load = useCallback(async () => {
    setOrders(null);
    try {
      const r = await api("get", "/paper-setting/orders", undefined, { params: { examSession: session || undefined } });
      setOrders(r.data.data);
    } catch (e) {
      setOrders([]);
      toast.error(errMsg(e, "Could not load the orders."));
    }
  }, [api, session, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const printUrl = (params) => `/print/paper-orders?${new URLSearchParams(params)}`;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-7">
      <h2 className="text-2xl font-bold tracking-tight text-slate-950">Paper setter orders</h2>
      <p className="mt-1 text-sm text-slate-500">Print the appointment order of each question paper setter and send it by post.</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          value={session}
          onChange={(e) => setSession(e.target.value.toUpperCase())}
          placeholder="Exam session e.g. NOV-2026"
          className="h-10 w-56 rounded-xl border border-slate-200 bg-white px-3 text-sm"
        />
        {orders?.length > 0 && (
          <a
            href={printUrl({ session })}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Print all {orders.length}
          </a>
        )}
      </div>

      {!orders && <div className="mt-5 h-64 animate-pulse rounded-2xl bg-white" />}
      {orders && (
        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {orders.length === 0 && <p className="px-4 py-10 text-center text-sm text-slate-500">No paper setter appointed for {session || "this session"}.</p>}
          <ul className="divide-y divide-slate-100">
            {orders.map((o) => (
              <li key={o._id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-950">
                    {o.subject?.code} <span className="font-normal text-slate-600">{o.subject?.name}</span>
                    <span className="ml-1 text-xs font-normal text-slate-500">· Set {o.setNo}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {o.examiner?.name}
                    {o.examiner?.department && ` (${String(o.examiner.department).toUpperCase()})`}
                    {o.examinerType === "EXTERNAL" && " · External"} · ordered {fmt(o.assignedAt)} · last date {fmt(o.deadline)}
                  </p>
                </div>
                <a
                  href={printUrl({ id: o._id })}
                  target="_blank"
                  rel="noreferrer"
                  className="self-start rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:self-center"
                >
                  Print order
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
