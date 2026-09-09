import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!databaseUrl && process.env.NODE_ENV === "production") {
  throw new Error("DATABASE_URL is required in production");
}

export const pool = new Pool({
  connectionString: databaseUrl || "postgresql://localhost:5432/selam_kids",
  ssl: databaseUrl ? { rejectUnauthorized: false } : false,
  max: 10,
});

export function query(text, values) {
  return pool.query(text, values);
}

function readJson(fileName) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, "backend", "data", fileName), "utf8"));
  } catch {
    return [];
  }
}

export async function connectPostgres() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      google_id TEXT UNIQUE,
      username TEXT UNIQUE,
      email TEXT UNIQUE,
      display_name TEXT NOT NULL DEFAULT '',
      gender TEXT NOT NULL DEFAULT '',
      age INTEGER,
      avatar_url TEXT NOT NULL DEFAULT '',
      legacy_points INTEGER NOT NULL DEFAULT 0,
      is_admin BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS magazines (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      cover_url TEXT NOT NULL DEFAULT '',
      minutes INTEGER NOT NULL DEFAULT 5,
      likes INTEGER NOT NULL DEFAULT 0,
      edition TEXT NOT NULL DEFAULT 'New Edition',
      category TEXT NOT NULL DEFAULT 'Magazine',
      date TEXT NOT NULL DEFAULT '',
      paragraphs JSONB NOT NULL DEFAULT '[]'::jsonb,
      fun_fact TEXT NOT NULL DEFAULT '',
      target_url TEXT NOT NULL DEFAULT '',
      story_images JSONB NOT NULL DEFAULT '[]'::jsonb,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS banners (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      kicker TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL DEFAULT '',
      active BOOLEAN NOT NULL DEFAULT TRUE,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS feedback (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      image_url TEXT NOT NULL DEFAULT '',
      family_name TEXT NOT NULL DEFAULT '',
      kid_username TEXT NOT NULL DEFAULT '',
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const [{ rows: bannerCount }, { rows: magazineCount }] = await Promise.all([
    query("SELECT COUNT(*)::int AS count FROM banners"),
    query("SELECT COUNT(*)::int AS count FROM magazines"),
  ]);

  if (bannerCount[0].count === 0) {
    for (const banner of readJson("banners.json")) {
      await query(
        `INSERT INTO banners (id, title, kicker, image_url, active, display_order, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING`,
        [
          banner._id,
          banner.title,
          banner.kicker ?? "",
          banner.imageUrl ?? "",
          banner.active !== false,
          Number(banner.order ?? 0),
          banner.createdAt || new Date(),
        ],
      );
    }
  }

  if (magazineCount[0].count === 0) {
    for (const magazine of readJson("magazines.json")) {
      await query(
        `INSERT INTO magazines
          (id, title, description, cover_url, minutes, likes, edition, category, date, paragraphs, fun_fact, target_url, story_images, active, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13::jsonb, $14, $15)
         ON CONFLICT (id) DO NOTHING`,
        [
          magazine._id,
          magazine.title,
          magazine.description ?? "",
          magazine.coverUrl ?? "",
          Number(magazine.minutes ?? 5),
          Number(magazine.likes ?? 0),
          magazine.edition ?? "New Edition",
          magazine.category ?? "Magazine",
          magazine.date ?? "",
          JSON.stringify(magazine.paragraphs ?? []),
          magazine.funFact ?? "",
          magazine.targetUrl ?? "",
          JSON.stringify(magazine.storyImages ?? []),
          magazine.active !== false,
          magazine.createdAt || new Date(),
        ],
      );
    }
  }

  console.log("✅ PostgreSQL connected");
  return pool;
}

export async function closePostgres() {
  await pool.end();
}
