// ESLint flat config (ESLint 9). Replaces the legacy .eslintrc.cjs, which
// referenced @typescript-eslint packages that were never installed, so lint
// never actually ran. Rules favour catching bugs over enforcing style —
// formatting is Prettier's job (eslint-config-prettier turns off clashes).
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import nextPlugin from "@next/eslint-plugin-next";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/coverage/**",
      "**/*.config.*",
      "packages/desktop/build/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["packages/*/src/**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { "react-hooks": reactHooks, "@next/next": nextPlugin },
    settings: { next: { rootDir: "packages/app/" } },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      // Plain <img> is deliberate: posters come from TMDB/provider CDNs or our
      // own proxies, and next/image would route them through the Next image
      // optimizer (sharp/libvips), which has had RCE advisories. Not needed here.
      "@next/next/no-img-element": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // `cond ? a() : b()` / `x && y()` are deliberate idioms here.
      "@typescript-eslint/no-unused-expressions": ["error", { allowShortCircuit: true, allowTernary: true }],
      "no-empty": ["error", { allowEmptyCatch: true }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_", caughtErrors: "none" },
      ],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "no-console": "off",
    },
  },
  {
    // Desktop main process + CLI: plain CommonJS on Node.
    files: ["packages/{desktop,cli}/**/*.{js,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: { ...globals.node },
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      // `const crypto = require("crypto")` legitimately shadows the global.
      "no-redeclare": ["error", { builtinGlobals: false }],
      "no-empty": ["error", { allowEmptyCatch: true }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
    },
  },
  {
    // Desktop/CLI tests are ESM run by vitest.
    files: ["packages/{desktop,cli}/test/**/*.{js,mjs}"],
    languageOptions: { sourceType: "module", globals: { ...globals.node } },
  },
  {
    files: ["**/*.test.{ts,tsx,js}", "packages/app/src/test/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
  prettier,
);
