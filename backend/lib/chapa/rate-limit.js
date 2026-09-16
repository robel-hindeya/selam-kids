import crypto from "node:crypto";

// Lightweight in-memory sliding-window rate limiter. Suitable for a single
// serverless instance per request (Vercel functions) and for self-hosted use.
// It is intentionally dependency-free and safe on Node >= 18.
function defaultKey(req) {
  return req?.ip || req?.socket?.remoteAddress || "unknown";
}

export function createRateLimiter({ windowMs = 60_000, max = 30, keyGenerator = defaultKey } = {}) {
  const hits = new Map();

  return function rateLimit(req, res, next) {
    const key = String(keyGenerator(req) || "unknown");
    const now = Date.now();
    const window = hits.get(key) || [];
    const fresh = window.filter((t) => now - t < windowMs);

    if (fresh.length >= max) {
      res.setHeader("Retry-After", String(Math.ceil(windowMs / 1000)));
      return res.status(429).json({ error: "Too many requests. Please try again later." });
    }

    fresh.push(now);
    hits.set(key, fresh);

    // Opportunistically release memory for idle keys (single process only).
    if (hits.size > 10_000) {
      for (const [k, times] of hits) {
        if (!times.some((t) => now - t < windowMs)) hits.delete(k);
      }
    }
    return next();
  };
}

export function randomId() {
  return crypto.randomUUID();
}