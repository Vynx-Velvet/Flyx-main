import Link from "next/link";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  className?: string;
}

/**
 * EmptyState — Consistent empty/zero-state across all pages.
 * Shows a frosted glass icon container, title, optional description,
 * and optional action button.
 */
export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-20 text-center ${className}`}
      style={{ animation: "rail-fade-in 0.5s var(--ease-out) both" }}
    >
      {/* Icon container */}
      <div
        className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
        }}
      >
        {icon ?? (
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-white/25"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        )}
      </div>

      {/* Title */}
      <h3 className="font-display text-xl font-semibold text-white/55">{title}</h3>

      {/* Description */}
      {description && (
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/30">
          {description}
        </p>
      )}

      {/* Action */}
      {actionLabel && (actionHref || onAction) && (
        <div className="mt-6">
          {actionHref ? (
            <Link href={actionHref} className="btn-secondary">
              {actionLabel}
            </Link>
          ) : onAction ? (
            <button type="button" onClick={onAction} className="btn-secondary">
              {actionLabel}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

/**
 * PageLoader — Consistent loading spinner for page-level suspense boundaries.
 */
export function PageLoader({ message = "Loading..." }: { message?: string }) {
  return (
    <div
      className="flex min-h-[50vh] flex-col items-center justify-center gap-5"
      style={{ animation: "fade-in 0.35s var(--ease-out) both" }}
    >
      <div
        className="flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{
          background: "linear-gradient(135deg, rgba(0,229,191,0.12), rgba(139,124,240,0.08))",
          boxShadow: "0 8px 28px rgba(0,229,191,0.12)",
        }}
      >
        <div
          className="h-6 w-6 animate-spin rounded-full"
          style={{
            border: "2px solid rgba(0,229,191,0.15)",
            borderTopColor: "#00e5bf",
          }}
        />
      </div>
      <p className="text-sm font-medium text-white/35">{message}</p>
    </div>
  );
}

/**
 * ErrorState — Consistent error display with retry action.
 */
export function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this content. Please try again.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div
        className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{
          background: "rgba(248,113,113,0.08)",
          border: "1px solid rgba(248,113,113,0.12)",
        }}
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#f87171"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
      </div>
      <h3 className="font-display text-xl font-semibold text-white/55">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/30">
        {description}
      </p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-secondary mt-6">
          Try Again
        </button>
      )}
    </div>
  );
}
