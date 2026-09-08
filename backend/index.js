import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import passport from "./auth/google.js";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/user.js";
import adminRoutes from "./routes/admin.js";
import publicRoutes from "./routes/public.js";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const app = express();
const PORT = process.env.PORT ?? 4000;

// ─── Ensure uploads directory exists ─────────────────────────────────────────
const uploadsDir = path.join(ROOT, "public", "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(
    cors({
        origin: process.env.FRONTEND_URL ?? "http://localhost:5173",
        credentials: true,
    })
);
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

// ─── Static files (uploaded images + built frontend) ─────────────────────────
app.use(express.static(path.join(ROOT, "public")));

// In production also serve the built frontend
if (process.env.NODE_ENV === "production") {
    const distPath = path.join(ROOT, ".output", "public");
    if (fs.existsSync(distPath)) {
        app.use(express.static(distPath));
    }
}

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api", publicRoutes);
app.use("/api", userRoutes);

// ─── SPA fallback (production) ────────────────────────────────────────────────
if (process.env.NODE_ENV === "production") {
    app.get("*", (_req, res) => {
        const indexPath = path.join(ROOT, ".output", "public", "index.html");
        if (fs.existsSync(indexPath)) {
            res.sendFile(indexPath);
        } else {
            res.status(404).send("Not found");
        }
    });
}

// ─── Start API first, then connect to MongoDB in the background ───────────────
// The public banner fallback must be available even when local MongoDB is not.
app.listen(PORT, () => console.log(`🚀 API server running on http://localhost:${PORT}`));

mongoose
    .connect(process.env.MONGODB_URI ?? "mongodb://localhost:27017/selamkids", {
        serverSelectionTimeoutMS: 3000,
    })
    .then(() => console.log("✅ MongoDB connected"))
    .catch((err) => console.warn("⚠️ MongoDB unavailable; using file-backed banner storage:", err.message));
