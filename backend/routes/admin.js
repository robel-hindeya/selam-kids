import { Router } from "express";
import multer from "multer";
import path from "node:path";
import crypto from "node:crypto";
import fs from "node:fs";
import { Magazine, Feedback, Banner } from "../models/Content.js";

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

router.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file provided or invalid type" });
  res.json({ url: `/uploads/${req.file.filename}` });
});

router.get("/magazines", async (_req, res) => {
  try {
    res.json(await Magazine.find().sort({ createdAt: -1 }));
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/magazines", async (req, res) => {
  try {
    res.status(201).json(await Magazine.create({ ...req.body, active: true }));
  } catch {
    res.status(400).json({ error: "Failed to create magazine" });
  }
});

router.get("/magazines/:id", async (req, res) => {
  try {
    const magazine = await Magazine.findById(req.params.id);
    return magazine ? res.json(magazine) : res.status(404).json({ error: "Magazine not found" });
  } catch {
    return res.status(404).json({ error: "Magazine not found" });
  }
});

router.delete("/magazines/:id", async (req, res) => {
  try {
    const magazine = await Magazine.findByIdAndDelete(req.params.id);
    if (magazine) removeUploadedFile(magazine.coverUrl);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/magazines/:id", async (req, res) => {
  try {
    const existing = await Magazine.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Magazine not found" });
    const updated = await Magazine.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (req.body.coverUrl && existing.coverUrl !== req.body.coverUrl)
      removeUploadedFile(existing.coverUrl);
    return res.json(updated);
  } catch (error) {
    return res.status(400).json({ error: error.message || "Failed to update magazine" });
  }
});

router.get("/banners", async (_req, res) => {
  try {
    res.json(await Banner.find().sort({ order: 1 }));
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/banners", async (req, res) => {
  try {
    res.status(201).json(await Banner.create({ ...req.body, active: true }));
  } catch {
    res.status(400).json({ error: "Failed to create banner" });
  }
});

router.delete("/banners/:id", async (req, res) => {
  try {
    const banner = await Banner.findByIdAndDelete(req.params.id);
    if (banner) removeUploadedFile(banner.imageUrl);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/banners/:id", async (req, res) => {
  try {
    const existing = await Banner.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Banner not found" });
    const updated = await Banner.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (req.body.imageUrl && existing.imageUrl !== req.body.imageUrl)
      removeUploadedFile(existing.imageUrl);
    return res.json(updated);
  } catch (error) {
    return res.status(400).json({ error: error.message || "Failed to update banner" });
  }
});

router.get("/feedback", async (_req, res) => {
  try {
    res.json(
      await Feedback.find()
        .sort({ createdAt: -1 })
        .populate("userId", "displayName email username"),
    );
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
