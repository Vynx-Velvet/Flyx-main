/**
 * AniList GraphQL — reliable server-side fallback when Jikan is down.
 * Maps responses into Jikan-shaped `{ data: [...] }` for the client.
 */

const ANILIST = "https://graphql.anilist.co";

export async function anilistQuery<T = any>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T | null> {
  try {
    const res = await fetch(ANILIST, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query, variables }),
      // Avoid Next data-cache quirks for external GraphQL
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.errors?.length) {
      console.warn("[AniList]", json.errors[0]?.message);
      return null;
    }
    return json.data as T;
  } catch (e) {
    console.warn("[AniList] fetch failed", e);
    return null;
  }
}

function mapMedia(m: any) {
  if (!m) return null;
  const malId = m.idMal || m.id;
  if (!malId) return null;

  // Strip HTML from AniList descriptions
  const synopsis = m.description
    ? String(m.description)
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&amp;/g, "&")
        .trim()
    : null;

  const score =
    m.averageScore != null ? Math.round((m.averageScore / 10) * 10) / 10 : null;

  const formatMap: Record<string, string> = {
    TV: "TV",
    TV_SHORT: "TV",
    MOVIE: "Movie",
    SPECIAL: "Special",
    OVA: "OVA",
    ONA: "ONA",
    MUSIC: "Music",
  };

  const statusMap: Record<string, string> = {
    FINISHED: "Finished Airing",
    RELEASING: "Currently Airing",
    NOT_YET_RELEASED: "Not yet aired",
    CANCELLED: "Cancelled",
    HIATUS: "Hiatus",
  };

  return {
    mal_id: malId,
    title: m.title?.romaji || m.title?.english || m.title?.native || "Untitled",
    title_english: m.title?.english || null,
    title_japanese: m.title?.native || null,
    synopsis,
    score,
    scored_by: m.popularity ?? null,
    year: m.seasonYear ?? null,
    season: m.season ? String(m.season).toLowerCase() : null,
    type: formatMap[m.format] || m.format || null,
    episodes: m.episodes ?? null,
    duration: m.duration ? `${m.duration} min` : null,
    status: statusMap[m.status] || m.status || null,
    rating: m.isAdult ? "R+" : null,
    genres: (m.genres || []).map((name: string, i: number) => ({
      mal_id: i + 1,
      name,
    })),
    studios: (m.studios?.nodes || []).map((s: any) => ({
      mal_id: s.id,
      name: s.name,
    })),
    images: {
      jpg: {
        image_url: m.coverImage?.large || m.coverImage?.medium || "",
        large_image_url:
          m.coverImage?.extraLarge || m.coverImage?.large || "",
      },
      webp: {
        image_url: m.coverImage?.large || "",
        large_image_url:
          m.coverImage?.extraLarge || m.coverImage?.large || "",
      },
    },
    trailer: m.trailer?.id
      ? {
          youtube_id: m.trailer.site === "youtube" ? m.trailer.id : null,
          url: null,
          embed_url: null,
        }
      : undefined,
    aired: {
      from: m.startDate?.year
        ? `${m.startDate.year}-${String(m.startDate.month || 1).padStart(2, "0")}-01`
        : undefined,
      string: m.seasonYear ? String(m.seasonYear) : undefined,
    },
    // extras for full page
    background: m.bannerImage || null,
    source: m.source || null,
    // AniList id if needed later
    anilist_id: m.id,
    // Franchise relations (Jikan-shaped)
    relations: mapRelations(m.relations),
  };
}

const RELATION_LABEL: Record<string, string> = {
  ADAPTATION: "Adaptation",
  PREQUEL: "Prequel",
  SEQUEL: "Sequel",
  PARENT: "Parent",
  SIDE_STORY: "Side story",
  CHARACTER: "Character",
  SUMMARY: "Summary",
  ALTERNATIVE: "Alternative",
  SPIN_OFF: "Spin-off",
  OTHER: "Other",
  SOURCE: "Source",
  COMPILATION: "Compilation",
  CONTAINS: "Contains",
};

function mapRelations(relations: any): Array<{
  relation: string;
  entry: Array<{
    mal_id: number;
    type: string;
    name: string;
    url?: string;
    images?: any;
  }>;
}> | undefined {
  const edges = relations?.edges;
  if (!Array.isArray(edges) || edges.length === 0) return undefined;

  // Group by relation type (Jikan shape)
  const groups = new Map<
    string,
    Array<{
      mal_id: number;
      type: string;
      name: string;
      url?: string;
      images?: any;
    }>
  >();

  for (const edge of edges) {
    const node = edge?.node;
    if (!node) continue;
    // Skip manga / non-anime
    if (node.type && node.type !== "ANIME") continue;
    const malId = node.idMal || node.id;
    if (!malId) continue;
    const label =
      RELATION_LABEL[edge.relationType] || edge.relationType || "Related";
    const entry = {
      mal_id: malId,
      type: "anime",
      name:
        node.title?.english ||
        node.title?.romaji ||
        node.title?.native ||
        "Untitled",
      images: {
        jpg: {
          image_url: node.coverImage?.large || node.coverImage?.medium || "",
          large_image_url:
            node.coverImage?.extraLarge || node.coverImage?.large || "",
        },
        webp: {
          image_url: node.coverImage?.large || "",
          large_image_url:
            node.coverImage?.extraLarge || node.coverImage?.large || "",
        },
      },
    };
    const list = groups.get(label) || [];
    list.push(entry);
    groups.set(label, list);
  }

  if (groups.size === 0) return undefined;
  return [...groups.entries()].map(([relation, entry]) => ({
    relation,
    entry,
  }));
}

