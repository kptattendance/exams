// src/services/practicalOrder.js
//
// Office order for an EXTERNAL practical examiner, addressed to the Principal
// of his college so that he is relieved for the practical examinations.
// The same HTML is emailed to the examiner (who forwards it to his Principal)
// and printed by the COE office (Print → Save as PDF). Inline styles only, so
// that it looks the same in Gmail / Outlook and on paper.

import { readFileSync } from "node:fs";

// The COE's signature with the office seal text (src/assets/coe-signature.png).
//   In an email it is attached and shown with cid:coe-sign (Gmail does not show
//   data: images); in the printed order and the attached copy it is a data URI.
export const SIGNATURE_PATH = new URL("../assets/coe-signature.png", import.meta.url);
export const SIGNATURE_CID = "coe-sign";
let signatureUri = null;
export const signatureDataUri = () => {
  if (signatureUri === null) {
    try {
      signatureUri = `data:image/png;base64,${readFileSync(SIGNATURE_PATH).toString("base64")}`;
    } catch {
      signatureUri = ""; // no file: the typed signature block is printed instead
    }
  }
  return signatureUri;
};

const LOGO = {
  // Cloudinary copies of the college logos (resized so the email stays small)
  crest: "https://res.cloudinary.com/dnreqxbdw/image/upload/w_220/v1757932916/logo3_vptob4.jpg",
  jubilee: "https://res.cloudinary.com/dnreqxbdw/image/upload/w_220/v1757932915/logo4_q0ujtn.png",
  emblem: "https://res.cloudinary.com/dnreqxbdw/image/upload/w_160/v1757932915/logo5_czeuoz.png",
};

export const ORDER_REF_PREFIX = "ಕೆಪಿಎಂ/29/ಸ್ವಾಯತ್ತತೆ (ಪರೀಕ್ಷೆ)";

