/**
 * # NOTE: handler.js
 * Role: Serverless Application Adapter
 * Layer: Infrastructure / Cloud Gateway Adapter
 * Description: Wraps Express application with resilient PostgreSQL connection pool for serverless execution.
 */

import app from "../app.js";
import { connectPostgres } from "../lib/postgres.js";

const MAX_DB_WAIT_MS = 12000;

export default async function handler(req, res) {
  try {
    await Promise.race([
      connectPostgres(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Database connection exceeded wait limit")), MAX_DB_WAIT_MS)
      ),
    ]);
  } catch (error) {
    console.warn("PostgreSQL connection note (proceeding with fallback datastore):", error.message);
  }
  return app(req, res);
}
