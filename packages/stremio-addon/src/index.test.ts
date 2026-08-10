import { describe, expect, it } from "vitest";

import worker from "./index";
import type { Env } from "./types";

const token = "test-token-with-at-least-32-characters";
const env: Env = { ADDON_TOKEN: token, TMDB_API_KEY: "test-key" };

describe("Worker routes", () => {
  it("hides every add-on route behind the private token", async () => {
    const response = await worker.fetch(
      new Request("https://worker.example/wrong-token/manifest.json"),
      env,
    );
    expect(response.status).toBe(404);
  });

  it("serves the manifest from the protected install URL", async () => {
    const response = await worker.fetch(
      new Request(`https://worker.example/${token}/manifest.json`),
      env,
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      id: "community.flyx.private",
      name: "Flyx Streams",
    });
  });

  it("reports configuration without exposing either secret", async () => {
    const response = await worker.fetch(new Request(`https://worker.example/${token}/health`), env);
    const body = await response.text();
    expect(response.status).toBe(200);
    expect(body).toContain('"tmdbConfigured":true');
    expect(body).not.toContain(token);
    expect(body).not.toContain("test-key");
  });

  it("returns an empty Stremio response for malformed IDs without calling TMDB", async () => {
    const response = await worker.fetch(
      new Request(`https://worker.example/${token}/stream/movie/not-an-imdb-id.json`),
      env,
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ streams: [] });
  });

  it("removes the protocol .json suffix before parsing a valid ID", async () => {
    const response = await worker.fetch(
      new Request(`https://worker.example/${token}/stream/movie/tt0133093.json`),
      { ADDON_TOKEN: token },
    );
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: "TMDB_API_KEY is not configured",
      streams: [],
    });
  });
});
