import * as cheerio from "cheerio";
import type { Element } from "domhandler";

import { classifyChange } from "./change-classifier.js";
import type { ChampionChange, ItemChange, ParseStatus, PatchData } from "./types.js";

function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function parsePatchVersion(input: string, fallback: string): string {
  const m = input.match(/patch\s*(\d+)\.(\d+)/i);
  if (m) return `${m[1]}.${m[2]}`;

  const m2 = input.match(/patch-(\d+)-(\d+)-notes/i);
  if (m2) return `${m2[1]}.${m2[2]}`;

  return fallback;
}

function parsePatchDate($: cheerio.CheerioAPI): string {
  const timeEl = $("time").first();
  const dt = cleanText(timeEl.attr("datetime") ?? "");
  if (dt) return dt.slice(0, 10);

  const bodyText = cleanText($("body").text());
  const dateMatch = bodyText.match(
    /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}/i
  );
  return dateMatch ? dateMatch[0] : "";
}

function findSectionHeaders($: cheerio.CheerioAPI): { champions: Element | null; items: Element | null } {
  const headers = $("h2, h3").toArray();

  const champions =
    headers.find((h) => {
      const txt = cleanText($(h).text());
      return /champions?/i.test(txt) && !/teamfight tactics|aram|arena/i.test(txt);
    }) ?? null;

  const items =
    headers.find((h) => {
      const txt = cleanText($(h).text());
      return /\bitems?\b/i.test(txt) && !/recommended|shop|aram|arena/i.test(txt);
    }) ?? null;

  return { champions, items };
}

function findSectionEnd(
  $: cheerio.CheerioAPI,
  sectionStart: Element,
  fallbackEnd: Element | null
): cheerio.Cheerio<Element> {
  if (fallbackEnd) return $(fallbackEnd);

  let node = $(sectionStart).next();
  while (node.length) {
    if (node.is("h2,h3") && /aram|arena|ranked|systems|bugfix|bugfixes|mythic|summoner/i.test(cleanText(node.text()))) {
      return node;
    }
    node = node.next();
  }

  return $([]);
}

function isEntityHeader(text: string, kind: "champion" | "item"): boolean {
  if (!text || text.length < 2 || text.length > 60) return false;
  if (/champions?|items?|patch|overview|mid-patch/i.test(text)) return false;
  if (/^base stats?$/i.test(text)) return false;
  if (/^ability\s*\d|^r\s*-/i.test(text)) return false;
  if (/^[QWERP]\s*[-–:]/i.test(text)) return false;
  if (/^\d+\.\d+/.test(text)) return false;
  if (/\b(passive|ability|cooldown|mana cost|adjustments?)\b/i.test(text)) return false;

  if (kind === "champion" && /\b(item|system|runes?)\b/i.test(text)) return false;
  return true;
}

function parseSectionEntries(
  $: cheerio.CheerioAPI,
  sectionStart: Element,
  sectionEnd: cheerio.Cheerio<Element>,
  kind: "champion" | "item"
): Array<ChampionChange | ItemChange> {
  const entries: Array<ChampionChange | ItemChange> = [];

  let currentName = "";
  let summary = "";
  const details: string[] = [];

  const flush = () => {
    if (!currentName) return;
    const detailsText = details.join("\n").trim();
    const entryBase = {
      changeType: classifyChange(detailsText, summary),
      summary: summary || "",
      details: detailsText || summary || "No details extracted"
    };

    if (kind === "champion") {
      entries.push({ championName: currentName, ...entryBase });
    } else {
      entries.push({ itemName: currentName, ...entryBase });
    }

    currentName = "";
    summary = "";
    details.length = 0;
  };

  const all = $("h2,h3,h4,h5,p,blockquote,li").toArray();
  const startIndex = all.findIndex((el) => el === sectionStart);
  const endIndex = sectionEnd.length ? all.findIndex((el) => el === sectionEnd[0]) : -1;

  for (let i = startIndex + 1; i < all.length; i++) {
    if (endIndex >= 0 && i >= endIndex) break;

    const el = all[i];
    const node = $(el);
    const nodeText = cleanText(node.text());
    if (!nodeText) continue;

    if (node.is("h2") && /aram|arena|ranked|systems|bugfix|skins|related/i.test(nodeText)) {
      break;
    }

    if (node.is("h3,h4")) {
      if (isEntityHeader(nodeText, kind)) {
        flush();
        currentName = nodeText;
        continue;
      }

      if (currentName) {
        details.push(nodeText);
      }
      continue;
    }

    if (!currentName) continue;

    if (!summary && node.is("blockquote,p")) {
      summary = nodeText;
    } else {
      details.push(nodeText);
    }
  }

  flush();
  return entries;
}

function buildFallbackPatchData(html: string, requestedVersion: string, parseStatus: ParseStatus): PatchData {
  const $ = cheerio.load(html);
  const title = cleanText($("title").text()) || requestedVersion;
  const bodyText = cleanText($("body").text()).slice(0, 12000);

  return {
    parseStatus,
    patchVersion: parsePatchVersion(title, requestedVersion),
    patchDate: parsePatchDate($),
    patchContext: bodyText || title,
    championChanges: [],
    itemChanges: []
  };
}

export function parsePatchHtml(html: string, requestedVersion: string): PatchData {
  const $ = cheerio.load(html);
  const bodyText = cleanText($("body").text());

  if (bodyText.length < 400) {
    return buildFallbackPatchData(html, requestedVersion, "fallback");
  }

  const title = cleanText($("title").text()) || cleanText($("h1").first().text()) || requestedVersion;
  const patchVersion = parsePatchVersion(title, requestedVersion);
  const patchDate = parsePatchDate($);
  const patchContext =
    cleanText($("blockquote").first().text()) ||
    cleanText($("article p").first().text()) ||
    cleanText($("p").first().text()) ||
    bodyText.slice(0, 600);

  const { champions, items } = findSectionHeaders($);
  if (!champions && !items) {
    return buildFallbackPatchData(html, patchVersion, "fallback");
  }

  const championChanges: ChampionChange[] = champions
    ? (parseSectionEntries($, champions, findSectionEnd($, champions, items), "champion") as ChampionChange[])
    : [];

  const itemChanges: ItemChange[] = items
    ? (parseSectionEntries($, items, findSectionEnd($, items, null), "item") as ItemChange[])
    : [];

  const parseStatus: ParseStatus = championChanges.length > 0 && itemChanges.length > 0 ? "full" : "partial";

  if (championChanges.length === 0 && itemChanges.length === 0) {
    return buildFallbackPatchData(html, patchVersion, "fallback");
  }

  return {
    parseStatus,
    patchVersion,
    patchDate,
    patchContext,
    championChanges,
    itemChanges
  };
}
