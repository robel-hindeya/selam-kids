import { Router } from "express";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import User from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";

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
        const user = await User.findById(req.userId).lean();
        if (!user) return res.status(404).json({ error: "User not found" });
        res.json(user);
    } catch {
        res.status(500).json({ error: "Server error" });
    }
});

// PATCH /api/me — update profile fields
router.patch("/me", requireAuth, async (req, res) => {
    try {
        const { displayName, username, gender, age, avatarUrl } = req.body;
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

export default router;
