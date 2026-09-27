/**
 * Wait until the server answers /api/health again after a settings save
 * restarted it (the desktop app restarts the server on any .env change).
 * Works from the desktop window (via its bridge) and from LAN browsers
 * (polling). Resolves after `timeoutMs` regardless.
 */

interface FlyxDesktopBridge {
  isDesktop: boolean;
  onServerReady: (cb: () => void) => void;
}

export function waitForServerReady(timeoutMs = 30000): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(startPolling);
      clearInterval(iv);
      clearTimeout(timer);
      resolve();
    };

    const bridge = (window as unknown as { flyxDesktop?: FlyxDesktopBridge }).flyxDesktop;
    if (bridge) bridge.onServerReady(finish);

    // Start polling after a moment: right after the save the old server is
    // still up and would answer before the restart has even begun.
    let iv: ReturnType<typeof setInterval> | undefined;
    const startPolling = setTimeout(() => {
      iv = setInterval(async () => {
        try {
          const r = await fetch("/api/health", { cache: "no-store" });
          if (r.ok) finish();
        } catch {
          /* server still down */
        }
      }, 1000);
    }, 2500);
    const timer = setTimeout(finish, timeoutMs);
  });
}
