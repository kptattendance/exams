"use client";

import AppShell from "../components/shell/AppShell";
import { MENUS } from "../components/shell/menus";

export default function ClerkLayout({ children }) {
  return <AppShell menu={MENUS.clerk}>{children}</AppShell>;
}
