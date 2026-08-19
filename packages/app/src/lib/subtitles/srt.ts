/**
 * Subtitle text helpers — shared by the subtitle proxy + download routes and
 * the in-player subtitle uploader.
 */

/** Normalize line endings and strip a leading BOM so SRT/VTT text parses cleanly. */
function normalizeText(text: string): string {
  return text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
}

/** Drop tags WebVTT won't render while keeping the text inside them. */
function cleanCueText(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, "\n") // HTML line breaks → VTT newlines
    .replace(/<\/?(font|span)\b[^>]*>/gi, "") // unsupported inline tags
    .replace(/\{[^}]*\}/g, "") // ASS-style override blocks
    .trim();
}

/**
 * Convert SRT cue blocks to VTT (timestamp commas → dots, cue indices dropped).
 * Handles CRLF/CR/LF, BOMs, whitespace-only separators, and SRT position hints.
 */
export function convertSRTtoVTT(srt: string): string {
  const normalized = normalizeText(srt);
  const blocks = normalized.split(/\n[ \t]*\n+/);
  const out: string[] = ["WEBVTT", ""];
  for (const block of blocks) {
    const lines = block.split("\n").filter((l) => l.trim().length > 0);
    const tsIdx = lines.findIndex((l) => l.includes("-->"));
    if (tsIdx === -1) continue;
    const timestamp = lines[tsIdx]
      .replace(/,(\d{3})/g, ".$1")
      .replace(/\s+(X1|X2|Y1|Y2):[^\s]+.*$/i, "");
    const text = cleanCueText(lines.slice(tsIdx + 1).join("\n"));
    if (!text) continue;
    out.push(timestamp, text, "");
  }
  return out.join("\n") + "\n";
}

/**
 * Ensure `vtt` is a valid WebVTT document — prepend the `WEBVTT` header if the
 * file (or a converted SRT) is missing it, so the browser's native <track> can
 * parse it.
 */
export function normalizeVTT(vtt: string): string {
  const text = normalizeText(vtt).trimStart();
  if (/^WEBVTT([ \t]|\n)/.test(text)) return text.trimEnd() + "\n";
  return `WEBVTT\n\n${text.trimEnd()}\n`;
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
