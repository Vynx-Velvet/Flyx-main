/**
 * Same-origin redirect validation (edge- and browser-safe: no Node imports).
 *
 * Returns a root-relative path ("/foo?x=1#h") when `target` resolves to the
 * same origin as `base`, otherwise `fallback`. Control characters are
 * rejected outright — the URL parser silently strips tabs/newlines, which
 * is how "/\t/evil.com" becomes "//evil.com".
 */
export function safeRedirectPath(
  target: string | null | undefined,
  fallback = "/",
  base = "http://flyx.invalid",
): string {
  if (!target || typeof target !== "string") return fallback;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\\]/.test(target)) return fallback;
  if (!target.startsWith("/") || target.startsWith("//")) return fallback;
  let resolved: URL;
  try {
    resolved = new URL(target, base);
  } catch {
    return fallback;
  }
  if (resolved.origin !== new URL(base).origin) return fallback;
  return `${resolved.pathname}${resolved.search}${resolved.hash}`;
}
