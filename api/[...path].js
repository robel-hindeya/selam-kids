/**
 * # NOTE: api/[...path].js
 * Role: Vercel Serverless Catch-All Route
 * Layer: Infrastructure / Cloud Gateway
 * Description: Forwards all wildcard API subpaths to index.js.
 */

export { default } from "./index.js";
