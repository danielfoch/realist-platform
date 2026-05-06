# @realist/mcp

**Model Context Protocol server + CLI for [Realist.ca](https://realist.ca)** — underwrite Canadian real estate deals, search the CREA MLS feed, and submit deals to the Realist community feed from Claude Desktop, the Codex CLI, Cursor, Continue, or any MCP-compatible AI agent.

## What you get

8 tools your AI assistant can call on your behalf:

| Tool | Purpose |
|---|---|
| `realist_underwrite_listing` | Underwrite a Canadian MLS# (cap rate, cash flow, DSCR, cash-on-cash) |
| `realist_underwrite_custom` | Underwrite a custom address with your own price + assumptions |
| `realist_find_deals` | Natural-language deal search ("4-plex in Hamilton under $900k") |
| `realist_list_my_analyses` | List your saved underwritings |
| `realist_get_analysis` | Fetch a specific underwriting |
| `realist_submit_for_review` | Post an underwriting to the community feed for upvotes & comments |
| `realist_get_market_report` | City-level market snapshot |
| `realist_get_mortgage_rates` | Current Canadian mortgage rates |

## Setup

### 1. Mint an API key

Sign in at [realist.ca](https://realist.ca), then go to **[Account → API Keys](https://realist.ca/account/api-keys)** and create one. Copy it immediately — it's shown only once.

### 2a. Use with Claude Desktop

Edit your config file:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "realist": {
      "command": "npx",
      "args": ["-y", "@realist/mcp"],
      "env": {
        "REALIST_API_KEY": "realist_live_..."
      }
    }
  }
}
```

Restart Claude Desktop. Try:

> *Underwrite MLS X12345678 as a buy-and-hold with 25% down.*
> *Find me triplexes in Calgary with positive cash flow.*
> *Show me my last 5 underwritings.*
> *Submit my analysis of MLS X12345678 to the community feed.*

### 2b. Use with Codex CLI / Cursor / Continue

Any MCP-compatible client works. Codex CLI:

```bash
codex mcp add realist -- npx -y @realist/mcp
codex mcp env set realist REALIST_API_KEY realist_live_...
```

### 2c. Use as a CLI

```bash
npm install -g @realist/mcp
export REALIST_API_KEY=realist_live_...

realist whoami
realist underwrite X12345678 --strategy buyHold --down 25
realist analyze "123 Main St, Hamilton ON" 750000 --rent 4200 --units 3
realist find "4-plex in Hamilton under 900k"
realist list --limit 10
realist submit X12345678 --analysis abc-123 --title "Strong cash flow"
realist rates
realist market Toronto
```

Or save the key once in `~/.realist/config.json`:

```json
{ "apiKey": "realist_live_..." }
```

## Environment variables

| Var | Default | Purpose |
|---|---|---|
| `REALIST_API_KEY` | (required) | Your API key |
| `REALIST_BASE_URL` | `https://realist.ca` | Override for self-hosted / staging |

## Development

```bash
cd mcp-realist
npm install
npm run dev      # run MCP server in stdio mode
npm run cli -- whoami
npm run build    # compile to dist/
```

## Publishing

```bash
npm version patch
npm publish --access public
```

The package binary names are:
- `realist-mcp` — entry point Claude/Codex spawn over stdio
- `realist` — CLI

## Security notes

- Keys are returned **once** at creation time and stored only as SHA-256 hashes server-side
- Revoke any key from `realist.ca/account/api-keys` — no app restart required
- All requests carry `Authorization: Bearer <key>`; never share the key in screenshots, logs, or commit history
- Rate limits, scopes, and per-key quotas are enforced server-side

## License

MIT © Realist.ca
