"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface ContentRailProps {
  title: string;
  subtitle?: string;
  href?: string;
  children: ReactNode;
  className?: string;
  index?: number;
}

export function ContentRail({
  title,
  subtitle,
  href,
  children,
  className = "",
  index = 0,
}: ContentRailProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setCanLeft(el.scrollLeft > 6);
    setCanRight(max > 6 && el.scrollLeft < max - 6);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    updateScrollState();
    const onScroll = () => updateScrollState();
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    const t = window.setTimeout(updateScrollState, 120);
    const t2 = window.setTimeout(updateScrollState, 500);

    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
      window.clearTimeout(t);
      window.clearTimeout(t2);
    };
  }, [updateScrollState, children]);

  const scrollBy = (dir: "left" | "right") => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = Math.min(el.clientWidth * 0.78, 720);
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  return (
    <section
      className={`section ${className}`}
      style={{ animationDelay: `${Math.min(index * 0.07, 0.4)}s` }}
    >
      <div className="section-head">
        <div className="min-w-0">
          <h2>{title}</h2>
          {subtitle && (
            <p className="mt-1 pl-[1rem] text-xs font-medium tracking-wide text-white/38">
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {href && (
            <Link href={href} className="view-all">
              View all
              <span className="ml-1 opacity-70">→</span>
            </Link>
          )}
          <div className="hidden items-center gap-1.5 sm:flex">
            <RailArrow
              dir="left"
              disabled={!canLeft}
              onClick={() => scrollBy("left")}
            />
            <RailArrow
              dir="right"
              disabled={!canRight}
              onClick={() => scrollBy("right")}
            />
          </div>
        </div>
      </div>

      <div
        className="rail-fade"
        data-can-scroll-left={canLeft ? "true" : "false"}
        data-can-scroll-right={canRight ? "true" : "false"}
      >
        <div
          ref={scrollerRef}
          className="rail scrollbar-none"
          aria-label={title}
        >
          {children}
        </div>
      </div>
    </section>
  );
}

function RailArrow({
  dir,
  disabled,
  onClick,
}: {
  dir: "left" | "right";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === "left" ? "Scroll left" : "Scroll right"}
      className="rail-arrow"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={dir === "right" ? "rotate-180" : undefined}
      >
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>
  );
}

export function ContentRailSkeleton({
  title,
  count = 8,
}: {
  title?: string;
  count?: number;
}) {
  return (
    <section className="section">
      <div className="section-head">
        {title ? <h2>{title}</h2> : <div className="skeleton h-7 w-44" />}
        <div className="hidden gap-1.5 sm:flex">
          <div className="skeleton h-9 w-9 rounded-full" />
          <div className="skeleton h-9 w-9 rounded-full" />
        </div>
      </div>
      <div className="rail scrollbar-none">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="skeleton shrink-0 rounded-[1rem]"
            style={{
              width: "clamp(148px, 11vw, 200px)",
              aspectRatio: "2/3",
            }}
          />
        ))}
      </div>
    </section>
  );
}

export default ContentRail;
