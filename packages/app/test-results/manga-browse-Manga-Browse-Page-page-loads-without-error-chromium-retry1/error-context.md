# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: manga\browse.spec.ts >> Manga Browse Page >> page loads without error
- Location: packages\app\e2e\manga\browse.spec.ts:16:7

# Error details

```
Error: expect(page).toHaveTitle(expected) failed

Expected pattern: /Manga/
Received string:  "Flyx — Stream Free"
Timeout: 30000ms

Call log:
  - Expect "toHaveTitle" with timeout 30000ms
    2 × locator resolved to <html lang="en" data-scroll-behavior="smooth" class="inter_c15e96cb-module__0bjUvq__variable outfit_9f4f9187-module__4LtYgq__variable">…</html>
      - unexpected value "Flyx — Stream Free"
    60 × locator resolved to <html lang="en" data-landing="1" data-scroll-behavior="smooth" class="inter_c15e96cb-module__0bjUvq__variable outfit_9f4f9187-module__4LtYgq__variable">…</html>
       - unexpected value "Flyx — Stream Free"

```

```yaml
- text: Flyx v3.0
- paragraph:
  - strong: Privacy-first streaming.
  - text: No ads. No tracking. No bullshit. Movies, TV, anime, manga, live TV, sports, and PPV events — all from free sources.
- link "Sign In":
  - /url: /login
- link "GitHub":
  - /url: https://github.com/Vynx-Velvet/Flyx-main
- link "Discord":
  - /url: https://discord.gg/flyx
- link "Vynx-Velvet/Flyx-main":
  - /url: https://github.com/Vynx-Velvet/Flyx-main
- text: About
- heading "What is Flyx 3.0?" [level=2]
- paragraph: The pirate streaming ecosystem has optimized for extraction. Sites scrape freely available content, then layer it with advertisements, tracking scripts, malware-laden popups, and background cryptocurrency miners. They do not host the media. They do not license it. They insert themselves between the user and material that was already free, converting attention and device resources into revenue. The prevailing assumption is that this exploitation is the unavoidable price of free access.
- paragraph: Flyx rejects that assumption.
- paragraph: Flyx aggregates movies, TV shows, anime, manga, live TV (850+ channels), live sports, and PPV events exclusively from the same free, unlicensed sources used by those sites. It never draws from legitimate platforms. It never touches services that pay for distribution rights. The sources are the free streams already circulating on the open internet. The difference is that every layer of monetization and surveillance is stripped away before the content reaches the user.
- paragraph: No advertisements. No tracking. No data sold to brokers. No miners. No personal information collected.
- paragraph: Flyx hosts nothing. It locates streams that already exist and delivers them cleanly through the user's own infrastructure — local machine, Docker host, or Cloudflare account. The operator controls the instance, the data, and access. No third party observes viewing history or even that the application is running.
- paragraph: Version 3.0 is a complete architectural rebuild. The previous single Next.js application has been replaced by a Turborepo monorepo of eleven packages with strict dependency boundaries. Types, error handling, caching, provider logic, extraction, and the video player each live in their own package — independently testable, versioned, and deployable. A new provider requires roughly fifteen lines. The player is composed of React hooks rather than a multi-thousand-line monolith. Errors carry machine-readable codes. Caching is a single unified layer.
- paragraph: The project is fully self-hosted and open source. It asks for no payment, no personal data, and no attention. Its purpose is to demonstrate that free streaming does not require exploiting the people who use it.
- paragraph: The sources remain the same. The extraction of value from the user does not.
- link "GitHub Repository Source code, issues, and contributions":
  - /url: https://github.com/Vynx-Velvet/Flyx-main
  - heading "GitHub Repository" [level=4]
  - paragraph: Source code, issues, and contributions
- link "Discord Community Get help, share ideas, and connect":
  - /url: https://discord.gg/flyx
  - heading "Discord Community" [level=4]
  - paragraph: Get help, share ideas, and connect
- text: Under the Hood
- heading "How It Works" [level=2]
- paragraph:
  - text: "Pirate sites make money by inserting themselves between you and content that was never theirs to sell. Flyx does the opposite: it"
  - strong: removes every middleman
  - text: between you and the stream. Nothing is hosted. Nothing is paywalled. Nothing is tracked. Here's how the pipeline cuts out the parasites.
- text: "1"
- heading "Provider Registry — No Single Point of Failure" [level=4]
- paragraph:
  - text: The
  - strong: "@flyx/providers"
  - text: package maintains a registry of 12+ sources in priority order, each as a lightweight class extending BaseProvider. When you search for content, the registry iterates through matching providers automatically — if a pirate site goes down or gets taken over, the next provider picks up without you noticing. Error isolation means one broken source never crashes your instance. Unlike the sprawling sites that embed 15 ad networks into every page, each provider is typically 15–30 lines of focused, auditable code.
- text: "2"
- heading "Extraction Pipeline — One Path, No Snooping" [level=4]
- paragraph:
  - text: All providers feed into a
  - strong: single ExtractionPipeline
  - text: in
  - strong: "@flyx/extractors."
  - text: This is the only fetch path in the entire app — API routes, player hooks, and admin tools all use it. Results hit the
  - strong: UnifiedCache
  - text: (TTL with stale-while-revalidate) in
  - strong: "@flyx/core,"
  - text: so repeated requests return instantly. In 2.0, this logic was copy-pasted across 5 different files — a nightmare to audit. In 3.0, it's one path, one cache, and you can read every line of it.
- text: "3"
- heading "Stream Proxy — You Are Invisible" [level=4]
- paragraph:
  - text: This is where Flyx earns the "privacy-first" claim. A dedicated proxy (Bun server on :8787 for local/Docker, Cloudflare Worker for production) sits between your browser and every upstream CDN. It
  - strong: injects Referer and Origin headers
  - text: so streams play correctly,
  - strong: rewrites M3U8 manifests
  - text: for CORS, and — this is the important part —
  - strong: completely shields your real IP address
  - text: from every content source. The upstream CDNs see the proxy, not you. Pirate sites want to know who you are so they can sell that information. Flyx makes that impossible.
- text: "4"
- heading "Decomposed Player — No Bloat, No Malware" [level=4]
- paragraph:
  - text: The
  - strong: "@flyx/player"
  - text: package provides composable React hooks for HLS.js playback — quality switching, subtitle tracks, keyboard shortcuts, Chromecast, AirPlay, stream URL copying. Each is its own hook, not a 5,000-line monolith like 2.0. The
  - strong: custom FetchLoader
  - text: routes every segment request through the proxy layer. Your browser never talks directly to a CDN. No hidden iframes. No drive-by crypto miners. Just a video player that plays video.
- text: "5"
- heading "Run It Anywhere — Not Their Server, Yours" [level=4]
- paragraph:
  - text: The
  - strong: "@flyx/config"
  - text: package detects your deployment target — local dev, Docker, Cloudflare, or Vercel — and selects the right database adapter (SQLite, D1, or Postgres), proxy backend, and environment automatically. One command to start. Zero code changes between platforms. Unlike the pirate ecosystem where you're at the mercy of whatever server some operator in a jurisdiction you'll never visit decides to keep online today, this is
  - strong: your infrastructure, your rules.
- text: History
- heading "From Flyx 2.0" [level=2]
- paragraph: "Flyx 2.0 was the original streaming platform — a single Next.js app with 20+ providers, a working video player, live TV, and a growing community. It proved the concept: free, private streaming was possible. But as the codebase grew past 30,000 lines with no architectural boundaries, every new feature became harder to ship. Provider logic leaked into the UI. Cache invalidation was guesswork. Errors were thrown as raw strings with no stack context."
- paragraph:
  - text: Rather than keep patching the cracks, we chose to rebuild — not to add features, but to create a foundation that makes adding features
  - strong: easy.
  - text: Everything that worked in 2.0 (streaming, providers, live TV, the player) was carried forward. Everything that held us back (the monolith, the error handling, the cache sprawl) was redesigned from scratch.
- text: Motivation
- heading "Why This Was Done" [level=2]
- paragraph: Flyx 2.0 was a working streaming platform, but it was held together by duct tape and hope. As the project grew, the cracks started showing. Flyx 3.0 was born out of the need to fix these architectural problems at the root.
- text: 🔀
- heading "Tangled Codebase" [level=3]
- paragraph: Flyx 2.0 spread provider logic across 6 directories in a mix of JS and TS. Adding a single provider meant touching 5+ files. 3.0 isolates each provider to a single 15–30 line class.
- text: 💥
- heading "Brittle Error Handling" [level=3]
- paragraph: 2.0 threw raw strings and had 5+ different error handling systems. Debugging production issues meant grepping for string literals. 3.0 has one typed error hierarchy with machine-readable codes.
- text: 🐌
- heading "Performance Bottlenecks" [level=3]
- paragraph: Four separate cache systems with no coordination meant stale data, cache stampedes, and wasted memory. 3.0's UnifiedCache deduplicates and coordinates all caching through a single layer.
- text: 🔧
- heading "Untestable Design" [level=3]
- paragraph: Components were 5,000+ lines with no separation of concerns. You couldn't test a provider without booting the entire app. 3.0's package boundaries make every module independently testable.
- text: 🧩
- heading "Missing Pieces" [level=3]
- paragraph: 2.0 had no manga support, no proper database, and no admin dashboard. Each feature was bolted on as an afterthought. 3.0 was designed from the ground up to accommodate manga, live TV, sync, and more.
- text: 🏠
- heading "Self-Host First" [level=3]
- paragraph: "Flyx 2.0 was hard to self-host — fragile config, no Docker support, and Cloudflare lock-in. 3.0 runs anywhere: local dev with SQLite, Docker with persistent volumes, or Cloudflare with D1 and Workers."
- text: What's New
- heading "Flyx 2.0 → 3.0" [level=2]
- paragraph:
  - text: Flyx 3.0 is a
  - strong: ground-up architectural refactor
  - text: of the 2.0 codebase. Every system was redesigned for reliability, maintainability, and performance.
- text: 🏗️
- heading "Monorepo Architecture" [level=3]
- paragraph: 11 packages with clear dependency boundaries. No more tangled 6-directory codebase — each concern is isolated, testable, and independently versioned.
- text: ⚡
- heading "Unified Extraction Pipeline" [level=3]
- paragraph: Single fetch path for all providers with built-in caching. Flyx 2.0 duplicated extraction logic across 5 locations — 3.0 has one ExtractionPipeline used everywhere.
- text: 🛡️
- heading "Type-Safe Error Hierarchy" [level=3]
- paragraph: One FlyxError base class with typed subclasses. Every error carries machine-readable codes, HTTP status, and retry flags. No more string-throwing.
- text: 🗄️
- heading "Proper DB Migrations" [level=3]
- paragraph: Tracked schema versions with transactional rollback. Flyx 2.0 ran CREATE TABLE IF NOT EXISTS on every request — a D1 anti-pattern we've eliminated.
- text: 🎯
- heading "Decorator-Free Providers" [level=3]
- paragraph: No experimental decorators. Providers register via a simple safeRegister() call with built-in error isolation. Each provider is just 15–30 lines.
- text: 💾
- heading "Single Cache System" [level=3]
- paragraph: One UnifiedCache with TTL, stale-while-revalidate, namespaces, and LRU eviction. Replaced 4 separate caching systems from 2.0.
- text: Self-Host
- heading "Setup & Configuration" [level=2]
- paragraph: Get your own Flyx instance running in minutes. Requires Node.js 20+ and npm.
- text: "1"
- heading "Clone the repository" [level=4]
- paragraph: Get the source code from GitHub.
- code: git clone https://github.com/Vynx-Velvet/Flyx-main.git
- text: "2"
- heading "Install dependencies" [level=4]
- paragraph: Install all packages in the Turborepo monorepo.
- code: cd Flyx-main && npm install
- text: "3"
- heading "Configure environment" [level=4]
- paragraph: Copy the example env file and fill in your values. At minimum, you need a TMDB API key and a JWT secret.
- code: cp .env.example .env
- text: "4"
- heading "Start the development server" [level=4]
- paragraph: Launch the Next.js dev server with hot reload across all packages.
- code: npm run dev
- text: "5"
- heading "Create your first account" [level=4]
- paragraph: The first account is always created as admin. You'll need the HOST_KEY from your .env to authorize the request.
- code: "curl -X POST http://localhost:3000/api/auth/register -H \"Content-Type: application/json\" -H \"x-host-key: YOUR_HOST_KEY\" -d '{\"username\":\"admin\",\"password\":\"your-password\"}'"
- text: Reference
- heading "Environment Variables" [level=2]
- paragraph: All configuration is done through environment variables. Copy .env.example to .env and fill in the values for your deployment.
- table:
  - rowgroup:
    - row "Variable Required Description":
      - columnheader "Variable"
      - columnheader "Required"
      - columnheader "Description"
  - rowgroup:
    - row "TMDB_API_KEY Required TMDB API key for content metadata, posters, and search":
      - cell "TMDB_API_KEY"
      - cell "Required"
      - cell "TMDB API key for content metadata, posters, and search"
    - row "JWT_SECRET Required Secret key for signing auth tokens (min 32 characters)":
      - cell "JWT_SECRET"
      - cell "Required"
      - cell "Secret key for signing auth tokens (min 32 characters)"
    - row "HOST_KEY Optional Secret key for creating new accounts. Required to enable user registration.":
      - cell "HOST_KEY"
      - cell "Optional"
      - cell "Secret key for creating new accounts. Required to enable user registration."
    - row "DATABASE_URL Optional Database connection string. Defaults to local SQLite.":
      - cell "DATABASE_URL"
      - cell "Optional"
      - cell "Database connection string. Defaults to local SQLite."
    - 'row "ENABLE_LANDING_PAGE Optional Show the landing page for unauthenticated visitors. Default: true."':
      - cell "ENABLE_LANDING_PAGE"
      - cell "Optional"
      - 'cell "Show the landing page for unauthenticated visitors. Default: true."'
    - row "CLOUDFLARE_ACCOUNT_ID Optional Cloudflare account ID for Workers deployment":
      - cell "CLOUDFLARE_ACCOUNT_ID"
      - cell "Optional"
      - cell "Cloudflare account ID for Workers deployment"
    - row "CLOUDFLARE_API_TOKEN Optional Cloudflare API token for Workers and D1 access":
      - cell "CLOUDFLARE_API_TOKEN"
      - cell "Optional"
      - cell "Cloudflare API token for Workers and D1 access"
    - row "STRIPE_SECRET_KEY Optional Stripe secret for token purchases (monetization)":
      - cell "STRIPE_SECRET_KEY"
      - cell "Optional"
      - cell "Stripe secret for token purchases (monetization)"
- contentinfo:
  - text: Flyx 3.0 Privacy-first streaming
  - navigation:
    - link "GitHub":
      - /url: https://github.com/Vynx-Velvet/Flyx-main
    - link "Discord":
      - /url: https://discord.gg/flyx
    - link "Sign In":
      - /url: /login
  - text: MIT License © 2026
- alert
```

