import "dotenv/config";

import fs from "node:fs";
import path from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const gameName = process.argv[2];
const tagLine = process.argv[3];
const routingCluster = process.argv[4] ?? "asia";

if (!gameName || !tagLine) {
  console.error("Usage: node scripts/test_profile_checks.mjs <gameName> <tagLine> [routingCluster]");
  process.exit(1);
}

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

const client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });

try {
  await client.connect(transport);

  const result = await client.callTool({
    name: "get_player_profile",
    arguments: {
      gameName,
      tagLine,
      routingCluster
    }
  });

  const textItem = result.content.find((item) => item.type === "text");
  const text = textItem?.type === "text" ? textItem.text : JSON.stringify(result);
  const bytes = Buffer.byteLength(text, "utf8");
  const parsed = JSON.parse(text);

  console.log("=== profile_check ===");
  console.log(`riotId=${gameName}#${tagLine}`);
  console.log(`routingCluster=${routingCluster}`);
  console.log(`jsonSizeBytes=${bytes}`);

  if (parsed.error) {
    console.log(`error=${parsed.error}`);
    process.exit(0);
  }

  const recentMatches = Array.isArray(parsed.recentMatches) ? parsed.recentMatches : [];
  const first = recentMatches[0];
  const championPool = Array.isArray(parsed?.summary?.championPool)
    ? parsed.summary.championPool
    : [];

  console.log(`recentMatchesCount=${recentMatches.length}`);
  console.log(`championPoolCount=${championPool.length}`);
  console.log(`hasChampionNameString=${typeof first?.championName === "string"}`);
  console.log(`hasVisionScoreNumber=${typeof first?.visionScore === "number"}`);
  console.log(`coreItemsSample=${JSON.stringify(first?.coreItems ?? [])}`);
  console.log(`firstMatchChampion=${first?.championName ?? "N/A"}`);

  const outDir = path.join(process.cwd(), "test-logs");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `player_profile_${gameName}_${tagLine}.json`);
  fs.writeFileSync(outPath, JSON.stringify(parsed, null, 2), "utf8");
  console.log(`savedJson=${outPath}`);
} finally {
  await transport.close();
}
