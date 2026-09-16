import { Router } from "express";
import jwt from "jsonwebtoken";
import { Magazine, Banner, Feedback } from "../models/Content.js";

const router = Router();

router.get("/banners", async (_req, res) => {
  try {
    const banners = await Banner.find({ active: true }).sort({ order: 1 });
    res.json(banners);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/magazines", async (_req, res) => {
  try {
    res.json(await Magazine.find({ active: true }).sort({ createdAt: -1 }));
  } catch {
    res.status(500).json({ error: "Server error" });
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

router.post("/feedback", async (req, res) => {
  try {
    let userId = req.body?.userId || null;
    if (!userId && req.cookies?.token) {
      try {
        const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
        if (decoded?.userId) userId = decoded.userId;
      } catch {}
    }
    await Feedback.create({ ...req.body, userId });
    res.status(201).json({ success: true });
  } catch {
    res.status(400).json({ error: "Failed to submit feedback" });
  }
});

export default router;
