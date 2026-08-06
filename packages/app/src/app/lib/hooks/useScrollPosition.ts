'use client';
import { useState, useEffect } from 'react';
export function useScrollPosition() {
  const [y, setY] = useState(0);
  useEffect(() => { const h = () => setY(window.scrollY); window.addEventListener('scroll', h, { passive: true }); return () => window.removeEventListener('scroll', h); }, []);
  return y;
}
