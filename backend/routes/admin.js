import { Router } from "express";
import multer from "multer";
import path from "node:path";
import crypto from "node:crypto";
import fs from "node:fs";
import { Magazine, Feedback, Banner } from "../models/Content.js";
import { query } from "../lib/postgres.js";
import { requireAdmin, requireSuperAdmin } from "../middleware/auth.js";
import { logActivity, getActivityLogs } from "../lib/activity.js";
import { syncGoogleUsersFromSupabase } from "../lib/supabaseSync.js";
import { passwordHash } from "./auth.js";

const router = Router();
const uploadsDir = path.resolve("public/uploads");

function removeUploadedFile(url) {
  if (!url || !url.startsWith("/uploads/")) return;
  const filePath = path.resolve(uploadsDir, path.basename(url));
  if (filePath.startsWith(`${uploadsDir}${path.sep}`)) fs.rmSync(filePath, { force: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) =>
      cb(
        null,
        `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${path.extname(file.originalname).toLowerCase()}`,
      ),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith("image/")),
});

// ─── Super Admin Endpoints (requireSuperAdmin) ─────────────────────────────

router.get("/superadmin/dashboard", requireSuperAdmin, async (_req, res) => {
  try {
    const result = await query(`
      SELECT
        (SELECT COUNT(*)::int FROM users) AS users,
        (SELECT COUNT(*)::int FROM users WHERE is_admin = TRUE) AS admins,
        (SELECT COUNT(*)::int FROM magazines WHERE active = TRUE) AS active_magazines,
        (SELECT COUNT(*)::int FROM magazine_sales) AS magazines_sold,
        (SELECT COALESCE(SUM(amount_cents), 0)::int FROM magazine_sales) AS sales_cents
    `);
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: "Could not load dashboard data" });
  }
});

router.get("/superadmin/users", requireSuperAdmin, async (_req, res) => {
  try {
    // Sync Google users from Supabase so all registered users are up to date
    await syncGoogleUsersFromSupabase();

    const result = await query(`
      SELECT id, display_name, username, email, gender, age, avatar_url, role, account_type, is_disabled, is_admin, is_super_admin, created_at
      FROM users ORDER BY created_at DESC
    `);
    res.json(result.rows.map((row) => ({
      _id: row.id,
      displayName: row.display_name,
      username: row.username,
      email: row.email,
      gender: row.gender,
      age: row.age,
      avatarUrl: row.avatar_url,
      role: row.role || "Kid",
      accountType: row.account_type || (row.avatar_url?.includes("googleusercontent") ? "Google" : "Email"),
      isDisabled: Boolean(row.is_disabled),
      isAdmin: Boolean(row.is_admin),
      isSuperAdmin: Boolean(row.is_super_admin),
      createdAt: row.created_at,
    })));
  } catch (err) {
    console.error("Failed to load users:", err);
    res.status(500).json({ error: "Could not load users" });
  }
});

router.patch("/superadmin/users/:id/admin", requireSuperAdmin, async (req, res) => {
  const isAdmin = req.body?.isAdmin === true;
  try {
    const target = await query(
      "SELECT id, username, is_super_admin FROM users WHERE id = $1",
      [req.params.id],
    );
    if (!target.rows[0]) return res.status(404).json({ error: "User not found" });
    if (target.rows[0].is_super_admin && !isAdmin)
      return res.status(400).json({ error: "A super administrator cannot be removed here" });
    const updated = await query(
      "UPDATE users SET is_admin = $1, updated_at = NOW() WHERE id = $2 RETURNING id, is_admin",
      [isAdmin, req.params.id],
    );

    await logActivity({
      userId: req.userId,
      action: "Updated users",
      details: `${isAdmin ? "Promoted" : "Demoted"} @${target.rows[0].username || req.params.id} ${isAdmin ? "to admin" : "from admin"}`,
      targetType: "user",
      targetId: req.params.id,
    });

    return res.json({ _id: updated.rows[0].id, isAdmin: updated.rows[0].is_admin });
  } catch {
    return res.status(500).json({ error: "Could not update administrator access" });
  }
});

