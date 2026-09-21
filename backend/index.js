/**
 * # NOTE: index.js
 * Role: Server Entrypoint & Listener
 * Layer: Infrastructure / Application Bootstrap
 * Description: Initializes HTTP server, connects to PostgreSQL database, and starts listening on PORT.
 */

import "dotenv/config";
import app from "./app.js";
import { connectPostgres } from "./lib/postgres.js";

const PORT = process.env.PORT ?? 4000;

app.listen(PORT, () => console.log(`🚀 API server running on http://localhost:${PORT}`));

connectPostgres().catch((error) => {
  console.warn("⚠️ PostgreSQL initial connection note:", error.message);
});
