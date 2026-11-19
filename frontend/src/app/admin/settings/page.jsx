"use client";

import AcademicYearSettings from "../../components/AcademicYearSettings";
import SignatureSettings from "../../components/admin/SignatureSettings";
import VerificationSettings from "../../components/admin/VerificationSettings";

export default function AdminSettingsPage() {
  return (
    <>
      <AcademicYearSettings />
      <VerificationSettings />
      <SignatureSettings />
    </>
  );
}
