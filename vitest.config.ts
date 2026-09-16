import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.{js,ts}"],
    environment: "node",
    globals: false,
    testTimeout: 15_000,
  },
});