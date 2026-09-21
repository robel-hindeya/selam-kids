/**
 * # NOTE: vitest.config.ts
 * Role: Automated Test Suite Configuration
 * Layer: Tooling / Testing
 * Description: Configures Vitest test runner, test environment, and path aliases.
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.{js,ts}"],
    environment: "node",
    globals: false,
    testTimeout: 15_000,
  },
});