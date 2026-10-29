"use client";

// Office orders for the external practical examiners (addressed to the
// Principal of each examiner's college, for relieving). One A4 page each.
//   ?panel=<id>        only that examiner set
//   ?department=cs     only that department's sets
// The order text comes from the server (services/practicalOrder.js) – the same
// HTML that is emailed to the examiner. Use Print → "Save as PDF" for a PDF.

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

import { errMsg, useApi } from "../../../components/exams/shared";

function PrintOrders() {
  const { examId } = useParams();
  const search = useSearchParams();
  const { isLoaded, isSignedIn } = useAuth();
  const api = useApi();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) return setError("Please sign in to print the office orders.");
    const params = Object.fromEntries(search.entries());
    api("get", `/practicals/${examId}/orders`, undefined, { params })
      .then((r) => setData(r.data))
      .catch((e) => setError(errMsg(e, "Could not load the office orders.")));
  }, [api, examId, isLoaded, isSignedIn, search]);

  if (error) return <p className="p-8 text-sm text-red-700">{error}</p>;
  if (!data) return <p className="p-8 text-sm text-slate-500">Loading…</p>;

  const orders = data.data;
  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <style>{`
        @page { size: A4; margin: 10mm 12mm; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @media print { body { background: #fff; } }
        .order + .order { break-before: page; page-break-before: always; }
        @media screen { .order { width: 210mm; margin: 18px auto; padding: 10mm 12mm; background: #fff; box-shadow: 0 3px 12px rgba(19,15,46,.16); } }
      `}</style>

      <div className="flex items-center gap-3 border-b border-slate-200 bg-white p-4 print:hidden">
        <p className="flex-1 text-sm text-slate-600">
          <b>{orders.length}</b> office order{orders.length === 1 ? "" : "s"} for external examiners · {data.exam?.name}
        </p>
        <button onClick={() => window.print()} disabled={!orders.length} className="h-10 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white disabled:opacity-40">
          Print / Save as PDF
        </button>
      </div>

      {orders.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No external examiner has been allotted yet.</p>}

      {orders.map((o) => (
        // server-made HTML: every value in it is escaped there
        <div key={o._id} className="order" dangerouslySetInnerHTML={{ __html: o.html }} />
      ))}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <PrintOrders />
    </Suspense>
  );
}
