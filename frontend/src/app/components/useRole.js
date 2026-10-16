"use client";

// Role of the signed-in user (from Clerk). Only for showing or hiding buttons:
// the server checks every action again.

import { useUser } from "@clerk/nextjs";

export function useRole() {
  const { user } = useUser();
  return String(user?.publicMetadata?.role || "");
}

// Deleting records, undoing an import and reopening entered marks are for the Admin only
export const useIsAdmin = () => useRole() === "admin";
