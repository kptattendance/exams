"use client";

// Office orders (PDF) for the practical examiners – the same PDF that is
// emailed to them. Shown in the browser's PDF viewer to print or download.
//   ?panel=<id>        only that examiner set
//   ?department=cs     only that department's sets
//   ?who=internal|both internal examiners' orders, or both (default: external)

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

import { useApi } from "../../../components/exams/shared";

// A failed blob request carries the JSON error as a Blob
async function blobError(e, fallback) {
  try {
    const text = await e?.response?.data?.text?.();
    return JSON.parse(text).error || fallback;
  } catch {
    return fallback;
  }
}

function PrintOrders() {
  const { examId } = useParams();
  const search = useSearchParams();
  const { isLoaded, isSignedIn } = useAuth();
  const api = useApi();
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) return setError("Please sign in to print the office orders.");
    let made = "";
    const params = Object.fromEntries(search.entries());
    api("get", `/practicals/${examId}/orders`, undefined, { params, responseType: "blob" })
      .then((r) => {
        made = URL.createObjectURL(new Blob([r.data], { type: "application/pdf" }));
        setUrl(made);
      })
      .catch(async (e) => setError(await blobError(e, "Could not make the office orders.")));
    return () => made && URL.revokeObjectURL(made);
  }, [api, examId, isLoaded, isSignedIn, search]);

  if (error) return <p className="p-8 text-sm text-red-700">{error}</p>;
  if (!url) return <p className="p-8 text-sm text-slate-500">Making the office order PDF…</p>;

  return (
    <div className="flex h-screen flex-col bg-slate-100">
      <div className="flex items-center gap-3 border-b border-slate-200 bg-white p-3">
        <p className="flex-1 text-sm text-slate-600">Office order – use the print or download button of the viewer below.</p>
        <a href={url} download="Office_Order.pdf" className="h-10 rounded-xl bg-slate-950 px-5 text-sm font-semibold leading-10 text-white">
          Download PDF
        </a>
      </div>
      <iframe src={url} title="Office order" className="w-full flex-1 border-0" />
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
