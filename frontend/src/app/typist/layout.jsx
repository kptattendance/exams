"use client";

import AppShell from "../components/shell/AppShell";
import { MENUS } from "../components/shell/menus";

// Office typist: prints the practical examiners' certificates
export default function TypistLayout({ children }) {
  return <AppShell menu={MENUS.typist}>{children}</AppShell>;
}
