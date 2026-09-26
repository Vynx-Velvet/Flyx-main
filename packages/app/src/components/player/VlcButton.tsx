'use client';

/** Traffic-cone glyph used for the VLC hand-off controls. */
export function IconVlc({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 3h6l3 13H6L9 3Z" />
      <path d="M4 16h16l1 4H3l1-4Z" />
      <path d="M8 9h8" />
    </svg>
  );
}
