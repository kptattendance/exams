"use client";

import { useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import axios from "axios";

const BASE = `${process.env.NEXT_PUBLIC_API_URL}/api`;

// api("get", "/exams", undefined, { params: {...} })
export function useApi() {
  const { getToken } = useAuth();
  return useCallback(
    async (method, path, data, extra = {}) => {
      const token = await getToken();
      return axios({ method, url: `${BASE}${path}`, data, headers: { Authorization: `Bearer ${token}` }, ...extra });
    },
    [getToken]
  );
}

export const errMsg = (e, fallback = "Something went wrong. Please try again.") =>
  e?.response?.data?.error || e?.response?.data?.message || fallback;

export const DEPARTMENTS = [
  { value: "at", label: "Automobile" },
  { value: "ch", label: "Chemical" },
  { value: "ce", label: "Civil" },
  { value: "cs", label: "Computer Science" },
  { value: "ec", label: "Electronics & Comm." },
  { value: "ee", label: "Electrical & Electronics" },
  { value: "me", label: "Mechanical" },
  { value: "ps", label: "Polymer" },
];
export const deptLabel = (d) => DEPARTMENTS.find((x) => x.value === String(d).toLowerCase())?.label || String(d).toUpperCase();

export const ADMISSION_SHORT = {
  regular: "Regular",
  "lateral-puc": "Lateral PUC",
  "lateral-iti": "Lateral ITI",
  "lateral-iti-cross": "Lateral ITI cross",
};

// Per-subject decision
export const DECISION = {
  ELIGIBLE: { label: "Eligible", short: "OK", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  ANS: { label: "Attendance shortage", short: "ANS", chip: "bg-red-50 text-red-700 ring-red-200" },
  NE: { label: "IA below minimum", short: "NE", chip: "bg-orange-50 text-orange-700 ring-orange-200" },
  PENDING: { label: "Waiting", short: "Waiting", chip: "bg-slate-100 text-slate-600 ring-slate-200" },
};

// Whole student
export const OVERALL = {
  ALL_CLEAR: { label: "All subjects allowed", short: "All clear", dot: "bg-emerald-500", text: "text-emerald-700" },
  PARTIAL: { label: "Some subjects not permitted", short: "Partly blocked", dot: "bg-orange-500", text: "text-orange-700" },
  BLOCKED: { label: "No subject permitted", short: "Blocked", dot: "bg-red-500", text: "text-red-700" },
  PENDING: { label: "Waiting for IA / attendance / elective", short: "Waiting", dot: "bg-slate-400", text: "text-slate-600" },
};

export const KIND = {
  REGULAR: "",
  ELECTIVE: "Elective",
  BRIDGE: "Bridge",
  BACKLOG: "Back paper",
};

export const SHEET = {
  confirmed: { label: "Frozen", chip: "bg-emerald-50 text-emerald-700" },
  submitted: { label: "With Exam Officer", chip: "bg-blue-50 text-blue-700" },
  draft: { label: "Draft", chip: "bg-orange-50 text-orange-700" },
  missing: { label: "Not started", chip: "bg-slate-100 text-slate-500" },
};

export const ACADEMIC_YEARS = ["2025-26", "2026-27", "2027-28"];

export async function downloadBlob(api, path, params, fallbackName) {
  const r = await api("get", path, undefined, { params, responseType: "blob" });
  const cd = r.headers?.["content-disposition"] || "";
  const name = /filename="([^"]+)"/.exec(cd)?.[1] || fallbackName;
  const url = URL.createObjectURL(r.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
