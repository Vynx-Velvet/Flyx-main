import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@flyx/core": path.resolve(__dirname, "../core/src/index.ts"),
      "@flyx/core/types": path.resolve(__dirname, "../core/src/types/index.ts"),
      "@flyx/config": path.resolve(__dirname, "../config/src/index.ts"),
      "@flyx/providers": path.resolve(__dirname, "../providers/src/index.ts"),
      "@flyx/providers/providers": path.resolve(__dirname, "../providers/src/providers/index.ts"),
      "@flyx/extractors": path.resolve(__dirname, "../extractors/src/index.ts"),
      "@flyx/extractors/services": path.resolve(__dirname, "../extractors/src/services/index.ts"),
      "@flyx/player": path.resolve(__dirname, "../player/src/index.ts"),
      "@flyx/db": path.resolve(__dirname, "../db/src/index.ts"),
      "@flyx/sync": path.resolve(__dirname, "../sync/src/index.ts"),
      "@flyx/shared": path.resolve(__dirname, "../shared/src/index.ts"),
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
