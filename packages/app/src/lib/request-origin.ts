import type { NextRequest } from "next/server";

/**
 * The origin the client actually used to reach us.
 *
 * Next's standalone server builds request URLs from HOSTNAME (0.0.0.0 when
 * LAN sharing is on) instead of the Host header, so `new URL(request.url)`
 * would redirect LAN clients to a non-routable http://0.0.0.0:3891 address.
 * Use the Host header (+ forwarded proto for https deployments) instead.
 *
 * The Host header is client-controlled; it is safe to reflect here only
 * because the middleware rejects hosts outside its allowlist (see
 * isAllowedHost in middleware.ts). x-forwarded-proto is honored only when it
 * is exactly "http" or "https".
 */
export function requestOrigin(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured;

  const host = request.headers.get("host");
  if (host) {
    const fwd = request.headers.get("x-forwarded-proto")?.trim().toLowerCase();
    const proto = fwd === "https" || fwd === "http" ? fwd : "http";
    return `${proto}://${host}`;
  }

  return new URL(request.url).origin;
}

// ─── Host allowlist / cross-site request checks (edge-safe) ──────────

/** Hostname part of a Host header value, lowercased, without port or trailing dot. */
export function hostnameOf(hostHeader: string): string {
  let h = hostHeader.trim().toLowerCase();
  if (h.startsWith("[")) {
    const end = h.indexOf("]");
    h = end === -1 ? h : h.slice(0, end + 1);
  } else {
    const colon = h.lastIndexOf(":");
    if (colon !== -1 && h.indexOf(":") === colon) h = h.slice(0, colon);
  }
  return h.endsWith(".") ? h.slice(0, -1) : h;
}

/**
 * One FLYX_ALLOWED_HOSTS entry as a bare hostname. Accepts what people paste:
 * "mypc.ts.net", "mypc.ts.net:3891" or "https://mypc.ts.net:3891/watch".
 * Returns "" for garbage.
 */
export function normalizeHostEntry(entry: string): string {
  const e = entry.trim();
  if (!e) return "";
  if (e === "*") return "*";
  if (e.includes("://")) {
    try {
      return hostnameOf(new URL(e).host);
    } catch {
      return "";
    }
  }
  return hostnameOf(e.split("/")[0]);
}

function isIpLiteral(hostname: string): boolean {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return true;
  return /^\[[0-9a-f:.]+(%[0-9a-z]+)?\]$/.test(hostname);
}

function configuredHosts(): string[] {
  const out: string[] = [];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    try {
      out.push(new URL(appUrl).hostname.toLowerCase());
    } catch {
      /* ignore malformed */
    }
  }
  for (const entry of (process.env.FLYX_ALLOWED_HOSTS ?? "").split(",")) {
    const h = normalizeHostEntry(entry);
    if (h) out.push(h);
  }
  return out;
}

/**
 * DNS-rebinding guard: a malicious site can point its own domain at a LAN
 * IP, but the browser still sends *its* domain as Host. Allow only names a
 * self-hosted server is legitimately reached by — IP literals, localhost,
 * mDNS (.local), bare machine names — plus NEXT_PUBLIC_APP_URL's host and
 * anything in FLYX_ALLOWED_HOSTS (comma-separated; "*" disables the check).
 */
export function isAllowedHost(hostHeader: string | null | undefined): boolean {
  if (!hostHeader) return true; // no Host → nothing to rebind
  const host = hostnameOf(hostHeader);
  if (!host) return true;
  if (isIpLiteral(host)) return true;
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
  if (!host.includes(".")) return true;
  const allowed = configuredHosts();
  return allowed.includes("*") || allowed.includes(host);
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF guard for state-changing requests: reject a browser request whose
 * Origin names a different host than the one it was sent to, or that the
 * browser itself labels cross-site. The Origin may also match
 * x-forwarded-host (reverse proxies that rewrite Host — a cross-site page
 * can't set that header without a CORS preflight) or a configured host.
 */
export function isCrossSiteMutation(request: Request): boolean {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return false;
  if (request.headers.get("sec-fetch-site")?.toLowerCase() === "cross-site") return true;

  const origin = request.headers.get("origin");
  if (!origin) return false; // non-browser client (curl, Electron main process)

  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return true; // "null" (sandboxed iframe, file://) or garbage
  }
  if (!originHost) return true;

  const host = request.headers.get("host")?.trim().toLowerCase();
  if (host && originHost === host) return false;
  const fwdHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim().toLowerCase();
  if (fwdHost && originHost === fwdHost) return false;
  // "*" relaxes the Host allowlist only — it never whitelists every Origin.
  const allowed = configuredHosts().filter((h) => h !== "*");
  return !allowed.includes(hostnameOf(originHost));
}

/**
 * True for a state-changing request that carries a body that isn't JSON.
 * Every Flyx API that accepts a body takes JSON; requiring it means a
 * cross-site "simple" form/no-cors POST (text/plain, form-encoded) can't
 * reach a handler.
 */
export function hasNonJsonBody(request: Request): boolean {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return false;
  const len = request.headers.get("content-length");
  const hasBody =
    (len !== null && len.trim() !== "" && len.trim() !== "0") ||
    request.headers.has("transfer-encoding");
  if (!hasBody) return false;
  const type = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  return type !== "application/json";
}
