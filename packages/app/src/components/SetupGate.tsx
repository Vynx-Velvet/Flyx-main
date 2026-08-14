"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Desktop first-run gate: pins the Electron master window to /setup until
 * setup completes (SETUP_COMPLETE=true in the server env).
 *
 * Why client-side (not middleware): the Next middleware runs in the edge
 * runtime, which never sees the in-memory process.env mutations that
 * api/setup/save makes — a middleware pin would keep bouncing the master to
 * /setup even after the wizard saved. /api/network runs in the Node runtime,
 * so its `setupComplete` flips true immediately after a save; auto-login
 * covers the unauthenticated master (Node runtime too), and this gate covers
 * an already-authenticated master with a stale session cookie.
 *
 * Only the Electron window acts: it is the sole client with the
 * window.flyxDesktop bridge. LAN browsers (even signed-in ones) never get
 * bounced to the wizard — setup is master-only.
 */
export default function SetupGate() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const bridge = (window as unknown as { flyxDesktop?: { isDesktop: boolean } })
      .flyxDesktop;
    if (!bridge?.isDesktop) return;

    if (pathname === "/setup" || pathname.startsWith("/setup/")) return;

    let cancelled = false;
    fetch("/api/network")
      .then((res) => res.json())
      .then((info: { desktop?: boolean; setupComplete?: boolean }) => {
        if (cancelled) return;
        if (info.desktop && !info.setupComplete) {
          router.replace("/setup");
        }
      })
      .catch(() => {}); // server hiccup — the auto-login path still covers us

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  return null;
}
