import { Router } from "express";
import mongoose from "mongoose";
import { Magazine, Banner, Feedback } from "../models/Content.js";
import { getBanners, getMagazine, getMagazines } from "../lib/bannerStore.js";

const router = Router();

// GET active banners
router.get("/banners", async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) return res.json(getBanners({ activeOnly: true }));
        const banners = await Banner.find({ active: true }).sort({ order: 1, createdAt: -1 });
        res.json(banners);
    } catch {
        res.status(500).json({ error: "Server error" });
    }
});

// GET active magazines
router.get("/magazines", async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) return res.json(getMagazines({ activeOnly: true }));
        const magazines = await Magazine.find({ active: true }).sort({ createdAt: -1 });
        res.json(magazines);
    } catch {
        res.status(500).json({ error: "Server error" });
    }
});

router.get("/magazines/:id", async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            const magazine = getMagazine(req.params.id);
            return magazine ? res.json(magazine) : res.status(404).json({ error: "Magazine not found" });
        }
        const magazine = await Magazine.findById(req.params.id);
        return magazine ? res.json(magazine) : res.status(404).json({ error: "Magazine not found" });
    } catch {
        const magazine = getMagazine(req.params.id);
        return magazine ? res.json(magazine) : res.status(404).json({ error: "Magazine not found" });
    }
});

// POST feedback (public, or logged in)
router.post("/feedback", async (req, res) => {
    try {
        const data = { ...req.body };

        // Optionally grab userId if logged in (this requires token cookie parsing if we want 
        // to strictly link it, but we can just use req.cookies from the request if we pass it 
        // through a lightweight optional auth middleware)

        await Feedback.create(data);
        res.status(201).json({ success: true });
    } catch (err) {
        res.status(400).json({ error: "Failed to submit feedback" });
    }
});

export default router;
