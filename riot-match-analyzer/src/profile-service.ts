import {
  processMatchDetail,
  processPlayerProfile,
  processTeamProfile
} from "./data-processor.js";
import { RiotApiClient } from "./riot-api.js";
import type {
  PlayerProfile,
  PlayerProfileInput,
  TeamProfile,
  TeamProfileInput
} from "./types.js";

export async function fetchPlayerProfile(
  api: RiotApiClient,
  input: PlayerProfileInput
): Promise<PlayerProfile | { error: string; gameName: string; tagLine: string }> {
  try {
    const account = await api.getAccountByRiotId(
      input.routingCluster,
      input.gameName,
      input.tagLine
    );

    const matchIds = await api.getMatchIds(input.routingCluster, account.puuid, 10);
    const processedMatches = [];

    // 仕様要件: マッチ詳細は直列取得（Promise.allで全並列にしない）
    for (const matchId of matchIds) {
      const detail = await api.getMatchDetail(input.routingCluster, matchId);
      processedMatches.push(processMatchDetail(detail, account.puuid));
    }

    return processPlayerProfile(
      account.gameName,
      account.tagLine,
      account.puuid,
      processedMatches
    );
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return {
        error: "Player not found",
        gameName: input.gameName,
        tagLine: input.tagLine
      };
    }

    return {
      error: `Failed to fetch player profile: ${
        error instanceof Error ? error.message : String(error)
      }`,
      gameName: input.gameName,
      tagLine: input.tagLine
    };
  }
}

export async function fetchTeamProfile(
  api: RiotApiClient,
  input: TeamProfileInput
): Promise<TeamProfile | { error: string; gameName: string; tagLine: string }> {
  const playerProfiles: PlayerProfile[] = [];

  for (const player of input.players) {
    const result = await fetchPlayerProfile(api, {
      gameName: player.gameName,
      tagLine: player.tagLine,
      routingCluster: input.routingCluster,
      platformId: input.platformId
    });

    if ("error" in result) {
      return result;
    }

    playerProfiles.push(result);
  }

  return processTeamProfile(playerProfiles);
}
