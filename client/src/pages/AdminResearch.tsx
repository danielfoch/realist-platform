import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigation } from "@/components/Navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Clipboard, Eye, FileText, ShieldCheck } from "lucide-react";
import type { ReportContent, ReportSection } from "@shared/reportContent";

type ResearchArticle = {
  id: string;
  sourceId: string;
  slug: string;
  title: string;
  dek: string;
  status: string;
  articleJson: ReportContent;
  validationErrors: string[];
  previewUrl: string;
  publishBlockedReason: string | null;
  createdAt: string;
  updatedAt: string;
};

function sectionLabel(section: ReportSection): string {
  if (section.type === "chart") return `Chart: ${section.title}`;
  if (section.type === "statGrid") return `Stats: ${section.heading || `${section.stats.length} items`}`;
  if (section.type === "callout") return `Callout: ${section.heading || "Untitled"}`;
  return section.heading || "Narrative";
}

export default function AdminResearch() {
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<ResearchArticle[]>({
    queryKey: ["/api/admin/research/articles"],
    retry: false,
  });

  const articles = data || [];
  const selected = useMemo(
    () => articles.find((article) => article.id === selectedId) || articles[0],
    [articles, selectedId],
  );

  async function refreshPreview(article: ResearchArticle) {
    setBusyId(article.id);
    try {
      const res = await apiRequest("POST", `/api/admin/research/articles/${article.id}/preview-link`, {});
      const body = await res.json();
      await navigator.clipboard?.writeText(body.previewUrl);
      toast({ title: "Signed preview link copied" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/research/articles"] });
    } finally {
      setBusyId(null);
    }
  }

  async function recordPublishAttempt(article: ResearchArticle) {
    setBusyId(article.id);
    try {
      const key = `admin-${article.id}-${Date.now()}`;
      const res = await apiRequest("POST", `/api/admin/research/articles/${article.id}/publish`, {
        idempotencyKey: key,
        confirm: "publish",
      });
      const body = await res.json();
      toast({ title: "Publish remains disabled", description: body.message || "Attempt recorded as blocked." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/research/articles"] });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              <h1 className="text-3xl font-bold tracking-tight">Research publishing</h1>
            </div>
            <p className="text-muted-foreground">Review DB-backed report drafts before any public publish workflow exists.</p>
          </div>
          <Badge variant="outline" className="gap-1">
            <ShieldCheck className="h-3 w-3" />
            Publish disabled
          </Badge>
        </div>

        {error ? (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">Admin access required or research table migration not applied.</CardContent>
          </Card>
        ) : isLoading ? (
          <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
          </div>
        ) : articles.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">No research drafts have been ingested yet.</CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
            <div className="space-y-3">
              {articles.map((article) => (
                <button
                  key={article.id}
                  type="button"
                  onClick={() => setSelectedId(article.id)}
                  className={`w-full rounded-lg border p-4 text-left transition hover:bg-muted/40 ${
                    selected?.id === article.id ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <Badge variant={article.validationErrors.length ? "destructive" : "secondary"}>{article.status}</Badge>
                    <span className="text-xs text-muted-foreground">{new Date(article.createdAt).toLocaleDateString()}</span>
                  </div>
                  <h2 className="font-semibold leading-snug">{article.title}</h2>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{article.dek}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{article.slug}</p>
                </button>
              ))}
            </div>

            {selected && (
              <Card>
                <CardHeader className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-2xl">{selected.articleJson.title}</CardTitle>
                      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{selected.articleJson.dek}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" className="gap-2" disabled={busyId === selected.id} onClick={() => refreshPreview(selected)}>
                        <Clipboard className="h-4 w-4" />
                        Copy preview
                      </Button>
                      <a href={selected.previewUrl} target="_blank" rel="noreferrer">
                        <Button variant="outline" size="sm" className="gap-2">
                          <Eye className="h-4 w-4" />
                          Open JSON
                        </Button>
                      </a>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busyId === selected.id || selected.validationErrors.length > 0}
                        onClick={() => recordPublishAttempt(selected)}
                      >
                        Record publish attempt
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {selected.validationErrors.length > 0 && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-destructive">
                        <AlertTriangle className="h-4 w-4" />
                        Validation issues
                      </div>
                      <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                        {selected.validationErrors.map((issue) => (
                          <li key={issue}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selected.publishBlockedReason && (
                    <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                      {selected.publishBlockedReason}
                    </div>
                  )}

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border p-3">
                      <div className="text-xs text-muted-foreground">Kind</div>
                      <div className="font-medium capitalize">{selected.articleJson.kind}</div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-xs text-muted-foreground">Sections</div>
                      <div className="font-medium">{selected.articleJson.sections.length}</div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-xs text-muted-foreground">Sources</div>
                      <div className="font-medium">{selected.articleJson.sources.length}</div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold uppercase text-muted-foreground">Preview outline</h3>
                    {selected.articleJson.sections.map((section, index) => (
                      <div key={`${section.type}-${index}`} className="rounded-lg border p-4">
                        <div className="text-sm font-medium">{sectionLabel(section)}</div>
                        {section.type === "narrative" && (
                          <p className="mt-2 line-clamp-4 whitespace-pre-line text-sm text-muted-foreground">{section.body}</p>
                        )}
                        {section.type === "callout" && (
                          <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{section.body}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
