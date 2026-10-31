// src/services/mailer.js
//
// Sends the "please set the question paper" email.
// The email contains a link to the website and, when the COE has uploaded
// them, the syllabus / scheme PDFs of the subject. The link by itself gives
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
import { PRACTICAL_SESSIONS } from "./exams/practical.js";

// The office order (PDF, see services/practicalOrder.js) as an attachment
const orderAttachment = (pdf, name) => ({
  filename: `Office_Order_${String(name || "Examiner").replace(/[^A-Za-z0-9]+/g, "_")}.pdf`,
  content: pdf,
  contentType: "application/pdf",
});

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

  // Every email: a sender that matches the signed-in account, replies to the
  // MAIL_FROM address, and a plain-text copy next to the HTML (spam filters
  // distrust HTML-only mail).
  // A temporary refusal (Gmail "421 / 454 try again later", a dropped
  // connection) is retried twice before the send is reported as failed.
  const send = transporter.sendMail.bind(transporter);
  transporter.sendMail = async (msg) => {
    const { from, replyTo } = senderFor();
    const full = { ...msg, from, replyTo: msg.replyTo || replyTo, text: msg.text || htmlToText(msg.html) };
    for (let attempt = 1; ; attempt++) {
      try {
        return await send(full);
      } catch (e) {
        if (attempt >= 3 || !isTemporary(e)) throw e;
        console.warn(`Email to ${msg.to} failed (${e.responseCode || e.code}), retrying…`);
        await new Promise((r) => setTimeout(r, attempt * 3000));
      }
    }
  };
  return transporter;
}

// Gmail sends only as the signed-in account (SMTP_USER). A From address that is
// a different mailbox looks forged and lands in spam, so only the display name
// is taken from MAIL_FROM and its address is used for replies. If that address is
// added in Gmail under "Send mail as" (verified), set MAIL_FROM_VERIFIED=true.
export function senderFor(env = process.env) {
  const user = String(env.SMTP_USER || "").trim();
  const m = String(env.MAIL_FROM || "").match(/^\s*"?([^"<]*?)"?\s*<\s*([^>\s]+)\s*>\s*$/);
  const name = (m?.[1] || "COE, KPT Mangaluru").trim();
  const wanted = (m?.[2] || "").trim();
  const same = !wanted || wanted.toLowerCase() === user.toLowerCase();
  const address = same || env.MAIL_FROM_VERIFIED === "true" ? wanted || user : user;
  return {
    from: { name, address },
    replyTo: !same && address !== wanted ? wanted : undefined,
  };
}

// SMTP 4xx replies and network errors pass; 5xx (bad address, rejected) do not
export const isTemporary = (e) =>
  (e?.responseCode >= 400 && e?.responseCode < 500) || ["ETIMEDOUT", "ECONNECTION", "ECONNRESET", "ESOCKET", "EDNS"].includes(e?.code);

// Plain-text version of an HTML email
export function htmlToText(html) {
  if (!html) return undefined;
  return String(html)
    .replace(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, label) => `${label.replace(/<[^>]+>/g, "").trim()}: ${href}`)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