# Test source

```ts
  1   | /**
  2   |  * Manga Browse Page — Playwright E2E Tests
  3   |  *
  4   |  * Tests the manga discovery/browse page at /manga including
  5   |  * hero section, category tabs, search, and navigation.
  6   |  */
  7   | import { test, expect } from "@playwright/test";
  8   | 
  9   | test.describe("Manga Browse Page", () => {
  10  |   test.beforeEach(async ({ page }) => {
  11  |     await page.goto("/manga");
  12  |     // Wait for the page to render — the hero or loading state should appear
  13  |     await page.waitForLoadState("domcontentloaded");
  14  |   });
  15  | 
  16  |   test("page loads without error", async ({ page }) => {
  17  |     // The page title should indicate manga
> 18  |     await expect(page).toHaveTitle(/Manga/);
      |                        ^ Error: expect(page).toHaveTitle(expected) failed
  19  | 
  20  |     // Body should be visible
  21  |     await expect(page.locator("body")).toBeVisible();
  22  |   });
  23  | 
  24  |   test("search input is present and accepts text", async ({ page }) => {
  25  |     const searchInput = page.locator('input[placeholder*="Search"]').or(
  26  |       page.locator('input[type="search"]')
  27  |     ).or(page.locator('input[type="text"]'));
  28  | 
  29  |     const input = searchInput.first();
  30  |     await expect(input).toBeVisible({ timeout: 10_000 });
  31  | 
  32  |     // Type into the search
  33  |     await input.fill("solo leveling");
  34  |     await expect(input).toHaveValue("solo leveling");
  35  |   });
  36  | 
  37  |   test("search returns results for a known title", async ({ page }) => {
  38  |     const searchInput = page.locator("input").first();
  39  |     await expect(searchInput).toBeVisible({ timeout: 10_000 });
  40  | 
  41  |     await searchInput.fill("naruto");
  42  | 
  43  |     // Wait for debounced search results (350ms debounce + API time)
  44  |     await page.waitForTimeout(3000);
  45  | 
  46  |     // Results should appear — either cards or a "no results" message
  47  |     // The page should not crash
  48  |     const body = page.locator("main");
  49  |     await expect(body).toBeVisible();
  50  |   });
  51  | 
  52  |   test("hero section renders with featured manga", async ({ page }) => {
  53  |     // Wait for loading to finish and content to appear
  54  |     await page.waitForTimeout(3000);
  55  | 
  56  |     // The hero section should have some content (title text visible)
  57  |     const mainContent = page.locator("main");
  58  |     await expect(mainContent).toBeVisible({ timeout: 10_000 });
  59  |   });
  60  | 
  61  |   test("category sections load with content", async ({ page }) => {
  62  |     // Wait for API data to load
  63  |     await page.waitForTimeout(5000);
  64  | 
  65  |     // After loading, we should see category headings like
  66  |     // "Most Popular", "Latest Updates", etc.
  67  |     const headings = page.locator("h2");
  68  |     const count = await headings.count();
  69  | 
  70  |     // Should have at least some section headings
  71  |     expect(count).toBeGreaterThanOrEqual(1);
  72  |   });
  73  | 
  74  |   test("clicking a manga card navigates to details page", async ({ page }) => {
  75  |     // Wait for content to load
  76  |     await page.waitForTimeout(5000);
  77  | 
  78  |     // Look for clickable elements that might be manga cards
  79  |     // Cards have click handlers that navigate to /manga/{id}
  80  |     const cards = page.locator('[class*="cursor-pointer"]').first();
  81  | 
  82  |     // If cards are not found directly, try navigating via search
  83  |     const cardCount = await cards.count();
  84  |     if (cardCount === 0) {
  85  |       // Fall back to searching for a known title
  86  |       const searchInput = page.locator("input").first();
  87  |       await searchInput.fill("solo leveling");
  88  |       await page.waitForTimeout(3000);
  89  |     }
  90  | 
  91  |     // Find any link or clickable element that links to manga details
  92  |     const detailLink = page.locator('a[href*="/manga/"]').first();
  93  | 
  94  |     if ((await detailLink.count()) > 0) {
  95  |       const href = await detailLink.getAttribute("href");
  96  |       await detailLink.click();
  97  | 
  98  |       // Should navigate to the details page
  99  |       await page.waitForURL(/\/manga\//);
  100 |       expect(page.url()).toContain("/manga/");
  101 |     }
  102 |   });
  103 | 
  104 |   test("loading state shows spinner", async ({ page }) => {
  105 |     // Navigate fresh — the loading spinner should appear briefly
  106 |     await page.goto("/manga");
  107 | 
  108 |     // The spinner or "Browsing manga library…" text should appear
  109 |     const spinner = page.locator(".animate-spin");
  110 |     const loadingText = page.getByText("Browsing manga library");
  111 | 
  112 |     // At least one should exist (might disappear quickly if cached)
  113 |     const spinnerVisible = await spinner.isVisible().catch(() => false);
  114 |     const textVisible = await loadingText.isVisible().catch(() => false);
  115 | 
  116 |     // This is a soft check — content might load immediately from cache
  117 |     expect(spinnerVisible || textVisible || true).toBeTruthy();
  118 |   });
```