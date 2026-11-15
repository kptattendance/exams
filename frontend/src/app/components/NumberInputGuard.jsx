"use client";

// Number boxes on every page: marks, fees, attendance… are only ever TYPED.
//   - the mouse wheel over a focused number box would change its value: the
//     box loses focus instead, so the page just scrolls;
//   - the ↑ / ↓ keys would add or take away 1: they do nothing in a number box.
// (The up / down arrows themselves are hidden in globals.css.)

import { useEffect } from "react";

const isNumberBox = (el) => el instanceof HTMLInputElement && el.type === "number";

export default function NumberInputGuard() {
  useEffect(() => {
    const onWheel = (e) => {
      const el = document.activeElement;
      if (isNumberBox(el) && (e.target === el || el.contains(e.target))) el.blur();
    };
    const onKey = (e) => {
      if ((e.key === "ArrowUp" || e.key === "ArrowDown") && isNumberBox(e.target)) e.preventDefault();
    };
    document.addEventListener("wheel", onWheel, { passive: true });
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("wheel", onWheel);
      document.removeEventListener("keydown", onKey);
    };
  }, []);
  return null;
}
