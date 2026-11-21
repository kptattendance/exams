"use client";

// The browser names a "Save as PDF" file after the page title. Each print page
// sets a title that says what it is, e.g. "EC Sem 1 IA 2026-27" (instead of the
// website's name). usePrintTitle("EC", "Sem 1", "IA") – empty parts are left out.

import { useEffect } from "react";

const clean = (t) =>
  String(t || "")
    .replace(/[\\/:*?"<>|]+/g, "-") // characters a file name cannot have
    .replace(/\s+/g, " ")
    .trim();

export const dmyOf = (iso) => (iso ? String(iso).split("-").reverse().join("-") : "");
export const deptCode = (d) => String(d || "").toUpperCase();

export default function usePrintTitle(...parts) {
  const title = clean(parts.filter((x) => x !== undefined && x !== null && x !== "").join(" "));
  useEffect(() => {
    if (!title) return;
    const before = document.title;
    document.title = title;
    return () => {
      document.title = before;
    };
  }, [title]);
}
