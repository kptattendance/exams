"use client";

import AppShell from "../components/shell/AppShell";
import { MENUS } from "../components/shell/menus";

export default function OfficeLayout({ children }) {
  return <AppShell menu={MENUS.office}>{children}</AppShell>;
}
