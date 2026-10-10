// src/services/mailer.js
//
// Sends the "please set the question paper" email.
// The email contains ONLY a link to the website. The link by itself gives
// no access: the faculty must sign in with Clerk, and the server checks that
// the signed-in user is the examiner assigned to that paper.
//
// Env (Gmail example — use an App Password, not the real password):
//   SMTP_HOST=smtp.gmail.com
//   SMTP_PORT=465
//   SMTP_USER=coe.kpt@gmail.com
//   SMTP_PASS=xxxx xxxx xxxx xxxx
//   MAIL_FROM="COE, KPT Mangaluru <coe.kpt@gmail.com>"
//   FRONTEND_URL=https://exams.kptmangaluru.in

import nodemailer from "nodemailer";

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return null;

  const port = Number(process.env.SMTP_PORT || 465);
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transporter;
}

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

export async function sendPaperSettingEmail({ to, name, subject, paper, isReminder }) {
  const t = getTransporter();
  if (!t) {
    console.warn("SMTP not configured: paper-setting email not sent to", to);
    return false;
  }

  const link = `${process.env.FRONTEND_URL}/faculty/paper-setting/${paper._id}`;
  const deadline = new Date(paper.deadline).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });

  const title = isReminder
    ? "Reminder: Question paper setting"
    : "Appointment as Question Paper Setter";

  const html = `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#0f172a">
    <h2 style="margin:0 0 12px">${title}</h2>
    <p>Dear ${esc(name)},</p>
    <p>You have been appointed to set the <b>${esc(paper.paperType.toLowerCase())}</b>
       question paper for:</p>
    <p style="background:#f1f5f9;padding:12px;border-radius:8px">
      <b>${esc(subject.code)} – ${esc(subject.name)}</b><br/>
      Semester ${esc(subject.semester)} · ${esc(paper.examSession)} examination
    </p>
    <p><b>Last date for submission:</b> ${esc(deadline)}</p>
    ${paper.instructions ? `<p><b>Instructions:</b><br/>${esc(paper.instructions).replace(/\n/g, "<br/>")}</p>` : ""}
    <p style="margin:24px 0">
      <a href="${link}" style="background:#2563eb;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">
        Sign in and upload the paper
      </a>
    </p>
    <p style="font-size:13px;color:#475569">
      Please upload the paper only through the website (Word .docx format).
      <b>Do not send the question paper by email or WhatsApp.</b>
      This link works only after you sign in with your college account.
      This is a confidential communication.
    </p>
  </div>`;

  await t.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject: `${title} – ${subject.code}`,
    html,
  });
  return true;
}

// ------------------------------------------------------------------ practical exams

const DEPT_NAME = {
  at: "Automobile",
  ch: "Chemical",
  ce: "Civil",
  cs: "Computer Science",
  ec: "Electronics & Communication",
  ee: "Electrical & Electronics",
  me: "Mechanical",
  ps: "Polymer",
  sc: "Science & English",
};
const deptName = (d) => DEPT_NAME[String(d).toLowerCase()] || String(d).toUpperCase();

const wrap = (title, body) => `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#0f172a">
    <h2 style="margin:0 0 12px">${title}</h2>
    ${body}
    <p style="font-size:13px;color:#475569">This is a confidential communication from the COE office.</p>
  </div>`;

