"use client";

export default function SyncSettings() {
  return (
    <div className="settings-panel space-y-4 p-1">
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
        <h3 className="font-display text-base font-semibold text-white">Cross-device sync</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-white/45">
          Pair devices with a sync code to share watchlists, progress, and preferences.
          Full sync worker integration is available when the sync service is deployed.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="meta-chip">Local storage active</span>
          <span className="meta-chip">No account required</span>
        </div>
      </div>
    </div>
  );
}
