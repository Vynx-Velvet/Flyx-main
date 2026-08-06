'use client';
import { useState, useEffect } from 'react';
export function useMediaQuery(query) {
  const [m, setM] = useState(false);
  useEffect(() => { const mql = window.matchMedia(query); setM(mql.matches); const h = (e) => setM(e.matches); mql.addEventListener('change', h); return () => mql.removeEventListener('change', h); }, [query]);
  return m;
}
