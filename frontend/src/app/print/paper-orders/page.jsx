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
        ಮೇಲ್ಕಂಡ ವಿಷಯಕ್ಕೆ ಸಂಬಂಧಿಸಿದಂತೆ {year} ರ {months} ಡಿಪ್ಲೋಮಾ ಸೆಮಿಸ್ಟರ್ ಪರೀಕ್ಷೆಯ ಈ ಕೆಳಕಂಡ ವಿಷಯಕ್ಕೆ ಈ ಕೆಳಗೆ
        ತಿಳಿಸಲಾದ ಉಪನ್ಯಾಸಕರನ್ನು ಪ್ರಶ್ನೆ ಪತ್ರಿಕೆ ರಚನಕಾರರಾಗಿ ನೇಮಿಸಲಾಗಿದೆ. ಸದರಿ ಉಪನ್ಯಾಸಕರು ನಿಗದಿತ ಪಠ್ಯಕ್ರಮ ಮತ್ತು ಸ್ಕೀಮ್
        ಆಫ್ ಸ್ಟಡೀಸ್ ಗೆ ಅನುಗುಣವಾಗಿ ಪಠ್ಯಕ್ರಮದಲ್ಲಿ ನೀಡಿರುವ ಮಾರ್ಗಸೂಚಿಗಳನ್ವಯ ಪ್ರಶ್ನೆ ಪತ್ರಿಕೆಗಳನ್ನು ರಚಿಸಿ, ಸಾಫ್ಟ್ ಕಾಪಿಯನ್ನು
        MS Word ನಲ್ಲಿ ಸಿದ್ದಪಡಿಸುವಂತೆ ತಿಳಿಸಲಾಗಿದೆ.
      </p>
      <p className="mt-2 indent-12 text-justify">
        ಸಂಬಂಧಿಸಿದ ಪರೀಕ್ಷಕರ ಸಮಿತಿಯ ಅಧ್ಯಕ್ಷರು ಅಥವಾ ಸದಸ್ಯರು ಹಾಗೂ KPT Controller of Examination ವತಿಯಿಂದ ಕಾಲಕಾಲಕ್ಕೆ ನೀಡುವ
        ಸೂಚನೆಗಳಂತೆ ಸಮನ್ವಯತೆಯಿಂದ ನಿಗದಿತ ಸಮಯದಲ್ಲಿ {SCHEME} ಪಠ್ಯಕ್ರಮದ ಪ್ರಶ್ನೆ ಪತ್ರಿಕೆಗಳನ್ನು exams.kptmangaluru.in website link
        ಮುಖಾಂತರ ಅಪ್ಲೋಡ್ ಮಾಡಲು ತಿಳಿಸಲಾಗಿದೆ. (Only Word document to be uploaded). ಪ್ರಶ್ನೆ ಪತ್ರಿಕೆಯ ರಚನೆ ಕಾರ್ಯವನ್ನು ಅತ್ಯಂತ
        ಜಾಗೃತೆ, ಪಾವಿತ್ರತೆ ಹಾಗೂ ಗೌಪ್ಯತೆಯಿಂದ ನಿರ್ವಹಿಸಲು ಮತ್ತು ಈ ವಿಷಯದಲ್ಲಿ ಯಾವುದೇ ಅಜಾಗರೂಕತೆ/ಲೋಪದೋಷ/ತಪ್ಪುಗಳು
        ಉಂಟಾಗದಂತೆ ಎಚ್ಚರವಹಿಸಿ ಕ್ರಮ ಕೈಗೊಳ್ಳುವಂತೆ ಸೂಚಿಸಲಾಗಿದೆ.
      </p>

      <p className="mt-3 text-[15px] font-bold">ಸೂಚನೆಗಳು :</p>
      <p className="text-justify">
        ಪ್ರಶ್ನೆ ಪತ್ರಿಕೆ ರಚನಕಾರರು ಪರೀಕ್ಷಾ ನಿಯಂತ್ರಕರ (KPT Controller of Examination) ಎಲ್ಲಾ ಸೂಚನೆಯನ್ನು ಕಡ್ಡಾಯವಾಗಿ
        ಪಾಲಿಸತಕ್ಕದ್ದು
      </p>
      <ol className="ml-8 list-decimal text-justify">
        <li>
          ಪ್ರಶ್ನೆಗೆ ನಿಗದಿಪಡಿಸಲಾದ ಅಂಕಗಳು / ಉತ್ತರಿಸಲು ಬೇಕಾದ ಅಂದಾಜು ಸಮಯ / ಉತ್ತರಗಳ ಸ್ವರೂಪ ಮತ್ತು ವಿಸ್ತಾರ ಸ್ಕೀಮ್ ಆಫ್
          ವ್ಯಾಲ್ಯೂಯೇಷನ್ ಅಂಶಗಳನ್ನು ಗಮನಿಸಿ ಪ್ರಶ್ನೆಗಳನ್ನು ದೋಷರಹಿತವಾಗಿ ಸ್ಪಷ್ಟವಾಗಿ ಮತ್ತು ನಿಖರತೆಯಿಂದ ಪ್ರಶ್ನೆಪತ್ರಿಕೆಯನ್ನು
          ರಚಿಸಬೇಕಾಗಿರುತ್ತದೆ.
        </li>
        <li>
          ಪ್ರಶ್ನೆ ಪತ್ರಿಕೆಯನ್ನು ಸಂಪೂರ್ಣವಾಗಿ Syllabus ಅನ್ವಯ ಪ್ರತಿ chapter ಗೆ ನಿಗದಿಪಡಿಸಲಾಗಿರುವ ಗಂಟೆಗಳು ಮತ್ತು ಪ್ರಾಮುಖ್ಯತೆಯ
          ಆಧಾರದ ಮೇಲೆ ಅಂಕಗಳನ್ನು ನಿರ್ಧರಿಸಬೇಕಾಗುತ್ತದೆ.
        </li>
        <li>Follow RUBRICS wherever Required.</li>
        <li>
          ಪ್ರಶ್ನೆ ಪತ್ರಿಕೆ ರಚನೆ ಬ್ಲೂ ಪ್ರಿಂಟ್, ಪಠ್ಯಕ್ರಮ, ಪ್ರಶ್ನೆ ಪತ್ರಿಕೆ ಕೋಡ್, ಕುರಿತ ಹೆಚ್ಚಿನ ವಿವರಗಳಿಗಾಗಿ ಸಂಬಂಧಿಸಿದ ಚೇರ್ಮನ್
          ಅಥವಾ ದೂರವಾಣಿ ಸಂಖ್ಯೆಯ {HELP_PHONES} ಹೆಚ್ಚಿನ ಮಾಹಿತಿಗಾಗಿ ಸಂಪರ್ಕಿಸುವುದು.
        </li>
        <li>
          ಪಠ್ಯಕ್ರಮದನ್ವಯ ಪ್ರಶ್ನೆ ಪತ್ರಿಕೆಯನ್ನು ಸಿದ್ದಪಡಿಸುವುದು ಮತ್ತು MS Word ನಲ್ಲಿ ಟೈಪ್ ಮಾಡಿ ವಿಷಯ ಸಮಿತಿಗಳ ಅಧ್ಯಕ್ಷರು ಮತ್ತು
          KPT COE ಯೊಟ್ಟಿಗೆ ಸಮನ್ವಯತೆಯಿಂದ exams.kptmangaluru.in website link ನಲ್ಲಿ ನಿಗದಿತ ಸಮಯದಲ್ಲಿ ಅಪ್ಲೋಡ್ ಮಾಡುವುದು.
        </li>
        <li>ಪ್ರಶ್ನೆ ಪತ್ರಿಕೆಯನ್ನು ಸಂಬಂಧಿಸಿದ ವಿಭಾಗದ ಬ್ಲೂ ಪ್ರಿಂಟ್ ನ ಪ್ರಕಾರ ರಚಿಸಬೇಕು.</li>
      </ol>

      <p className="mt-10 text-right font-semibold">ಪರೀಕ್ಷಾ ನಿಯಂತ್ರಕರು</p>

      <table className="mt-6 w-full border-collapse text-[13px]">
        <tbody>
          {[
            ["QP SETTER NAME", `${o.examiner?.name || ""}${dept ? `, ${dept}` : ""}`],
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
