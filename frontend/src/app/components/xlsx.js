"use client";

// The Excel library (SheetJS, ~420 KB) is NOT part of any page's own code any
// more: pages open without it, and AppShell loads it in the background just
// after the page appears (preloadXlsx). Pages use XLSX exactly as before –
//   import { XLSX } from "…/components/xlsx";   XLSX.utils.json_to_sheet(…)
// If an Excel button is clicked before it has arrived (the first second), a
// popup asks to try again instead of failing silently.

let lib = null;
let loading = null;

export function preloadXlsx() {
  if (lib) return Promise.resolve(lib);
  if (!loading)
    loading = import("xlsx")
      .then((m) => (lib = m))
      .catch((e) => {
        loading = null; // try again on the next call
        throw e;
      });
  return loading;
}

export const XLSX = new Proxy(
  {},
  {
    get(_, key) {
      if (lib) return lib[key];
      preloadXlsx().catch(() => {});
      if (typeof window !== "undefined") window.alert("Excel is still loading – please try again in a moment.");
      throw new Error("Excel is still loading.");
    },
  }
);
