"use client";

import AppShell from "../components/shell/AppShell";
import { MENUS } from "../components/shell/menus";

export default function COELayout({ children }) {
  return <AppShell menu={MENUS.coe}>{children}</AppShell>;
}
