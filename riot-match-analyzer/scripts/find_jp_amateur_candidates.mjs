import "dotenv/config";

const API_KEY = process.env.RIOT_API_KEY;

if (!API_KEY) {
  console.error("RIOT_API_KEY is required");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function riotFetch(url) {
  const res = await fetch(url, {
    headers: { "X-Riot-Token": API_KEY }
  });

  if (res.status === 429) {
    const retryAfter = Number(res.headers.get("Retry-After") ?? "5");
    await sleep(retryAfter * 1000);
    return riotFetch(url);
  }

  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} :: ${url}`);
  }

  return res.json();
}

function normalizeRole(teamPosition) {
  switch (teamPosition) {
    case "TOP":
      return "Top";
    case "JUNGLE":
      return "Jungle";
    case "MIDDLE":
      return "Mid";
    case "BOTTOM":
      return "ADC";
    case "UTILITY":
      return "Support";
    default:
      return "Unknown";
  }
}

function topEntries(mapObj, limit = 3) {
  return Object.entries(mapObj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

async function getCandidates() {
  const master = await riotFetch(
    "https://jp1.api.riotgames.com/lol/league/v4/masterleagues/by-queue/RANKED_SOLO_5x5"
  );

  const d1p1 = await riotFetch(
    "https://jp1.api.riotgames.com/lol/league/v4/entries/RANKED_SOLO_5x5/DIAMOND/I?page=1"
  );

  const d2p1 = await riotFetch(
    "https://jp1.api.riotgames.com/lol/league/v4/entries/RANKED_SOLO_5x5/DIAMOND/II?page=1"
  );

  const merged = [
    ...master.entries.map((e) => ({ ...e, tier: "MASTER", rank: "I" })),
    ...d1p1,
    ...d2p1
  ];

  merged.sort((a, b) => (b.leaguePoints ?? 0) - (a.leaguePoints ?? 0));
  return merged.slice(0, 40);
}

async function analyzePlayer(entry) {
  const puuid = entry.puuid;
  if (!puuid) {
    return null;
  }

  const account = await riotFetch(
    `https://asia.api.riotgames.com/riot/account/v1/accounts/by-puuid/${encodeURIComponent(puuid)}`
  );
  await sleep(70);

  const matchIds = await riotFetch(
    `https://asia.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?count=10`
  );
  await sleep(70);

  if (!Array.isArray(matchIds) || matchIds.length < 8) {
    return null;
  }

  const roleCounts = {};
  const championCounts = {};

  for (const matchId of matchIds) {
    const detail = await riotFetch(`https://asia.api.riotgames.com/lol/match/v5/matches/${matchId}`);
    await sleep(70);

    const p = detail?.info?.participants?.find((x) => x.puuid === puuid);
    if (!p) continue;

    const role = normalizeRole(p.teamPosition);
    roleCounts[role] = (roleCounts[role] ?? 0) + 1;
    championCounts[p.championName] = (championCounts[p.championName] ?? 0) + 1;
  }

  const roleTop = topEntries(roleCounts, 1)[0];
  const champTop = topEntries(championCounts, 1)[0];

  return {
    gameName: account.gameName,
    tagLine: account.tagLine,
    tier: entry.tier,
    rank: entry.rank,
    lp: entry.leaguePoints,
    mainRole: roleTop?.[0] ?? "Unknown",
    mainRoleGames: roleTop?.[1] ?? 0,
    topChampion: champTop?.[0] ?? "Unknown",
    topChampionGames: champTop?.[1] ?? 0,
    roleCounts,
    championCounts
  };
}

const excludeNames = new Set([
  "Hide on bush",
  "Faker",
  "Chovy",
  "Zeus",
  "Oner",
  "Ruler",
  "Lehends",
  "Gumayusi",
  "Keria"
]);

const entries = await getCandidates();
const analyzed = [];

for (const entry of entries) {
  try {
    const row = await analyzePlayer(entry);
    if (!row) continue;
    if (excludeNames.has(row.gameName)) continue;
    if (row.mainRole === "Unknown") continue;
    if (row.topChampionGames < 3) continue;
    analyzed.push(row);
    console.log(
      `${row.gameName}#${row.tagLine} | ${row.tier} ${row.rank} ${row.lp}LP | role=${row.mainRole}(${row.mainRoleGames}) | top=${row.topChampion}(${row.topChampionGames})`
    );
  } catch (error) {
    console.error(`skip entry due to error: ${error.message}`);
  }
}

console.log("\n=== JSON ===");
console.log(JSON.stringify(analyzed, null, 2));
