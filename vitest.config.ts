import path from "path";
import { defineConfig } from "vitest/config";

// Unit-test suite for the colocated *.test.ts files under server/, shared/,
// and client/. The legacy IDX integration suite (test/**) stays on jest
// (`npm run idx:test`); keep the two runners' globs disjoint.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    include: [
      "server/**/*.test.{ts,tsx}",
      "shared/**/*.test.{ts,tsx}",
      "client/src/**/*.test.{ts,tsx}",
    ],
    setupFiles: ["./vitest.setup.ts"],
  },
});
