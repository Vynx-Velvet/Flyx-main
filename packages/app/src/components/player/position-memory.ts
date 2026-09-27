/**
 * Last known good playback position for one piece of content (movie or a
 * specific episode), used to resume after an automatic source fail-over.
 *
 * Fail-over paths can't read the position at the moment they run: by then
 * the failed source has been torn down (`video.src = ""` / hls.destroy()),
 * which resets currentTime to 0 — so without this the next source started
 * from the beginning (e.g. after hls.js's two media-error recoveries).
 */
export class PositionMemory {
  private key = "";
  private t = 0;

  /** timeupdate: record forward progress. Near-zero readings are ignored —
   * they come from a freshly loaded source before its resume seek. */
  onProgress(key: string, time: number): void {
    if (!key || !Number.isFinite(time) || time <= 2) return;
    this.key = key;
    this.t = time;
  }

  /** seeked: a completed seek is a deliberate position (user scrub, restart,
   * or our own resume seek), so trust it even near 0. */
  onSeeked(key: string, time: number): void {
    if (!key || !Number.isFinite(time) || time < 0) return;
    this.key = key;
    this.t = time;
  }

  /** Where a fail-over for `key` should resume, or null to start fresh. */
  resumeAt(key: string): number | null {
    return key && this.key === key && this.t > 2 ? this.t : null;
  }
}
