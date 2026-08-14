import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "packages/core",
  "packages/config",
  "packages/providers",
  "packages/extractors",
  "packages/app",
  "packages/desktop",
]);
