'use client';

import { useState, useEffect } from 'react';

export interface MobileInfo {
  isMobile: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isSafari: boolean;
  isChrome: boolean;
  isTablet: boolean;
  supportsTouchEvents: boolean;
  screenWidth: number;
  screenHeight: number;
  isLandscape: boolean;
}

const defaultInfo: MobileInfo = {
  isMobile: false,
  isIOS: false,
  isAndroid: false,
  isSafari: false,
  isChrome: false,
  isTablet: false,
  supportsTouchEvents: false,
  screenWidth: 0,
  screenHeight: 0,
  isLandscape: false,
};

function readMobileInfo(): MobileInfo {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return defaultInfo;
  }

  const ua = navigator.userAgent.toLowerCase();
  const platform = (navigator.platform || '').toLowerCase();
  const width = window.innerWidth;
  const height = window.innerHeight;

  const isIOS =
    /iphone|ipad|ipod/.test(ua) ||
    (platform === 'macintel' && navigator.maxTouchPoints > 1);
  const isAndroid = /android/.test(ua);
  const isSafari = /safari/.test(ua) && !/chrome|chromium|crios|edg/.test(ua);
  const isChrome = /chrome|crios|chromium/.test(ua) && !/edg/.test(ua);
  const isTablet =
    /ipad/.test(ua) ||
    (isAndroid && !/mobile/.test(ua)) ||
    (navigator.maxTouchPoints > 1 && width >= 768);
  const supportsTouchEvents =
    'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isMobile =
    isIOS ||
    isAndroid ||
    /mobi|phone|windows phone/.test(ua) ||
    (supportsTouchEvents && width < 768);

  return {
    isMobile,
    isIOS,
    isAndroid,
    isSafari,
    isChrome,
    isTablet,
    supportsTouchEvents,
    screenWidth: width,
    screenHeight: height,
    isLandscape: width > height,
  };
}

/**
 * Device / viewport info for choosing mobile vs desktop player.
 * Returns a stable object shape (not a bare boolean).
 */
export function useIsMobile(): MobileInfo {
  const [info, setInfo] = useState<MobileInfo>(defaultInfo);

  useEffect(() => {
    const update = () => setInfo(readMobileInfo());
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return info;
}