// The COE allotted a set of practical examiners to a department.
//   role "EXTERNAL" – also carries the secret code he types on exam day
//   role "INTERNAL" – he signs in and opens each batch
//   role "HOD"      – so that he can contact them and fix the dates
export async function sendPracticalAllotmentEmail({ to, name, role, exam, panel, code }) {
  const t = getTransporter();
  if (!t || !to) {
    if (!t) console.warn("SMTP not configured: practical allotment email not sent to", to);
    return false;
  }
  const title = role === "HOD" ? "Practical examiners allotted" : "Appointment as Practical Examiner";
  const contact = (p) => [p.phone, p.email].filter(Boolean).map(esc).join(" · ");
  const html = wrap(
    title,
    `<p>Dear ${esc(name)},</p>
    <p>${
      role === "HOD"
        ? "The COE has allotted these practical examiners to your department. Please contact them and fix the dates of the practical examinations in <b>Practical batches</b>."
        : `You have been appointed as the <b>${role === "EXTERNAL" ? "external" : "internal"} examiner</b> for the practical examinations of:`
    }</p>
    <p style="background:#f1f5f9;padding:12px;border-radius:8px">
      <b>${esc(deptName(panel.department))} department</b> · Examiner set ${esc(panel.number)}<br/>
      ${esc(exam.name)}
    </p>
    <p>
      <b>Internal examiner:</b> ${esc(panel.internal.name)}${contact(panel.internal) ? ` (${contact(panel.internal)})` : ""}<br/>
      <b>External examiner:</b> ${esc(panel.external.name)}${panel.external.college ? `, ${esc(panel.external.college)}` : ""}${
      contact(panel.external) ? ` (${contact(panel.external)})` : ""
    }
    </p>
    ${
      role === "EXTERNAL"
        ? `<p>The Head of the Department will contact you to fix the dates. Your secret code:</p>
           <p style="font-size:28px;font-weight:bold;letter-spacing:6px;background:#f1f5f9;padding:12px;border-radius:8px;text-align:center">${esc(code)}</p>
           <p style="font-size:13px;color:#475569">
             After each batch the internal examiner signs in and opens the marks sheet. You then type this code
             <b>yourself</b> to open the sheet, and once more to submit the marks. The same code works for all your batches.
             <b>Do not share this code with anyone, including the internal examiner.</b>
           </p>`
        : role === "INTERNAL"
        ? `<p>The Head of the Department will fix the dates; you will get the time table by email. After each batch, sign in at
             <a href="${process.env.FRONTEND_URL}">${esc(process.env.FRONTEND_URL || "the examination website")}</a>
             and open <b>Practical marks entry</b>. The external examiner types a secret code on your screen
             to open the marks sheet and again to submit it. Submitted marks are final.</p>`
        : ""
    }`
  );
  await t.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject: `${title} – ${deptName(panel.department)} (${exam.name})`,
    html,
  });
  return true;
}

// The HOD fixed or changed the dates: each examiner gets his full time table.
//   batches: every batch of the examiner's set, in date order
export async function sendPracticalScheduleEmail({ to, name, exam, panel, batches }) {
  const t = getTransporter();
  if (!t || !to) return false;
  const day = (b) => (b.date ? new Date(`${b.date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "Not fixed yet");
  const cell = "padding:6px 8px;border:1px solid #cbd5e1;font-size:13px";
  const rows = batches
    .map(
      (b) => `<tr>
        <td style="${cell}">${esc(day(b))}${b.session ? `<br/>${b.session === "FN" ? "Morning" : "Afternoon"}` : ""}</td>
        <td style="${cell}"><b>${esc(b.code)}</b> ${esc(b.name)}<br/>Batch ${esc(b.number)} · ${b.students.length} students</td>
        <td style="${cell}">${esc(b.lab || "")}</td>
      </tr>`
    )
    .join("");
  const html = wrap(
    "Practical examination time table",
    `<p>Dear ${esc(name)},</p>
    <p>This is your present time table for the practical examinations of the <b>${esc(deptName(panel.department))}</b> department
       (${esc(exam.name)}). It replaces any earlier time table sent to you.</p>
    <table style="border-collapse:collapse;width:100%">
      <tr style="background:#f1f5f9"><th style="${cell};text-align:left">Date</th><th style="${cell};text-align:left">Subject</th><th style="${cell};text-align:left">Lab</th></tr>
      ${rows}
    </table>
    <p>Internal examiner: ${esc(panel.internal.name)} · External examiner: ${esc(panel.external.name)}</p>`
  );
  await t.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject: `Practical examination time table – ${deptName(panel.department)} (${exam.name})`,
    html,
  });
  return true;
}
