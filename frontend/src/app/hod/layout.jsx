"use client";

import AppShell from "../components/shell/AppShell";
import { MENUS } from "../components/shell/menus";

export default function HODLayout({ children }) {
  return <AppShell menu={MENUS.hod}>{children}</AppShell>;
}
