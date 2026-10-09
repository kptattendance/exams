"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const STATUS = {
  ASSIGNED: ["Upload pending", "bg-amber-50 text-amber-700"],
  UPLOADED: ["Draft – not submitted", "bg-blue-50 text-blue-700"],
  RETURNED: ["Returned – correction needed", "bg-orange-50 text-orange-700"],
  SUBMITTED: ["Submitted", "bg-emerald-50 text-emerald-700"],
};

export default function FacultyHome() {
  const { getToken } = useAuth();
  const [papers, setPapers] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const res = await axios.get(`${API_URL}/api/paper-setting/my`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setPapers(res.data?.data || []);
      } catch (e) {
        setError(e.response?.data?.error || "Could not load your tasks.");
      }
    })();
  }, [getToken]);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-950">Question paper setting</h1>
      <p className="mt-1 text-sm text-slate-500">Papers you have been appointed to set.</p>

      {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="mt-5 space-y-3">
        {papers === null && !error && <p className="text-sm text-slate-500">Loading…</p>}
        {papers?.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            You have no paper setting requests right now.
          </div>
        )}
        {papers?.map((p) => {
          const [label, cls] = STATUS[p.status] || [p.status, "bg-slate-100 text-slate-700"];
          return (
            <Link
              key={p._id}
              href={`/faculty/paper-setting/${p._id}`}
              className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold text-slate-900">
                  {p.subject?.code} – {p.subject?.name}
                </p>
                <p className="text-xs text-slate-500">
                  {p.examSession} · {p.paperType} · Semester {p.subject?.semester}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs ${p.isPastDeadline && p.status !== "SUBMITTED" ? "font-semibold text-red-600" : "text-slate-500"}`}>
                  Due {new Date(p.deadline).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                </span>
                <span className={`rounded-lg px-2 py-1 text-xs font-semibold ${cls}`}>{label}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
