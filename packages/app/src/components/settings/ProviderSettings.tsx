"use client";

export default function ProviderSettings() {
  return (
    <div className="settings-panel space-y-4 p-1">
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
        <h3 className="font-display text-base font-semibold text-white">Streaming providers</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-white/45">
          Flyx aggregates 20+ free sources with automatic priority fallback. Providers are
          tried in order until a working stream is found.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {["Movies & TV", "Anime", "Live TV", "Sports / PPV"].map((label) => (
            <div
              key={label}
              className="rounded-xl border border-white/[0.06] bg-black/20 px-4 py-3 text-sm text-white/70"
            >
              {label}
              <span className="mt-0.5 block text-[11px] text-[#2ee6c5]/80">Enabled</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
