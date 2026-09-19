/**
 * Frame around a hosted agent result (/v/:token): a slim branded header and a
 * footer with the disclaimer. Deliberately lighter than <Navigation /> — the
 * visitor arrived from their AI harness to look at one result, not to browse.
 */
import { useState, type ReactNode } from "react";
import { Link } from "wouter";
import { Check, Link2, Moon, Sparkles, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/lib/theme";
import type { AgentViewLink } from "@shared/agentViews";
import logoImage from "@assets/Untitled_design_(4)_1773356428184.webp";

export function CopyLinkButton() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked (permissions, insecure origin) — the URL bar still works.
    }
  };
  return (
    <Button variant="outline" size="sm" onClick={copy} className="gap-1.5" data-testid="button-copy-view-link">
      {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
      <span className="hidden sm:inline">{copied ? "Copied" : "Copy link"}</span>
    </Button>
  );
}

export function ViewHeader() {
  const { theme, toggleTheme } = useTheme();
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur print:hidden">
      <div className="max-w-7xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/" className="flex items-center gap-2 shrink-0" data-testid="link-view-home">
            <img src={logoImage} alt="Realist" className="h-7 w-7 object-contain dark:invert" />
            <span className="font-bold tracking-tight">Realist</span>
          </Link>
          <Badge variant="secondary" className="gap-1 font-normal hidden sm:inline-flex">
            <Sparkles className="h-3 w-3" />
            Result from your AI agent
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <CopyLinkButton />
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme" data-testid="button-view-theme">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </header>
  );
}

/** Site-relative links route in-app; absolute ones open in a new tab. */
export function ViewLink({ link, children, className }: { link: Pick<AgentViewLink, "href">; children: ReactNode; className?: string }) {
  if (link.href.startsWith("/")) {
    return <Link href={link.href} className={className}>{children}</Link>;
  }
  // Documents are built server-side, but never trust a stored href blindly: http(s) only.
  if (!/^https?:\/\//i.test(link.href)) return <span className={className}>{children}</span>;
  return <a href={link.href} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>;
}

export function ViewLinks({ links }: { links: AgentViewLink[] }) {
  if (!links.length) return null;
  return (
    <div className="flex flex-wrap gap-2 print:hidden" data-testid="view-links">
      {links.map((link) => (
        <Button key={link.href} asChild variant={link.primary ? "default" : "outline"} size="sm">
          <ViewLink link={link}>{link.label}</ViewLink>
        </Button>
      ))}
    </div>
  );
}

export function ViewFooter({ disclaimer, generatedAt, tool }: { disclaimer: string; generatedAt: string; tool: string }) {
  const generated = new Date(generatedAt);
  return (
    <footer className="border-t mt-12">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-3 text-xs text-muted-foreground leading-5">
        <p>{disclaimer}</p>
        <p>
          Generated {Number.isNaN(generated.getTime()) ? "" : generated.toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })} by{" "}
          <code className="font-mono">{tool}</code> via the Realist API. Anyone with this link can view this page.{" "}
          <Link href="/developers" className="underline underline-offset-2 hover:text-foreground">
            Connect your own AI agent to Realist
          </Link>
          .
        </p>
      </div>
    </footer>
  );
}
