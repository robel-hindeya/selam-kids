import "dotenv/config";
import app from "./app.js";
import { connectPostgres } from "./lib/postgres.js";

const PORT = process.env.PORT ?? 4000;

app.listen(PORT, () => console.log(`🚀 API server running on http://localhost:${PORT}`));

connectPostgres().catch((error) => {
  console.error("⚠️ PostgreSQL connection failed:", error.message);
  process.exitCode = 1;
});
