/**
 * "Connect your agent" snippets, per harness. One component so the public
 * /developers page and the signed-in /account/api-keys page can never drift.
 *
 * Everything points at the hosted MCP endpoint (a URL + an API key — nothing to
 * install) or the REST API. Pass `apiKey` to get paste-ready snippets; without
 * it a placeholder is shown.
 */
import { useState } from "react";
import { Check, Copy, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const REALIST_MCP_URL = "https://realist.ca/mcp";
export const REALIST_API_BASE = "https://realist.ca/api/v1";
const KEY_PLACEHOLDER = "realist_live_YOUR_KEY";

export function CodeBlock({ code, label, testId }: { code: string; label?: string; testId: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — the text is still selectable.
    }
  };
  return (
    <div>
      {label && <p className="text-sm font-medium mb-2">{label}</p>}
      <div className="relative rounded-lg border bg-muted/60">
        <pre className="p-4 pr-24 overflow-x-auto text-xs leading-5 font-mono" data-testid={`code-${testId}`}>{code}</pre>
        {/* Positioned by a wrapper: Button's hover-elevate utility sets position: relative, which beats `absolute`. */}
        <div className="absolute top-2 right-2">
          <Button type="button" size="sm" variant="ghost" className="h-8 gap-1.5 bg-muted/80 backdrop-blur" onClick={copy} data-testid={`button-copy-${testId}`}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground leading-6">{children}</p>;
}

export function ConnectGuide({ apiKey }: { apiKey?: string | null }) {
  const key = apiKey || KEY_PLACEHOLDER;

  return (
    <Tabs defaultValue="claude-code" data-testid="connect-guide">
      <TabsList className="flex h-auto flex-wrap justify-start gap-1">
        <TabsTrigger value="claude-code">Claude Code</TabsTrigger>
        <TabsTrigger value="claude-app">Claude &amp; ChatGPT apps</TabsTrigger>
        <TabsTrigger value="codex">Codex</TabsTrigger>
        <TabsTrigger value="cursor">Cursor / VS Code</TabsTrigger>
        <TabsTrigger value="apis">Grok, OpenAI &amp; Claude APIs</TabsTrigger>
        <TabsTrigger value="rest">REST / any harness</TabsTrigger>
      </TabsList>

      <TabsContent value="claude-code" className="space-y-4 mt-4">
        <CodeBlock
          testId="claude-code"
          label="Run once in your terminal"
          code={`claude mcp add --transport http realist ${REALIST_MCP_URL} \\\n  --header "Authorization: Bearer ${key}"`}
        />
        <Note>Then ask: <em>“Underwrite 123 Main St, Hamilton at $750k with $4,200 rent and give me the spreadsheet.”</em></Note>
      </TabsContent>

      <TabsContent value="claude-app" className="space-y-4 mt-4">
        <Note>
          The Claude apps (claude.ai, desktop, mobile) and ChatGPT add remote MCP servers as <strong>custom connectors</strong>.
          No key needed — paste the server URL, then sign in to Realist and approve when the app sends you here:
        </Note>
        <CodeBlock testId="connector-url" code={REALIST_MCP_URL} />
        <Note>
          <strong>Claude:</strong> Settings → Connectors → Add custom connector → paste the URL → Connect.{" "}
          <strong>ChatGPT:</strong> Settings → Connectors → enable developer mode → add an MCP server with OAuth authentication.
          You choose what the app may do, and can disconnect it any time from your API keys page.
        </Note>
        <details className="rounded-lg border p-4 text-sm">
          <summary className="cursor-pointer font-medium">My app can't do OAuth or send headers</summary>
          <div className="mt-3 space-y-3">
            <Note>Use a personal connector URL instead — the API key rides in the path, with authentication set to none:</Note>
            <CodeBlock testId="connector-secret-url" code={`${REALIST_MCP_URL}/u/${key}`} />
            <div className="flex gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 leading-6">
              <ShieldAlert className="h-5 w-5 shrink-0 text-amber-500 mt-0.5" />
              <p className="text-muted-foreground">
                That URL contains your key, so treat it like a password: don't post it or screenshot it. If it leaks, revoke the key on the
                API keys page and the URL stops working immediately.
              </p>
            </div>
          </div>
        </details>
      </TabsContent>

      <TabsContent value="codex" className="space-y-4 mt-4">
        <CodeBlock
          testId="codex"
          label="Run once in your terminal"
          code={`export REALIST_API_KEY="${key}"   # add to your shell profile\ncodex mcp add realist --url ${REALIST_MCP_URL} --bearer-token-env-var REALIST_API_KEY`}
        />
        <CodeBlock
          testId="codex-toml"
          label="…or add it to ~/.codex/config.toml"
          code={`[mcp_servers.realist]\nurl = "${REALIST_MCP_URL}"\nbearer_token_env_var = "REALIST_API_KEY"`}
        />
      </TabsContent>

      <TabsContent value="cursor" className="space-y-4 mt-4">
        <CodeBlock
          testId="cursor"
          label="Cursor — ~/.cursor/mcp.json"
          code={JSON.stringify({ mcpServers: { realist: { url: REALIST_MCP_URL, headers: { Authorization: `Bearer ${key}` } } } }, null, 2)}
        />
        <CodeBlock
          testId="vscode"
          label="VS Code — .vscode/mcp.json"
          code={JSON.stringify({ servers: { realist: { type: "http", url: REALIST_MCP_URL, headers: { Authorization: `Bearer ${key}` } } } }, null, 2)}
        />
      </TabsContent>

      <TabsContent value="apis" className="space-y-4 mt-4">
        <Note>Building your own agent? The model APIs can call the Realist MCP server for you — no tool loop to write.</Note>
        <CodeBlock
          testId="xai"
          label="Grok (xAI API) and OpenAI Responses API — remote MCP tool"
          code={`tools = [{\n    "type": "mcp",\n    "server_label": "realist",\n    "server_url": "${REALIST_MCP_URL}",\n    "authorization": "${key}",\n}]`}
        />
        <CodeBlock
          testId="anthropic"
          label="Claude API — MCP connector (Python)"
          code={`import anthropic\n\nclient = anthropic.Anthropic()\nresponse = client.beta.messages.create(\n    model="claude-opus-5",\n    max_tokens=16000,\n    betas=["mcp-client-2025-11-20"],\n    mcp_servers=[{\n        "type": "url",\n        "url": "${REALIST_MCP_URL}",\n        "name": "realist",\n        "authorization_token": "${key}",\n    }],\n    tools=[{"type": "mcp_toolset", "mcp_server_name": "realist"}],\n    messages=[{"role": "user", "content": "Find 4-plexes in Hamilton under $900k and underwrite the best one."}],\n)`}
        />
      </TabsContent>

      <TabsContent value="rest" className="space-y-4 mt-4">
        <Note>
          No MCP support? Every tool is also a plain <code className="font-mono text-xs">POST</code>. Load the JSON Schemas from{" "}
          <code className="font-mono text-xs">/tools</code> to register them as functions with any function-calling model (Gemini, Llama, Muse,
          Mistral…), or import the OpenAPI document into a custom GPT action or an OpenAPI toolkit.
        </Note>
        <CodeBlock
          testId="curl"
          label="Underwrite a deal"
          code={`curl -s ${REALIST_API_BASE}/tools/realist_underwrite_custom \\\n  -H "Authorization: Bearer ${key}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"address": "123 Main St", "city": "Hamilton", "price": 750000, "monthlyRent": 4200, "units": 3}'\n\n# → { "ok": true, "result": { "summary": "Cap rate 3.9% · …", "view": { "url": "https://realist.ca/v/…" }, … } }`}
        />
        <CodeBlock
          testId="discovery"
          label="Discovery (no key needed)"
          code={`curl -s ${REALIST_API_BASE}/tools          # tool catalog with JSON Schemas\ncurl -s ${REALIST_API_BASE}/openapi.json   # OpenAPI 3.1`}
        />
      </TabsContent>
    </Tabs>
  );
}
