import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve("J:/Dev/eSports Preparation Room/riot-match-analyzer/.env") });

// Configuration for the two servers
const RIOT_API_KEY = process.env.RIOT_API_KEY ?? "";

if (!RIOT_API_KEY) {
  throw new Error("RIOT_API_KEY is not set. Please configure riot-match-analyzer/.env");
}

const SERVERS = {
  "riot-match-analyzer": {
    command: "node",
    args: [path.resolve("J:/Dev/eSports Preparation Room/riot-match-analyzer/dist/index.js")],
    cwd: path.resolve("J:/Dev/eSports Preparation Room/riot-match-analyzer"),
    env: { RIOT_API_KEY }
  },
  "patch-context": {
    command: "node",
    args: [path.resolve("J:/Dev/eSports Preparation Room/patch-context/dist/index.js")],
    cwd: path.resolve("J:/Dev/eSports Preparation Room/patch-context"),
    env: {}
  }
};

async function testServer(serverKey, toolName, toolArgs) {
  const config = SERVERS[serverKey];
  const transport = new StdioClientTransport({
    command: config.command,
    args: config.args,
    env: { ...process.env, ...config.env }
  });

  const client = new Client(
    { name: "integration-test-client", version: "1.0.0" },
    { capabilities: {} }
  );

  await client.connect(transport);
  
  console.log(`[${serverKey}] Calling tool: ${toolName}...`);
  const result = await client.callTool({
    name: toolName,
    arguments: toolArgs
  });
  
  await transport.close();
  return result;
}

async function main() {
  console.log("=== Part 1-2. スモークテスト ===");
  try {
    // Test A
    const resA = await testServer("riot-match-analyzer", "get_player_profile", {
      gameName: "Perle",
      tagLine: "2201",
      routingCluster: "asia"
    });
    console.log("Test A (riot-match-analyzer) Success. Data length:", resA.content[0].text.length);

    // Test B
    const resB = await testServer("patch-context", "get_current_patch", {
      version: "26.5"
    });
    console.log("Test B (patch-context) Success. Data length:", resB.content[0].text.length);

    console.log("\n=== Part 2. 統合テスト本実行 ===");
    
    // Step 1
    const teamRes = await testServer("riot-match-analyzer", "get_team_profile", {
      players: [
        { gameName: "Perle", tagLine: "2201" },
        { gameName: "ShadowIsles0", tagLine: "JP1" },
        { gameName: "月 姫", tagLine: "xxx" },
        { gameName: "Jubilant veil", tagLine: "JP2" },
        { gameName: "だれでも", tagLine: "1108" }
      ],
      routingCluster: "asia"
    });
    const teamData = JSON.parse(teamRes.content[0].text);
    console.log("Step 1 (get_team_profile) Success. Players fetched:", teamData.players.length);
    
    await fs.writeFile("J:/Dev/eSports Preparation Room/tmp_team_data.json", JSON.stringify(teamData, null, 2));

    // Step 2
    const patchDataStr = resB.content[0].text;
    const patchData = JSON.parse(patchDataStr);
    console.log("Step 2 (get_current_patch) Success. Status:", patchData.parseStatus);
    
    await fs.writeFile("J:/Dev/eSports Preparation Room/tmp_patch_data.json", JSON.stringify(patchData, null, 2));

    console.log("\nAll data extracted successfully. Please proceed to Step 3.");
  } catch (err) {
    console.error("Test Error:", err);
    process.exit(1);
  }
}

main();
