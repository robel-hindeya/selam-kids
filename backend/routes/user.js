/**
 * # NOTE: user.js
 * Role: User Profile Controller
 * Layer: Presentation / REST API
 * Description: Handles user profile retrieval and personal detail updates.
 */

import { Router } from "express";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";
import { query } from "../lib/postgres.js";

const router = Router();

// ─── Multer config ────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, path.resolve("public/uploads"));
    },
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
        cb(null, name);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (_req, file, cb) => {
        const allowed = /image\/(jpeg|jpg|png|gif|webp)/;
        cb(null, allowed.test(file.mimetype));
    },
});

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/me — return current user
router.get("/me", requireAuth, async (req, res) => {
    try {
        const user = await Promise.race([
            User.findById(req.userId).lean(),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 12000)),
        ]);
        if (!user) return res.status(404).json({ error: "User not found" });
        res.json(user);
    } catch {
        res.status(500).json({ error: "Server error" });
    }
});

// PATCH /api/me — update profile fields
router.patch("/me", requireAuth, async (req, res) => {
    try {
        const { displayName, username, gender, age, avatarUrl, role } = req.body;
        const updates = {};

        if (displayName !== undefined) updates.displayName = String(displayName).trim();
        if (username !== undefined) {
            const clean = String(username).trim().toLowerCase().replace(/[^a-z0-9_.]/g, "");
            // Check uniqueness
            const existing = await User.findOne({ username: clean });
            if (existing && existing._id.toString() !== req.userId) {
                return res.status(409).json({ error: "Username already taken" });
            }
            updates.username = clean;
        }
        if (gender !== undefined) updates.gender = gender;
        if (age !== undefined) updates.age = Number(age);
        if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
        if (role !== undefined) updates.role = role === "Family" ? "Family" : "Kid";

        const user = await User.findByIdAndUpdate(req.userId, updates, { new: true }).lean();
        res.json(user);
    } catch {
        res.status(500).json({ error: "Server error" });
    }
});

// POST /api/upload — upload a single image file
router.post("/upload", requireAuth, upload.single("file"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file provided or invalid type" });

    // Build the public URL (accessible from frontend)
    const url = `/uploads/${req.file.filename}`;
    res.json({ url });
});

// GET /api/library — return only books/magazines paid for by the current authenticated user
async function handleUserLibrary(req, res) {
    try {
        let userId = null;
        if (req.cookies?.token) {
            try {
                const payload = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
                userId = payload.userId;
            } catch {}
        }
        if (!userId && req.headers.authorization?.startsWith("Bearer ")) {
            try {
                const payload = jwt.verify(req.headers.authorization.slice(7), process.env.JWT_SECRET);
                userId = payload.userId;
            } catch {}
        }

        if (!userId) {
            return res.json([]);
        }

        const libraryQuery = query(
            `SELECT DISTINCT m.id, m.title, m.description, m.cover_url, m.minutes, m.likes, m.edition, m.category, m.date, m.paragraphs, m.fun_fact, m.target_url, m.story_images, m.price_cents, m.active, m.created_at, m.updated_at
             FROM magazines m
             WHERE m.id IN (
                 SELECT magazine_id FROM magazine_sales WHERE user_id = $1
                 UNION
                 SELECT product_id FROM orders WHERE user_id = $1 AND status = 'PAID'
                 UNION
                 SELECT o.product_id FROM payments p JOIN orders o ON p.order_id = o.id WHERE p.user_id = $1 AND p.status = 'SUCCESS'
             )
             ORDER BY m.created_at DESC`,
            [userId]
        );

        const result = await Promise.race([
            libraryQuery,
            new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 12000)),
        ]);

        const magazines = (result?.rows || []).map((row) => ({
            _id: row.id,
            id: row.id,
            title: row.title,
            description: row.description,
            coverUrl: row.cover_url,
            minutes: row.minutes,
            likes: row.likes,
            edition: row.edition,
            category: row.category,
            date: row.date,
            paragraphs: row.paragraphs,
            funFact: row.fun_fact,
            targetUrl: row.target_url,
            storyImages: row.story_images,
            priceCents: row.price_cents,
            active: row.active,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        }));

        res.json(magazines);
    } catch (error) {
        console.warn("User library fetch warning:", error.message);
        res.json([]);
    }
}

router.get("/library", handleUserLibrary);
router.get("/user/library", handleUserLibrary);

export default router;