function mapRecommendationNodes(recs: any): any[] {
  const nodes = recs?.nodes;
  if (!Array.isArray(nodes)) return [];
  return nodes
    .map((n: any) => n?.mediaRecommendation)
    .filter(Boolean)
    .map((m: any) => mapMedia(m))
    .filter(Boolean);
}

const MEDIA_FIELDS = `
  id
  idMal
  title { romaji english native }
  coverImage { extraLarge large medium }
  bannerImage
  averageScore
  popularity
  seasonYear
  season
  format
  episodes
  duration
  status
  isAdult
  description(asHtml: false)
  genres
  source
  trailer { id site }
  startDate { year month day }
  studios { nodes { id name } }
`;

const FULL_MEDIA_FIELDS = `
  ${MEDIA_FIELDS}
  relations {
    edges {
      relationType
      node {
        id
        idMal
        type
        title { romaji english native }
        coverImage { extraLarge large medium }
        averageScore
        format
        seasonYear
        episodes
        status
      }
    }
  }
`;

export async function anilistPage(
  sort: string[],
  perPage: number,
  extra: Record<string, unknown> = {},
) {
  const data = await anilistQuery<{
    Page: { media: any[] };
  }>(
    `query ($page: Int, $perPage: Int, $sort: [MediaSort], $type: MediaType, $status: MediaStatus, $format: MediaFormat, $genre: String, $search: String, $isAdult: Boolean) {
      Page(page: $page, perPage: $perPage) {
        media(
          type: $type
          sort: $sort
          status: $status
          format: $format
          genre: $genre
          search: $search
          isAdult: $isAdult
        ) {
          ${MEDIA_FIELDS}
        }
      }
    }`,
    {
      page: 1,
      perPage: Math.min(perPage, 50),
      sort,
      type: "ANIME",
      isAdult: false,
      ...extra,
    },
  );

  const media = data?.Page?.media || [];
  return {
    data: media.map(mapMedia).filter(Boolean),
    pagination: { has_next_page: false },
    source: "anilist",
  };
}

export async function anilistByMalId(malId: number) {
  const data = await anilistQuery<{ Media: any }>(
    `query ($idMal: Int) {
      Media(idMal: $idMal, type: ANIME) {
        ${FULL_MEDIA_FIELDS}
      }
    }`,
    { idMal: malId },
  );
  const mapped = mapMedia(data?.Media);
  if (!mapped) return null;
  return { data: mapped, source: "anilist" };
}

/** Community recommendations shaped like Jikan /recommendations */
export async function anilistRecommendations(malId: number) {
  const data = await anilistQuery<{ Media: any }>(
    `query ($idMal: Int) {
      Media(idMal: $idMal, type: ANIME) {
        recommendations(page: 1, perPage: 18, sort: [RATING_DESC]) {
          nodes {
            mediaRecommendation {
              ${MEDIA_FIELDS}
            }
          }
        }
      }
    }`,
    { idMal: malId },
  );
  const items = mapRecommendationNodes(data?.Media?.recommendations);
  // Jikan-shaped: { data: [ { entry: {...} } ] }
  return {
    data: items.map((entry) => ({ entry })),
    source: "anilist",
  };
}

/**
 * Map a Jikan-style path to AniList data.
 * Returns null if the path can't be mapped.
 */
export async function anilistFromJikanPath(pathWithQuery: string) {
  const url = new URL(pathWithQuery, "https://jikan.local");
  const pathname = url.pathname;
  const limit = Number(url.searchParams.get("limit") || "16") || 16;
  const q = url.searchParams.get("q") || "";
  const filter = url.searchParams.get("filter") || "";
  const type = url.searchParams.get("type") || "";
  const genres = url.searchParams.get("genres") || "";

  // Full details: /anime/123/full or /anime/123
  const fullMatch = pathname.match(/^\/anime\/(\d+)(?:\/full)?$/);
  if (fullMatch) {
    return anilistByMalId(Number(fullMatch[1]));
  }

  // Recommendations: /anime/123/recommendations
  const recMatch = pathname.match(/^\/anime\/(\d+)\/recommendations$/);
  if (recMatch) {
    return anilistRecommendations(Number(recMatch[1]));
  }

  // Search
  if (pathname === "/anime" && q) {
    return anilistPage(["SEARCH_MATCH", "POPULARITY_DESC"], limit, {
      search: q,
    });
  }

  // Genre browse (Jikan genre ids ≠ AniList names — map common ones)
  if (pathname === "/anime" && genres) {
    const GENRE_MAP: Record<string, string> = {
      "1": "Action",
      "2": "Adventure",
      "4": "Comedy",
      "8": "Drama",
      "10": "Fantasy",
      "14": "Horror",
      "7": "Mystery",
      "22": "Romance",
      "24": "Sci-Fi",
      "36": "Slice of Life",
      "30": "Sports",
      "37": "Supernatural",
      "41": "Suspense",
    };
    const genreName = GENRE_MAP[genres.split(",")[0]] || undefined;
    return anilistPage(["POPULARITY_DESC"], limit, {
      genre: genreName,
    });
  }

  // Seasons now
  if (pathname === "/seasons/now") {
    return anilistPage(["POPULARITY_DESC"], limit, { status: "RELEASING" });
  }

  // Upcoming
  if (pathname === "/seasons/upcoming") {
    return anilistPage(["POPULARITY_DESC"], limit, {
      status: "NOT_YET_RELEASED",
    });
  }

  // Top anime
  if (pathname === "/top/anime") {
    if (type === "movie") {
      return anilistPage(["SCORE_DESC"], limit, { format: "MOVIE" });
    }
    if (filter === "bypopularity") {
      return anilistPage(["POPULARITY_DESC"], limit);
    }
    return anilistPage(["SCORE_DESC"], limit);
  }

  return null;
}
