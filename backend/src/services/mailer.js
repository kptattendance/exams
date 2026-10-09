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
