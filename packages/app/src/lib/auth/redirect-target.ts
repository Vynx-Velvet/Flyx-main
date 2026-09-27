import { safeRedirectPath } from "@/lib/security/safe-redirect";

/**
 * Same-origin page path to land on after sign-in, or null. Never an
 * API/setup/login target (edge- and browser-safe).
 */
export function postLoginPath(redirectParam: string | null | undefined): string | null {
  const path = safeRedirectPath(redirectParam, "");
  if (!path) return null;
  if (/^\/(api|setup|login)(\/|\?|#|$)/.test(path)) return null;
  return path;
}
