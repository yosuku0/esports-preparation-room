# eSports Preparation Room

An MCP-native AI system that generates coach-level opponent analysis briefings for League of Legends amateur/semi-pro teams.

## Overview

This system connects two MCP (Model Context Protocol) servers to an LLM, transforming raw competitive data into actionable strategic insights. Instead of showing statistics (like OP.GG), it returns **judgments and hypotheses** — recommended bans, threat assessments, patch impact analysis, and team tendency predictions.

### What It Does

1. **Fetches opponent data** — Retrieves recent match history (last 10 games) for 5 opponent players via the Riot Games API
2. **Fetches patch context** — Automatically parses the latest patch notes from the official Riot Games website
3. **Prunes to relevance** — Filters 170+ champions and 30+ patch changes down to only what matters for these specific 5 opponents
4. **Generates briefing** — Produces a structured opponent analysis briefing with ban recommendations, threat levels, and strategic insights

### Target Users

- Amateur/semi-pro teams preparing for Clash, tournaments, or scrimmages
- Team coaches and analysts who need quick opponent research
- Players who want structured pre-match preparation beyond basic stat checking

## Architecture

```
[User Input: 5 Riot IDs]
    │
    ├── MCP Server: riot-match-analyzer
    │     ├── Riot Games API → Player profiles
    │     ├── Data Dragon → Champion/Item name resolution
    │     └── Pre-processing (30-50KB raw → 2-5KB summary per player)
    │
    ├── MCP Server: patch-context
    │     ├── Official patch notes (HTML) → Structured JSON
    │     ├── Champion changes with buff/nerf classification
    │     └── Item changes with impact assessment
    │
    └── LLM (MCP Client)
          ├── Step 0: Relevance Pruning (42 candidates → 10-12)
          ├── Step 1-5: Analysis (per-player, team trends, patch impact)
          └── Step 6: Briefing generation (Markdown output)
```

## Project Structure

```
eSports-Preparation-Room/
├── riot-match-analyzer/     # MCP Server 1: Player/team data
│   ├── src/
│   │   ├── index.ts         # MCP server entry point
│   │   ├── riot-api.ts      # Riot API client with rate limiting
│   │   ├── data-dragon.ts   # Champion/item name resolution cache
│   │   ├── data-processor.ts # Raw data → LLM-friendly summary
│   │   └── types.ts
│   ├── scripts/
│   │   ├── test_get_player_profile.mjs
│   │   ├── test_get_team_profile.mjs
│   │   └── get_opponents.mjs  # Utility: extract opponents from recent matches
│   └── package.json
│
├── patch-context/           # MCP Server 2: Patch notes
│   ├── src/
│   │   ├── index.ts         # MCP server entry point
│   │   ├── patch-fetcher.ts # Patch notes URL construction & fetch
│   │   ├── patch-parser.ts  # HTML → structured JSON (semantic tags, no CSS class dependency)
│   │   ├── change-classifier.ts # buff/nerf/adjustment classification
│   │   └── types.ts
│   ├── scripts/
│   │   └── test_get_patch.mjs
│   └── package.json
│
├── rules/
│   └── lol_analyst_rules.md # Domain knowledge rules for LLM reasoning
│
├── workflows/
│   └── opponent_analysis.md # Step-by-step analysis workflow
│
└── docs/                    # Generated briefings and test logs
```

## Riot Games API Usage

### Endpoints Used

| Endpoint | Purpose | Calls per Analysis |
|---|---|---|
| Account-v1 (`/riot/account/v1/accounts/by-riot-id/`) | Resolve Riot ID → PUUID | 5 (one per player) |
| Match-v5 (`/lol/match/v5/matches/by-puuid/.../ids`) | Get recent match IDs | 5 (one per player) |
| Match-v5 (`/lol/match/v5/matches/{matchId}`) | Get match details | 50 (10 matches × 5 players) |
| Data Dragon (static, no key needed) | Champion/item name resolution | 2-3 (cached at startup) |