// Create normal admin account with username and password
router.post("/superadmin/admins", requireSuperAdmin, async (req, res) => {
  const { username, password, displayName, email, role } = req.body || {};
  const cleanUsername = String(username || "").trim().toLowerCase().replace(/[^a-z0-9_.]/g, "");
  const rawPassword = String(password || "");

  if (!cleanUsername) {
    return res.status(400).json({ error: "Username is required." });
  }
  if (rawPassword.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }

  const cleanEmail = email
    ? String(email).trim().toLowerCase()
    : `${cleanUsername}@selamkids.admin`;
  const cleanName = String(displayName || cleanUsername).trim();
  const adminRole = role === "Family" ? "Family" : role === "Kid" ? "Kid" : "Admin";

  try {
    const existingUser = await query(
      "SELECT id FROM users WHERE LOWER(username) = $1",
      [cleanUsername],
    );
    if (existingUser.rows[0]) {
      return res.status(409).json({ error: "Username already taken." });
    }

    const existingEmail = await query(
      "SELECT id FROM users WHERE LOWER(email) = $1",
      [cleanEmail],
    );
    if (existingEmail.rows[0]) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    const hash = await passwordHash(rawPassword);
    const newId = crypto.randomUUID();
    const result = await query(
      `INSERT INTO users (
        id, username, email, display_name, password_hash, is_admin, is_super_admin, role, account_type, is_disabled, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,TRUE,FALSE,$6,'Admin',FALSE,NOW(),NOW())
      RETURNING id, display_name, username, email, role, account_type, is_disabled, is_admin, is_super_admin, created_at`,
      [newId, cleanUsername, cleanEmail, cleanName, hash, adminRole],
    );

    await logActivity({
      userId: req.userId,
      action: "Created admin",
      details: `Created admin account @${cleanUsername}`,
      targetType: "admin",
      targetId: newId,
    });

    const row = result.rows[0];
    return res.status(201).json({
      _id: row.id,
      displayName: row.display_name,
      username: row.username,
      email: row.email,
      role: row.role,
      accountType: row.account_type,
      isDisabled: row.is_disabled,
      isAdmin: row.is_admin,
      isSuperAdmin: row.is_super_admin,
      createdAt: row.created_at,
    });
  } catch (err) {
    console.error("Failed to create admin:", err);
    return res.status(500).json({ error: "Could not create administrator account." });
  }
});

// Edit admin account
router.patch("/superadmin/admins/:id", requireSuperAdmin, async (req, res) => {
  const { username, displayName, email, password, role } = req.body || {};
  try {
    const target = await query(
      "SELECT id, username, email, is_super_admin FROM users WHERE id = $1",
      [req.params.id],
    );
    if (!target.rows[0]) return res.status(404).json({ error: "Admin not found." });
    const existing = target.rows[0];

    // Protect other super admins from unauthorized modification
    if (existing.is_super_admin && existing.id !== req.userId) {
      return res.status(403).json({ error: "Cannot edit another super administrator." });
    }

    const updates = [];
    const values = [];

    if (username !== undefined) {
      const cleanUsername = String(username).trim().toLowerCase().replace(/[^a-z0-9_.]/g, "");
      if (!cleanUsername) return res.status(400).json({ error: "Username cannot be empty." });
      const dup = await query(
        "SELECT id FROM users WHERE LOWER(username) = $1 AND id != $2",
        [cleanUsername, req.params.id],
      );
      if (dup.rows[0]) return res.status(409).json({ error: "Username already taken." });
      values.push(cleanUsername);
      updates.push(`username = $${values.length}`);
    }

    if (email !== undefined) {
      const cleanEmail = String(email).trim().toLowerCase();
      if (!cleanEmail) return res.status(400).json({ error: "Email cannot be empty." });
      const dup = await query(
        "SELECT id FROM users WHERE LOWER(email) = $1 AND id != $2",
        [cleanEmail, req.params.id],
      );
      if (dup.rows[0]) return res.status(409).json({ error: "Email already in use." });
      values.push(cleanEmail);
      updates.push(`email = $${values.length}`);
    }

    if (displayName !== undefined) {
      values.push(String(displayName).trim());
      updates.push(`display_name = $${values.length}`);
    }

    if (role !== undefined) {
      values.push(String(role).trim());
      updates.push(`role = $${values.length}`);
    }

    if (password) {
      const rawPassword = String(password);
      if (rawPassword.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters." });
      }
      values.push(await passwordHash(rawPassword));
      updates.push(`password_hash = $${values.length}`);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update." });
    }

    values.push(req.params.id);
    const result = await query(
      `UPDATE users SET ${updates.join(", ")}, updated_at = NOW() WHERE id = $${values.length}
       RETURNING id, display_name, username, email, role, account_type, is_disabled, is_admin, is_super_admin, created_at`,
      values,
    );

    await logActivity({
      userId: req.userId,
      action: "Edited admin",
      details: `Updated admin @${result.rows[0].username}`,
      targetType: "admin",
      targetId: req.params.id,
    });

    const row = result.rows[0];
    return res.json({
      _id: row.id,
      displayName: row.display_name,
      username: row.username,
      email: row.email,
      role: row.role,
      accountType: row.account_type,
      isDisabled: row.is_disabled,
      isAdmin: row.is_admin,
      isSuperAdmin: row.is_super_admin,
      createdAt: row.created_at,
    });
  } catch (err) {
    console.error("Failed to edit admin:", err);
    return res.status(500).json({ error: "Could not update admin account." });
  }
});

