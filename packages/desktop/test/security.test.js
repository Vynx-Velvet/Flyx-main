import { describe, it, expect } from "vitest";
import {
  appOrigin,
  isAppUrl,
  isTrustedSender,
  classifyNavigation,
  isPermissionAllowed,
  stripQuery,
  redactUrls,
} from "../src/security.js";

const PORT = 3891;
const ev = (url) => ({ senderFrame: url === undefined ? null : { url } });

describe("isTrustedSender", () => {
  it("trusts only frames on http://127.0.0.1:<currentPort>", () => {
    expect(appOrigin(PORT)).toBe("http://127.0.0.1:3891");
    expect(isTrustedSender(ev("http://127.0.0.1:3891/settings?tab=updates"), PORT)).toBe(true);
    expect(isTrustedSender(ev("http://127.0.0.1:3891"), PORT)).toBe(true);
  });

  it("rejects other origins, ports, schemes and missing frames", () => {
    for (const url of [
      "http://localhost:3891/", // may be [::1] — a different listener
      "http://[::1]:3891/",
      "http://127.0.0.1:3892/",
      "https://127.0.0.1:3891/",
      "http://192.168.1.5:3891/",
      "https://www.youtube.com/embed/x",
      "data:text/html,hi",
      "file:///C:/x.html",
      "",
    ]) {
      expect(isTrustedSender(ev(url), PORT), url).toBe(false);
    }
    expect(isTrustedSender(ev(undefined), PORT)).toBe(false); // destroyed frame
    expect(isTrustedSender({}, PORT)).toBe(false);
    expect(isTrustedSender(null, PORT)).toBe(false);
  });

  it("isAppUrl tolerates garbage", () => {
    expect(isAppUrl("not a url", PORT)).toBe(false);
    expect(isAppUrl(undefined, PORT)).toBe(false);
  });
});

describe("classifyNavigation", () => {
  const restart = "data:text/html;charset=utf-8,%3Chtml%3E";

  it("allows the app origin and the exact restart page", () => {
    expect(classifyNavigation("http://127.0.0.1:3891/watch?tmdbId=1", PORT)).toEqual({ action: "allow" });
    expect(classifyNavigation(restart, PORT, { allowExact: [restart] })).toEqual({ action: "allow" });
    expect(classifyNavigation("data:text/html,<script>evil()</script>", PORT, { allowExact: [restart] })).toEqual({
      action: "block",
    });
  });

  it("re-pins loopback spellings of our own server to 127.0.0.1", () => {
    expect(classifyNavigation("http://localhost:3891/login?next=%2F#x", PORT)).toEqual({
      action: "rewrite",
      url: "http://127.0.0.1:3891/login?next=%2F#x",
    });
    expect(classifyNavigation("http://0.0.0.0:3891/", PORT).action).toBe("rewrite");
    expect(classifyNavigation("http://[::1]:3891/", PORT).action).toBe("rewrite");
    // Different port → not ours
    expect(classifyNavigation("http://localhost:4000/", PORT).action).toBe("block");
  });

  it("sends https elsewhere to the OS browser and blocks every other scheme", () => {
    expect(classifyNavigation("https://github.com/Vynx-Velvet/Flyx-main/releases", PORT)).toEqual({
      action: "external",
      url: "https://github.com/Vynx-Velvet/Flyx-main/releases",
    });
    for (const url of [
      "http://evil.example/",
      "http://192.168.1.5:3891/",
      "file:///C:/Windows/System32/calc.exe",
      "smb://host/share",
      "ms-settings:privacy",
      "vlc://x",
      "javascript:alert(1)",
      "not a url",
    ]) {
      expect(classifyNavigation(url, PORT).action, url).toBe("block");
    }
  });
});

describe("isPermissionAllowed", () => {
  it("allows only the permissions the app uses, only on the app origin", () => {
    const topUrl = "http://127.0.0.1:3891/watch";
    for (const p of ["fullscreen", "clipboard-sanitized-write", "mediaKeySystem"]) {
      expect(isPermissionAllowed(p, { topUrl, port: PORT }), p).toBe(true);
      expect(isPermissionAllowed(p, { topUrl: "https://evil.example/", port: PORT }), p).toBe(false);
    }
    for (const p of [
      "media",
      "geolocation",
      "notifications",
      "midi",
      "midiSysex",
      "clipboard-read",
      "openExternal",
      "hid",
      "serial",
      "usb",
      "pointerLock",
      "display-capture",
    ]) {
      expect(isPermissionAllowed(p, { topUrl, port: PORT }), p).toBe(false);
    }
  });
});

describe("log redaction", () => {
  it("strips query strings and fragments", () => {
    expect(stripQuery("http://127.0.0.1:3891/api/stream/proxy?url=https%3A%2F%2Fcdn&sig=abc")).toBe(
      "http://127.0.0.1:3891/api/stream/proxy?…",
    );
    expect(stripQuery("http://127.0.0.1:3891/watch")).toBe("http://127.0.0.1:3891/watch");
    expect(stripQuery(undefined)).toBe("");
  });

  it("redacts URLs inside free-form console messages", () => {
    expect(redactUrls("[HLS] loading http://127.0.0.1:3891/api/stream/proxy?url=x&sig=y failed")).toBe(
      "[HLS] loading http://127.0.0.1:3891/api/stream/proxy?… failed",
    );
    expect(redactUrls("no urls here")).toBe("no urls here");
  });
});
