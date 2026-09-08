import "dotenv/config";
import app from "./app.js";
import { connectMongo } from "./lib/mongo.js";

const PORT = process.env.PORT ?? 4000;

app.listen(PORT, () => console.log(`🚀 API server running on http://localhost:${PORT}`));

connectMongo().catch((error) => {
  console.warn("⚠️ MongoDB unavailable; using local fallback storage:", error.message);
});