**Total API calls per analysis: ~60 requests**

### Rate Limiting

The system implements dual-layer rate limiting:
- **Short-term**: 60ms minimum interval between requests (~16 req/sec, well under the 20/sec limit)
- **Long-term**: Tracks request count within 2-minute windows, auto-pauses at 90 requests (under the 100/2min limit)
- **429 handling**: Reads `Retry-After` header and waits automatically

### Data Handling

- **No data storage**: Player data is processed in-memory and returned to the LLM client. No database, no persistent storage of player data.
- **No redistribution**: Raw API data is never exposed. The MCP server returns pre-processed summaries only.
- **Pre-processing (pruning)**: Match-v5 responses (30-50KB per match) are pruned to 2-5KB summaries containing only: champion name, win/loss, KDA, core items (3), CS/min, game duration, vision score.
- **Riot Games attribution**: All data sourced from Riot Games API. This project is not endorsed by Riot Games.

## Setup

### Prerequisites

- Node.js 18+
- Riot Games API Key (Development or Production)

### Installation

```bash
# Clone the repository
git clone https://github.com/[your-username]/esports-preparation-room.git
cd esports-preparation-room

# Setup riot-match-analyzer
cd riot-match-analyzer
npm install
npm run build
cp .env.example .env
# Edit .env and add your RIOT_API_KEY

# Setup patch-context
cd ../patch-context
npm install
npm run build
```

### MCP Server Configuration

Add both servers to your MCP client configuration (e.g., `cline_mcp_settings.json`):

```json
{
  "mcpServers": {
    "riot-match-analyzer": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/path/to/esports-preparation-room/riot-match-analyzer",
      "env": {
        "RIOT_API_KEY": "RGAPI-your-key-here"
      }
    },
    "patch-context": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/path/to/esports-preparation-room/patch-context"
    }
  }
}
```

### Quick Test

```bash
# Test riot-match-analyzer
cd riot-match-analyzer
node scripts/test_get_player_profile.mjs

# Test patch-context
cd ../patch-context
node scripts/test_get_patch.mjs
```

## MCP Tools

### riot-match-analyzer

#### `get_player_profile`
Fetches and summarizes a player's recent 10 matches.

**Input:**
```json
{
  "gameName": "PlayerName",
  "tagLine": "JP1",
  "routingCluster": "asia"
}
```

**Output:** Player profile with champion pool, win rates, KDA trends, core builds, vision scores.

#### `get_team_profile`
Fetches 5 players' profiles and calculates team-level statistics.

**Input:**
```json
{
  "players": [
    { "gameName": "Player1", "tagLine": "JP1" },
    { "gameName": "Player2", "tagLine": "JP1" },
    { "gameName": "Player3", "tagLine": "JP1" },
    { "gameName": "Player4", "tagLine": "JP1" },
    { "gameName": "Player5", "tagLine": "JP1" }
  ],
  "routingCluster": "asia"
}
```

**Output:** 5 player profiles + team summary (avg game duration, win rate by game duration).

### patch-context

#### `get_current_patch`
Fetches and parses official Riot Games patch notes.

**Input:**
```json
{
  "version": "26.5"
}
```

**Output:** Structured patch data with champion changes, item changes, buff/nerf classification, and parse status.

## Development History

This project was developed through a phased validation approach:

- **Phase 0**: Mock data validation — proved LLM can generate coach-level analysis
- **Phase 1**: Real data validation — proved the system works for amateur players (not pro solo queue)
- **Phase 2**: Patch automation — automated patch note parsing (87.5% changeType accuracy)
- **Phase 2.5**: 3-layer knowledge design — implemented relevance pruning (42→11 candidates), profile reliability, meaning tags, and patch confidence

## Legal

This project uses the Riot Games API. It is not endorsed by Riot Games and does not reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties.

Riot Games, League of Legends, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.