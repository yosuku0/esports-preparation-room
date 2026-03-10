import type { DataDragonCache, ItemData } from "./types.js";

let cache: DataDragonCache | null = null;

interface DataDragonChampionResponse {
  data: Record<
    string,
    {
      id: string;
      name: string;
    }
  >;
}

interface DataDragonItemResponse {
  data: Record<
    string,
    {
      name: string;
      gold: { total: number };
      tags?: string[];
      into?: string[];
    }
  >;
}

export async function initializeDataDragonCache(): Promise<DataDragonCache> {
  try {
    const versionsRes = await fetch(
      "https://ddragon.leagueoflegends.com/api/versions.json"
    );
    if (!versionsRes.ok) {
      throw new Error(`Failed versions fetch: ${versionsRes.status}`);
    }

    const versions = (await versionsRes.json()) as string[];
    const version = versions[0];

    const championRes = await fetch(
      `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`
    );
    if (!championRes.ok) {
      throw new Error(`Failed champion fetch: ${championRes.status}`);
    }

    const itemRes = await fetch(
      `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/item.json`
    );
    if (!itemRes.ok) {
      throw new Error(`Failed item fetch: ${itemRes.status}`);
    }

    const championJson =
      (await championRes.json()) as DataDragonChampionResponse;
    const itemJson = (await itemRes.json()) as DataDragonItemResponse;

    const champions = new Map<string, string>();
    for (const champion of Object.values(championJson.data)) {
      champions.set(champion.id, champion.name);
    }

    const items = new Map<number, ItemData>();
    for (const [id, item] of Object.entries(itemJson.data)) {
      const numericId = Number(id);
      if (Number.isNaN(numericId)) continue;

      items.set(numericId, {
        name: item.name,
        goldTotal: item.gold?.total ?? 0,
        tags: item.tags ?? [],
        into: item.into
      });
    }

    cache = { version, champions, items };
    return cache;
  } catch (error) {
    console.error("Failed to initialize Data Dragon cache", error);
    throw new Error("Failed to initialize Data Dragon cache");
  }
}

export function getDataDragonCache(): DataDragonCache {
  if (!cache) {
    throw new Error("Data Dragon cache is not initialized");
  }
  return cache;
}

export function extractCoreItems(itemIds: number[]): string[] {
  const { items } = getDataDragonCache();
  const candidates: Array<{ name: string; goldTotal: number }> = [];

  for (const itemId of itemIds) {
    if (itemId === 0) continue;

    const item = items.get(itemId);
    if (!item) continue;

    const tags = item.tags ?? [];
    const hasExcludedTag =
      tags.includes("Boots") ||
      tags.includes("Consumable") ||
      tags.includes("Vision");
    if (hasExcludedTag) continue;

    if (item.into && item.into.length > 0) continue;
    if (item.goldTotal < 2000) continue;

    candidates.push({ name: item.name, goldTotal: item.goldTotal });
  }

  candidates.sort((a, b) => b.goldTotal - a.goldTotal);
  return candidates.slice(0, 3).map((item) => item.name);
}
