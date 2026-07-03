/**
 * RequireAccount — lightweight email/signup gate for tool pages.
 *
 * Free-account signup is the gate for using tools: wrap a page's content and
 * signed-out visitors see a create-account / sign-in wall instead (same
 * pattern as the Field Notebook's inline gate). Signed-in users render
 * children untouched.
 *
 *   <RequireAccount title="Multiplex Underwriter" description="...">
 *     <UnderwriterContent />
 *   </RequireAccount>
 *
 * NOTE: intentionally NOT applied to /tools/multiplex-underwriter yet — the
 * underwriter's gating decision ships with the underwriter PR.
 */
import type { ComponentType, ReactNode } from "react";
import { Link } from "wouter";
import { Loader2, Lock } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export interface RequireAccountProps {
  /** Tool name shown on the gate wall. */
  title: string;
  /** One-liner selling why it's worth the free account. */
  description?: string;
  icon?: ComponentType<{ className?: string }>;
  children: ReactNode;
}

export function RequireAccount({ title, description, icon: Icon = Lock, children }: RequireAccountProps) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <Icon className="w-8 h-8 text-primary" />
        </div>
        <div className="text-xs font-semibold uppercase tracking-widest text-primary mb-3" style={{ fontFamily: "var(--font-mono)" }}>
          Realist.ca
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-3">{title}</h1>
        <p className="text-muted-foreground text-base mb-8 leading-relaxed">
          {description ?? "Create a free account to use this tool and save your work to your profile."}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/create-account"
            className="px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors text-sm"
          >
            Create free account →
          </Link>
          <Link
            href="/login"
            className="px-6 py-3 border border-border bg-card text-foreground font-medium rounded-lg hover:bg-muted transition-colors text-sm"
          >
            Sign in
          </Link>
        </div>
        <p className="text-xs text-muted-foreground mt-8">Free to use · No credit card required</p>
      </div>
    );
  }

  return <>{children}</>;
}
