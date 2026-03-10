import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolRequest
} from "@modelcontextprotocol/sdk/types.js";

import { fetchPatchHtml } from "./patch-fetcher.js";
import { parsePatchHtml } from "./patch-parser.js";

type JsonObject = Record<string, unknown>;

function toToolResult(text: string) {
  return {
    content: [{ type: "text", text }]
  };
}

function asGetCurrentPatchInput(args: JsonObject | undefined): { version?: string } {
  if (!args) return {};
  const { version } = args;
  if (version === undefined) return {};
  if (typeof version !== "string") {
    throw new Error("version must be a string");
  }
  return { version };
}

function asGetPatchDiffInput(args: JsonObject | undefined): { baseVersion: string; targetVersion: string } {
  if (!args) throw new Error("Invalid arguments for get_patch_diff");

  const { baseVersion, targetVersion } = args;
  if (typeof baseVersion !== "string" || typeof targetVersion !== "string") {
    throw new Error("baseVersion and targetVersion must be strings");
  }

  return { baseVersion, targetVersion };
}

async function handleGetCurrentPatch(args: JsonObject | undefined): Promise<string> {
  const input = asGetCurrentPatchInput(args);

  try {
    const fetched = await fetchPatchHtml(input.version);
    const patchData = parsePatchHtml(fetched.html, fetched.requestedVersion);
    return JSON.stringify(patchData);
  } catch (error) {
    return JSON.stringify({
      error: "Failed to fetch patch notes",
      message: error instanceof Error ? error.message : String(error),
      requestedVersion: input.version ?? "latest"
    });
  }
}

async function main(): Promise<void> {
  const server = new Server(
    {
      name: "patch-context",
      version: "1.0.0"
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "get_current_patch",
        description:
          "Fetches and parses League of Legends patch notes from the official Riot Games website. Returns structured champion and item changes with buff/nerf classification.",
        inputSchema: {
          type: "object",
          properties: {
            version: { type: "string" }
          },
          additionalProperties: false
        }
      },
      {
        name: "get_patch_diff",
        description: "Compares changes between two patch versions. (Not yet implemented)",
        inputSchema: {
          type: "object",
          properties: {
            baseVersion: { type: "string" },
            targetVersion: { type: "string" }
          },
          required: ["baseVersion", "targetVersion"],
          additionalProperties: false
        }
      }
    ]
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
    const args = (request.params.arguments ?? {}) as JsonObject;

    if (request.params.name === "get_current_patch") {
      const result = await handleGetCurrentPatch(args);
      return toToolResult(result);
    }

    if (request.params.name === "get_patch_diff") {
      asGetPatchDiffInput(args);
      return toToolResult(
        JSON.stringify({
          error: "Not implemented. This feature is planned for a future release."
        })
      );
    }

    throw new Error(`Unknown tool: ${request.params.name}`);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

void main();
