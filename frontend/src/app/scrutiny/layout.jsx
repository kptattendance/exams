"use client";

import AppShell from "../components/shell/AppShell";
import { MENUS } from "../components/shell/menus";

export default function ScrutinyLayout({ children }) {
  return <AppShell menu={MENUS.scrutiny}>{children}</AppShell>;
}
