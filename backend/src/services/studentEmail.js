// src/services/studentEmail.js
//
// Admin: change a student's email (e.g. typed wrongly in the Excel:
// "@gamil.com"). The SAME Clerk login account is kept – its user ID stays, so
// the student record stays linked – only its email address is replaced:
//   1. the new address is added to that Clerk user, verified and primary
//   2. every other (old) address of that user is deleted from Clerk
//   3. the student record gets the new email
// Nothing else changes (photo, registrations, fees, results).

import { clerkClient } from "@clerk/express";

import Student from "../models/Student.js";

export const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export class EmailChangeError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// studentId, newEmail -> { student, oldEmail, newEmail, removed: [addresses] }
export async function changeStudentEmail(studentId, newEmailRaw) {
  const newEmail = String(newEmailRaw || "").replace(/\s+/g, "").toLowerCase();
  if (!EMAIL_RX.test(newEmail)) throw new EmailChangeError(400, "Type a valid email address.");

  const student = await Student.findById(studentId).select("name registerNumber email clerkId");
  if (!student) throw new EmailChangeError(404, "Student not found.");
  const oldEmail = String(student.email || "").toLowerCase();
  if (newEmail === oldEmail) throw new EmailChangeError(409, "This is already the student's email.");
  if (!student.clerkId) throw new EmailChangeError(409, "This student has no login account.");

  // the new address must not belong to anybody else
  const other = await Student.findOne({ email: newEmail, _id: { $ne: student._id } }).select("registerNumber name").lean();
  if (other) throw new EmailChangeError(409, `${newEmail} is already the email of ${other.registerNumber} ${other.name}.`);
  const clerkOthers = await clerkClient.users.getUserList({ emailAddress: [newEmail] });
  const taken = (clerkOthers.data || []).find((u) => u.id !== student.clerkId);
  if (taken) throw new EmailChangeError(409, `${newEmail} is already used by another login account.`);

  const user = await clerkClient.users.getUser(student.clerkId); // also checks the account still exists
  let added = user.emailAddresses.find((e) => String(e.emailAddress).toLowerCase() === newEmail);
  if (!added) {
    added = await clerkClient.emailAddresses.createEmailAddress({ userId: user.id, emailAddress: newEmail, verified: true, primary: true });
  } else if (user.primaryEmailAddressId !== added.id) {
    await clerkClient.emailAddresses.updateEmailAddress(added.id, { verified: true, primary: true });
  }

  // the old address(es) are removed from the login account
  const removed = [];
  for (const e of user.emailAddresses) {
    if (e.id === added.id) continue;
    await clerkClient.emailAddresses.deleteEmailAddress(e.id);
    removed.push(e.emailAddress);
  }

  student.email = newEmail;
  await student.save();
  return { student, oldEmail, newEmail, removed };
}
