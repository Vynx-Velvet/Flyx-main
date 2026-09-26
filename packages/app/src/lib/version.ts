/**
 * The running release version, baked in at build time from
 * packages/app/package.json (see next.config.ts → env.NEXT_PUBLIC_APP_VERSION).
 * Shared by the sidebar badge, the health endpoint and anything else that
 * shows "what am I running".
 */
export const APP_VERSION: string = process.env.NEXT_PUBLIC_APP_VERSION || "0.0.0";

/** "v3.1.0" */
export const APP_VERSION_LABEL = `v${APP_VERSION}`;
