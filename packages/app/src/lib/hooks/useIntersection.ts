'use client';

import { useRef, useEffect, useState, useCallback } from 'react';

export interface UseIntersectionOptions {
  threshold?: number;
  rootMargin?: string;
  freezeOnceVisible?: boolean;
}

/**
 * useIntersection - Hook that observes element visibility
 * Useful for lazy loading, animations, and analytics tracking
 */
export function useIntersection<T extends HTMLElement = HTMLDivElement>(
  options: UseIntersectionOptions = {}
) {
  const { threshold = 0, rootMargin = '0px', freezeOnceVisible = false } = options;
  const ref = useRef<T>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);

  const frozen = useRef(false);

  const callback = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      const isVisible = entry.isIntersecting;

      if (freezeOnceVisible && frozen.current) return;

      setIsIntersecting(isVisible);
      setEntry(entry);

      if (freezeOnceVisible && isVisible) {
        frozen.current = true;
      }
    },
    [freezeOnceVisible]
  );

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(callback, {
      threshold,
      rootMargin,
    });

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [callback, threshold, rootMargin]);

  return { ref, isIntersecting, entry };
}
