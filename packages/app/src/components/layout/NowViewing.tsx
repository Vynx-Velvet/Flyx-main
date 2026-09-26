"use client";

/**
 * NowViewing — the header's "Now viewing" kicker + name. Uses search params
 * (so Movies vs TV Shows on /browse updates instantly), which suspends
 * during static rendering — hence the Suspense wrapper exported below.
 */

import { Suspense } from "react";
import { usePageLabel } from "@/hooks/usePageLabel";

function DesktopLabel() {
  const label = usePageLabel();
  return (
    <div className="desktop-header-context" title={label.name}>
      <span>{label.kicker}</span>
      <strong>{label.name}</strong>
    </div>
  );
}

function MobileLabel() {
  const label = usePageLabel();
  return <strong>{label.name}</strong>;
}

export function NowViewing({ variant }: { variant: "desktop" | "mobile" }) {
  if (variant === "mobile") {
    return (
      <Suspense fallback={<strong>Flyx</strong>}>
        <MobileLabel />
      </Suspense>
    );
  }
  return (
    <Suspense
      fallback={
        <div className="desktop-header-context">
          <span>Now viewing</span>
          <strong>Flyx</strong>
        </div>
      }
    >
      <DesktopLabel />
    </Suspense>
  );
}
