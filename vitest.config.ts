import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts"],
    /**
     * `src/lib/env.ts` validates at import time. Unit tests that pull server modules
     * need a non-empty DATABASE_URL even when no DB is used.
     */
    env: {
      NODE_ENV: "test",
      DATABASE_URL:
        process.env.DATABASE_URL ?? "postgresql://127.0.0.1:5432/mennyu_vitest_placeholder",
      /** Must be set before modules load; `vi.stubEnv` runs too late for `export const env = loadEnv()`. */
      DELIVERECT_API_KEY: "test-key",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./vitest-shims/server-only.js"),
    },
  },
});
