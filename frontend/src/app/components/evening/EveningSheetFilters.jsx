"use client";

// Evening Principal – Branch and Shift on the Final IA / Final attendance pages.
//   Branch : which evening branch's sheet is loaded (the same choice as the
//            band at the top of his pages – kept in step both ways)
//   Shift  : evening shift / working professionals – only which rows are
//            SHOWN; the sheet (save, submit, Excel, signature sheet) always
//            has the whole class, so no one's marks are ever left out.

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export const EVENING_BRANCHES = [
  ["ee", "Electrical and Electronics Engineering"],
  ["me", "Mechanical Engineering"],
];
const STORE = "kpt-evening-department";
export const EVENING_BRANCH_EVENT = "kpt-evening-branch";

export const useEveningMode = () => String(usePathname() || "").startsWith("/evening");

export function getEveningBranch() {
  try {
    const d = localStorage.getItem(STORE);
    return EVENING_BRANCHES.some(([k]) => k === d) ? d : EVENING_BRANCHES[0][0];
  } catch {
    return EVENING_BRANCHES[0][0];
  }
}

export function setEveningBranch(d) {
  try {
    localStorage.setItem(STORE, d);
  } catch {
    // the requests fall back to the first branch
  }
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVENING_BRANCH_EVENT, { detail: d }));
}

// [branch, choose] – follows changes made anywhere (the band at the top or a page)
export function useEveningBranch() {
  const [branch, setBranch] = useState(() => (typeof window === "undefined" ? EVENING_BRANCHES[0][0] : getEveningBranch()));
  useEffect(() => {
    const on = (e) => setBranch(e.detail || getEveningBranch());
    window.addEventListener(EVENING_BRANCH_EVENT, on);
    return () => window.removeEventListener(EVENING_BRANCH_EVENT, on);
  }, []);
  return [branch, setEveningBranch];
}

const box = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500";

export function BranchShiftFields({ branch, onBranch, shift, onShift }) {
  return (
    <>
      <div>
        <label className="mb-1 block text-xs font-semibold text-gray-600">Branch</label>
        <select value={branch} onChange={(e) => onBranch(e.target.value)} className={box}>
          {EVENING_BRANCHES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-gray-600">Shift (rows shown)</label>
        <select value={shift} onChange={(e) => onShift(e.target.value)} className={box}>
          <option value="">Evening shift + Working professionals</option>
          <option value="EVENING">Evening shift (second shift)</option>
          <option value="WORKING">Working professionals</option>
        </select>
      </div>
    </>
  );
}
