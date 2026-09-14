import { Router } from "express";
import passport from "../auth/google.js";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { promisify } from "node:util";
import { query } from "../lib/postgres.js";

const router = Router();
const scrypt = promisify(crypto.scrypt);

const frontendUrl = () => (process.env.FRONTEND_URL || "http://localhost:8080").replace(/\/$/, "");
const loginUrl = (error) =>
  `${frontendUrl()}/auth${error ? `?error=${encodeURIComponent(error)}` : ""}`;

function hasGoogleConfiguration() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function setAuthCookie(res, userId) {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "30d" });
  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

async function passwordHash(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64);
  return `${salt}:${Buffer.from(key).toString("hex")}`;
}

async function passwordMatches(password, stored) {
  const [salt, savedKey] = String(stored || "").split(":");
  if (!salt || !savedKey) return false;
  const key = Buffer.from(await scrypt(password, salt, 64));
  const saved = Buffer.from(savedKey, "hex");
  return saved.length === key.length && crypto.timingSafeEqual(saved, key);
}

router.post("/register", async (req, res) => {
  const { displayName, email, password, gender, age, avatarUrl } = req.body || {};
  const cleanEmail = String(email || "")
    .trim()
    .toLowerCase();
  const cleanName = String(displayName || "").trim();
  if (!cleanName || !/^\S+@\S+\.\S+$/.test(cleanEmail))
    return res.status(400).json({ error: "Enter your name and a valid email." });
  if (String(password || "").length < 8)
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  const numericAge = Number(age);
  if (!Number.isInteger(numericAge) || numericAge < 1 || numericAge > 120)
    return res.status(400).json({ error: "Enter a valid age." });
  if (String(avatarUrl || "").length > 3 * 1024 * 1024)
    return res.status(400).json({ error: "Profile picture is too large." });
  try {
    const existing = await query("SELECT id FROM users WHERE LOWER(email) = $1", [cleanEmail]);
    if (existing.rows[0])
      return res
        .status(409)
        .json({ error: "An account with this email already exists. Please log in." });
    const base = (cleanName.toLowerCase().replace(/[^a-z0-9]/g, "") || "reader").slice(0, 24);
    let username = base;
    let suffix = 1;
    while ((await query("SELECT id FROM users WHERE username = $1", [username])).rows[0])
      username = `${base}${suffix++}`;
    const result = await query(
      `INSERT INTO users (id, username, email, display_name, gender, age, avatar_url, password_hash)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [
        crypto.randomUUID(),
        username,
        cleanEmail,
        cleanName,
        String(gender || ""),
        numericAge,
        String(avatarUrl || ""),
        await passwordHash(password),
      ],
    );
    setAuthCookie(res, result.rows[0].id);
    return res.status(201).json({ ok: true });
  } catch (error) {
    console.error("Registration failed", error);
    return res.status(500).json({ error: "Could not create your account." });
  }
});

router.post("/login", async (req, res) => {
  const email = String(req.body?.email || "")
    .trim()
    .toLowerCase();
  const password = String(req.body?.password || "");
  try {
    const result = await query("SELECT id, password_hash FROM users WHERE LOWER(email) = $1", [
      email,
    ]);
    const user = result.rows[0];
    if (!user || !(await passwordMatches(password, user.password_hash)))
      return res.status(401).json({ error: "Incorrect email or password." });
    setAuthCookie(res, user.id);
    return res.json({ ok: true });
  } catch (error) {
    console.error("Login failed", error);
    return res.status(500).json({ error: "Could not log you in." });
  }
});

// Start Google OAuth flow
router.get(
  "/google",
  (_req, res, next) => {
    if (!hasGoogleConfiguration()) {
      return res.redirect(loginUrl("Google sign-in is not configured yet."));
    }
    next();
  },
  passport.authenticate("google", { scope: ["profile", "email"], session: false }),
);

// Google OAuth callback
router.get(
  "/google/callback",
  (req, res, next) => {
    if (req.query.error) return res.redirect(loginUrl("Google sign-in was cancelled or denied."));
    if (!hasGoogleConfiguration())
      return res.redirect(loginUrl("Google sign-in is not configured yet."));
    next();
  },
  passport.authenticate("google", {
    failureRedirect: loginUrl("Google sign-in failed."),
    session: false,
  }),
  (req, res) => {
    const user = req.user;
    setAuthCookie(res, user._id.toString());

    res.redirect(`${frontendUrl()}/home`);
  },
);

// Logout
router.post("/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ ok: true });
});

export default router;
