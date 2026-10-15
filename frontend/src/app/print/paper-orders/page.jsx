"use client";

// Printable appointment order (ಅಧಿಕೃತ ಜ್ಞಾಪನ) for question paper setters,
// one per A4 page, to be posted to the faculty.
//   /print/paper-orders?id=<assignment id>        one order
//   /print/paper-orders?session=NOV-2026          every order of the session
// Use Print → "Save as PDF" for a PDF.

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

import { errMsg, useApi } from "../../components/exams/shared";

// ---- Fixed parts of the order. Change here if the office wording changes.
const REF_PREFIX = "ಕೆಪಿಎಂ/29/ಸ್ವಾಯತ್ತತೆ (ಪರೀಕ್ಷೆ)";
const SCHEME = "C-25";
const HELP_PHONES = "9448104224, 9481115003";
const INSTITUTION = "Karnataka (Govt.) Polytechnic, Mangaluru";
const INSTITUTION_CODE = "________"; // Enter the official college/institution code

const SESSION_KN = { NOV: "ನವೆಂಬರ್/ಡಿಸೆಂಬರ್", DEC: "ನವೆಂಬರ್/ಡಿಸೆಂಬರ್", MAY: "ಮೇ/ಜೂನ್", JUN: "ಮೇ/ಜೂನ್" };
const DEPT = {
  at: "Automobile Engineering",
  ch: "Chemical Engineering",
  ce: "Civil Engineering",
  cs: "Computer Science & Engineering",
  ec: "Electronics & Communication Engineering",
  ee: "Electrical & Electronics Engineering",
  me: "Mechanical Engineering",
  ps: "Polymer Technology",
  sc: "Science & English",
};

// Designation in Kannada (none recorded -> Lecturer)
const DESIGNATION_KN = {
  Lecturer: "ಉಪನ್ಯಾಸಕರು",
  "Senior Grade Lecturer": "ಹಿರಿಯ ಶ್ರೇಣಿ ಉಪನ್ಯಾಸಕರು",
  "Selection Grade Lecturer": "ಆಯ್ಕೆ ಶ್ರೇಣಿ ಉಪನ್ಯಾಸಕರು",
};

// "NOV-2026" -> { months: "ನವೆಂಬರ್/ಡಿಸೆಂಬರ್", year: "2026" }
function sessionParts(session) {
  const [m, y] = String(session || "").toUpperCase().split("-");
  return { months: SESSION_KN[m] || m || "", year: y || "" };
}

const ddmmyyyy = (d) => new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
const ddmmyy = (d) => new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" });
const lastDate = (d) => new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
// Academic year runs June – May: Oct 2026 -> "2026-27"
const academicYear = (d) => {
  const x = new Date(d);
  const start = x.getMonth() >= 5 ? x.getFullYear() : x.getFullYear() - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
};

function PrintOrders() {
  const search = useSearchParams();
  const { isLoaded, isSignedIn } = useAuth();
  const api = useApi();
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) return setError("Please sign in to print the orders.");
    const id = search.get("id");
    const session = search.get("session");
    const req = id
      ? api("get", `/paper-setting/${id}/order`).then((r) => [r.data.data])
      : api("get", "/paper-setting/orders", undefined, { params: { examSession: session || undefined } }).then((r) => r.data.data);
    req.then(setOrders).catch((e) => setError(errMsg(e, "Could not load the orders.")));
  }, [api, isLoaded, isSignedIn, search]);

  if (error) return <p className="p-8 text-sm text-red-700">{error}</p>;
  if (!orders) return <p className="p-8 text-sm text-slate-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-[210mm] bg-white text-black print:max-w-none">
      <style>{`
        @page { size: A4; margin: 12mm 14mm; }
        @media print { body { background: #fff; } }
        .order { break-after: page; page-break-after: always; }
        .order:last-child { break-after: auto; page-break-after: auto; }
      `}</style>

      <div className="flex items-center gap-3 border-b border-slate-200 p-4 print:hidden">
        <p className="flex-1 text-sm text-slate-600">
          <b>{orders.length}</b> order{orders.length === 1 ? "" : "s"} · one per A4 page
        </p>
        <button
          onClick={() => window.print()}
          disabled={!orders.length}
          className="h-10 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white disabled:opacity-40"
        >
          Print / Save as PDF
        </button>
      </div>

      {orders.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No assignment for this session.</p>}
      {orders.map((o) => (
        <Order key={o._id} o={o} />
      ))}
    </div>
  );
}

