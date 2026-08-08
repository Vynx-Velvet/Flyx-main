'use client';
import { useState, useEffect } from 'react';
export function useMediaQuery(query: string) {
  const [m, setM] = useState(false);
  useEffect(() => { const mql = window.matchMedia(query); setM(mql.matches); const h = (e: MediaQueryListEvent) => setM(e.matches); mql.addEventListener('change', h); return () => mql.removeEventListener('change', h); }, [query]);
  return m;
}
