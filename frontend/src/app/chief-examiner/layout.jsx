"use client";

import AppShell from "../components/shell/AppShell";
import { MENUS } from "../components/shell/menus";

export default function ChiefExaminerLayout({ children }) {
  return <AppShell menu={MENUS.chiefExaminer}>{children}</AppShell>;
}
