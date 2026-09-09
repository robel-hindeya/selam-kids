import "dotenv/config";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import {
  addBanner,
  addFeedback,
  addMagazine,
  getBanners,
  getFeedback,
  getMagazine,
  getMagazines,
  getUser,
  removeBanner,
  removeFeedback,
  removeMagazine,
  updateBanner,
  updateMagazine,
  updateUser,
  upsertUser,
} from "./lib/bannerStore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const PORT = Number(process.env.PORT || 4000);
const isProduction = process.env.NODE_ENV === "production";
const uploadsDir = path.join(ROOT, "public", "uploads");

fs.mkdirSync(uploadsDir, { recursive: true });

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "access-control-allow-origin": "*",
    "access-control-allow-credentials": "true",
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function readJson(req) {
  const body = await readBody(req);
  return body.length ? JSON.parse(body.toString("utf8")) : {};
}

async function saveUpload(req) {
  const contentType = req.headers["content-type"] || "";
  const match = contentType.match(/boundary=([^;]+)/i);
  if (!match) return null;

  const body = await readBody(req);
  const boundary = Buffer.from(`--${match[1].replace(/^"|"$/g, "")}`);
  const start = body.indexOf(Buffer.from("\r\n\r\n"));
  if (start === -1) return null;

  const header = body.subarray(0, start).toString("utf8");
  const filenameMatch = header.match(/filename="([^"]+)"/i);
  if (!filenameMatch) return null;

  const contentStart = start + 4;
  const contentEnd = body.indexOf(Buffer.concat([Buffer.from("\r\n"), boundary]), contentStart);
  if (contentEnd === -1) return null;

  const extension = path.extname(filenameMatch[1]).toLowerCase() || ".bin";
  const filename = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${extension}`;
  fs.writeFileSync(path.join(uploadsDir, filename), body.subarray(contentStart, contentEnd));
  return `/uploads/${filename}`;
}

function removeUpload(url) {
  if (!url?.startsWith("/uploads/")) return;
  const filename = path.basename(url);
  fs.rmSync(path.join(uploadsDir, filename), { force: true });
}

function findId(pathname, prefix) {
  return pathname.startsWith(prefix) ? decodeURIComponent(pathname.slice(prefix.length)) : null;
}

function parseCookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || "")
      .split(";")
      .map((part) => part.trim().split("="))
      .filter(([key, value]) => key && value)
      .map(([key, ...value]) => [key, decodeURIComponent(value.join("="))]),
  );
}

function currentUser(req) {
  try {
    const token = parseCookies(req).token;
    if (!token) return null;
    const payload = jwt.verify(token, process.env.JWT_SECRET || "local-development-secret");
    return getUser(payload.userId);
  } catch {
    return null;
  }
}

function googleCallbackUrl() {
  return process.env.GOOGLE_CALLBACK_URL || `http://localhost:${PORT}/api/auth/google/callback`;
}

async function exchangeGoogleCode(code) {
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      redirect_uri: googleCallbackUrl(),
      grant_type: "authorization_code",
    }),
  });
  if (!tokenResponse.ok) throw new Error("Google token exchange failed");
  const tokens = await tokenResponse.json();
  const profileResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { authorization: `Bearer ${tokens.access_token}` },
  });
  if (!profileResponse.ok) throw new Error("Google profile request failed");
  return profileResponse.json();
}

function setAuthCookie(res, userId) {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET || "local-development-secret", { expiresIn: "30d" });
  res.setHeader(
    "set-cookie",
    `token=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000${isProduction ? "; Secure" : ""}`,
  );
}

