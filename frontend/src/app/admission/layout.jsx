"use client";

import AppShell from "../components/shell/AppShell";
import { MENUS } from "../components/shell/menus";

// Office – admission section: students and faculty details
export default function AdmissionLayout({ children }) {
  return <AppShell menu={MENUS.admission}>{children}</AppShell>;
}
