"use client";

import { useEffect, useState } from "react";

/**
 * Detect Apple platforms (macOS / iOS / iPadOS) for shortcut labels.
 * Defaults to non-Apple until mounted to avoid SSR/hydration mismatch.
 */
export function useIsApple(): boolean {
  const [isApple, setIsApple] = useState(false);

  useEffect(() => {
    const platform =
      (navigator as Navigator & { userAgentData?: { platform?: string } })
        .userAgentData?.platform ||
      navigator.platform ||
      "";
    const ua = navigator.userAgent || "";
    setIsApple(
      /Mac|iPhone|iPad|iPod/i.test(platform) ||
        /Mac OS X|iPhone|iPad|iPod/i.test(ua),
    );
  }, []);

  return isApple;
}

/** Primary modifier for shortcuts: Meta on Apple, Ctrl elsewhere */
export function isModKey(e: KeyboardEvent): boolean {
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } })
      .userAgentData?.platform ||
    navigator.platform ||
    "";
  const apple = /Mac|iPhone|iPad|iPod/i.test(platform);
  return apple ? e.metaKey : e.ctrlKey;
}