export async function handleApiRequest(req, res) {
  const url = new URL(req.url || "/", "http://localhost");
  const { pathname } = url;

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-credentials": "true",
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    });
    return res.end();
  }

  if (!pathname.startsWith("/api/")) return false;

  try {
    if (req.method === "GET" && pathname === "/api/health") {
      return sendJson(res, 200, { ok: true, service: "selam-kids-node" });
    }

    if (req.method === "GET" && pathname === "/api/data") {
      return sendJson(res, 200, { banners: getBanners(), magazines: getMagazines(), feedback: getFeedback() });
    }

    if (req.method === "GET" && pathname === "/api/banners") {
      return sendJson(res, 200, getBanners({ activeOnly: true }));
    }

    if (req.method === "GET" && pathname === "/api/magazines") {
      return sendJson(res, 200, getMagazines({ activeOnly: true }));
    }

    const magazineId = findId(pathname, "/api/magazines/");
    if (req.method === "GET" && magazineId) {
      const magazine = getMagazine(magazineId);
      return magazine ? sendJson(res, 200, magazine) : sendJson(res, 404, { error: "Magazine not found" });
    }

    if (req.method === "POST" && pathname === "/api/feedback") {
      return sendJson(res, 201, { success: true, feedback: addFeedback(await readJson(req)) });
    }

    if (req.method === "GET" && pathname === "/api/auth/google") {
      const params = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        redirect_uri: googleCallbackUrl(),
        response_type: "code",
        scope: "openid email profile",
        access_type: "online",
        prompt: "select_account",
      });
      res.writeHead(302, { location: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
      return res.end();
    }

    if (req.method === "GET" && pathname === "/api/auth/google/callback") {
      const code = url.searchParams.get("code");
      if (!code) return sendJson(res, 400, { error: "Google authorization code is missing" });
      const profile = await exchangeGoogleCode(code);
      const user = upsertUser({
        googleId: profile.id,
        email: profile.email,
        displayName: profile.name,
        avatarUrl: profile.picture,
        username: (profile.email?.split("@")[0] || "reader").replace(/[^a-z0-9_.]/gi, "").toLowerCase(),
      });
      setAuthCookie(res, user._id);
      res.writeHead(302, { location: "/home" });
      return res.end();
    }

    if (req.method === "POST" && (pathname === "/api/upload" || pathname === "/api/admin/upload")) {
      const url = await saveUpload(req);
      return url ? sendJson(res, 200, { url }) : sendJson(res, 400, { error: "No file provided or invalid type" });
    }

    if (req.method === "GET" && pathname === "/api/admin/magazines") {
      return sendJson(res, 200, getMagazines());
    }

    if (req.method === "POST" && pathname === "/api/admin/magazines") {
      return sendJson(res, 201, addMagazine(await readJson(req)));
    }

    const adminMagazineId = findId(pathname, "/api/admin/magazines/");
    if (adminMagazineId && req.method === "PUT") {
      const existing = getMagazine(adminMagazineId);
      const updated = updateMagazine(adminMagazineId, await readJson(req));
      if (!updated) return sendJson(res, 404, { error: "Magazine not found" });
      if (existing?.coverUrl && updated.coverUrl !== existing.coverUrl) removeUpload(existing.coverUrl);
      if (Array.isArray(existing?.storyImages) && Array.isArray(updated.storyImages)) {
        for (const image of existing.storyImages) {
          if (!updated.storyImages.includes(image)) removeUpload(image);
        }
      }
      return sendJson(res, 200, updated);
    }

    if (adminMagazineId && req.method === "DELETE") {
      const existing = getMagazine(adminMagazineId);
      removeMagazine(adminMagazineId);
      if (existing) removeUpload(existing.coverUrl);
      if (existing?.storyImages) existing.storyImages.forEach(removeUpload);
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "GET" && pathname === "/api/admin/banners") return sendJson(res, 200, getBanners());
    if (req.method === "POST" && pathname === "/api/admin/banners") {
      return sendJson(res, 201, addBanner(await readJson(req)));
    }

    const bannerId = findId(pathname, "/api/admin/banners/");
    if (bannerId && req.method === "PUT") {
      const existing = getBanners().find((banner) => banner._id === bannerId);
      const updated = updateBanner(bannerId, await readJson(req));
      if (!updated) return sendJson(res, 404, { error: "Banner not found" });
      if (existing?.imageUrl && updated.imageUrl !== existing.imageUrl) removeUpload(existing.imageUrl);
      return sendJson(res, 200, updated);
    }

    if (bannerId && req.method === "DELETE") {
      const existing = getBanners().find((banner) => banner._id === bannerId);
      removeBanner(bannerId);
      if (existing) removeUpload(existing.imageUrl);
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === "GET" && pathname === "/api/admin/feedback") return sendJson(res, 200, getFeedback());
    const feedbackId = findId(pathname, "/api/admin/feedback/");
    if (feedbackId && req.method === "DELETE") {
      removeFeedback(feedbackId);
      return sendJson(res, 200, { ok: true });
    }

    if (pathname === "/api/auth/logout" && req.method === "POST") {
      res.setHeader("set-cookie", "token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax");
      return sendJson(res, 200, { ok: true });
    }

    if (pathname === "/api/me") {
      const user = currentUser(req);
      if (!user) return sendJson(res, 401, { error: "Not authenticated" });
      if (req.method === "PATCH") {
        const body = await readJson(req);
        const updates = {};
        if (body.displayName !== undefined) updates.displayName = String(body.displayName).trim();
        if (body.gender !== undefined) updates.gender = body.gender;
        if (body.age !== undefined) updates.age = Number(body.age);
        if (body.avatarUrl !== undefined) updates.avatarUrl = body.avatarUrl;
        return sendJson(res, 200, updateUser(user._id, updates));
      }
      return sendJson(res, 200, user);
    }

    return sendJson(res, 404, { error: "API route not found" });
  } catch (error) {
    console.error("API request failed:", error);
    return sendJson(res, 400, { error: "Invalid request" });
  }
}

async function serveStatic(req, res) {
  const pathname = new URL(req.url || "/", "http://localhost").pathname;
  const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
  const roots = isProduction
    ? [path.join(ROOT, "dist", "client"), path.join(ROOT, ".output", "public"), path.join(ROOT, "public")]
    : [path.join(ROOT, "public")];
  for (const root of roots) {
    const candidate = path.resolve(root, relativePath);
    if (!candidate.startsWith(`${root}${path.sep}`) && candidate !== path.join(root, "index.html")) continue;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      res.writeHead(200);
      return fs.createReadStream(candidate).pipe(res);
    }
  }
  return false;
}

async function start() {
  let vite;
  const server = http.createServer(async (req, res) => {
    const isApiRequest = (req.url || "").startsWith("/api/");
    if (isApiRequest) {
      await handleApiRequest(req, res);
      return;
    }
    if (await serveStatic(req, res)) return;
    if (vite) return vite.middlewares(req, res, () => {
      res.writeHead(404);
      res.end("Not found");
    });
    res.writeHead(404);
    res.end("Not found");
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    vite = await createViteServer({ server: { middlewareMode: true, ws: { server } }, appType: "spa" });
  }

  server.listen(PORT);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) start().catch((error) => {
  console.error("Failed to start Selam Kids:", error);
  process.exitCode = 1;
});
