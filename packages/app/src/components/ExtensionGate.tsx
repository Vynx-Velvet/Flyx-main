"use client";

import type { ReactNode } from "react";

/**
 * ExtensionGate — passthrough wrapper for surfaces that may later require
 * the browser extension. Always renders children in 3.0 for now.
 */
export function ExtensionGate({
  children,
}: {
  children: ReactNode;
  type?: string;
  fallback?: ReactNode;
}) {
  return <>{children}</>;
}

export default ExtensionGate;
