// src/middleware/authMiddleware.js

import { getAuth, clerkClient } from "@clerk/express";

import { normalizeRole } from "../config/roles.js";

// The signed-in person's details are kept for a short while, so that a page
// sending many requests (e.g. the student import, step after step) does not
// ask Clerk every time – Clerk allows only a limited number of calls.
const CACHE_MS = 30 * 1000;
const cache = new Map(); // userId -> { user, at }

async function clerkUser(userId) {
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.user;
  const u = await clerkClient.users.getUser(userId);
  const user = u
    ? {
        id: u.id,
        email: u.emailAddresses[0]?.emailAddress,
        // Old "exam_officer" accounts work as "office"
        role: normalizeRole(u.publicMetadata?.role),
        department: u.publicMetadata?.department || null,
      }
    : null;
  if (user) {
    if (cache.size > 500) cache.clear();
    cache.set(userId, { user, at: Date.now() });
  }
  return user;
}

// Clerk too busy (too many requests) or not reachable – not the person's fault
export const clerkBusy = (e) => e?.status === 429 || e?.status >= 500 || ["ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN"].includes(e?.code);

export const authenticateUser = async (req, res, next) => {
  try {
    const auth = getAuth(req);

    if (!auth.isAuthenticated || !auth.userId) {
      return res.status(401).json({
        error: "Unauthorized. No authenticated Clerk user found.",
      });
    }

    const user = await clerkUser(auth.userId);

    if (!user) {
      return res.status(401).json({
        error: "Unauthorized. Clerk user not found.",
      });
    }

    req.user = { ...user };

    next();
  } catch (error) {
    console.error("Auth Middleware Error:", error);

    if (clerkBusy(error)) {
      return res.status(503).json({
        error: "The sign-in service is busy for a moment. Please wait a few seconds and try again.",
        busy: true,
      });
    }

    return res.status(401).json({
      error: "Unauthorized request",
    });
  }
};
