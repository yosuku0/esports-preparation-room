import "dotenv/config";

import fs from "node:fs";
import path from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const players = [
  { gameName: "Perle", tagLine: "2201", role: "Top", rank: "MASTER I" },
  { gameName: "ShadowIsles0", tagLine: "JP1", role: "Jungle", rank: "MASTER I" },
  { gameName: "月 姫", tagLine: "xxx", role: "Mid", rank: "MASTER I" },
  { gameName: "Jubilant veil", tagLine: "JP2", role: "ADC", rank: "MASTER I" },
  { gameName: "だれでも", tagLine: "1108", role: "Support", rank: "MASTER I" }
];

const routingCluster = "asia";

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["dist/index.js"],
  cwd: process.cwd(),
  env: {
    RIOT_API_KEY: process.env.RIOT_API_KEY ?? "",
    NODE_TLS_REJECT_UNAUTHORIZED: process.env.NODE_TLS_REJECT_UNAUTHORIZED ?? ""
  },
  stderr: "inherit"
});

const client = new Client({ name: "team-test-client", version: "1.0.0" }, { capabilities: {} });

function buildChampionUsageSummary(teamProfile) {
  const lines = [];

  for (const [index, player] of teamProfile.players.entries()) {
    lines.push(
      `Player ${index + 1}: ${player.gameName}#${player.tagLine} (Role: ${players[index].role}, Rank: ${players[index].rank})`
    );
    const pool = Array.isArray(player?.summary?.championPool) ? player.summary.championPool : [];
    const championLine = pool.map((e) => `${e.champion}(${e.games})`).join(", ");
    lines.push(`  Champions: ${championLine}`);
    lines.push("");
  }

  return lines.join("\n");
}

try {
  const outDir = path.join(process.cwd(), "test-logs");
  fs.mkdirSync(outDir, { recursive: true });

  await client.connect(transport);

  const startedAt = Date.now();
  const result = await client.callTool(
    {
      name: "get_team_profile",
      arguments: {
        players: players.map(({ gameName, tagLine }) => ({ gameName, tagLine })),
        routingCluster
      }
    },
    undefined,
    { timeout: 300000 }
  );
  const elapsedMs = Date.now() - startedAt;

  const textItem = result.content.find((item) => item.type === "text");
  const text = textItem?.type === "text" ? textItem.text : JSON.stringify(result);
  const json = JSON.parse(text);

  const teamPath = path.join(outDir, "team_profile_jp_amateur_test.json");
  fs.writeFileSync(teamPath, JSON.stringify(json, null, 2), "utf8");

  const summaryText = buildChampionUsageSummary(json);
  const summaryPath = path.join(outDir, "champion_usage_summary_jp_amateur.txt");
  fs.writeFileSync(summaryPath, summaryText, "utf8");

  const jsonSize = Buffer.byteLength(JSON.stringify(json), "utf8");

  console.log("=== team_profile_check ===");
  console.log(`players=${players.map((p) => `${p.gameName}#${p.tagLine}(${p.role})`).join(" | ")}`);
  console.log(`routingCluster=${routingCluster}`);
  console.log(`elapsedMs=${elapsedMs}`);
  console.log(`jsonSizeBytes=${jsonSize}`);

  if (json.error) {
    console.log(`error=${json.error}`);
    process.exit(0);
  }

  const counts = json.players.map((p) => p.recentMatches.length);
  console.log(`recentMatchesCounts=${counts.join(",")}`);
  console.log(`allPlayersHave10=${counts.every((c) => c === 10)}`);
  console.log(`hasWinRateByDuration=${Boolean(json?.teamSummary?.winRateByDuration)}`);
  console.log(`savedJson=${teamPath}`);
  console.log(`savedSummary=${summaryPath}`);
} finally {
  await transport.close();
}
