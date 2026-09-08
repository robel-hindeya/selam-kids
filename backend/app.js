import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
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
const uploadsDir = path.join(ROOT, "public", "uploads");

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

app.use(
  cors({
    origin: process.env.FRONTEND_URL || true,
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());
app.use(express.static(path.join(ROOT, "public")));

if (process.env.NODE_ENV === "production") {
  const distPath = path.join(ROOT, ".output", "public");
  if (fs.existsSync(distPath)) app.use(express.static(distPath));
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "selam-kids-api" });
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api", publicRoutes);
app.use("/api", userRoutes);

if (process.env.NODE_ENV === "production") {
  app.get("/{*splat}", (_req, res) => {
    const indexPath = path.join(ROOT, ".output", "public", "index.html");
    if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
    res.status(404).send("Not found");
  });
}

export default app;
