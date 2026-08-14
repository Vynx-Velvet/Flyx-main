/**
 * Subtitle text helpers — shared by the subtitle proxy + download routes.
 */

/** Convert SRT cue blocks to VTT (timestamp commas → dots, cue indices dropped). */
export function convertSRTtoVTT(srt: string): string {
  let vtt = "WEBVTT\n\n";
  const normalized = srt.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const blocks = normalized.split(/\n\n+/);
  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 2) continue;
    const tsIdx = lines.findIndex((l) => l.includes("-->"));
    if (tsIdx === -1) continue;
    const timestamp = lines[tsIdx].replace(/,(\d{3})/g, ".$1");
    const text = lines.slice(tsIdx + 1).join("\n");
    vtt += `${timestamp}\n${text}\n\n`;
  }
  return vtt;
}

/**
 * Decode subtitle file bytes. OpenSubtitles zips often contain CP-1252 /
 * latin1 text — try UTF-8 first, fall back to latin1 on replacement chars.
 */
export function decodeSubtitleText(bytes: Uint8Array): string {
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  if (utf8.includes("�")) {
    return new TextDecoder("latin1").decode(bytes);
  }
  return utf8;
}
