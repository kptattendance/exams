"use client";

import AppShell from "../components/shell/AppShell";
import { MENUS } from "../components/shell/menus";

export default function ExamOfficerLayout({ children }) {
  return <AppShell menu={MENUS.examOfficer}>{children}</AppShell>;
}
