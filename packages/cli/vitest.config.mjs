import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.mjs"],
    // CLI modules read FLYX_DATA_DIR at load time; each test file loads them
    // fresh against its own temp dir, so keep files isolated.
    pool: "forks",
  },
});
