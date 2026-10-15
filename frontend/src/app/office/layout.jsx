"use client";

import AppShell from "../components/shell/AppShell";
import { MENUS } from "../components/shell/menus";

// Exam section (office): fees, IA / attendance freezing, hall tickets, absentees, paper-setter orders
export default function OfficeLayout({ children }) {
  return <AppShell menu={MENUS.office}>{children}</AppShell>;
}
