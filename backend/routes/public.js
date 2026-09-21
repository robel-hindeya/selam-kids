/**
 * # NOTE: public.js
 * Role: Public Content Controller
 * Layer: Presentation / REST API
 * Description: Serves public magazines, banners, feedback submissions, and health checks.
 */

import { Router } from "express";
import jwt from "jsonwebtoken";
import { Magazine, Banner, Feedback } from "../models/Content.js";
import { getBanners, getMagazines, getMagazine } from "../lib/bannerStore.js";

const router = Router();

const withTimeout = (promise, ms = 12000) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Query timeout")), ms)),
  ]);

router.get("/banners", async (_req, res) => {
  try {
    const banners = await withTimeout(Banner.find({ active: true }).sort({ order: 1 }));
    if (Array.isArray(banners) && banners.length > 0) {
      return res.json(banners);
    }
    return res.json(getBanners({ activeOnly: true }));
  } catch {
    return res.json(getBanners({ activeOnly: true }));
  }
});

router.get("/magazines", async (_req, res) => {
  try {
    const magazines = await withTimeout(Magazine.find({ active: true }).sort({ createdAt: -1 }));
    if (Array.isArray(magazines) && magazines.length > 0) {
      return res.json(magazines);
    }
    return res.json(getMagazines({ activeOnly: true }));
  } catch {
    return res.json(getMagazines({ activeOnly: true }));
  }
});

router.get("/magazines/:id", async (req, res) => {
  try {
    const magazine = await withTimeout(Magazine.findById(req.params.id));
    if (magazine) return res.json(magazine);
    const fallback = getMagazine(req.params.id);
    return fallback ? res.json(fallback) : res.status(404).json({ error: "Magazine not found" });
  } catch {
    const fallback = getMagazine(req.params.id);
    return fallback ? res.json(fallback) : res.status(404).json({ error: "Magazine not found" });
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