export async function sendPaperSettingEmail({ to, name, subject, paper, isReminder, attachments = [] }) {
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
    ${
      attachments.length
        ? `<p>We have attached the syllabus of this subject and the table of specification of the question paper
           (${attachments.map((a) => esc(a.filename)).join(", ")}). Please set the paper as per these.</p>`
        : ""
    }
    <p style="margin:24px 0">
      <a href="${link}" style="background:#2563eb;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">
        Sign in and upload the paper
      </a>
    </p>
    <p style="font-size:13px;color:#475569">
      Please upload the paper only through the website (Word .docx format).
      <b>Do not send the question paper by email or WhatsApp.</b>
      This link works only after you sign in with your mail account.
      This is a confidential communication.
    </p>

  <p style="font-size:13px; color:#475569; margin:24px 0;">
  The formal appointment order will be issued separately
  and sent to you by post.
</p>
  </div>`;

  await t.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject: `${title} – ${subject.code}`,
    html,
    attachments,
  });
  return true;
}

// ------------------------------------------------------------------ practical exams

const DEPT_NAME = {
  at: "Automobile Engineering",
  ch: "Chemical Engineering",
  ce: "Civil Engineering",
  cs: "Computer Science and Engineering",
  ec: "Electronics and Communication Engineering",
  ee: "Electrical and Electronics Engineering",
  me: "Mechanical Engineering",
  ps: "Polymer Technology",
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
//   orderPdf          – external examiner: the office order (PDF) goes in the same email
export async function sendPracticalAllotmentEmail({ to, name, role, exam, panel, code, orderPdf = null }) {
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
           </p>${
             orderPdf
               ? `<p style="background:#fff7ed;border-left:4px solid #ea580c;padding:10px 12px;border-radius:4px">
             <b>Your office order is attached (PDF).</b> Print it and give the copy to your Principal so that you are relieved
             for the practical examinations. If you send it to your Principal by email, attach only the PDF –
             <b>do not forward this email</b>, it contains your secret code.</p>`
               : ""
           }`
        : role === "INTERNAL"
        ? `<p>The Head of the Department will fix the dates; you will get the time table by email. After each batch, sign in at
             <a href="${process.env.FRONTEND_URL}">${esc(process.env.FRONTEND_URL || "the examination website")}</a>
             and open <b>Practical marks entry</b>. The external examiner types a secret code on your screen
             to open the marks sheet and again to submit it. Submitted marks are final.</p>${
             orderPdf ? `<p style="background:#fff7ed;border-left:4px solid #ea580c;padding:10px 12px;border-radius:4px"><b>Your office order is attached (PDF).</b></p>` : ""
           }`
        : ""
    }`
  );
  await t.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject: `${title} – ${deptName(panel.department)} (${exam.name})`,
    html,
    attachments: orderPdf ? [orderAttachment(orderPdf, name)] : undefined,
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
        <td style="${cell}">${esc(day(b))}${b.session ? `<br/>${b.session === "FN" ? "Morning" : b.session === "AN" ? "Afternoon" : esc(PRACTICAL_SESSIONS[b.session]?.label || b.session)}` : ""}</td>
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

// Office order for a practical examiner (see services/practicalOrder.js).
// The external examiner forwards it to his Principal to be relieved for the
// practical examinations; the internal examiner (internal: true) keeps it.
export async function sendPracticalOrderEmail({ to, name, exam, orderPdf, internal = false }) {
  const t = getTransporter();
  if (!t || !to) return false;
  const html = wrap(
    "Office order – Practical examiner",
    internal
      ? `<p>Dear ${esc(name)},</p>
    <p>Your office order as the <b>internal examiner</b> for the practical examinations of ${esc(exam.name)} is attached (PDF).</p>`
      : `<p>Dear ${esc(name)},</p>
    <p>Your office order as an <b>external examiner</b> for the practical examinations of ${esc(exam.name)} at
       Karnataka (Govt.) Polytechnic, Mangaluru is attached (PDF). Please print it and give the copy to your Principal
       so that you are relieved for the examinations.</p>`
  );
  await t.sendMail({
    to,
    subject: `Office order – Practical examiner, ${exam.name} (KPT Mangaluru)`,
    html,
    attachments: [orderAttachment(orderPdf, name)],
  });
  return true;
}

// ------------------------------------------------------------------ security codes

// One-time code for a dangerous admin action (e.g. deleting students with all records)
export async function sendSecurityCodeEmail({ to, code, action, details = [] }) {
  const t = getTransporter();
  if (!t || !to) return false;
  const html = wrap(
    "Security code",
    `<p>A request was made on the examination website to <b>${esc(action)}</b>.</p>
    ${details.length ? `<ul>${details.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>` : ""}
    <p>Your code (valid for 10 minutes):</p>
    <p style="font-size:28px;font-weight:bold;letter-spacing:6px;background:#f1f5f9;padding:12px;border-radius:8px;text-align:center">${esc(code)}</p>
    <p style="font-size:13px;color:#475569">If you did not ask for this, do not share the code and inform the COE office.</p>`
  );
  await t.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject: `Security code: ${action}`,
    html,
  });
  return true;
}

// The COE asks a setter for the scheme of valuation of his paper
export async function sendSchemeRequestEmail({ to, name, subject, paper }) {
  const t = getTransporter();
  if (!t || !to) return false;
  const link = `${process.env.FRONTEND_URL}/faculty/paper-setting/${paper._id}`;
  const html = wrap(
    "Scheme of valuation requested",
    `<p>Dear ${esc(name)},</p>
    <p>Please upload the <b>scheme of valuation</b> (Word file) for the question paper you set:</p>
    <p style="background:#f1f5f9;padding:12px;border-radius:8px"><b>${esc(subject?.code)} – ${esc(subject?.name)}</b><br/>
      ${esc(paper.examSession)} examination · Set ${esc(paper.setNo)}</p>
    <p style="margin:24px 0"><a href="${link}" style="background:#2563eb;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Sign in and upload the scheme</a></p>
    <p style="font-size:13px;color:#475569">Upload only through the website. Do not send it by email or WhatsApp.</p>`
  );
  await t.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject: `Scheme of valuation requested – ${subject?.code}`,
    html,
  });
  return true;
}
