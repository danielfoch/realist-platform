import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Copy, Key, Trash2, Terminal, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ApiKeyRow = {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

export default function AccountApiKeys() {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [newlyCreated, setNewlyCreated] = useState<{ key: string; name: string } | null>(null);

  const { data, isLoading } = useQuery<{ keys: ApiKeyRow[] }>({
    queryKey: ["/api/api-keys"],
  });

  const createMutation = useMutation({
    mutationFn: async (keyName: string) => {
      const res = await apiRequest("POST", "/api/api-keys", { name: keyName });
      return res.json() as Promise<{ id: string; name: string; key: string; keyPrefix: string }>;
    },
    onSuccess: (created) => {
      setNewlyCreated({ key: created.key, name: created.name });
      setName("");
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to create key", description: err?.message || "Try again", variant: "destructive" });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/api-keys/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Key revoked" });
      queryClient.invalidateQueries({ queryKey: ["/api/api-keys"] });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  function PromptBlock({ text, label, testId }: { text: string; label?: string; testId: string }) {
    return (
      <div>
        {label && <p className="text-sm font-medium mb-2">{label}</p>}
        <div className="relative bg-muted rounded-md">
          <pre className="p-4 pr-14 overflow-x-auto text-xs whitespace-pre-wrap" data-testid={`code-${testId}`}>
            {text}
          </pre>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="absolute top-2 right-2"
            onClick={() => copyToClipboard(text)}
            data-testid={`button-copy-${testId}`}
          >
            <Copy className="w-4 h-4 mr-1" /> Copy
          </Button>
        </div>
      </div>
    );
  }

  const activeKeys = (data?.keys || []).filter((k) => !k.revokedAt);
  const revokedKeys = (data?.keys || []).filter((k) => k.revokedAt);

  return (
    <div className="container max-w-4xl mx-auto py-10 space-y-6" data-testid="page-api-keys">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <Key className="w-7 h-7" /> API Keys
        </h1>
        <p className="text-muted-foreground mt-2">
          Use these keys to connect Claude Desktop, the Codex CLI, or any MCP-compatible AI agent to your Realist account.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Terminal className="w-5 h-5" /> Connect Claude or Codex in 30 seconds</CardTitle>
          <CardDescription>
            Mint a key below, then copy one of the prompts and paste it into Claude or Codex CLI. The agent will handle the install for you.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <PromptBlock
            label="Codex CLI — paste this prompt"
            testId="prompt-codex"
            text={`Install the Realist MCP plugin so I can underwrite Canadian real estate deals from this terminal.

1. Run: codex mcp add realist -- npx -y @realist/mcp
2. Run: codex mcp env set realist REALIST_API_KEY <PASTE_YOUR_KEY_HERE>
3. Verify with: codex mcp call realist realist_whoami

Once it's working, list the 8 tools the realist server exposes and tell me how to underwrite an MLS listing.`}
          />

          <PromptBlock
            label="Claude Code / Cursor — paste this prompt"
            testId="prompt-claude-code"
            text={`Add the Realist MCP server to my agent so I can underwrite Canadian real estate deals.

1. Install globally: npm install -g @realist/mcp
2. Add this MCP server entry to my agent config:

{
  "mcpServers": {
    "realist": {
      "command": "npx",
      "args": ["-y", "@realist/mcp"],
      "env": { "REALIST_API_KEY": "<PASTE_YOUR_KEY_HERE>" }
    }
  }
}

3. Restart the agent, call the realist_underwrite_listing tool with MLS X12345678, and summarise the cap rate, monthly cash flow, and DSCR.`}
          />

          <div>
            <p className="text-sm font-medium mb-2">Claude Desktop — manual config (one-time)</p>
            <p className="text-xs text-muted-foreground mb-2">
              Open <code className="text-xs">~/Library/Application Support/Claude/claude_desktop_config.json</code> on macOS
              (or <code className="text-xs">%APPDATA%\Claude\claude_desktop_config.json</code> on Windows), paste this, then restart Claude Desktop.
            </p>
            <PromptBlock
              testId="prompt-claude-desktop"
              text={`{
  "mcpServers": {
    "realist": {
      "command": "npx",
      "args": ["-y", "@realist/mcp"],
      "env": { "REALIST_API_KEY": "<PASTE_YOUR_KEY_HERE>" }
    }
  }
}`}
            />
          </div>

          <p className="text-sm text-muted-foreground">
            Once connected you can ask: <em>"Underwrite MLS X12345678 as a buy-and-hold"</em>,
            {" "}<em>"Find 4-plex deals in Hamilton under $900k"</em>, or
            {" "}<em>"Submit my last analysis to the Realist community feed."</em>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create a new key</CardTitle>
          <CardDescription>Give it a memorable name (e.g. "Claude Desktop on MacBook").</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) createMutation.mutate(name.trim());
            }}
            className="flex gap-2"
          >
            <div className="flex-1">
              <Label htmlFor="key-name" className="sr-only">Key name</Label>
              <Input
                id="key-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Claude Desktop"
                maxLength={80}
                data-testid="input-key-name"
              />
            </div>
            <Button
              type="submit"
              disabled={!name.trim() || createMutation.isPending}
              data-testid="button-create-key"
            >
              {createMutation.isPending ? "Creating..." : "Create key"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {newlyCreated && (
        <Alert variant="default" className="border-amber-500" data-testid="alert-new-key">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertTitle>Save your key now — it won't be shown again</AlertTitle>
          <AlertDescription>
            <div className="flex items-center gap-2 mt-2 bg-muted p-3 rounded-md">
              <code className="flex-1 break-all font-mono text-sm" data-testid="text-new-key">{newlyCreated.key}</code>
              <Button size="sm" variant="ghost" onClick={() => copyToClipboard(newlyCreated.key)} data-testid="button-copy-key">
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <Button size="sm" variant="ghost" className="mt-2" onClick={() => setNewlyCreated(null)} data-testid="button-dismiss-new-key">
              I've saved it
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Your keys</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading...</p>
          ) : activeKeys.length === 0 && revokedKeys.length === 0 ? (
            <p className="text-muted-foreground text-sm" data-testid="text-no-keys">No keys yet. Create your first one above.</p>
          ) : (
            <div className="space-y-3">
              {activeKeys.map((k) => (
                <div
                  key={k.id}
                  className="flex items-center justify-between border rounded-md p-3"
                  data-testid={`row-key-${k.id}`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium" data-testid={`text-key-name-${k.id}`}>{k.name}</span>
                      <Badge variant="secondary" className="font-mono text-xs">{k.keyPrefix}…</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Created {new Date(k.createdAt).toLocaleDateString()} ·
                      {" "}{k.lastUsedAt ? `Last used ${new Date(k.lastUsedAt).toLocaleString()}` : "Never used"}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => revokeMutation.mutate(k.id)}
                    disabled={revokeMutation.isPending}
                    data-testid={`button-revoke-${k.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              {revokedKeys.length > 0 && (
                <div className="pt-3 border-t">
                  <p className="text-xs text-muted-foreground mb-2">Revoked</p>
                  {revokedKeys.map((k) => (
                    <div key={k.id} className="flex items-center justify-between text-sm text-muted-foreground py-1" data-testid={`row-revoked-${k.id}`}>
                      <span>{k.name} <Badge variant="outline" className="font-mono text-xs ml-2">{k.keyPrefix}…</Badge></span>
                      <span className="text-xs">Revoked {k.revokedAt ? new Date(k.revokedAt).toLocaleDateString() : ""}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
