// src/middlewares/rateLimits.js
//
// Stops anybody from hammering the server with requests. Limits are counted
// per signed-in person (the whole college shares one internet address, so an
// address-based limit would block everybody together); requests without a
// login are counted per address. The limits are far above normal use – a
// busy page or an import makes a few requests a second at most.

import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { getAuth } from "@clerk/express";

const personOrAddress = (req) => {
  let userId = null;
  try {
    userId = getAuth(req)?.userId || null;
  } catch {
    userId = null;
  }
  return userId ? `u:${userId}` : `ip:${ipKeyGenerator(req.ip || "")}`;
};

const common = {
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: personOrAddress,
  skip: (req) => req.method === "OPTIONS",
};

// every API request: 600 a minute per person (10 a second)
export const apiLimiter = rateLimit({
  ...common,
  windowMs: 60 * 1000,
  limit: (req) => (personOrAddress(req).startsWith("u:") ? 600 : 120),
  message: { error: "Too many requests in a short time. Please wait a minute and try again." },
});

// verification codes (email / SMS – each costs): 10 in 10 minutes per person
export const otpLimiter = rateLimit({
  ...common,
  windowMs: 10 * 60 * 1000,
  limit: 10,
  message: { error: "Too many verification codes asked for. Please wait 10 minutes and try again." },
});
