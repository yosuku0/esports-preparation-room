import { extractCoreItems } from "./data-dragon.js";
import type {
  ChampionPoolEntry,
  MatchDetail,
  PlayerProfile,
  PlayerSummary,
  ProcessedMatch,
  TeamProfile
} from "./types.js";

function roundTo(value: number, digits: number): number {
  const base = 10 ** digits;
  return Math.round(value * base) / base;
}

function normalizeGameDurationSeconds(gameDurationRaw: number): number {
  // Riot APIのパッチ差分により秒またはミリ秒で返ることがある
  return gameDurationRaw > 10_000 ? gameDurationRaw / 1000 : gameDurationRaw;
}

export function processMatchDetail(matchDetail: MatchDetail, puuid: string): ProcessedMatch {
  const participant = matchDetail.info.participants.find((p) => p.puuid === puuid);
  if (!participant) {
    throw new Error("TARGET_PARTICIPANT_NOT_FOUND");
  }

  const gameDurationSeconds = normalizeGameDurationSeconds(matchDetail.info.gameDuration);
  const gameDurationMin = roundTo(gameDurationSeconds / 60, 1);
  const csTotal = participant.totalMinionsKilled + participant.neutralMinionsKilled;
  const csPerMin = gameDurationMin > 0 ? roundTo(csTotal / gameDurationMin, 1) : 0;

  const coreItems = extractCoreItems([
    participant.item0,
    participant.item1,
    participant.item2,
    participant.item3,
    participant.item4,
    participant.item5,
    participant.item6
  ]);

  return {
    championName: participant.championName,
    win: participant.win,
    kills: participant.kills,
    deaths: participant.deaths,
    assists: participant.assists,
    kda: `${participant.kills}/${participant.deaths}/${participant.assists}`,
    coreItems,
    csPerMin,
    gameDurationMin,
    visionScore: participant.visionScore
  };
}

export function processPlayerProfile(
  gameName: string,
  tagLine: string,
  puuid: string,
  recentMatches: ProcessedMatch[]
): PlayerProfile {
  const totalGames = recentMatches.length;
  const summary = buildPlayerSummary(recentMatches);

  return {
    gameName,
    tagLine,
    puuid,
    recentMatches: recentMatches.slice(0, 10),
    summary: {
      ...summary,
      totalGames
    }
  };
}

function buildPlayerSummary(matches: ProcessedMatch[]): PlayerSummary {
  if (matches.length === 0) {
    return {
      championPool: [],
      totalGames: 0,
      totalWinRate: 0,
      avgKDA: "0.0/0.0/0.0",
      avgCsPerMin: 0,
      avgGameDurationMin: 0,
      avgVisionScore: 0
    };
  }

  const championStats = new Map<string, { games: number; wins: number }>();
  let wins = 0;
  let killsTotal = 0;
  let deathsTotal = 0;
  let assistsTotal = 0;
  let csPerMinTotal = 0;
  let gameDurationTotal = 0;
  let visionScoreTotal = 0;

  for (const match of matches) {
    const current = championStats.get(match.championName) ?? { games: 0, wins: 0 };
    current.games += 1;
    if (match.win) current.wins += 1;
    championStats.set(match.championName, current);

    if (match.win) wins += 1;
    killsTotal += match.kills;
    deathsTotal += match.deaths;
    assistsTotal += match.assists;
    csPerMinTotal += match.csPerMin;
    gameDurationTotal += match.gameDurationMin;
    visionScoreTotal += match.visionScore;
  }

  const championPool: ChampionPoolEntry[] = Array.from(championStats.entries())
    .map(([champion, stat]) => ({
      champion,
      games: stat.games,
      wins: stat.wins,
      winRate: stat.games > 0 ? roundTo(stat.wins / stat.games, 3) : 0
    }))
    .sort((a, b) => b.games - a.games || b.wins - a.wins || a.champion.localeCompare(b.champion));

  const totalGames = matches.length;
  const avgKills = roundTo(killsTotal / totalGames, 1);
  const avgDeaths = roundTo(deathsTotal / totalGames, 1);
  const avgAssists = roundTo(assistsTotal / totalGames, 1);

  return {
    championPool,
    totalGames,
    totalWinRate: roundTo(wins / totalGames, 3),
    avgKDA: `${avgKills}/${avgDeaths}/${avgAssists}`,
    avgCsPerMin: roundTo(csPerMinTotal / totalGames, 1),
    avgGameDurationMin: roundTo(gameDurationTotal / totalGames, 1),
    avgVisionScore: roundTo(visionScoreTotal / totalGames, 1)
  };
}

export function processTeamProfile(players: PlayerProfile[]): TeamProfile {
  const allMatches = players.flatMap((player) => player.recentMatches);

  const avgGameDurationMin =
    allMatches.length > 0
      ? roundTo(
          allMatches.reduce((acc, match) => acc + match.gameDurationMin, 0) /
            allMatches.length,
          1
        )
      : 0;

  const under25 = allMatches.filter((m) => m.gameDurationMin < 25);
  const between25and35 = allMatches.filter(
    (m) => m.gameDurationMin >= 25 && m.gameDurationMin < 35
  );
  const over35 = allMatches.filter((m) => m.gameDurationMin >= 35);

  const calcBucket = (matches: ProcessedMatch[]) => {
    const games = matches.length;
    const wins = matches.filter((m) => m.win).length;
    return {
      games,
      winRate: games > 0 ? roundTo(wins / games, 3) : 0
    };
  };

  return {
    players,
    teamSummary: {
      avgGameDurationMin,
      winRateByDuration: {
        under25min: calcBucket(under25),
        between25and35min: calcBucket(between25and35),
        over35min: calcBucket(over35)
      }
    }
  };
}