const DEPT_FULL = {
  at: "Automobile Engineering",
  ch: "Chemical Engineering",
  ce: "Civil Engineering",
  cs: "Computer Science and Engineering",
  ec: "Electronics and Communication Engineering",
  ee: "Electrical and Electronics Engineering",
  me: "Mechanical Engineering",
  ps: "Polymer Technology",
  sc: "Science and English",
};
export const deptFull = (d) => DEPT_FULL[String(d || "").toLowerCase()] || String(d || "").toUpperCase();

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// "2026-11-20" or a Date -> "20-11-2026"
export const dmy = (d) => {
  if (!d) return "";
  const x = typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T00:00:00+05:30`) : new Date(d);
  return x.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Kolkata" }).replace(/\//g, "-");
};

// June onwards belongs to the new academic year: 2025-26
const academicYear = (d) => {
  const x = new Date(d);
  const start = x.getMonth() >= 5 ? x.getFullYear() : x.getFullYear() - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
};

const REFERENCES = [
  "ಸರ್ಕಾರದ ಆದೇಶ ಸಂಖ್ಯೆ ಇಡಿ. 72 ಡಿಟಿಇ 2024 “Regulation for Autonomous Polytechnic College 2025” ದಿ: 19.10.2025.",
  "ಸರ್ಕಾರದ ಆದೇಶ ಸಂಖ್ಯೆ ಇಡಿ.72 ಡಿಟಿಇ 2024 ಕರ್ನಾಟಕ (ಸರ್ಕಾರಿ) ಪಾಲಿಟೆಕ್ನಿಕ್ ಸ್ವಾಯತ್ತತೆ ನೀಡಿ ಆದೇಶ ದಿನಾಂಕ 19.10.25",
  "ನಿರ್ದೇಶಕರು, ತಾಂತ್ರಿಕ ಶಿಕ್ಷಣ ನಿರ್ದೇಶನಾಲಯ, ಬೆಂಗಳೂರು ಇವರ ಅಧ್ಯಕ್ಷತೆಯಲ್ಲಿ ನಡೆದ ಆಡಳಿತ ಮಂಡಳಿ ಸಭೆಯ ನಡಾವಳಿ ದಿ:12.12.2025",
  "ಕರ್ನಾಟಕ (ಸರ್ಕಾರಿ) ಪಾಲಿಟೆಕ್ನಿಕ್ (ಸ್ವಾಯತ್ತ), ಮಂಗಳೂರು ಇದರ ಶೈಕ್ಷಣಿಕ ನಿಯಮಗಳು ಮತ್ತು ನಿಯಂತ್ರಣ - ಡಿಪ್ಲೊಮಾ ಎಂಜಿನಿಯರಿಂಗ್",
  "ಕರ್ನಾಟಕ (ಸರ್ಕಾರಿ) ಪಾಲಿಟೆಕ್ನಿಕ್ (ಸ್ವಾಯತ್ತ), ಮಂಗಳೂರು ಇದರ ಪರೀಕ್ಷಾ ಕೈಪಿಡಿ – 2025",
];

const FONT = "'Noto Sans Kannada','Nirmala UI','Tunga',Arial,sans-serif";
const cell = "border:1px solid #333;padding:6px 8px;font-size:13px;vertical-align:top";

// A complete page (for the attached copy that the examiner prints)
export const orderDocument = (html, title = "Office order") =>
  `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>@page{size:A4;margin:10mm 12mm}body{margin:0;padding:16px}@media print{body{padding:0}}</style></head><body>${html}</body></html>`;

// order: { exam: { name }, panel, date, from, to, start }
//   from / to  – first and last day of the practical examinations ("" if not fixed)
//   start      – first day this examiner is needed ("" if not fixed)
//   signature  – image source of the COE's signature (default: data URI)
export function practicalOrderHtml({ exam, panel, date = new Date(), from = "", to = "", start = "", signature = signatureDataUri() }) {
  const ext = panel.external || {};
  const college = ext.college || "";
  const later = "ಮುಂದೆ ತಿಳಿಸಲಾಗುವುದು";
  const period =
    from && to
      ? `ದಿನಾಂಕ ${esc(dmy(from))} ರಿಂದ ${esc(dmy(to))} ರವರೆಗೆ`
      : "ಮುಂದೆ ತಿಳಿಸಲಾಗುವ ದಿನಾಂಕಗಳಂದು";

  return `
<div style="font-family:${FONT};max-width:720px;margin:auto;color:#111;font-size:14px;line-height:1.7;background:#fff">
  <table role="presentation" width="100%" style="border-collapse:collapse;border-bottom:3px solid #1d1842">
    <tr>
      <td width="96" style="vertical-align:middle;padding:0 0 8px"><img src="${LOGO.crest}" width="88" alt="KPT" style="display:block"/></td>
      <td style="text-align:center;vertical-align:middle;padding:0 4px 8px;line-height:1.25">
        <img src="${LOGO.emblem}" width="54" alt="" style="display:block;margin:0 auto 2px"/>
        <div style="font-size:15px;font-weight:bold;font-family:Georgia,'Times New Roman',serif">GOVERNMENT OF KARNATAKA</div>
        <div style="font-size:13.5px;font-weight:bold;font-family:Georgia,'Times New Roman',serif">DEPARTMENT OF COLLEGIATE AND TECHNICAL EDUCATION</div>
        <div style="font-size:17px;font-weight:bold;color:#c00000;font-family:Georgia,'Times New Roman',serif">KARNATAKA (GOVT.) POLYTECHNIC, MANGALURU</div>
        <div style="font-size:12.5px;font-weight:bold;color:#1f4e9c;font-family:Georgia,'Times New Roman',serif">(First Autonomous Polytechnic in India from AICTE New Delhi)</div>
        <div style="font-size:13px;font-family:Georgia,'Times New Roman',serif">Kadri Hills, Mangaluru– 575004, Dakshina Kannada, Karnataka</div>
      </td>
      <td width="96" style="vertical-align:middle;text-align:right;padding:0 0 8px"><img src="${LOGO.jubilee}" width="88" alt="" style="display:block;margin-left:auto"/></td>
    </tr>
  </table>

  <table role="presentation" width="100%" style="border-collapse:collapse;margin-top:12px;font-size:13.5px">
    <tr>
      <td style="vertical-align:top">ನಂ: ${esc(ORDER_REF_PREFIX)}/${esc(academicYear(date))}</td>
      <td style="vertical-align:top;text-align:right">
        ಪರೀಕ್ಷಾ ನಿಯಂತ್ರಕರ ಕಚೇರಿ,<br/>ಕರ್ನಾಟಕ(ಸರ್ಕಾರಿ) ಪಾಲಿಟೆಕ್ನಿಕ್(ಸ್ವಾಯತ್ತ)<br/>ಮಂಗಳೂರು, ದಿನಾಂಕ: ${esc(dmy(date))}.
      </td>
    </tr>
  </table>

  <p style="margin:12px 0 0">ರಿಗೆ,<br/>&nbsp;&nbsp;&nbsp;&nbsp;ಪ್ರಾಂಶುಪಾಲರು,<br/>&nbsp;&nbsp;&nbsp;&nbsp;<b>${esc(college || "________________________")}</b></p>

  <table role="presentation" width="100%" style="border-collapse:collapse;margin-top:12px;font-size:13.5px">
    <tr>
      <td width="80" style="vertical-align:top;padding-left:40px;white-space:nowrap">ವಿಷಯ:-</td>
      <td style="vertical-align:top"><b>${esc(exam.name)} ಡಿಪ್ಲೋಮ ಸೆಮಿಸ್ಟರ್ ಪ್ರಾಯೋಗಿಕ ಪರೀಕ್ಷೆಗಳಿಗೆ ಉಪನ್ಯಾಸಕರನ್ನು ನಿಯೋಜಿಸುವ ಬಗ್ಗೆ.</b></td>
    </tr>
    <tr>
      <td style="vertical-align:top;padding:6px 0 0 40px;white-space:nowrap">ಉಲ್ಲೇಖ:-</td>
      <td style="vertical-align:top;padding-top:6px">
        <ol style="margin:0;padding-left:20px">${REFERENCES.map((r) => `<li>${esc(r)}</li>`).join("")}</ol>
      </td>
    </tr>
  </table>
  <p style="text-align:center;margin:2px 0 8px">-----------</p>

  <p style="text-align:justify;text-indent:40px;margin:0 0 8px">ಮೇಲ್ಕಂಡ ವಿಷಯಕ್ಕೆ ಸಂಬಂಧಿಸಿದಂತೆ, ಉಲ್ಲೇಖ (1)ರ ಆದೇಶದ ಪ್ರಕಾರ ಕರ್ನಾಟಕ ಸರ್ಕಾರವು ತಾಂತ್ರಿಕ ಶಿಕ್ಷಣ ಇಲಾಖೆ ಅಡಿಯಲ್ಲಿ ಕಾರ್ಯನಿರ್ವಹಿಸಲು ಪಾಲಿಟೆಕ್ನಿಕ್ ಸಂಸ್ಥೆಗಳ ಶೈಕ್ಷಣಿಕ ಮತ್ತು ಆಡಳಿತಾತ್ಮಕ ಚಟುವಟಿಕೆಗಳನ್ನು ಪಾರದರ್ಶಕವಾಗಿ ಮತ್ತು ಪರಿಣಾಮಕಾರಿಯಾಗಿ ನಿರ್ವಹಿಸುವ ಉದ್ದೇಶದಿಂದ “ಸ್ವಾಯತ್ತ ಪಾಲಿಟೆಕ್ನಿಕ್ ಕಾಲೇಜು ನಿಯಮಾವಳಿ 2025” ನ್ನು ಜಾರಿಗೊಳಿಸಿದೆ.</p>
  <p style="text-align:justify;text-indent:40px;margin:0 0 8px">ಉಲ್ಲೇಖ (2) ರ ಆದೇಶದಲ್ಲಿ, ಸರ್ಕಾರವು ಉಲ್ಲೇಖ (1) ರ ಆದೇಶದಲ್ಲಿ ವಿಧಿಸಲಾದ ನಿಯಮಾವಳಿಗಳನ್ನು ಪಾಲಿಸುವ ಷರತ್ತಿಗೆ ಒಳಪಟ್ಟು ನಮ್ಮ ಸಂಸ್ಥೆಗೆ ಮುಂದಿನ 5 (ಐದು) ವರ್ಷಗಳ ಕಾಲ ಶೈಕ್ಷಣಿಕ ಸ್ವಾಯತ್ತ ಸ್ಥಾನಮಾನ ನೀಡುವ ಬಗ್ಗೆ ಆಡಳಿತಾತ್ಮಕ ಅನುಮೋದನೆ ನೀಡಿ ಆದೇಶಿಸಿದೆ. ದಿನಾಂಕ 12.12.2025 ರಂದು ನಡೆದ ನಿರ್ದೇಶಕರು, ತಾಂತ್ರಿಕ ಶಿಕ್ಷಣ ನಿರ್ದೇಶನಾಲಯ ಇವರ ಅಧ್ಯಕ್ಷತೆಯ ಆಡಳಿತ ಮಂಡಳಿಯ ಉಲ್ಲೇಖ (3) ರ ಸಭೆಯಲ್ಲಿ, ನಮ್ಮ ಸಂಸ್ಥೆಯ ಸ್ವಾಯತ್ತ ಶೈಕ್ಷಣಿಕ ನಿಯಮಗಳು (ಉಲ್ಲೇಖ (4)), ಶೈಕ್ಷಣಿಕ ಕ್ಯಾಲೆಂಡರ್, ಪರೀಕ್ಷಾ ಕೈಪಿಡಿ (ಉಲ್ಲೇಖ (5)), ಮತ್ತು ಐಕ್ಯೂಎಸಿ ಕೋಶದ ನಿಯಮಾವಳಿ ಮೊದಲಾದವುಗಳನ್ನು ಮಂಡಿಸಿ ಅನುಮೋದನೆ ಪಡೆಯಲಾಗಿದೆ.</p>
  <p style="text-align:justify;text-indent:40px;margin:0 0 10px">ಮೇಲ್ಕಂಡ ವಿಷಯಕ್ಕೆ ಸಂಬಂಧಿಸಿದಂತೆ ${esc(exam.name)} ಪ್ರಾಯೋಗಿಕ ಪರೀಕ್ಷೆಗಳನ್ನು ${period} ನಮ್ಮ ಸಂಸ್ಥೆಯಲ್ಲಿ ನಡೆಸಲಾಗುವುದು. ಸದರಿ ಪ್ರಾಯೋಗಿಕ ಪರೀಕ್ಷೆಗಳಿಗೆ ತಮ್ಮ ಸಂಸ್ಥೆಯಿಂದ ಕೋಷ್ಟಕ - 1 ರಲ್ಲಿ ನಮೂದಿಸಿದ ಉಪನ್ಯಾಸಕರನ್ನು ನಿಯೋಜಿಸಲು ಕೋರಲಾಗಿದೆ.</p>

  <p style="text-align:center;font-weight:bold;margin:0 0 6px">ಕೋಷ್ಟಕ - 1</p>
  <table width="100%" style="border-collapse:collapse;text-align:center">
    <tr>
      <th style="${cell};text-align:center">ಕ್ರ.ಸಂ</th>
      <th style="${cell};text-align:center">ಉಪನ್ಯಾಸಕರ ಹೆಸರು</th>
      <th style="${cell};text-align:center">ಪದನಾಮ</th>
      <th style="${cell};text-align:center">ವಿಭಾಗದ ಹೆಸರು</th>
      <th style="${cell};text-align:center">ಸಂಸ್ಥೆಯ ಹೆಸರು</th>
      <th style="${cell};text-align:center">ಪರೀಕ್ಷಾ ಪ್ರಾರಂಭ ದಿನಾಂಕ</th>
    </tr>
    <tr>
      <td style="${cell};text-align:center">1</td>
      <td style="${cell};text-align:center"><b>${esc(ext.name)}</b></td>
      <td style="${cell};text-align:center">${esc(ext.designation || "Lecturer")}</td>
      <td style="${cell};text-align:center">${esc(deptFull(ext.department || panel.department))}</td>
      <td style="${cell};text-align:center">${esc(college)}</td>
      <td style="${cell};text-align:center"><b>${start ? esc(dmy(start)) : later}</b></td>
    </tr>
  </table>

  <table role="presentation" width="100%" style="border-collapse:collapse;margin-top:36px">
    <tr>
      <td></td>
      <td width="320" style="text-align:center;line-height:1.35">${
        signature
          ? `<img src="${signature}" width="300" alt="Controller of Examination, Karnataka (Govt.) Polytechnic (Autonomous), Kadri Hills, Mangaluru - 575004" style="display:block;margin:0 auto;max-width:100%;height:auto"/>`
          : `<div style="height:40px"></div>
        <div>ಪರೀಕ್ಷಾ ನಿಯಂತ್ರಕರು</div>
        <div style="font-weight:bold;color:#1d1842">CONTROLLER OF EXAMINATION</div>
        <div style="font-size:12.5px">Karnataka (Govt.) Polytechnic (Autonomous)</div>
        <div style="font-size:12.5px">Kadri Hills, Mangaluru - 575004</div>`
      }
      </td>
    </tr>
  </table>

  <p style="margin:18px 0 4px">ಪ್ರತಿಗಳು:</p>
  <p style="margin:0 0 0 24px">1) ಕೋಷ್ಟಕ - 1 ರಲ್ಲಿ ನಮೂದಿಸಿದ ಉಪನ್ಯಾಸಕರಿಗೆ - ಪ್ರಾಂಶುಪಾಲರ ಮುಖಾಂತರ</p>

  <div style="margin-top:24px;border-top:2px solid #1d1842;padding-top:6px;text-align:center;font-size:12px;line-height:1.5">
    <div style="font-weight:bold;color:#c00000">ಕರ್ನಾಟಕ (ಸರ್ಕಾರಿ) ಪಾಲಿಟೆಕ್ನಿಕ್, ಮಂಗಳೂರು</div>
    <div>ಕದ್ರಿ ಹಿಲ್ಸ್, ಮಂಗಳೂರು - 575004, ದಕ್ಷಿಣ ಕನ್ನಡ, ಕರ್ನಾಟಕ</div>
    <div>Phone No. 0824 – 3516910 / 2211636, E-Mail: kptmng@gmail.com</div>
  </div>
</div>`;
}
