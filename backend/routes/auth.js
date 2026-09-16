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

export async function passwordHash(password) {
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
  const { displayName, email, password, gender, age, avatarUrl, role } = req.body || {};
  const userRole = role === "Family" ? "Family" : "Kid";
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
      `INSERT INTO users (id, username, email, display_name, gender, age, avatar_url, password_hash, role, account_type)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Email') RETURNING id`,
      [
        crypto.randomUUID(),
        username,
        cleanEmail,
        cleanName,
        String(gender || ""),
        numericAge,
        String(avatarUrl || ""),
        await passwordHash(password),
        userRole,
      ],
    );
    setAuthCookie(res, result.rows[0].id);
    return res.status(201).json({ ok: true });
  } catch (error) {
    console.error("Registration failed", error);
    return res.status(500).json({ error: "Could not create your account." });
  }
});

router.post("/session", async (req, res) => {
  const { id: supaId, email, displayName, avatarUrl, username } = req.body || {};
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!cleanEmail) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    const superAdminEmails = (process.env.SUPERADMIN_EMAIL || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const shouldBeSuperAdmin = superAdminEmails.includes(cleanEmail);

    let userResult = await query(
      "SELECT id, username, email, display_name, gender, age, avatar_url, role, account_type, is_disabled, is_admin, is_super_admin, legacy_points FROM users WHERE id = $1 OR LOWER(email) = $2",
      [supaId || "", cleanEmail],
    );

    let user = userResult.rows[0];
    const isGoogle = Boolean(
      avatarUrl?.includes("googleusercontent.com") ||
      avatarUrl?.includes("lh3.google") ||
      req.body?.accountType === "Google",
    );

    if (user) {
      if (user.is_disabled) {
        return res.status(403).json({ error: "This account has been disabled. Please contact an administrator." });
      }

      if (shouldBeSuperAdmin && (!user.is_super_admin || !user.is_admin)) {
        await query(
          "UPDATE users SET is_admin = TRUE, is_super_admin = TRUE, role = 'Super Admin' WHERE id = $1",
          [user.id],
        );
        user.is_admin = true;
        user.is_super_admin = true;
        user.role = "Super Admin";
      }

      if (avatarUrl && (!user.avatar_url || isGoogle)) {
        await query(
          "UPDATE users SET avatar_url = $1, account_type = CASE WHEN $2 = 'Google' THEN 'Google' ELSE account_type END, updated_at = NOW() WHERE id = $3",
          [avatarUrl, isGoogle ? "Google" : "Email", user.id],
        );
        user.avatar_url = avatarUrl;
        if (isGoogle) user.account_type = "Google";
      }
    } else {
      const base = (
        username ||
        displayName ||
        cleanEmail.split("@")[0] ||
        "reader"
      )
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 24) || "reader";

      let cleanUser = base;
      let count = 1;
      while ((await query("SELECT id FROM users WHERE username = $1", [cleanUser])).rows[0]) {
        cleanUser = `${base}${count++}`;
      }

      const userId = supaId || crypto.randomUUID();
      const role = shouldBeSuperAdmin ? "Super Admin" : "Kid";
      const isAdmin = shouldBeSuperAdmin;
      const isSuperAdmin = shouldBeSuperAdmin;
      const accountType = isGoogle ? "Google" : "Email";

      const insertResult = await query(
        `INSERT INTO users (
          id, google_id, username, email, display_name, avatar_url, role, account_type,
          is_admin, is_super_admin, is_disabled, legacy_points, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, FALSE, 0, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          updated_at = NOW()
        RETURNING id, username, email, display_name, gender, age, avatar_url, role, account_type, is_disabled, is_admin, is_super_admin, legacy_points`,
        [
          userId,
          isGoogle ? userId : null,
          cleanUser,
          cleanEmail,
          displayName || cleanUser,
          avatarUrl || "",
          role,
          accountType,
          isAdmin,
          isSuperAdmin,
        ],
      );
      user = insertResult.rows[0];
    }

    setAuthCookie(res, user.id);
    return res.json({
      ok: true,
      user: {
        _id: user.id,
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.display_name,
        fullName: user.display_name,
        gender: user.gender || "",
        age: user.age,
        avatarUrl: user.avatar_url || "",
        legacyPoints: user.legacy_points || 0,
        role: user.role || "Kid",
        accountType: user.account_type || (isGoogle ? "Google" : "Email"),
        isAdmin: Boolean(user.is_admin),
        isSuperAdmin: Boolean(user.is_super_admin),
        isDisabled: Boolean(user.is_disabled),
      },
    });
  } catch (err) {
    console.error("Session sync failed:", err);
    return res.status(500).json({ error: "Failed to establish authenticated session." });
  }
});

router.post("/login", async (req, res) => {
  const identifier = String(req.body?.email || req.body?.username || "")
    .trim()
    .toLowerCase();
  const password = String(req.body?.password || "");
  if (!identifier || !password) {
    return res.status(400).json({ error: "Please enter your username or email, and password." });
  }
  try {
    const result = await query(
      "SELECT id, username, email, display_name, password_hash, gender, age, avatar_url, legacy_points, account_type, is_admin, is_super_admin, is_disabled, role FROM users WHERE LOWER(email) = $1 OR LOWER(username) = $1",
      [identifier],
    );
    let user = result.rows[0];
    if (!user || !(await passwordMatches(password, user.password_hash)))
      return res.status(401).json({ error: "Incorrect username/email or password." });
    if (user.is_disabled) {
      return res.status(403).json({ error: "This account has been disabled. Please contact an administrator." });
    }

    const superAdminEmails = (process.env.SUPERADMIN_EMAIL || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (superAdminEmails.includes(user.email?.toLowerCase()) && (!user.is_super_admin || !user.is_admin)) {
      await query(
        "UPDATE users SET is_admin = TRUE, is_super_admin = TRUE, role = 'Super Admin' WHERE id = $1",
        [user.id],
      );
      user.is_admin = true;
      user.is_super_admin = true;
      user.role = "Super Admin";
    }

    setAuthCookie(res, user.id);
    return res.json({
      ok: true,
      user: {
        _id: user.id,
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.display_name,
        fullName: user.display_name,
        gender: user.gender || "",
        age: user.age,
        avatarUrl: user.avatar_url || "",
        legacyPoints: user.legacy_points || 0,
        role: user.role || "Kid",
        accountType: user.account_type || "Email",
        isAdmin: Boolean(user.is_admin),
        isSuperAdmin: Boolean(user.is_super_admin),
        isDisabled: Boolean(user.is_disabled),
      },
    });
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
