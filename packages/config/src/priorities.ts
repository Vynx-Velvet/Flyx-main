/**
 * Central provider priority table — single source of truth.
 *
 * **NO MAGIC NUMBERS in provider classes.** All priority values
 * are defined here. Lower numbers are tried first during provider
 * fallback.
 *
 * ## Priority bands:
 * - **1–9**: Primary VOD providers (movies + TV)
 * - **10–19**: Anime providers
 * - **20–29**: Live TV providers
 * - **30–39**: Sports / PPV providers
 * - **40–49**: IPTV providers
 * - **50+**: Manga providers
 */

export const PROVIDER_PRIORITIES = {
  // === Primary VOD (movies + TV) ===
  VIDEASY: 1,
  VIDLINK: 2,
  VIDSRC: 3,
  MULTI_EMBED: 4,
  BINGEBOX: 5,
  MOVIEBOX: 6,
  PRIMESRC: 7,
  UFLIX: 8,
  VIDCORE: 9,

  // === Anime ===
  ANIMEX: 10,

  // === Live TV ===
  DLHD: 20,
  NTV: 21,
  GLOBETV: 22,
  UFREETV: 23,
  CDN_LIVE: 24,

  // === Sports / PPV ===
  STREAMNINJA: 30,
  PPV: 31,
  VIPROW: 32,

  // === IPTV ===
  IPTV: 40,

  // === Manga ===
  WEEBCENTRAL: 50,
} as const;

/** Provider priority value type. */
export type ProviderPriorityValue = (typeof PROVIDER_PRIORITIES)[keyof typeof PROVIDER_PRIORITIES];

/** Provider name type derived from the priority table. */
export type ProviderName = keyof typeof PROVIDER_PRIORITIES;

/**
 * Validate that the priority table has no collisions.
 *
 * Throws if any two providers share the same priority value.
 */
export function validatePriorities(): void {
  const seen = new Map<number, string>();
  const entries = Object.entries(PROVIDER_PRIORITIES) as [string, number][];

  for (const [name, priority] of entries) {
    const existing = seen.get(priority);
    if (existing) {
      throw new Error(
        `Priority collision: ${existing} and ${name} both have priority ${priority}`,
      );
    }
    seen.set(priority, name);
  }
}

/**
 * Get providers sorted by priority (lowest first, tried first).
 */
export function getProvidersByPriority(): { name: ProviderName; priority: ProviderPriorityValue }[] {
  return (Object.entries(PROVIDER_PRIORITIES) as [ProviderName, ProviderPriorityValue][])
    .map(([name, priority]) => ({ name, priority }))
    .sort((a, b) => a.priority - b.priority);
}

/**
 * Look up a provider's priority by name.
 */
export function getPriority(name: ProviderName | string): number | undefined {
  return PROVIDER_PRIORITIES[name as ProviderName];
}
