"use client";

/**
 * usePageLabel — "Now viewing" label for the headers.
 *
 * Reads the route and query (via Next's search params, so switching between
 * /browse?type=movie and /browse?type=tv — same path, different query — is
 * picked up immediately) and, on title pages, the document title the page
 * sets once its data loads.
 *
 * `useSearchParams` suspends during static rendering, so render the caller
 * inside a <Suspense> boundary (see components/layout/NowViewing.tsx).
 */

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { cleanDocumentTitle, isTitlePage, pageLabel, type PageLabel } from "@/lib/page-label";

export function usePageLabel(): PageLabel {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ?? "";
  const [docTitle, setDocTitle] = useState("");

  // Document title on title pages (set by the page after its fetch).
  useEffect(() => {
    if (!isTitlePage(pathname)) {
      setDocTitle("");
      return;
    }
    const sync = () => setDocTitle(cleanDocumentTitle(document.title));
    sync();
    const titleEl = document.querySelector("title");
    const observer = new MutationObserver(sync);
    if (titleEl) observer.observe(titleEl, { childList: true, characterData: true, subtree: true });
    observer.observe(document.head, { childList: true });
    // Some pages assign document.title before the <title> node exists.
    const poll = window.setInterval(sync, 800);
    const stop = window.setTimeout(() => window.clearInterval(poll), 15_000);
    return () => {
      observer.disconnect();
      window.clearInterval(poll);
      window.clearTimeout(stop);
    };
  }, [pathname, search]);

  return pageLabel(pathname, search, docTitle);
}
