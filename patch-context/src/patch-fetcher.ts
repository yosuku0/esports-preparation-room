import * as cheerio from "cheerio";
import type { Element } from "domhandler";

export interface PatchFetchResult {
  html: string;
  url: string;
  requestedVersion: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  let lastError: unknown;

  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "patch-context-mcp/1.0"
        }
      });
      return response;
    } catch (error) {
      lastError = error;
      await sleep(500 * (i + 1));
    }
  }

  throw new Error(`Network error while fetching ${url}: ${String(lastError)}`);
}

export function buildPatchUrls(version: string): string[] {
  const [major, minor] = version.split(".");

  return [
    `https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-${major}-${minor}-notes/`,
    `https://www.leagueoflegends.com/en-us/news/game-updates/patch-${major}-${minor}-notes/`
  ];
}

function normalizePatchVersion(version: string): string {
  const match = version.match(/(\d+)\.(\d+)/);
  if (!match) return version;
  return `${match[1]}.${match[2]}`;
}

async function discoverLatestPatchUrl(): Promise<{ url: string; version: string }> {
  const listingUrl = "https://www.leagueoflegends.com/en-us/news/game-updates/";
  const response = await fetchWithRetry(listingUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch patch listing: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const links = $("a[href]")
    .map((_i: number, el: Element) => $(el).attr("href") ?? "")
    .get();

  const patchLink = links.find(
    (href: string) => /\/news\/game-updates\/.+patch.+notes\//i.test(href) && !/tft|arena|dev/i.test(href)
  );

  if (!patchLink) {
    throw new Error("Failed to discover latest patch URL from listing page");
  }

  const absoluteUrl = patchLink.startsWith("http")
    ? patchLink
    : `https://www.leagueoflegends.com${patchLink}`;

  const match = absoluteUrl.match(/patch-(\d+)-(\d+)-notes/i);
  const version = match ? `${match[1]}.${match[2]}` : "latest";

  return { url: absoluteUrl, version };
}

export async function fetchPatchHtml(version?: string): Promise<PatchFetchResult> {
  const requestedVersion = version ? normalizePatchVersion(version) : "latest";

  if (!version) {
    const discovered = await discoverLatestPatchUrl();
    const response = await fetchWithRetry(discovered.url);
    if (!response.ok) {
      throw new Error(`Patch fetch failed: ${response.status} ${response.statusText}`);
    }
    return {
      html: await response.text(),
      url: discovered.url,
      requestedVersion: discovered.version
    };
  }

  const urls = buildPatchUrls(requestedVersion);

  for (const url of urls) {
    const response = await fetchWithRetry(url);
    if (response.status === 404) continue;
    if (!response.ok) {
      throw new Error(`Patch fetch failed: ${response.status} ${response.statusText}`);
    }

    return {
      html: await response.text(),
      url,
      requestedVersion
    };
  }

  throw new Error(`Patch not found for version ${requestedVersion}`);
}
