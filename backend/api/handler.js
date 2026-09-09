import app from "../app.js";
import { connectPostgres } from "../lib/postgres.js";

export default async function handler(req, res) {
  try {
    await connectPostgres();
    return app(req, res);
  } catch (error) {
    console.error("PostgreSQL connection failed:", error);
    return res.status(503).json({
      error: "Database unavailable",
      message: "Set a valid DATABASE_URL in the deployment environment.",
    });
  }
}
