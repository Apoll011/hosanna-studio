/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface OnlineChordProvider {
  /** Unique identifier for the provider (e.g. 'cifraclub', 'ultimateguitar') */
  id: string;
  /** Human-readable display name */
  name: string;
  /** Primary and secondary domain names matched against URL hostnames */
  domains: string[];
  /** Example URL to display as guidance or in input placeholder */
  exampleUrl: string;
  /** Website or docs URL */
  websiteUrl?: string;
  /**
   * Custom matcher function if standard hostname checks are insufficient.
   */
  matches?: (url: URL) => boolean;
  /**
   * Fallback parser to extract artist and title from the URL structure
   * when server scraping response lacks metadata.
   */
  parseUrlFallback: (url: URL) => { artist: string; title: string };
}

/**
 * Converts a URL slug into Title Case text.
 */
export function slugToName(slug: string): string {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export const CIFRA_CLUB_PROVIDER: OnlineChordProvider = {
  id: "cifraclub",
  name: "Cifra Club",
  domains: ["cifraclub.com.br", "m.cifraclub.com.br"],
  exampleUrl: "https://www.cifraclub.com.br/artista/musica/",
  websiteUrl: "https://www.cifraclub.com.br",
  parseUrlFallback: (url: URL) => {
    const segments = url.pathname.split("/").filter(Boolean);
    const [artistSlug, songSlug] = segments;
    return {
      artist: artistSlug ? slugToName(artistSlug) : "",
      title: songSlug ? slugToName(songSlug) : "",
    };
  },
};

export const ULTIMATE_GUITAR_PROVIDER: OnlineChordProvider = {
  id: "ultimateguitar",
  name: "Ultimate Guitar",
  domains: ["ultimate-guitar.com", "tabs.ultimate-guitar.com"],
  exampleUrl: "https://tabs.ultimate-guitar.com/tab/artist/song-12345",
  websiteUrl: "https://www.ultimate-guitar.com",
  parseUrlFallback: (url: URL) => {
    const segments = url.pathname.split("/").filter(Boolean);
    // Ultimate Guitar tab paths typically look like /tab/{artist}/{song-name}-{tabId}
    const relevant = segments[0] === "tab" ? segments.slice(1) : segments;
    const artistSlug = relevant[0] || "";
    let songSlug = relevant[1] || "";

    // Remove common suffixes like "-chords-12345" or "-12345"
    songSlug = songSlug
      .replace(/-(chords|tab|tabs|ukulele|bass)?-?\d+$/i, "")
      .replace(/-chords$/i, "");

    return {
      artist: artistSlug ? slugToName(artistSlug) : "",
      title: songSlug ? slugToName(songSlug) : "",
    };
  },
};

/**
 * Built-in online providers. More providers can be added here
 * or registered dynamically at runtime via registerOnlineChordProvider().
 */
const providersRegistry: OnlineChordProvider[] = [
  CIFRA_CLUB_PROVIDER,
  ULTIMATE_GUITAR_PROVIDER,
];

/**
 * Register an additional chord provider supported by the backend server.
 */
export function registerOnlineChordProvider(
  provider: OnlineChordProvider,
): void {
  const index = providersRegistry.findIndex((p) => p.id === provider.id);
  if (index >= 0) {
    providersRegistry[index] = provider;
  } else {
    providersRegistry.push(provider);
  }
}

/**
 * Retrieve all registered online chord providers.
 */
export function getOnlineChordProviders(): readonly OnlineChordProvider[] {
  return providersRegistry;
}

/**
 * Detect which provider matches a given raw URL string.
 */
export function detectProvider(rawUrl: string): OnlineChordProvider | null {
  try {
    const normalized = rawUrl.trim();
    if (!normalized) return null;
    const url = new URL(
      normalized.startsWith("http") ? normalized : `https://${normalized}`,
    );
    const hostname = url.hostname.toLowerCase();

    for (const provider of providersRegistry) {
      if (provider.matches && provider.matches(url)) {
        return provider;
      }
      if (
        provider.domains.some(
          (d) =>
            hostname === d.toLowerCase() ||
            hostname.endsWith(`.${d.toLowerCase()}`),
        )
      ) {
        return provider;
      }
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Parse fallback artist and title from a provider URL.
 */
export function parseUrlFallback(rawUrl: string): {
  artist: string;
  title: string;
  provider: OnlineChordProvider | null;
} {
  try {
    const normalized = rawUrl.trim();
    if (!normalized) return { artist: "", title: "", provider: null };
    const url = new URL(
      normalized.startsWith("http") ? normalized : `https://${normalized}`,
    );
    const provider = detectProvider(rawUrl);

    if (provider?.parseUrlFallback) {
      const parsed = provider.parseUrlFallback(url);
      return { ...parsed, provider };
    }
  } catch {
    // Ignore URL parsing errors
  }

  return { artist: "", title: "", provider: null };
}

/**
 * Generate a combined placeholder string representing supported providers.
 */
export function getProviderPlaceholder(): string {
  return providersRegistry.map((p) => p.exampleUrl).join(" ou ");
}

/**
 * Returns a human-friendly comma-separated list of provider names.
 */
export function getProviderNames(): string {
  return providersRegistry.map((p) => p.name).join(", ");
}
