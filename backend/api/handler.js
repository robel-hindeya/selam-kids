import app from "../app.js";
import { connectMongo } from "../lib/mongo.js";

export default async function handler(req, res) {
  try {
    await connectMongo();
    return app(req, res);
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    return res.status(503).json({
      error: "Database unavailable",
      message: "Set a valid MONGODB_URI in the Vercel project environment.",
    });
  }
}
