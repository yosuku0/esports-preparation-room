# eSports Preparation Room — A-lite Prototype

An **MCP-native AI analysis system** for League of Legends teams.  
Connects Riot API data and patch notes to an LLM, generating structured briefings for match preparation, post-match review, and self-analysis.

> ⚠️ **Research Prototype** — This is an experimental tool under active development. Analysis quality varies based on data availability. Not affiliated with or endorsed by Riot Games.

---

## What It Does

Instead of showing raw stats (like OP.GG), this system returns **hypotheses and judgments** — recommended bans, threat assessments, patch impact analysis, and team tendency predictions — tailored to the actual players you will face.

### Three Analysis Modes

| Mode | When to use | Input required |
|---|---|---|
| 🌟 **Post-Match Review** | After a game — understand what happened and why | Opponent Riot IDs (from match history) |
| **Pre-Match Analysis** | Before a Clash/tournament match | Opponent Riot IDs |
| **Self-Analysis** | Anytime — diagnose your own team | Your own team's Riot IDs |

*Post-Match Review is the lowest-friction entry point and is recommended for first use.*

---

## Architecture

```
[Input: 5 Riot IDs]
     │
     ├── MCP Server: riot-match-analyzer
     │     ├── Riot Games API → Player profiles (last 10 matches)
     │     └── Pre-processing (30-50KB raw → 2-5KB summary per player)
     │
     ├── MCP Server: patch-context
     │     ├── Official patch notes (HTML) → Structured JSON
     │     └── Champion/Item changes with buff/nerf classification
     │
     └── LLM (MCP Client — e.g. smolagents, Cline)
           ├── Step 0: Relevance Pruning (170+ champions → 10-12)
           ├── Steps 1-5: Role analysis, team tendencies, patch impact
           └── Step 6: Briefing (Markdown output with ban recs & threats)
```

---

## Project Structure

```
esports-preparation-room/
├── riot-match-analyzer/     # MCP Server 1: Player/team data
│   ├── src/
│   │   ├── index.ts         # MCP server entry point
│   │   ├── riot-api.ts      # Riot API client (rate limited)
│   │   ├── data-dragon.ts   # Champion/item name resolution
│   │   ├── data-processor.ts # Summary generation
│   │   └── types.ts
│   └── scripts/             # Standalone test scripts
│
├── patch-context/           # MCP Server 2: Patch notes
│   ├── src/
│   │   ├── index.ts
│   │   ├── patch-fetcher.ts # Patch notes → raw HTML
│   │   ├── patch-parser.ts  # HTML → structured JSON (no CSS class dependency)
│   │   ├── change-classifier.ts # buff/nerf/adjustment classification
│   │   └── types.ts
│   └── test/                # Vitest unit tests
│
├── rules/
│   └── lol_analyst_rules.md # LLM reasoning rules (domain knowledge)
│
├── workflows/
│   └── opponent_analysis.md # Step-by-step analysis workflow
│
└── docs/
    ├── tester_package/      # Onboarding materials for testers
    └── design-decisions.md  # Architectural decisions
```

---

## Setup

### Prerequisites

- Node.js 18+
- Riot Games API Key ([Developer Portal](https://developer.riotgames.com/))

### Installation

```bash
git clone https://github.com/yosuku0/esports-preparation-room.git
cd esports-preparation-room

# Setup riot-match-analyzer
cd riot-match-analyzer && npm install && npm run build
cp .env.example .env  # Add your RIOT_API_KEY

# Setup patch-context
cd ../patch-context && npm install && npm run build
```

### MCP Server Configuration

Add to your MCP client (e.g., `cline_mcp_settings.json`):

```json
{
  "mcpServers": {
    "riot-match-analyzer": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/path/to/esports-preparation-room/riot-match-analyzer",
      "env": { "RIOT_API_KEY": "RGAPI-your-key-here" }
    },
    "patch-context": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/path/to/esports-preparation-room/patch-context"
    }
  }
}
```

---

## Testing

```bash
# Unit tests (patch-context)
cd patch-context && npx vitest run

# Integration test (both servers)
# Run from the repository root
node scripts/run_integration_test.mjs
```

All 12 unit tests pass. Integration test validates the full E2E pipeline.

---

## MCP Tools

### `riot-match-analyzer`

| Tool | Description |
|---|---|
| `get_player_profile` | Fetches last 10 matches for a single player |
| `get_team_profile` | Fetches 5 players' profiles + team-level stats |

### `patch-context`

| Tool | Description |
|---|---|
| `get_current_patch` | Parses official Riot patch notes into structured JSON |

---

## Riot API Usage

Approximately 60 API calls per full team analysis (Account × 5 + Match IDs × 5 + Match details × 50). Dual-layer rate limiting is implemented (short-term 20 req/sec, long-term 100 req/2min).

No raw player data is stored or redistributed. All match data is summarized in-memory only.

---

## Known Limitations

- **Solo queue ≠ team play**: Analysis is based on solo queue history. In-team strategies may differ.
- **Small sample size**: 10 matches per player. Low-confidence outputs are labeled `reliability: low` in the briefing.
- **Patch notes parsing**: The parser handles standard Riot patch note HTML. Significant page structure changes by Riot may require parser updates.
- **Network environment**: Depending on your local TLS certificate setup, you may need to adjust HTTPS settings. See the [setup notes](#setup) if you encounter network errors.

---

## Development History

- **Phase 0**: Mock data validation — proved LLM can generate co-pilot / assistant-level analysis from structured summaries
- **Phase 1–2**: Real data + patch automation — validated on JP solo queue data; patch parsing at ≥87% accuracy
- **Phase 2.5–4**: Relevance pruning, reliability scoring, system stabilization
- **Phase 5**: A-lite self-rehearsal — validated all 4 success criteria on both mock and real data

---

## Legal

This project uses the Riot Games API. It is **not endorsed by Riot Games** and does not reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties.

Riot Games, League of Legends, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.