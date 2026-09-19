# @realist/mcp

**stdio bridge + CLI for the [Realist.ca](https://realist.ca) agent platform** — search Canadian MLS® deals, underwrite properties, estimate rents, model Toronto multiplexes and pull market data from any MCP-compatible AI agent.

> **You probably don't need this package.** Realist runs a hosted MCP server: point your harness at
> `https://realist.ca/mcp` with an API key and there is nothing to install. See
> [realist.ca/developers](https://realist.ca/developers) for copy-paste setup for Claude Code, the Claude and
> ChatGPT apps, Codex, Cursor, VS Code, and the Grok / OpenAI / Claude APIs.
>
> Use this package when your MCP client can only launch **local stdio servers**, or when you want the `realist` CLI.

## How it works

The bridge ships no tool definitions of its own. On startup it reads the live catalog from
`GET /api/v1/tools` (filtered to what your key's scopes allow) and forwards every call to
`POST /api/v1/tools/:name`. When Realist adds or changes a tool, you get it without upgrading.

Tools that produce something worth seeing return a `view.url` — an interactive page on realist.ca (an
editable pro forma spreadsheet with an Excel download, a multiplex model, a chart report). The bridge puts
that link at the top of the tool result so your agent shows it to you.

## Setup

### 1. Mint an API key

Sign in at [realist.ca](https://realist.ca), then go to **[Account → API Keys](https://realist.ca/account/api-keys)** and create one. Copy it immediately — it's shown only once.

### 2a. Use as a local MCP server

Any client that launches stdio servers works. Claude Desktop (`claude_desktop_config.json`), Cursor (`mcp.json`) and friends all take this shape:

```json
{
  "mcpServers": {
    "realist": {
      "command": "npx",
      "args": ["-y", "@realist/mcp"],
      "env": { "REALIST_API_KEY": "realist_live_..." }
    }
  }
}
```

Then try:

> *Underwrite 123 Main St, Hamilton at $750k with $4,200 rent and give me the spreadsheet.*
> *Find 4-plexes in Hamilton under $900k and underwrite the best one.*
> *What if I put 25% down at 4.9%?*

### 2b. Use as a CLI

```bash
npm install -g @realist/mcp
export REALIST_API_KEY=realist_live_...

realist whoami
realist underwrite X12345678 --strategy buyHold --down 25
realist analyze "123 Main St, Hamilton ON" 750000 --rent 4200 --units 3
realist find "4-plex in Hamilton under 900k"
realist list --limit 10
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
| `REALIST_BASE_URL` | `https://realist.ca` | Override for staging / local development |

## Development

```bash
cd mcp-realist
npm install
npm run dev      # run the stdio bridge
npm run cli -- whoami
npm run build    # compile to dist/
```

The tool registry lives in the main app at `server/agent/tools.ts`; architecture notes are in
`docs/AGENT_PLATFORM.md`.

## Publishing

```bash
npm version patch
npm publish --access public
```

The package binary names are:
- `realist-mcp` — entry point MCP clients spawn over stdio
- `realist` — CLI

## Security notes

- Keys are returned **once** at creation time and stored only as SHA-256 hashes server-side
- Revoke any key from `realist.ca/account/api-keys` — no app restart required
- All requests carry `Authorization: Bearer <key>`; never share the key in screenshots, logs, or commit history
- Rate limits (60/min, 2,000/day per key), scopes and usage metering are enforced server-side

## License

MIT © Realist.ca