function Order({ o }) {
  const { months, year } = sessionParts(o.examSession);
  const date = o.assignedAt || new Date();
  const internal = o.examinerType !== "EXTERNAL";
  const dept = DEPT[String(o.examiner?.department || "").toLowerCase()];
  const designation = o.examiner?.designation || "";
  const designationKn = DESIGNATION_KN[designation] || "ಉಪನ್ಯಾಸಕರು";

  return (
    <section className="order px-6 py-6 text-[13px] leading-[1.75] print:px-0 print:py-0">
      {/* letterhead */}
      <div className="flex items-center justify-between gap-3 border-b-2 border-black pb-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.jpg" alt="" className="h-[22mm] w-auto" />
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo3.png" alt="" className="mx-auto h-[16mm] w-auto" />
          <p className="text-[14px] font-bold leading-tight">GOVERNMENT OF KARNATAKA</p>
          <p className="text-[13px] font-bold leading-tight">DEPARTMENT OF TECHNICAL EDUCATION</p>
          <p className="text-[17px] font-bold leading-tight text-[#c0392b]">KARNATAKA (GOVT.) POLYTECHNIC, MANGALURU</p>
          <p className="text-[12px] font-semibold leading-tight text-[#c0392b]">(First Autonomous Polytechnic in India from AICTE New Delhi)</p>
          <p className="text-[12px] leading-tight">Kadri Hills, Mangaluru – 575004, Dakshina Kannada, Karnataka</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo2.png" alt="" className="h-[22mm] w-auto" />
      </div>

      <div className="mt-3 flex justify-between gap-6">
        <p>
          ನಂ: {REF_PREFIX}/{academicYear(date)}
        </p>
        <p className="text-right">
          ಪರೀಕ್ಷಾ ನಿಯಂತ್ರಕರ ಕಛೇರಿ,
          <br />
          ಕರ್ನಾಟಕ(ಸರ್ಕಾರಿ)ಪಾಲಿಟೆಕ್ನಿಕ್(ಸ್ವಾಯತ್ತತೆ)
          <br />
          ಮಂಗಳೂರು, ದಿನಾಂಕ:{ddmmyyyy(date)}.
        </p>
      </div>

      <p className="mt-3 text-center text-[15px] font-bold underline">ಅಧಿಕೃತ ಜ್ಞಾಪನ</p>
      <p className="mt-1 pl-[20%]">
        ವಿಷಯ: {months}-{year} ಸೆಮಿಸ್ಟರ್ ಪರೀಕ್ಷೆಯ ಪ್ರಶ್ನೆ ಪತ್ರಿಕೆಗಳನ್ನು ರಚಿಸುವ ಕುರಿತು.
      </p>
      <p className="text-center">*****</p>

      <p className="mt-1 indent-12 text-justify">
        ಮೇಲ್ಕಂಡ ವಿಷಯಕ್ಕೆ ಸಂಬಂಧಿಸಿದಂತೆ, {year}ರ {months} ಡಿಪ್ಲೋಮಾ ಸೆಮಿಸ್ಟರ್ ಪರೀಕ್ಷೆಗೆ ಸಂಬಂಧಿಸಿದಂತೆ, ಕೆಳಕಂಡ
        ವಿಷಯದ ಪ್ರಶ್ನೆ ಪತ್ರಿಕೆಯನ್ನು ರಚಿಸಲು {o.examiner?.name || ""}, {designationKn}{dept ? `, ${dept}` : ""} ಇವರನ್ನು ಪ್ರಶ್ನೆ ಪತ್ರಿಕೆ
        ರಚನಕಾರರಾಗಿ ನೇಮಿಸಲಾಗಿದೆ.
      </p>
      <p className="mt-2 indent-12 text-justify">
        ನೇಮಕಗೊಂಡ ಉಪನ್ಯಾಸಕರು, {SCHEME} ಪಠ್ಯಕ್ರಮದ ನಿಗದಿತ ಪಠ್ಯವಿಷಯಗಳು, ಸ್ಕೀಮ್ ಆಫ್ ಸ್ಟಡೀಸ್, ಸಂಬಂಧಿತ ಬ್ಲೂಪ್ರಿಂಟ್
        ಹಾಗೂ ಅನ್ವಯವಾಗುವ ಮಾರ್ಗಸೂಚಿಗಳಿಗೆ ಅನುಗುಣವಾಗಿ ಪ್ರಶ್ನೆ ಪತ್ರಿಕೆಯನ್ನು ಸಿದ್ಧಪಡಿಸಬೇಕು. ಸಿದ್ಧಪಡಿಸಿದ ಪ್ರಶ್ನೆ ಪತ್ರಿಕೆಯನ್ನು
        MS Word ರೂಪದಲ್ಲಿ ಸಾಫ್ಟ್ ಕಾಪಿಯಾಗಿ ಸಿದ್ಧಪಡಿಸಿ, ನಿಗದಿತ ಅವಧಿಯೊಳಗೆ
        <b> exams.kptmangaluru.in </b> ವೆಬ್‌ಸೈಟ್ ಮೂಲಕ ಅಪ್‌ಲೋಡ್ ಮಾಡಬೇಕು. ಪ್ರಶ್ನೆ ಪತ್ರಿಕೆಯನ್ನು Word ಡಾಕ್ಯುಮೆಂಟ್
        ರೂಪದಲ್ಲಿಯೇ ಅಪ್‌ಲೋಡ್ ಮಾಡತಕ್ಕದ್ದು.
      </p>
      <p className="mt-2 indent-12 text-justify">
        ಪ್ರಶ್ನೆ ಪತ್ರಿಕೆ ರಚನೆಯ ಸಂದರ್ಭದಲ್ಲಿ ಸಂಬಂಧಿತ ವಿಷಯ ಸಮಿತಿಯ ಅಧ್ಯಕ್ಷರು/ಸದಸ್ಯರು ಹಾಗೂ KPT ಪರೀಕ್ಷಾ ನಿಯಂತ್ರಕರು
        (Controller of Examination) ಕಾಲಕಾಲಕ್ಕೆ ನೀಡುವ ಸೂಚನೆಗಳನ್ನು ಪಾಲಿಸಿ, ಅವರೊಂದಿಗೆ ಸಮನ್ವಯದಿಂದ ಕಾರ್ಯನಿರ್ವಹಿಸಬೇಕು.
      </p>
      <p className="mt-2 indent-12 text-justify">
        ಪ್ರಶ್ನೆ ಪತ್ರಿಕೆ ರಚನೆಯ ಕಾರ್ಯವನ್ನು ಅತ್ಯಂತ ಜವಾಬ್ದಾರಿ, ನಿಖರತೆ, ಎಚ್ಚರಿಕೆ ಮತ್ತು ಸಂಪೂರ್ಣ ಗೌಪ್ಯತೆಯಿಂದ ನಿರ್ವಹಿಸಬೇಕು.
        ಪ್ರಶ್ನೆ ಪತ್ರಿಕೆಯಲ್ಲಿ ಯಾವುದೇ ರೀತಿಯ ದೋಷ, ಅಸ್ಪಷ್ಟತೆ ಅಥವಾ ಲೋಪ ಉಂಟಾಗದಂತೆ ವಿಶೇಷ ಗಮನಹರಿಸಬೇಕು.
      </p>

      <p className="mt-3 text-[15px] font-bold">ಪಾಲಿಸಬೇಕಾದ ಸೂಚನೆಗಳು:</p>
      <p className="text-justify">
        ಪ್ರಶ್ನೆ ಪತ್ರಿಕೆ ರಚನಕಾರರು KPT ಪರೀಕ್ಷಾ ನಿಯಂತ್ರಕರು ನೀಡುವ ಎಲ್ಲಾ ಸೂಚನೆಗಳು, ನಿಯಮಗಳು ಮತ್ತು ಮಾರ್ಗಸೂಚಿಗಳನ್ನು
        ಕಡ್ಡಾಯವಾಗಿ ಪಾಲಿಸಬೇಕು.
      </p>
      <ol className="ml-8 list-decimal text-justify">
        <li>
          ಪ್ರತಿ ಪ್ರಶ್ನೆಗೆ ನಿಗದಿಪಡಿಸಿದ ಅಂಕಗಳು, ಉತ್ತರಿಸಲು ಬೇಕಾದ ಅಂದಾಜು ಸಮಯ, ನಿರೀಕ್ಷಿತ ಉತ್ತರದ ಸ್ವರೂಪ ಮತ್ತು ವಿಸ್ತಾರ
          ಹಾಗೂ ಮೌಲ್ಯಮಾಪನ ಯೋಜನೆಯ (Scheme of Valuation) ಅವಶ್ಯಕತೆಗಳನ್ನು ಗಮನದಲ್ಲಿಟ್ಟುಕೊಂಡು ಪ್ರಶ್ನೆಗಳನ್ನು ಸ್ಪಷ್ಟವಾಗಿ,
          ನಿಖರವಾಗಿ ಮತ್ತು ದೋಷರಹಿತವಾಗಿ ರೂಪಿಸಬೇಕು.
        </li>
        <li>
          ಪ್ರಶ್ನೆ ಪತ್ರಿಕೆಯನ್ನು ಸಂಪೂರ್ಣವಾಗಿ ನಿಗದಿತ ಪಠ್ಯಕ್ರಮಕ್ಕೆ ಅನುಗುಣವಾಗಿ ರಚಿಸಬೇಕು. ಪ್ರತಿ ಅಧ್ಯಾಯಕ್ಕೆ ನಿಗದಿಪಡಿಸಿರುವ
          ಬೋಧನಾ ಗಂಟೆಗಳು, ವಿಷಯದ ಪ್ರಾಮುಖ್ಯತೆ ಹಾಗೂ ಅನುಮೋದಿತ ಬ್ಲೂಪ್ರಿಂಟ್‌ನಲ್ಲಿರುವ ಅಂಕಗಳ ಹಂಚಿಕೆಯನ್ನು ಕಡ್ಡಾಯವಾಗಿ
          ಅನುಸರಿಸಬೇಕು.
        </li>
        <li>
          ಅನ್ವಯಿಸುವ ಸಂದರ್ಭಗಳಲ್ಲಿ ನಿಗದಿಪಡಿಸಿರುವ ಮೌಲ್ಯಮಾಪನ ರೂಬ್ರಿಕ್ಸ್‌ಗಳನ್ನು (Rubrics) ಕಡ್ಡಾಯವಾಗಿ ಅನುಸರಿಸಬೇಕು.
        </li>
        <li>
          ಪ್ರಶ್ನೆ ಪತ್ರಿಕೆಯ ಬ್ಲೂಪ್ರಿಂಟ್, ಪಠ್ಯಕ್ರಮ, ಪ್ರಶ್ನೆ ಪತ್ರಿಕೆ ಕೋಡ್ ಅಥವಾ ಇತರ ತಾಂತ್ರಿಕ ವಿವರಗಳಿಗೆ ಸಂಬಂಧಿಸಿದಂತೆ
          ಸ್ಪಷ್ಟನೆ ಅಗತ್ಯವಿದ್ದಲ್ಲಿ, ಸಂಬಂಧಿತ ವಿಷಯ ಸಮಿತಿಯ ಅಧ್ಯಕ್ಷರನ್ನು ಸಂಪರ್ಕಿಸಬೇಕು. ಅಗತ್ಯ ಮಾಹಿತಿಗಾಗಿ
          {HELP_PHONES} ದೂರವಾಣಿ ಸಂಖ್ಯೆಗಳನ್ನು ಸಂಪರ್ಕಿಸಬಹುದು.
        </li>
        <li>
          ಪ್ರಶ್ನೆ ಪತ್ರಿಕೆಯನ್ನು MS Word ನಲ್ಲಿ ಸಿದ್ಧಪಡಿಸಿ, ಸಂಬಂಧಿತ ವಿಷಯ ಸಮಿತಿಯ ಅಧ್ಯಕ್ಷರು ಹಾಗೂ KPT ಪರೀಕ್ಷಾ ನಿಯಂತ್ರಕರೊಂದಿಗೆ
          ಸಮನ್ವಯ ಸಾಧಿಸಿ, ನಿಗದಿಪಡಿಸಿದ ಕೊನೆಯ ದಿನಾಂಕ ಮತ್ತು ಸಮಯದೊಳಗೆ
          <b> exams.kptmangaluru.in </b> ವೆಬ್‌ಸೈಟ್‌ನಲ್ಲಿ ಅಪ್‌ಲೋಡ್ ಮಾಡಬೇಕು. Word ಡಾಕ್ಯುಮೆಂಟ್ ಹೊರತುಪಡಿಸಿ ಇತರ
          ಫೈಲ್ ರೂಪಗಳನ್ನು ಅಪ್‌ಲೋಡ್ ಮಾಡಬಾರದು.
        </li>
        <li>
          ಪ್ರಶ್ನೆ ಪತ್ರಿಕೆಯ ವಿಭಾಗಗಳು, ಪ್ರಶ್ನೆಗಳ ಆಯ್ಕೆ, ಅಂಕಗಳ ಹಂಚಿಕೆ ಮತ್ತು ಇತರ ವಿನ್ಯಾಸದ ಅಂಶಗಳು ಸಂಬಂಧಿತ ವಿಭಾಗದ
          ಅನುಮೋದಿತ ಬ್ಲೂಪ್ರಿಂಟ್‌ಗೆ ಸಂಪೂರ್ಣವಾಗಿ ಅನುಗುಣವಾಗಿರಬೇಕು.
        </li>
        <li>
          ಪ್ರಶ್ನೆ ಪತ್ರಿಕೆಯ ಸಿದ್ಧತೆ, ಸಂಗ್ರಹಣೆ ಮತ್ತು ಅಪ್‌ಲೋಡ್ ಪ್ರಕ್ರಿಯೆಯ ಪ್ರತಿಯೊಂದು ಹಂತದಲ್ಲಿಯೂ ಸಂಪೂರ್ಣ ಗೌಪ್ಯತೆಯನ್ನು
          ಕಾಪಾಡಬೇಕು. ಪ್ರಶ್ನೆ ಪತ್ರಿಕೆಯ ವಿಷಯವನ್ನು ಅನಧಿಕೃತ ವ್ಯಕ್ತಿಗಳೊಂದಿಗೆ ಹಂಚಿಕೊಳ್ಳಬಾರದು. ಯಾವುದೇ ದೋಷ ಅಥವಾ ಸಂದೇಹ
          ಕಂಡುಬಂದಲ್ಲಿ ತಕ್ಷಣ ಸಂಬಂಧಿತ ವಿಷಯ ಸಮಿತಿಯ ಅಧ್ಯಕ್ಷರು ಅಥವಾ ಪರೀಕ್ಷಾ ನಿಯಂತ್ರಕರ ಗಮನಕ್ಕೆ ತರಬೇಕು.
        </li>
      </ol>

      <p className="mt-10 text-right font-semibold">ಪರೀಕ್ಷಾ ನಿಯಂತ್ರಕರು</p>

      <table className="mt-6 w-full border-collapse text-[13px]">
        <tbody>
          {[
            ["QP SETTER NAME", `${o.examiner?.name || ""}${dept ? `, ${dept}` : ""}`],
            ["DESIGNATION", designation || "Lecturer"],
            ["INST CODE and NAME", internal ? INSTITUTION : ""],
            ["QP CODE", `${o.subject?.code || ""}${o.setNo ? ` (Set ${o.setNo})` : ""}`],
            ["SUBJECT NAME", `${o.subject?.name || ""}${o.paperType === "PRACTICAL" ? " (Practical)" : ""}`],
            ["LAST DATE TO UPLOAD", lastDate(o.deadline)],
          ].map(([k, v]) => (
            <tr key={k}>
              <td className="w-[32%] border border-black px-3 py-3 text-center">{k}</td>
              <td className="border border-black px-3 py-3">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-6 text-[11px] leading-tight">
        Exam/QP/memo
        <br />
        Dt:{ddmmyy(date)}
      </p>

      <div className="mt-5 border-t border-black pt-2 text-[11px] leading-tight">
        <p className="font-semibold">ಪ್ರತಿ (Copy to):</p>
        <p>
          ಪ್ರಾಂಶುಪಾಲರು, ಸಂಸ್ಥೆಯ ಕೋಡ್: {INSTITUTION_CODE}, {INSTITUTION} — ಮಾಹಿತಿಗಾಗಿ.
        </p>
      </div>
    </section>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <PrintOrders />
    </Suspense>
  );
}
