
"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { errMsg, useApi } from "../../components/exams/shared";

const REF_PREFIX = "ಕೆಪಿಎಂ/35/ಸ್ವಾಯತ್ತತೆ (ಪರೀಕ್ಷೆ)";
const SCHEME = "C-25";
const HELP_PHONES = "9448104224, 9481115003";
const INSTITUTION = "Karnataka (Govt.) Polytechnic, Mangaluru";
const INSTITUTION_CODE = "103";

const FOOTER_KN = [
  "ಕರ್ನಾಟಕ (ಸರ್ಕಾರಿ) ಪಾಲಿಟೆಕ್ನಿಕ್ (ಸ್ವಾಯತ್ತ), ಮಂಗಳೂರು",
  "ಕದ್ರಿ ಹಿಲ್ಸ್, ಮಂಗಳೂರು - 575004, ದಕ್ಷಿಣ ಕನ್ನಡ, ಕರ್ನಾಟಕ",
  "Phone No. 0824 – 3516910 / 2211636, E-Mail: kptmng@gmail.com / coekpt25@gmail.com",
];

const SESSION_KN = {
  NOV: "ನವೆಂಬರ್/ಡಿಸೆಂಬರ್",
  DEC: "ನವೆಂಬರ್/ಡಿಸೆಂಬರ್",
  MAY: "ಮೇ/ಜೂನ್",
  JUN: "ಮೇ/ಜೂನ್",
};

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

const DESIGNATION_KN = {
  Lecturer: "ಉಪನ್ಯಾಸಕರು",
  "Senior Grade Lecturer": "ಹಿರಿಯ ಶ್ರೇಣಿ ಉಪನ್ಯಾಸಕರು",
  "Senior Lecturer": "ಹಿರಿಯ ಉಪನ್ಯಾಸಕರು",
  "Selection Grade Lecturer": "ಆಯ್ಕೆ ಶ್ರೇಣಿ ಉಪನ್ಯಾಸಕರು",
  HOD: "ವಿಭಾಗ ಮುಖ್ಯಸ್ಥರು",
  "Vice-Principal": "ಉಪ ಪ್ರಾಂಶುಪಾಲರು",
  Principal: "ಪ್ರಾಂಶುಪಾಲರು",
  "Guest Lecturer": "ಅತಿಥಿ ಉಪನ್ಯಾಸಕರು",
};

function sessionParts(session) {
  const [m, y] = String(session || "").toUpperCase().split("-");
  return { months: SESSION_KN[m] || m || "", year: y || "" };
}

const ddmmyyyy = (d) =>
  new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

const ddmmyy = (d) =>
  new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });

const lastDate = (d) =>
  new Date(d).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });

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
    if (!isSignedIn) {
      setError("Please sign in to print the orders.");
      return;
    }

    const id = search.get("id");
    const session = search.get("session");

    const req = id
      ? api("get", `/paper-setting/${id}/order`).then((r) => [r.data.data])
      : api("get", "/paper-setting/orders", undefined, {
          params: { examSession: session || undefined },
        }).then((r) => r.data.data);

    req.then(setOrders).catch((e) => setError(errMsg(e, "Could not load the orders.")));
  }, [api, isLoaded, isSignedIn, search]);

  if (error) {
    return <p className="p-8 text-sm text-red-700">{error}</p>;
  }

  if (!orders) {
    return <p className="p-8 text-sm text-slate-500">Loading…</p>;
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 print:bg-white">
      <style>{`
        @page {
          size: A4;
          margin: 0;
        }

        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        @media print {
          body {
            margin: 0;
            background: #ffffff;
          }
        }

        .sheet {
          width: 210mm;
          height: 296.5mm;
          padding: 12mm 17mm 9mm 19mm;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-sizing: border-box;
          background: #ffffff;
          font-family: "Noto Sans Kannada", "Nirmala UI", Arial, sans-serif;
        }

        .sheet + .sheet,
        .order + .order .sheet {
          break-before: page;
          page-break-before: always;
        }

        @media screen {
          .sheet {
            margin: 18px auto;
            box-shadow: 0 3px 12px rgba(19, 15, 46, 0.16);
          }
        }

        .official-blue {
          color: #1d1842;
        }

        .official-maroon {
          color: #8e0d3c;
        }

        .official-gold {
          color: #ef3b33;
        }

        .official-rule {
          border-color: #1d1842;
        }

        .official-table th {
          background: #1d1842;
          color: #ffffff;
          font-weight: 700;
          border: 1px solid #1d1842;
          padding: 8px;
        }

        .official-table td {
          border: 1px solid #a7a2c4;
          padding: 8px 10px;
        }

        .official-table tr:nth-child(even) td {
          background: #f6f5fa;
        }

        .important-box {
          background: #fff5f5;
          border-left: 4px solid #ef3b33;
          padding: 7px 10px;
        }

        .official-footer {
          border-top: 2px solid #1d1842;
          color: #8e0d3c;
        }

        .instruction-list li {
          margin-bottom: 7px;
          padding-left: 3px;
        }

        .instruction-list li::marker {
          color: #8e0d3c;
          font-weight: 700;
        }
      `}</style>

      <div className="flex items-center gap-3 border-b border-slate-200 bg-white p-4 print:hidden">
        <p className="flex-1 text-sm text-slate-600">
          <b>{orders.length}</b> order{orders.length === 1 ? "" : "s"} · two A4 pages each
        </p>
        <button
          onClick={() => window.print()}
          disabled={!orders.length}
          className="h-10 rounded-xl bg-[#1d1842] px-5 text-sm font-semibold text-white disabled:opacity-40"
        >
          Print / Save as PDF
        </button>
      </div>

      {orders.length === 0 && (
        <p className="p-8 text-center text-sm text-slate-500">
          No assignment for this session.
        </p>
      )}

      {orders.map((o) => (
        <Order key={o._id} o={o} />
      ))}
    </div>
  );
}

