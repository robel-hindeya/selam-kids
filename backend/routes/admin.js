import { Router } from "express";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs";
import mongoose from "mongoose";
import { Magazine, Feedback, Banner } from "../models/Content.js";
import {
    addBanner,
    addMagazine,
    getBanners,
    getMagazine,
    getMagazines,
    removeBanner,
    removeMagazine,
    updateBanner,
    updateMagazine,
} from "../lib/bannerStore.js";

const router = Router();
const uploadsDir = path.resolve("public/uploads");

function removeUploadedFile(url) {
    if (!url || !url.startsWith("/uploads/")) return;
    const filePath = path.resolve(uploadsDir, path.basename(url));
    if (filePath.startsWith(`${uploadsDir}${path.sep}`)) fs.rmSync(filePath, { force: true });
}

const upload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, path.resolve("public/uploads")),
        filename: (_req, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase();
            cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`);
        },
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith("image/")),
});

// The dashboard is intentionally public. Do not add an auth guard here: the
// admin route must be directly accessible without a login or redirect.

router.post("/upload", upload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file provided or invalid type" });
    res.json({ url: `/uploads/${req.file.filename}` });
});

// ─── Magazines ─────────────────────────────────────────────────────────────────
router.get("/magazines", async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) return res.json(getMagazines());
        const magazines = await Magazine.find().sort({ createdAt: -1 });
        res.json(magazines.length > 0 ? magazines : getMagazines());
    } catch {
        res.status(500).json({ error: "Server error" });
    }
});

router.post("/magazines", async (req, res) => {
    try {
        if (mongoose.connection.readyState === 1) {
            const magazine = await Magazine.create({ ...req.body, active: true });
            return res.status(201).json(magazine);
        }
    } catch (err) {
        console.warn("MongoDB magazine create failed; using file-backed storage:", err.message);
    }

    try {
        return res.status(201).json(addMagazine(req.body));
    } catch (err) {
        console.error("File-backed magazine create failed:", err);
        return res.status(400).json({ error: "Failed to create magazine" });
    }
});

router.get("/magazines/:id", async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            const magazine = getMagazine(req.params.id);
            return magazine ? res.json(magazine) : res.status(404).json({ error: "Magazine not found" });
        }
        const magazine = await Magazine.findById(req.params.id);
        if (magazine) return res.json(magazine);
        const localMagazine = getMagazine(req.params.id);
        return localMagazine ? res.json(localMagazine) : res.status(404).json({ error: "Magazine not found" });
    } catch {
        const magazine = getMagazine(req.params.id);
        return magazine ? res.json(magazine) : res.status(404).json({ error: "Magazine not found" });
    }
});

router.delete("/magazines/:id", async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            const magazine = getMagazine(req.params.id);
            removeMagazine(req.params.id);
            if (magazine) removeUploadedFile(magazine.coverUrl);
            return res.json({ ok: true });
        }
        const magazine = await Magazine.findByIdAndDelete(req.params.id);
        if (magazine) removeUploadedFile(magazine.coverUrl);
        res.json({ ok: true });
    } catch {
        res.status(500).json({ error: "Server error" });
    }
});

router.put("/magazines/:id", async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            const existing = getMagazine(req.params.id);
            const updated = updateMagazine(req.params.id, req.body);
            if (!updated) return res.status(404).json({ error: "Magazine not found" });
            if (existing?.coverUrl && req.body.coverUrl && existing.coverUrl !== req.body.coverUrl) {
                removeUploadedFile(existing.coverUrl);
            }
            return res.json(updated);
        }
        const existing = await Magazine.findById(req.params.id);
        if (!existing) return res.status(404).json({ error: "Magazine not found" });
        const updated = await Magazine.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
        });
        if (req.body.coverUrl && existing.coverUrl !== req.body.coverUrl) {
            removeUploadedFile(existing.coverUrl);
        }
        return res.json(updated);
    } catch (err) {
        return res.status(400).json({ error: err.message || "Failed to update magazine" });
    }
});

// ─── Banners ───────────────────────────────────────────────────────────────────
router.get("/banners", async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) return res.json(getBanners());
        const banners = await Banner.find().sort({ order: 1, createdAt: -1 });
        res.json(banners.length > 0 ? banners : getBanners());
    } catch {
        res.status(500).json({ error: "Server error" });
    }
});

router.post("/banners", async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) return res.status(201).json(addBanner(req.body));
        const banner = await Banner.create({ ...req.body, active: true });
        res.status(201).json(banner);
    } catch {
        res.status(400).json({ error: "Failed to create banner" });
    }
});

router.delete("/banners/:id", async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            const banner = getBanners().find((item) => item._id === req.params.id);
            removeBanner(req.params.id);
            if (banner) removeUploadedFile(banner.imageUrl);
            return res.json({ ok: true });
        }
        const banner = await Banner.findByIdAndDelete(req.params.id);
        if (banner) removeUploadedFile(banner.imageUrl);
        res.json({ ok: true });
    } catch {
        res.status(500).json({ error: "Server error" });
    }
});

router.put("/banners/:id", async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            const existing = getBanners().find((item) => item._id === req.params.id);
            const updated = updateBanner(req.params.id, req.body);
            if (!updated) return res.status(404).json({ error: "Banner not found" });
            if (existing?.imageUrl && req.body.imageUrl && existing.imageUrl !== req.body.imageUrl) {
                removeUploadedFile(existing.imageUrl);
            }
            return res.json(updated);
        }
        const existing = await Banner.findById(req.params.id);
        if (!existing) return res.status(404).json({ error: "Banner not found" });
        const updated = await Banner.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
        });
        if (req.body.imageUrl && existing.imageUrl !== req.body.imageUrl) {
            removeUploadedFile(existing.imageUrl);
        }
        return res.json(updated);
    } catch (err) {
        return res.status(400).json({ error: err.message || "Failed to update banner" });
    }
});

// ─── Feedback ──────────────────────────────────────────────────────────────────
router.get("/feedback", async (req, res) => {
    try {
        const feedback = await Feedback.find().sort({ createdAt: -1 }).populate("userId", "displayName email username");
        res.json(feedback);
    } catch {
        res.status(500).json({ error: "Server error" });
    }
});

router.delete("/feedback/:id", async (req, res) => {
    try {
        await Feedback.findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch {
        res.status(500).json({ error: "Server error" });
    }
});

export default router;
