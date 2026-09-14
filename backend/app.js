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
// Registration can include a small profile-picture data URL. Express defaults
// to 100 KB, which rejects normal phone photos before the auth route runs.
app.use(express.json({ limit: "4mb" }));
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

app.use((error, _req, res, next) => {
  if (error?.type === "entity.too.large") {
    return res
      .status(413)
      .json({ error: "Profile picture is too large. Please use a picture smaller than 2 MB." });
  }
  return next(error);
});

if (process.env.NODE_ENV === "production") {
  app.get("/{*splat}", (_req, res) => {
    const indexPath = path.join(ROOT, ".output", "public", "index.html");
    if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
    res.status(404).send("Not found");
  });
}

export default app;