function Order({ o }) {
  const { months, year } = sessionParts(o.examSession);
  const date = o.assignedAt || new Date();
  // The examiner's own college (external setters come from other institutes)
  const college = o.examiner?.college?.code
    ? o.examiner.college
    : { code: INSTITUTION_CODE, name: INSTITUTION };
  const collegeLine = [college.code, college.name].filter(Boolean).join(" — ");
  const dept = DEPT[String(o.examiner?.department || "").toLowerCase()];
  const designation = o.examiner?.designation || "Lecturer";
  const designationKn = DESIGNATION_KN[designation] || "ಉಪನ್ಯಾಸಕರು";

  const tableRows = [
    ["QP SETTER NAME", `${o.examiner?.name || ""}${dept ? `, ${dept}` : ""}`],
    ["DESIGNATION", designation],
    ["INST CODE and NAME", collegeLine],
    ["QP CODE", `${o.subject?.code || ""}`],
    ["SUBJECT NAME", `${o.subject?.name || ""}${o.paperType === "PRACTICAL" ? " (Practical)" : ""}`],
    ["LAST DATE TO UPLOAD", lastDate(o.deadline)],
  ];

  return (
    <section className="order text-[12.5px] leading-[1.7]">
      {/* PAGE 1: OFFICIAL APPOINTMENT ORDER */}
      <div className="sheet">
        <div className="flex-1">
          <div className="flex items-center justify-between gap-3 border-b-[3px] border-[#1d1842] pb-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.jpg" alt="Institution logo" className="h-[21mm] w-auto" />

            <div className="flex-1 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo3.png" alt="" className="mx-auto mb-1 h-[14mm] w-auto" />

              <p className="text-[13px] font-bold leading-tight tracking-wide text-[#1d1842]">
                GOVERNMENT OF KARNATAKA
              </p>
              <p className="text-[11.5px] font-bold leading-tight text-[#524c76]">
                DEPARTMENT OF TECHNICAL EDUCATION
              </p>
              <p className="mt-1 text-[16px] font-extrabold leading-tight text-[#8e0d3c]">
                KARNATAKA (GOVT.) POLYTECHNIC, MANGALURU
              </p>
              <p className="text-[10.5px] font-semibold text-[#ef3b33]">
                (First Autonomous Polytechnic in India from AICTE New Delhi)
              </p>
              <p className="text-[10px] leading-tight text-slate-600">
                Kadri Hills, Mangaluru – 575004, Dakshina Kannada, Karnataka
              </p>
            </div>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo2.png" alt="" className="h-[21mm] w-auto" />
          </div>

          <div className="mt-4 flex justify-between gap-5 text-[11.5px]">
            <p className="font-semibold text-[#1d1842]">
              ನಂ: {REF_PREFIX}/{academicYear(date)}
            </p>
            <p className="text-right leading-relaxed text-[#524c76]">
              <span className="font-bold text-[#1d1842]">ಪರೀಕ್ಷಾ ನಿಯಂತ್ರಕರ ಕಛೇರಿ</span>
              <br />
              ಕರ್ನಾಟಕ (ಸರ್ಕಾರಿ) ಪಾಲಿಟೆಕ್ನಿಕ್ (ಸ್ವಾಯತ್ತತೆ)
              <br />
              ಮಂಗಳೂರು, ದಿನಾಂಕ: {ddmmyyyy(date)}
            </p>
          </div>

          <div className="mt-4 rounded-md border border-[#fda1a2] bg-[#fff5f5] px-3 py-2 text-center">
            <p className="text-[16px] font-extrabold tracking-wide text-[#8e0d3c]">
              ಅಧಿಕೃತ ಜ್ಞಾಪನ
            </p>
            <p className="mt-1 text-[11.5px] font-semibold text-[#1d1842]">
              ವಿಷಯ: {months} {year}ರ ಡಿಪ್ಲೋಮಾ ಸೆಮಿಸ್ಟರ್ ಪರೀಕ್ಷೆ — KPT Autonomous {SCHEME} ಪಠ್ಯಕ್ರಮದ
              ಪ್ರಶ್ನೆ ಪತ್ರಿಕೆಯನ್ನು ರಚಿಸುವ ಕುರಿತು.
            </p>
          </div>

          <p className="mt-4 text-justify indent-10">
            ಮೇಲ್ಕಂಡ ವಿಷಯಕ್ಕೆ ಸಂಬಂಧಿಸಿದಂತೆ, {year}ರ {months} ಡಿಪ್ಲೋಮಾ ಸೆಮಿಸ್ಟರ್
            ಪರೀಕ್ಷೆಗೆ ಸಂಬಂಧಿಸಿದಂತೆ, ಕೆಳಕಂಡ ವಿಷಯದ ಪ್ರಶ್ನೆ ಪತ್ರಿಕೆಯನ್ನು ರಚಿಸಲು{" "}
            <b className="text-[#1d1842]">{o.examiner?.name || ""}</b>,{" "}
            <b className="text-[#8e0d3c]">{designationKn}</b>
            {dept ? `, ${dept}` : ""} ಇವರನ್ನು ಪ್ರಶ್ನೆ ಪತ್ರಿಕೆ ರಚನಕಾರರಾಗಿ
            ನೇಮಿಸಲಾಗಿದೆ.
          </p>

          <p className="mt-3 text-justify indent-10">
            ನೇಮಕಗೊಂಡ ಉಪನ್ಯಾಸಕರು, {SCHEME} ಪಠ್ಯಕ್ರಮದ ನಿಗದಿತ ಪಠ್ಯವಿಷಯಗಳು, ಸ್ಕೀಮ್ ಆಫ್
            ಸ್ಟಡೀಸ್, ಸಂಬಂಧಿತ ಬ್ಲೂಪ್ರಿಂಟ್ ಹಾಗೂ ಅನ್ವಯವಾಗುವ ಮಾರ್ಗಸೂಚಿಗಳಿಗೆ ಅನುಗುಣವಾಗಿ
            ಪ್ರಶ್ನೆ ಪತ್ರಿಕೆಯನ್ನು ಸಿದ್ಧಪಡಿಸಬೇಕು. ಸಿದ್ಧಪಡಿಸಿದ ಪ್ರಶ್ನೆ ಪತ್ರಿಕೆಯನ್ನು MS
            Word ರೂಪದಲ್ಲಿ ಸಾಫ್ಟ್ ಕಾಪಿಯಾಗಿ ಸಿದ್ಧಪಡಿಸಿ, ನಿಗದಿತ ಅವಧಿಯೊಳಗೆ{" "}
            <b className="text-[#1d1842]">exams.kptmangaluru.in</b> ವೆಬ್‌ಸೈಟ್
            ಮೂಲಕ ಅಪ್‌ಲೋಡ್ ಮಾಡಬೇಕು. ಪ್ರಶ್ನೆ ಪತ್ರಿಕೆಯನ್ನು Word ಡಾಕ್ಯುಮೆಂಟ್
            ರೂಪದಲ್ಲಿಯೇ ಅಪ್‌ಲೋಡ್ ಮಾಡತಕ್ಕದ್ದು.
          </p>

          <p className="mt-3 text-justify indent-10">
            ಪ್ರಶ್ನೆ ಪತ್ರಿಕೆ ರಚನೆಯ ಸಂದರ್ಭದಲ್ಲಿ ಸಂಬಂಧಿತ ವಿಷಯ ಸಮಿತಿಯ ಅಧ್ಯಕ್ಷರು/ಸದಸ್ಯರು
            ಹಾಗೂ KPT ಪರೀಕ್ಷಾ ನಿಯಂತ್ರಕರು (Controller of Examination) ಕಾಲಕಾಲಕ್ಕೆ
            ನೀಡುವ ಸೂಚನೆಗಳನ್ನು ಪಾಲಿಸಿ, ಅವರೊಂದಿಗೆ ಸಮನ್ವಯದಿಂದ ಕಾರ್ಯನಿರ್ವಹಿಸಬೇಕು.
          </p>

          <div className="important-box mt-3 rounded-r-md text-justify">
            <p className="font-bold text-[#8e0d3c]">ಗೌಪ್ಯತೆ ಮತ್ತು ಜವಾಬ್ದಾರಿ</p>
            <p className="mt-1">
              ಪ್ರಶ್ನೆ ಪತ್ರಿಕೆ ರಚನೆಯ ಕಾರ್ಯವನ್ನು ಅತ್ಯಂತ ಜವಾಬ್ದಾರಿ, ನಿಖರತೆ, ಎಚ್ಚರಿಕೆ
              ಮತ್ತು ಸಂಪೂರ್ಣ ಗೌಪ್ಯತೆಯಿಂದ ನಿರ್ವಹಿಸಬೇಕು. ಪ್ರಶ್ನೆ ಪತ್ರಿಕೆಯಲ್ಲಿ ಯಾವುದೇ
              ರೀತಿಯ ದೋಷ, ಅಸ್ಪಷ್ಟತೆ ಅಥವಾ ಲೋಪ ಉಂಟಾಗದಂತೆ ವಿಶೇಷ ಗಮನಹರಿಸಬೇಕು.
            </p>
          </div>

          <table className="official-table mt-5 w-full border-collapse text-[11px]">
            <tbody>
              {tableRows.map(([k, v]) => (
                <tr key={k}>
                  <td className="w-[34%] font-bold text-[#1d1842]">{k}</td>
                  <td className={k === "LAST DATE TO UPLOAD" ? "font-bold text-[#8e0d3c]" : ""}>
                    {v}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="mt-3 text-[10.5px] text-slate-600">
            ಮೇಲಿನ ವಿವರಗಳನ್ನು ಪರಿಶೀಲಿಸಿ, ನಿಗದಿತ ದಿನಾಂಕದೊಳಗೆ ಪ್ರಶ್ನೆ ಪತ್ರಿಕೆಯನ್ನು
            ಅಪ್‌ಲೋಡ್ ಮಾಡುವುದು ಪ್ರಶ್ನೆ ಪತ್ರಿಕೆ ರಚನಕಾರರ ಜವಾಬ್ದಾರಿಯಾಗಿದೆ.
          </p>
        </div>

        <footer className="official-footer mt-3 pt-2 text-center text-[9.5px] leading-snug">
          <p className="font-extrabold">{FOOTER_KN[0]}</p>
          <p className="text-slate-600">{FOOTER_KN[1]}</p>
          <p className="font-semibold text-[#1d1842]">{FOOTER_KN[2]}</p>
        </footer>
      </div>

      {/* PAGE 2: INSTRUCTIONS AND COPY TO */}
      <div className="sheet">
        <header className="mb-4 border-b-[3px] border-[#1d1842] pb-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[13px] font-extrabold text-[#1d1842]">
                KARNATAKA (GOVT.) POLYTECHNIC, MANGALURU
              </p>
              <p className="text-[10.5px] font-semibold text-[#8e0d3c]">
                OFFICE OF THE CONTROLLER OF EXAMINATION
              </p>
            </div>
            <p className="text-right text-[10px] font-semibold text-slate-500">
              {SCHEME} Scheme
              <br />
              Academic Year {academicYear(date)}
            </p>
          </div>
        </header>

        <div className="flex-1">
          <div className="rounded-md border border-[#fda1a2] bg-[#fff5f5] px-3 py-2">
            <p className="text-[14px] font-extrabold text-[#8e0d3c]">
              ಪಾಲಿಸಬೇಕಾದ ಸೂಚನೆಗಳು
            </p>
            <p className="mt-1 text-justify">
              ಪ್ರಶ್ನೆ ಪತ್ರಿಕೆ ರಚನಕಾರರು KPT ಪರೀಕ್ಷಾ ನಿಯಂತ್ರಕರು ನೀಡುವ ಎಲ್ಲಾ ಸೂಚನೆಗಳು,
              ನಿಯಮಗಳು ಮತ್ತು ಮಾರ್ಗಸೂಚಿಗಳನ್ನು ಕಡ್ಡಾಯವಾಗಿ ಪಾಲಿಸಬೇಕು.
            </p>
          </div>

          <ol className="instruction-list ml-7 mt-4 list-decimal text-justify">
            <li>
              ಪ್ರತಿ ಪ್ರಶ್ನೆಗೆ ನಿಗದಿಪಡಿಸಿದ ಅಂಕಗಳು, ಉತ್ತರಿಸಲು ಬೇಕಾದ ಅಂದಾಜು ಸಮಯ,
              ನಿರೀಕ್ಷಿತ ಉತ್ತರದ ಸ್ವರೂಪ ಮತ್ತು ವಿಸ್ತಾರ ಹಾಗೂ ಮೌಲ್ಯಮಾಪನ ಯೋಜನೆಯ (Scheme
              of Valuation) ಅವಶ್ಯಕತೆಗಳನ್ನು ಗಮನದಲ್ಲಿಟ್ಟುಕೊಂಡು ಪ್ರಶ್ನೆಗಳನ್ನು
              ಸ್ಪಷ್ಟವಾಗಿ, ನಿಖರವಾಗಿ ಮತ್ತು ದೋಷರಹಿತವಾಗಿ ರೂಪಿಸಬೇಕು.
            </li>
            <li>
              ಪ್ರಶ್ನೆ ಪತ್ರಿಕೆಯನ್ನು ಸಂಪೂರ್ಣವಾಗಿ ನಿಗದಿತ ಪಠ್ಯಕ್ರಮಕ್ಕೆ ಅನುಗುಣವಾಗಿ
              ರಚಿಸಬೇಕು. ಪ್ರತಿ ಅಧ್ಯಾಯಕ್ಕೆ ನಿಗದಿಪಡಿಸಿರುವ ಬೋಧನಾ ಗಂಟೆಗಳು, ವಿಷಯದ
              ಪ್ರಾಮುಖ್ಯತೆ ಹಾಗೂ ಅನುಮೋದಿತ ಬ್ಲೂಪ್ರಿಂಟ್‌ನಲ್ಲಿರುವ ಅಂಕಗಳ ಹಂಚಿಕೆಯನ್ನು
              ಕಡ್ಡಾಯವಾಗಿ ಅನುಸರಿಸಬೇಕು.
            </li>
            <li>
              ಅನ್ವಯಿಸುವ ಸಂದರ್ಭಗಳಲ್ಲಿ ನಿಗದಿಪಡಿಸಿರುವ ಮೌಲ್ಯಮಾಪನ ರೂಬ್ರಿಕ್ಸ್‌ಗಳನ್ನು
              (Rubrics) ಕಡ್ಡಾಯವಾಗಿ ಅನುಸರಿಸಬೇಕು.
            </li>
            <li>
              ಪ್ರಶ್ನೆ ಪತ್ರಿಕೆಯ ಬ್ಲೂಪ್ರಿಂಟ್, ಪಠ್ಯಕ್ರಮ, ಪ್ರಶ್ನೆ ಪತ್ರಿಕೆ ಕೋಡ್ ಅಥವಾ
              ಇತರ ತಾಂತ್ರಿಕ ವಿವರಗಳಿಗೆ ಸಂಬಂಧಿಸಿದಂತೆ ಸ್ಪಷ್ಟನೆ ಅಗತ್ಯವಿದ್ದಲ್ಲಿ,
              ಸಂಬಂಧಿತ ವಿಷಯ ಸಮಿತಿಯ ಅಧ್ಯಕ್ಷರನ್ನು ಸಂಪರ್ಕಿಸಬೇಕು. ಅಗತ್ಯ ಮಾಹಿತಿಗಾಗಿ{" "}
              <b className="text-[#1d1842]">{HELP_PHONES}</b> ದೂರವಾಣಿ ಸಂಖ್ಯೆಗಳನ್ನು
              ಸಂಪರ್ಕಿಸಬಹುದು.
            </li>
            <li>
              ಪ್ರಶ್ನೆ ಪತ್ರಿಕೆಯನ್ನು MS Word ನಲ್ಲಿ ಸಿದ್ಧಪಡಿಸಿ, ಸಂಬಂಧಿತ ವಿಷಯ ಸಮಿತಿಯ
              ಅಧ್ಯಕ್ಷರು ಹಾಗೂ KPT ಪರೀಕ್ಷಾ ನಿಯಂತ್ರಕರೊಂದಿಗೆ ಸಮನ್ವಯ ಸಾಧಿಸಿ,
              ನಿಗದಿಪಡಿಸಿದ ಕೊನೆಯ ದಿನಾಂಕ ಮತ್ತು ಸಮಯದೊಳಗೆ{" "}
              <b className="text-[#1d1842]">exams.kptmangaluru.in</b> ವೆಬ್‌ಸೈಟ್‌ನಲ್ಲಿ
              ಅಪ್‌ಲೋಡ್ ಮಾಡಬೇಕು. Word ಡಾಕ್ಯುಮೆಂಟ್ ಹೊರತುಪಡಿಸಿ ಇತರ ಫೈಲ್ ರೂಪಗಳನ್ನು
              ಅಪ್‌ಲೋಡ್ ಮಾಡಬಾರದು.
            </li>
            <li>
              ಪ್ರಶ್ನೆ ಪತ್ರಿಕೆಯ ವಿಭಾಗಗಳು, ಪ್ರಶ್ನೆಗಳ ಆಯ್ಕೆ, ಅಂಕಗಳ ಹಂಚಿಕೆ ಮತ್ತು ಇತರ
              ವಿನ್ಯಾಸದ ಅಂಶಗಳು ಸಂಬಂಧಿತ ವಿಭಾಗದ ಅನುಮೋದಿತ ಬ್ಲೂಪ್ರಿಂಟ್‌ಗೆ ಸಂಪೂರ್ಣವಾಗಿ
              ಅನುಗುಣವಾಗಿರಬೇಕು.
            </li>
          <li>
  ಪ್ರಶ್ನೆ ಪತ್ರಿಕೆಯ ಸಿದ್ಧತೆ, ಸಂಗ್ರಹಣೆ ಮತ್ತು ಅಪ್‌ಲೋಡ್ ಪ್ರಕ್ರಿಯೆಯ
  ಪ್ರತಿಯೊಂದು ಹಂತದಲ್ಲಿಯೂ ಸಂಪೂರ್ಣ ಗೌಪ್ಯತೆಯನ್ನು ಕಾಪಾಡಬೇಕು.
</li>
          </ol>

          <div className="mt-5 rounded-md border border-[#c8c3da] bg-slate-50 p-3">
            <p className="font-bold text-[#1d1842]">ಪ್ರಶ್ನೆ ಪತ್ರಿಕೆ ಅಪ್‌ಲೋಡ್ ವಿವರಗಳು</p>
            <div className="mt-2 grid grid-cols-[38%_62%] gap-y-1 text-[11px]">
              <span className="font-semibold text-slate-600">Question Paper Code</span>
              <span className="font-bold text-[#8e0d3c]">
                {o.subject?.code || ""}
              </span>
              <span className="font-semibold text-slate-600">Upload Deadline</span>
              <span className="font-bold text-[#8e0d3c]">{lastDate(o.deadline)}</span>
              <span className="font-semibold text-slate-600">Upload Website</span>
              <span className="font-bold text-[#1d1842]">exams.kptmangaluru.in</span>
            </div>
          </div>

          <p className="mt-7 text-right font-bold text-[#1d1842]">
            ಪರೀಕ್ಷಾ ನಿಯಂತ್ರಕರು
          </p>

          <div className="mt-5 pt-3 text-[11px] leading-relaxed">
            <p className="font-extrabold text-[#8e0d3c]">ಪ್ರತಿ (Copy to):</p>
            <p className="mt-1">
              1. ಪ್ರಾಂಶುಪಾಲರು, ಸಂಸ್ಥೆಯ ಕೋಡ್: {college.code}
              {college.name ? `, ${college.name}` : ""} —
              ಮಾಹಿತಿಗಾಗಿ.
            </p>
          </div>
        </div>

        <footer className="official-footer mt-3 flex justify-between pt-2 text-[9.5px]">
          <span className="font-semibold">exams.kptmangaluru.in</span>
          <span className="font-semibold">Page 2 of 2</span>
        </footer>
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
