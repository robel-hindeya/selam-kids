import crypto from "node:crypto";
import { query } from "./postgres.js";

export async function logActivity({ userId, username, action, details = "", targetType = "", targetId = null }) {
  try {
    let resolvedUsername = username;
    if (!resolvedUsername && userId) {
      const res = await query("SELECT username, display_name FROM users WHERE id = $1", [userId]);
      if (res.rows[0]) resolvedUsername = res.rows[0].username || res.rows[0].display_name;
    }
    await query(
      `INSERT INTO activity_logs (id, user_id, username, action, details, target_type, target_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        crypto.randomUUID(),
        userId || null,
        resolvedUsername || "Admin",
        action,
        details,
        targetType,
        targetId ? String(targetId) : null,
      ]
    );
  } catch (err) {
    console.error("Failed to write activity log:", err);
  }
}

export async function getActivityLogs(limit = 50) {
  try {
    const result = await query(
      `SELECT id, user_id, username, action, details, target_type, target_id, created_at
       FROM activity_logs
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows.map((row) => ({
      _id: row.id,
      userId: row.user_id,
      username: row.username,
      action: row.action,
      details: row.details,
      targetType: row.target_type,
      targetId: row.target_id,
      createdAt: row.created_at,
    }));
  } catch (err) {
    console.error("Failed to get activity logs:", err);
    return [];
  }
}
