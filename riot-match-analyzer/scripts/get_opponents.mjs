import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

import { RiotApiClient } from "../dist/riot-api.js";

const SOLO_RANKED_QUEUE_ID = 420;
const MATCH_COUNT = 5;

/**
 * @typedef {Object} MatchParticipantExtended
 * @property {string} puuid
 * @property {number} teamId
 * @property {string} riotIdGameName
 * @property {string} riotIdTagline
 * @property {boolean} win
 */

/**
 * @typedef {Object} MatchDetailExtended
 * @property {{
 *   gameCreation?: number,
 *   gameStartTimestamp?: number,
 *   gameDuration: number,
 *   queueId?: number,
 *   participants: MatchParticipantExtended[]
 * }} info
 */

/**
 * @param {number} timestampMs
 */
function formatDateTime(timestampMs) {
  const d = new Date(timestampMs);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

/**
 * @param {number} seconds
 */
function toMinutes(seconds) {
  return Math.round(seconds / 60);
}

/**
 * @param {MatchParticipantExtended} p
 */
function toRiotId(p) {
  const gameName = p.riotIdGameName ?? "Unknown";
  const tagLine = p.riotIdTagline ?? "Unknown";
  return `${gameName}#${tagLine}`;
}

/**
 * @param {MatchParticipantExtended[]} participants
 * @param {number} teamId
 */
function pickTeam(participants, teamId) {
  return participants.filter((p) => p.teamId === teamId);
}

/**
 * @param {MatchParticipantExtended[]} participants
 * @param {string} puuid
 */
function findSelf(participants, puuid) {
  return participants.find((p) => p.puuid === puuid) ?? null;
}

async function main() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const envPath = path.resolve(__dirname, "../.env");
  dotenv.config({ path: envPath });

  const apiKey = process.env.RIOT_API_KEY;
  if (!apiKey) {
    console.error("RIOT_API_KEY が設定されていません。.env を確認してください。");
    process.exit(1);
  }

  const gameName = process.argv[2];
  const tagLine = process.argv[3];
  const routingCluster = process.argv[4];

  if (!gameName || !tagLine || !routingCluster) {
    console.error(
      '使い方: node scripts/get_opponents.mjs "gameName" "tagLine" "routingCluster"'
    );
    process.exit(1);
  }

  const api = new RiotApiClient(apiKey);

  const account = await api.getAccountByRiotId(routingCluster, gameName, tagLine);
  const baseMatchIdsUrl = api.getMatchListUrl(routingCluster, account.puuid, MATCH_COUNT);
  const rankedMatchIdsUrl = `${baseMatchIdsUrl}&queue=${SOLO_RANKED_QUEUE_ID}`;

  /** @type {string[]} */
  const matchIds = await api.fetch(rankedMatchIdsUrl);

  if (matchIds.length === 0) {
    console.log("直近のランク戦（queue=420）が見つかりませんでした。");
    return;
  }

  /** @type {Array<{ matchId: string, detail: MatchDetailExtended, self: MatchParticipantExtended, allies: MatchParticipantExtended[], opponents: MatchParticipantExtended[] }>} */
  const matchRows = [];

  for (const matchId of matchIds) {
    /** @type {MatchDetailExtended} */
    const detail = await api.getMatchDetail(routingCluster, matchId);
    const participants = detail.info.participants ?? [];
    const self = findSelf(participants, account.puuid);

    if (!self) {
      continue;
    }

    const allies = pickTeam(participants, self.teamId);
    const opponents = pickTeam(participants, self.teamId === 100 ? 200 : 100);

    matchRows.push({ matchId, detail, self, allies, opponents });
  }

  if (matchRows.length === 0) {
    console.log("対象プレイヤーを含む試合データを取得できませんでした。");
    return;
  }

  console.log("=== 直近のランク戦 ===");

  for (const [index, row] of matchRows.entries()) {
    const startedAt =
      row.detail.info.gameCreation ?? row.detail.info.gameStartTimestamp ?? Date.now();
    const durationMin = toMinutes(row.detail.info.gameDuration);
    const resultText = row.self.win ? "勝利" : "敗北";

    console.log(
      `[${index + 1}] ${formatDateTime(startedAt)} (${durationMin}分) - ${resultText}`
    );
    console.log(`    味方: ${row.allies.map(toRiotId).join(", ")}`);
    console.log(`    相手: ${row.opponents.map(toRiotId).join(", ")}`);
  }

  const rl = readline.createInterface({ input, output });
  let selectedIndex = -1;

  while (selectedIndex < 0 || selectedIndex >= matchRows.length) {
    const answer = await rl.question(`試合を選択してください (1-${matchRows.length}): `);
    const parsed = Number.parseInt(answer, 10);
    if (Number.isNaN(parsed) || parsed < 1 || parsed > matchRows.length) {
      console.log("無効な入力です。表示された番号を入力してください。");
      continue;
    }
    selectedIndex = parsed - 1;
  }

  rl.close();

  const selected = matchRows[selectedIndex];
  const payload = {
    players: selected.opponents.slice(0, 5).map((p) => ({
      gameName: p.riotIdGameName,
      tagLine: p.riotIdTagline
    })),
    routingCluster
  };

  console.log("\n=== 選択した試合の相手5人 (get_team_profile入力形式) ===");
  console.log(JSON.stringify(payload, null, 2));

  const outDir = path.resolve(__dirname, "../test-logs");
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, "opponents_selected.json");
  await fs.writeFile(outPath, JSON.stringify(payload, null, 2), "utf8");

  console.log(`\n保存先: ${outPath}`);
}

main().catch((error) => {
  console.error("エラーが発生しました:", error instanceof Error ? error.message : error);
  process.exit(1);
});