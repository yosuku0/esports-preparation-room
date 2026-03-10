import "dotenv/config";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolRequest
} from "@modelcontextprotocol/sdk/types.js";

import { initializeDataDragonCache } from "./data-dragon.js";
import { fetchPlayerProfile, fetchTeamProfile } from "./profile-service.js";
import { RiotApiClient } from "./riot-api.js";
import type {
  PlayerProfileInput,
  PlatformId,
  RoutingCluster,
  TeamProfileInput
} from "./types.js";

type JsonObject = Record<string, unknown>;

const platformIds: PlatformId[] = [
  "na1",
  "jp1",
  "kr",
  "euw1",
  "eun1",
  "br1",
  "la1",
  "la2",
  "oc1",
  "tr1",
  "ru",
  "ph2",
  "sg2",
  "th2",
  "tw2",
  "vn2"
];

function isRoutingCluster(value: unknown): value is RoutingCluster {
  return ["americas", "asia", "europe", "sea"].includes(String(value));
}

function isPlatformId(value: unknown): value is PlatformId {
  return platformIds.includes(String(value) as PlatformId);
}

function asPlayerProfileInput(args: JsonObject | undefined): PlayerProfileInput {
  if (!args) throw new Error("Invalid arguments");

  const { gameName, tagLine, routingCluster, platformId } = args;

  if (
    typeof gameName !== "string" ||
    typeof tagLine !== "string" ||
    !isRoutingCluster(routingCluster)
  ) {
    throw new Error("Invalid arguments for get_player_profile");
  }

  return {
    gameName,
    tagLine,
    routingCluster,
    platformId: isPlatformId(platformId) ? platformId : undefined
  };
}

function asTeamProfileInput(args: JsonObject | undefined): TeamProfileInput {
  if (!args) throw new Error("Invalid arguments");

  const { players, routingCluster, platformId } = args;

  if (!Array.isArray(players) || !isRoutingCluster(routingCluster)) {
    throw new Error("Invalid arguments for get_team_profile");
  }

  if (
    players.length !== 5 ||
    !players.every(
      (p) =>
        typeof p === "object" &&
        p !== null &&
        typeof (p as { gameName?: unknown }).gameName === "string" &&
        typeof (p as { tagLine?: unknown }).tagLine === "string"
    )
  ) {
    throw new Error("players must be an array of 5 entries with gameName and tagLine");
  }

  return {
    players: players as Array<{ gameName: string; tagLine: string }>,
    routingCluster,
    platformId: isPlatformId(platformId) ? platformId : undefined
  };
}

async function buildPlayerProfile(api: RiotApiClient, input: PlayerProfileInput): Promise<string> {
  const result = await fetchPlayerProfile(api, input);
  return JSON.stringify(result);
}

async function buildTeamProfile(api: RiotApiClient, input: TeamProfileInput): Promise<string> {
  const result = await fetchTeamProfile(api, input);
  return JSON.stringify(result);
}

function toToolResult(text: string) {
  return {
    content: [{ type: "text", text }]
  };
}

async function main(): Promise<void> {
  const apiKey = process.env.RIOT_API_KEY;
  if (!apiKey) {
    console.error("RIOT_API_KEY environment variable is required");
    process.exit(1);
  }

  try {
    await initializeDataDragonCache();
  } catch {
    console.error("Failed to initialize Data Dragon cache");
    process.exit(1);
  }

  const api = new RiotApiClient(apiKey);

  const server = new Server(
    {
      name: "riot-match-analyzer",
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
        name: "get_player_profile",
        description:
          "Fetches and summarizes a League of Legends player's recent 10 matches, including champion pool, win rates, KDA, builds, and vision score. Data is pre-processed for LLM consumption.",
        inputSchema: {
          type: "object",
          properties: {
            gameName: { type: "string" },
            tagLine: { type: "string" },
            routingCluster: {
              type: "string",
              enum: ["americas", "asia", "europe", "sea"]
            },
            platformId: { type: "string" }
          },
          required: ["gameName", "tagLine", "routingCluster"],
          additionalProperties: false
        }
      },
      {
        name: "get_team_profile",
        description:
          "Fetches and summarizes 5 players' recent matches and calculates team-level tendencies including game duration patterns and win rates by game phase.",
        inputSchema: {
          type: "object",
          properties: {
            players: {
              type: "array",
              minItems: 5,
              maxItems: 5,
              items: {
                type: "object",
                properties: {
                  gameName: { type: "string" },
                  tagLine: { type: "string" }
                },
                required: ["gameName", "tagLine"],
                additionalProperties: false
              }
            },
            routingCluster: {
              type: "string",
              enum: ["americas", "asia", "europe", "sea"]
            },
            platformId: { type: "string" }
          },
          required: ["players", "routingCluster"],
          additionalProperties: false
        }
      }
    ]
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
    const args = (request.params.arguments ?? {}) as JsonObject;

    if (request.params.name === "get_player_profile") {
      const input = asPlayerProfileInput(args);
      const result = await buildPlayerProfile(api, input);
      return toToolResult(result);
    }

    if (request.params.name === "get_team_profile") {
      const input = asTeamProfileInput(args);
      const result = await buildTeamProfile(api, input);
      return toToolResult(result);
    }

    throw new Error(`Unknown tool: ${request.params.name}`);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

void main();
