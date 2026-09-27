import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "packages/core",
      "packages/config",
      "packages/providers",
      "packages/extractors",
      "packages/app",
      "packages/desktop",
      "packages/cli",
    ],
  },
});
