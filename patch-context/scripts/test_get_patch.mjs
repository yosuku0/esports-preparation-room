import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import fs from "node:fs";
import path from "node:path";

const version = process.argv[2] || "26.5";

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["dist/index.js"],
  cwd: process.cwd(),
  env: {
    NODE_TLS_REJECT_UNAUTHORIZED: process.env.NODE_TLS_REJECT_UNAUTHORIZED ?? ""
  },
  stderr: "inherit"
});

const client = new Client({ name: "patch-test-client", version: "1.0.0" }, { capabilities: {} });

try {
  await client.connect(transport);

  const startedAt = Date.now();
  const result = await client.callTool(
    {
      name: "get_current_patch",
      arguments: { version }
    },
    undefined,
    { timeout: 300000 }
  );
  const elapsedMs = Date.now() - startedAt;

  const textItem = result.content.find((item) => item.type === "text");
  const text = textItem?.type === "text" ? textItem.text : JSON.stringify(result);
  const parsed = JSON.parse(text);

  const outDir = path.join(process.cwd(), "test-logs");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `patch_${String(version).replace(/[^\w.-]+/g, "_")}.json`);
  fs.writeFileSync(outPath, JSON.stringify(parsed, null, 2), "utf8");

  console.log("=== get_current_patch ===");
  console.log(`version=${version}`);
  console.log(`elapsedMs=${elapsedMs}`);

  if (parsed.error) {
    console.log(`error=${parsed.error}`);
    console.log(`message=${parsed.message ?? ""}`);
    process.exit(0);
  }

  console.log(`parseStatus=${parsed.parseStatus}`);
  console.log(`patchVersion=${parsed.patchVersion}`);
  console.log(`championCount=${Array.isArray(parsed.championChanges) ? parsed.championChanges.length : 0}`);
  console.log(`itemCount=${Array.isArray(parsed.itemChanges) ? parsed.itemChanges.length : 0}`);
  console.log(`jsonSizeBytes=${Buffer.byteLength(text, "utf8")}`);
  console.log(`savedJson=${outPath}`);

  const champs = (parsed.championChanges ?? []).map((c) => c.championName).join(", ");
  const items = (parsed.itemChanges ?? []).map((i) => i.itemName).join(", ");
  console.log(`champions=${champs}`);
  console.log(`items=${items}`);
} finally {
  await transport.close();
}
