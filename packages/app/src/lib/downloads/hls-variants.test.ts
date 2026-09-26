import { describe, it, expect } from "vitest";
import { isGenericQuality, parseMasterVariants, pickVariant, tierLabel, unwrapProxiedUri } from "./hls-variants";

const MASTER = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=682018,CODECS="mp4a.40.2,avc1.42c015",RESOLUTION=640x266
/pl/abc/low/index.m3u8?token=1
#EXT-X-STREAM-INF:BANDWIDTH=2332661,RESOLUTION=1280x534
mid/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=4462464,CODECS="avc1.640028",RESOLUTION=1920x800
https://cdn.example/pl/abc/high/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=4000000,RESOLUTION=1920x800
dupe/index.m3u8
`;

describe("parseMasterVariants", () => {
  it("lists variants highest first with absolute URLs and 'Np' labels", () => {
    const v = parseMasterVariants(MASTER, "https://cdn.example/pl/abc/master.m3u8");
    expect(v.map((x) => x.label)).toEqual(["1080p", "720p", "360p"]);
    expect(v[0]).toMatchObject({ url: "https://cdn.example/pl/abc/high/index.m3u8", bandwidth: 4462464, width: 1920 });
    expect(v[1]!.url).toBe("https://cdn.example/pl/abc/mid/index.m3u8");
    expect(v[2]!.url).toBe("https://cdn.example/pl/abc/low/index.m3u8?token=1");
  });

  it("returns nothing for a media playlist", () => {
    expect(parseMasterVariants("#EXTM3U\n#EXTINF:6,\nseg1.ts\n", "https://h/x.m3u8")).toEqual([]);
  });

  it("labels by bandwidth when RESOLUTION is missing", () => {
    const v = parseMasterVariants("#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1500000\na.m3u8\n", "https://h/m.m3u8");
    expect(v[0]!.label).toBe("1500 kbps");
  });
});

describe("pickVariant", () => {
  const v = parseMasterVariants(MASTER, "https://cdn.example/pl/abc/master.m3u8");
  it("returns the best for generic requests", () => {
    expect(pickVariant(v, undefined)!.label).toBe("1080p");
    expect(pickVariant(v, "Auto")!.label).toBe("1080p");
  });
  it("matches an exact label, else the closest height", () => {
    expect(pickVariant(v, "720p")!.label).toBe("720p");
    expect(pickVariant(v, "480p")!.label).toBe("360p");
    expect(pickVariant(v, "4K")!.label).toBe("1080p");
    expect(pickVariant([], "720p")).toBeNull();
  });
});

describe("tierLabel / unwrapProxiedUri", () => {
  it("labels cinema-ratio and portrait sizes by the familiar tier", () => {
    expect(tierLabel(1920, 800)).toBe("1080p");
    expect(tierLabel(1280, 534)).toBe("720p");
    expect(tierLabel(3840, 1600)).toBe("2160p");
    expect(tierLabel(0, 480)).toBe("480p");
    expect(tierLabel(0, 0)).toBe("Auto");
  });
  it("recovers the upstream URL from a proxy-rewritten playlist line", () => {
    const line = "/api/stream/proxy?referer=https%3A%2F%2Fr%2F&url=https%3A%2F%2Fcdn%2Fpl%2Fx%2Fhigh%2Findex.m3u8%3Ftoken%3Dabc";
    expect(unwrapProxiedUri(line, "https://cdn/pl/x/master.m3u8")).toBe("https://cdn/pl/x/high/index.m3u8?token=abc");
    expect(unwrapProxiedUri("mid/index.m3u8", "https://cdn/pl/x/master.m3u8")).toBe("https://cdn/pl/x/mid/index.m3u8");
  });
  it("parses a proxy-rewritten master", () => {
    const text = "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=4000000,RESOLUTION=1920x800\n/api/stream/proxy?url=https%3A%2F%2Fcdn%2Fhigh.m3u8\n";
    const v = parseMasterVariants(text, "https://cdn/master.m3u8");
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ url: "https://cdn/high.m3u8", label: "1080p" });
  });
});

describe("isGenericQuality", () => {
  it("treats Auto/blank/hls as generic and real labels as specific", () => {
    expect(isGenericQuality("Auto")).toBe(true);
    expect(isGenericQuality("")).toBe(true);
    expect(isGenericQuality(undefined)).toBe(true);
    expect(isGenericQuality("1080p")).toBe(false);
    expect(isGenericQuality("4K")).toBe(false);
  });
});
