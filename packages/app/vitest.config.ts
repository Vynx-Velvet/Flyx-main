import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    // Aliases match by prefix in insertion order: subpaths must come before
    // their package root or "@flyx/extractors" swallows "@flyx/extractors/services".
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@flyx/core/utils": path.resolve(__dirname, "../core/src/utils/index.ts"),
      "@flyx/core/types": path.resolve(__dirname, "../core/src/types/index.ts"),
      "@flyx/core": path.resolve(__dirname, "../core/src/index.ts"),
      "@flyx/config": path.resolve(__dirname, "../config/src/index.ts"),
      "@flyx/providers/providers": path.resolve(__dirname, "../providers/src/providers/index.ts"),
      "@flyx/providers": path.resolve(__dirname, "../providers/src/index.ts"),
      "@flyx/extractors/services": path.resolve(__dirname, "../extractors/src/services/index.ts"),
      "@flyx/extractors": path.resolve(__dirname, "../extractors/src/index.ts"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 30_000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: ["src/**/*.test.ts"],
    },
  },
});
