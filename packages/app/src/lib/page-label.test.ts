import { describe, it, expect } from "vitest";
import { cleanDocumentTitle, isTitlePage, pageLabel } from "./page-label";

describe("pageLabel", () => {
  it("names browse pages by type instead of a generic Explore", () => {
    expect(pageLabel("/browse", "?type=movie")).toEqual({ kicker: "Browsing", name: "Movies" });
    expect(pageLabel("/browse", "type=tv")).toEqual({ kicker: "Browsing", name: "TV Shows" });
    expect(pageLabel("/browse", "?type=tv&genre=Drama").name).toBe("TV Shows · Drama");
    expect(pageLabel("/browse").name).toBe("Movies & TV");
  });

  it("uses the document title on details pages once it is known", () => {
    expect(pageLabel("/details/550", "?type=movie", "")).toEqual({ kicker: "Now viewing", name: "Title details" });
    expect(pageLabel("/details/550", "?type=movie", "Fight Club")).toEqual({ kicker: "Movie", name: "Fight Club" });
    expect(pageLabel("/details/1399", "?type=tv", "Game of Thrones")).toEqual({ kicker: "Series", name: "Game of Thrones" });
    expect(pageLabel("/anime/21", "", "One Piece")).toEqual({ kicker: "Anime", name: "One Piece" });
    expect(pageLabel("/manga/abc", "", "Berserk")).toEqual({ kicker: "Manga", name: "Berserk" });
  });

  it("shows the search term", () => {
    expect(pageLabel("/search", "?q=alien").name).toBe("“alien”");
    expect(pageLabel("/search").name).toBe("Search");
  });

  it("keeps plain section names elsewhere", () => {
    expect(pageLabel("/").name).toBe("Home");
    expect(pageLabel("/livetv").name).toBe("Live TV");
    expect(pageLabel("/anime").name).toBe("Anime");
    expect(pageLabel("/settings").name).toBe("Settings");
    expect(pageLabel("/nowhere").name).toBe("Flyx");
  });
});

describe("cleanDocumentTitle / isTitlePage", () => {
  it("strips the Flyx suffix and ignores the bare app title", () => {
    expect(cleanDocumentTitle("Fight Club | Flyx")).toBe("Fight Club");
    expect(cleanDocumentTitle("One Piece — Flyx")).toBe("One Piece");
    expect(cleanDocumentTitle("Flyx")).toBe("");
    expect(cleanDocumentTitle(null)).toBe("");
  });
  it("recognises title pages only", () => {
    expect(isTitlePage("/details/550")).toBe(true);
    expect(isTitlePage("/anime/21")).toBe(true);
    expect(isTitlePage("/anime")).toBe(false);
    expect(isTitlePage("/browse")).toBe(false);
  });
});
