/**
 * # NOTE: api/index.js
 * Role: Vercel Serverless Function Gateway
 * Layer: Infrastructure / Cloud Gateway
 * Description: Required by Vercel to discover and deploy serverless functions. Re-exports the backend Express handler.
 */

export { default } from "../backend/api/handler.js";
