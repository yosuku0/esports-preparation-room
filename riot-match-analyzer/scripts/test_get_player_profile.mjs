import "dotenv/config";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const gameName = process.argv[2] ?? "smukakukuka";
const tagLine = process.argv[3] ?? "EUW";
const routingCluster = process.argv[4] ?? "asia";

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

  console.log("=== get_player_profile result ===");
  console.log(text);
  console.log("=== json_size_bytes ===");
  console.log(Buffer.byteLength(text, "utf8"));
} finally {
  await transport.close();
}