// Disable/enable admin account
router.patch("/superadmin/admins/:id/status", requireSuperAdmin, async (req, res) => {
  const isDisabled = req.body?.isDisabled === true;
  try {
    const target = await query(
      "SELECT id, username, is_super_admin FROM users WHERE id = $1",
      [req.params.id],
    );
    if (!target.rows[0]) return res.status(404).json({ error: "Admin not found." });
    if (target.rows[0].is_super_admin) {
      return res.status(400).json({ error: "Super administrator cannot be disabled." });
    }

    const updated = await query(
      "UPDATE users SET is_disabled = $1, updated_at = NOW() WHERE id = $2 RETURNING id, username, is_disabled",
      [isDisabled, req.params.id],
    );

    await logActivity({
      userId: req.userId,
      action: isDisabled ? "Disabled admin" : "Enabled admin",
      details: `${isDisabled ? "Disabled" : "Enabled"} admin @${target.rows[0].username}`,
      targetType: "admin",
      targetId: req.params.id,
    });

    return res.json({ _id: updated.rows[0].id, isDisabled: updated.rows[0].is_disabled });
  } catch {
    return res.status(500).json({ error: "Could not update admin status." });
  }
});

// Delete admin account
router.delete("/superadmin/admins/:id", requireSuperAdmin, async (req, res) => {
  try {
    const target = await query(
      "SELECT id, username, is_super_admin FROM users WHERE id = $1",
      [req.params.id],
    );
    if (!target.rows[0]) return res.status(404).json({ error: "Admin not found." });
    if (target.rows[0].is_super_admin) {
      return res.status(400).json({ error: "Super administrator cannot be deleted." });
    }

    await query("DELETE FROM users WHERE id = $1", [req.params.id]);

    await logActivity({
      userId: req.userId,
      action: "Deleted admin",
      details: `Deleted admin account @${target.rows[0].username}`,
      targetType: "admin",
      targetId: req.params.id,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("Failed to delete admin:", err);
    return res.status(500).json({ error: "Could not delete admin." });
  }
});

// Super Admin Recent Activity Log
router.get("/superadmin/activity", requireSuperAdmin, async (_req, res) => {
  try {
    const logs = await getActivityLogs(50);
    res.json(logs);
  } catch {
    res.status(500).json({ error: "Could not load activity logs" });
  }
});

// ─── Normal Admin Endpoints (requireAdmin) ──────────────────────────────────

router.post("/upload", requireAdmin, upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file provided or invalid type" });
  res.json({ url: `/uploads/${req.file.filename}` });
});

router.get("/magazines", requireAdmin, async (_req, res) => {
  try {
    res.json(await Magazine.find().sort({ createdAt: -1 }));
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/magazines", requireAdmin, async (req, res) => {
  try {
    const magazine = await Magazine.create({ ...req.body, active: true });
    await logActivity({
      userId: req.userId,
      action: "Added magazine",
      details: `Created magazine "${magazine.title}"`,
      targetType: "magazine",
      targetId: magazine._id,
    });
    res.status(201).json(magazine);
  } catch {
    res.status(400).json({ error: "Failed to create magazine" });
  }
});

router.get("/magazines/:id", requireAdmin, async (req, res) => {
  try {
    const magazine = await Magazine.findById(req.params.id);
    return magazine ? res.json(magazine) : res.status(404).json({ error: "Magazine not found" });
  } catch {
    return res.status(404).json({ error: "Magazine not found" });
  }
});

router.delete("/magazines/:id", requireAdmin, async (req, res) => {
  try {
    const magazine = await Magazine.findByIdAndDelete(req.params.id);
    if (magazine) {
      removeUploadedFile(magazine.coverUrl);
      await logActivity({
        userId: req.userId,
        action: "Deleted magazine",
        details: `Deleted magazine "${magazine.title}"`,
        targetType: "magazine",
        targetId: req.params.id,
      });
    }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/magazines/:id", requireAdmin, async (req, res) => {
  try {
    const existing = await Magazine.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Magazine not found" });
    const updated = await Magazine.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (req.body.coverUrl && existing.coverUrl !== req.body.coverUrl)
      removeUploadedFile(existing.coverUrl);

    await logActivity({
      userId: req.userId,
      action: "Edited magazine",
      details: `Updated magazine "${updated.title}"`,
      targetType: "magazine",
      targetId: req.params.id,
    });

    return res.json(updated);
  } catch (error) {
    return res.status(400).json({ error: error.message || "Failed to update magazine" });
  }
});

router.get("/banners", requireAdmin, async (_req, res) => {
  try {
    res.json(await Banner.find().sort({ order: 1 }));
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/banners", requireAdmin, async (req, res) => {
  try {
    const banner = await Banner.create({ ...req.body, active: true });
    await logActivity({
      userId: req.userId,
      action: "Added banner",
      details: `Created banner "${banner.title}"`,
      targetType: "banner",
      targetId: banner._id,
    });
    res.status(201).json(banner);
  } catch {
    res.status(400).json({ error: "Failed to create banner" });
  }
});

router.delete("/banners/:id", requireAdmin, async (req, res) => {
  try {
    const banner = await Banner.findByIdAndDelete(req.params.id);
    if (banner) {
      removeUploadedFile(banner.imageUrl);
      await logActivity({
        userId: req.userId,
        action: "Deleted banner",
        details: `Deleted banner "${banner.title}"`,
        targetType: "banner",
        targetId: req.params.id,
      });
    }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/banners/:id", requireAdmin, async (req, res) => {
  try {
    const existing = await Banner.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Banner not found" });
    const updated = await Banner.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (req.body.imageUrl && existing.imageUrl !== req.body.imageUrl)
      removeUploadedFile(existing.imageUrl);

    await logActivity({
      userId: req.userId,
      action: "Edited banner",
      details: `Updated banner "${updated.title}"`,
      targetType: "banner",
      targetId: req.params.id,
    });

    return res.json(updated);
  } catch (error) {
    return res.status(400).json({ error: error.message || "Failed to update banner" });
  }
});

router.get("/feedback", requireAdmin, async (_req, res) => {
  try {
    res.json(
      await Feedback.find()
        .sort({ createdAt: -1 })
        .populate("userId", "displayName email username role"),
    );
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/feedback/:id", requireAdmin, async (req, res) => {
  try {
    await Feedback.findByIdAndDelete(req.params.id);
    await logActivity({
      userId: req.userId,
      action: "Deleted feedback",
      details: `Deleted user feedback item`,
      targetType: "feedback",
      targetId: req.params.id,
    });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
