/**
 * # NOTE: supabaseSync.js
 * Role: Supabase User Synchronization Adapter
 * Layer: Domain Service / Integration
 * Description: Synchronizes Supabase authentication records into PostgreSQL users table.
 */

import { createClient } from "@supabase/supabase-js";
import { query } from "./postgres.js";

let supabaseClient = null;

function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (url && anonKey && !url.includes("placeholder")) {
    supabaseClient = createClient(url, anonKey);
  }
  return supabaseClient;
}

export async function syncGoogleUsersFromSupabase() {
  const client = getSupabaseClient();
  if (!client) return;

  try {
    const { data: profiles, error } = await client.from("profiles").select("*");
    if (error || !Array.isArray(profiles)) return;

    for (const p of profiles) {
      if (!p.id || !p.email) continue;
      const cleanEmail = p.email.trim().toLowerCase();

      // Check if user exists in PostgreSQL
      const existing = await query(
        "SELECT id, username, email, google_id, account_type, is_admin, is_super_admin FROM users WHERE id = $1 OR LOWER(email) = $2",
        [p.id, cleanEmail]
      );

      const isGoogle = Boolean(
        p.avatar_url?.includes("googleusercontent.com") ||
        p.avatar_url?.includes("lh3.google") ||
        p.google_id
      );
      const accType = isGoogle ? "Google" : "Email";

      if (existing.rows[0]) {
        const row = existing.rows[0];
        // If row is Google account or google_id is missing, sync google_id and account_type
        if (isGoogle && (!row.google_id || row.account_type !== "Google")) {
          await query(
            "UPDATE users SET google_id = COALESCE(google_id, $1), account_type = 'Google', avatar_url = CASE WHEN avatar_url = '' THEN $2 ELSE avatar_url END WHERE id = $3",
            [p.id, p.avatar_url || "", row.id]
          );
        }
      } else {
        // Find unique username
        const base = (
          p.username ||
          p.display_name ||
          p.full_name ||
          cleanEmail.split("@")[0] ||
          "reader"
        )
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
          .slice(0, 24) || "reader";

        let username = base;
        let count = 1;
        while ((await query("SELECT id FROM users WHERE username = $1", [username])).rows[0]) {
          username = `${base}${count++}`;
        }

        await query(
          `INSERT INTO users (
            id, google_id, username, email, display_name, gender, age, avatar_url,
            password_hash, legacy_points, is_admin, is_super_admin, role, account_type, is_disabled, created_at, updated_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
          ON CONFLICT (id) DO NOTHING`,
          [
            p.id,
            isGoogle ? p.id : null,
            username,
            cleanEmail,
            p.display_name || p.full_name || username,
            p.gender || "",
            p.age ? Number(p.age) : null,
            p.avatar_url || "",
            null,
            p.legacy_points || 0,
            Boolean(p.is_admin),
            Boolean(p.is_super_admin),
            p.role || "Kid",
            accType,
            false,
            p.created_at ? new Date(p.created_at) : new Date(),
            p.updated_at ? new Date(p.updated_at) : new Date(),
          ]
        );
      }
    }
  } catch (err) {
    console.error("Supabase user sync error:", err);
  }
}
