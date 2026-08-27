import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, RefreshCw, Upload, WandSparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type EnrichmentRow = {
  episodeSlug: string;
  episodeTitle: string;
  episodePublishedAt: string | null;
  transcriptSourceKind: string;
  transcriptSourceUrl: string | null;
  transcriptLength: number;
  status: string;
  summaryText: string | null;
  keyTakeawaysJson: string[];
  faqJson: Array<{ question: string; answer: string }>;
  generationModel: string | null;
  generationError: string | null;
  reviewedAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
};

type FeedEpisode = { slug: string; title: string; pubDate: string };

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "published") return "default";
  if (status === "ready_for_review") return "secondary";
  if (status === "needs_revision") return "destructive";
  return "outline";
}

export function PodcastEnrichmentAdmin() {
  const { toast } = useToast();
  const [episodeSlug, setEpisodeSlug] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [transcriptText, setTranscriptText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const { data: rows = [], error } = useQuery<EnrichmentRow[]>({
    queryKey: ["/api/admin/podcast-enrichments"],
    retry: false,
  });
  const { data: episodes = [] } = useQuery<FeedEpisode[]>({
    queryKey: ["/api/podcast/episodes"],
    retry: false,
  });

  useEffect(() => {
    if (!episodeSlug && episodes[0]?.slug) setEpisodeSlug(episodes[0].slug);
  }, [episodeSlug, episodes]);

  async function refreshRows() {
    await queryClient.invalidateQueries({ queryKey: ["/api/admin/podcast-enrichments"] });
  }

  async function syncOmny() {
    setBusy("sync");
    try {
      const response = await apiRequest("POST", "/api/admin/podcast-enrichments/sync", {});
      const body = await response.json();
      const result = body.result;
      toast({
        title: "Publisher transcript check complete",
        description: `${result.drafted} draft(s) created; ${result.unavailable} recent episode(s) have no published Omny transcript.`,
      });
      await refreshRows();
    } catch (error: any) {
      toast({ title: "Transcript sync failed", description: error?.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }

  async function ingestTranscript() {
    setBusy("ingest");
    try {
      await apiRequest("POST", "/api/admin/podcast-enrichments/ingest", {
        episodeSlug,
        transcriptText,
        sourceKind: "publisher_upload",
        ...(sourceUrl.trim() ? { sourceUrl: sourceUrl.trim() } : {}),
        generate: true,
      });
      toast({ title: "Transcript ingested", description: "A transcript-backed draft is ready or queued for review." });
      setTranscriptText("");
      setSourceUrl("");
      await refreshRows();
    } catch (error: any) {
      toast({ title: "Transcript ingest failed", description: error?.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }

  async function generateDraft(slug: string) {
    setBusy(`generate:${slug}`);
    try {
      await apiRequest("POST", `/api/admin/podcast-enrichments/${encodeURIComponent(slug)}/generate`, {});
      toast({ title: "Editorial draft generated", description: "Review every summary, takeaway, and answer before publishing." });
      await refreshRows();
    } catch (error: any) {
      toast({ title: "Draft generation failed", description: error?.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }

  async function publishDraft(slug: string) {
    setBusy(`publish:${slug}`);
    try {
      const response = await apiRequest("POST", `/api/admin/podcast-enrichments/${encodeURIComponent(slug)}/publish`, { confirm: "publish" });
      const body = await response.json();
      toast({ title: "Episode brief published", description: body.publicUrl });
      await refreshRows();
      queryClient.invalidateQueries({ queryKey: [`/api/podcast/episodes/${slug}`] });
    } catch (error: any) {
      toast({ title: "Publish blocked", description: error?.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mt-12 border-t pt-10" data-testid="admin-podcast-enrichment">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Podcast evidence briefs</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Import publisher transcripts, generate transcript-grounded editorial drafts, and review them before they appear on episode pages.
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={syncOmny} disabled={busy !== null}>
          <RefreshCw className={`h-4 w-4 ${busy === "sync" ? "animate-spin" : ""}`} />
          Check Omny transcripts
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Manual publisher-transcript fallback</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <select
            value={episodeSlug}
            onChange={(event) => setEpisodeSlug(event.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            aria-label="Podcast episode"
          >
            <option value="">Select an RSS episode</option>
            {episodes.map((episode) => <option key={episode.slug} value={episode.slug}>{episode.title}</option>)}
          </select>
          <Input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="Optional HTTPS transcript source URL" />
          <Textarea
            value={transcriptText}
            onChange={(event) => setTranscriptText(event.target.value)}
            placeholder="Paste the publisher transcript (minimum 500 characters). It stays private; only the reviewed brief is public."
            className="min-h-40"
          />
          <Button className="gap-2" onClick={ingestTranscript} disabled={!episodeSlug || transcriptText.trim().length < 500 || busy !== null}>
            <Upload className="h-4 w-4" />
            Import and draft
          </Button>
        </CardContent>
      </Card>

      {error ? (
        <Card><CardContent className="flex gap-2 py-6 text-sm text-muted-foreground"><AlertTriangle className="h-4 w-4" />Apply the podcast enrichment migration to use this queue.</CardContent></Card>
      ) : rows.length === 0 ? (
        <Card><CardContent className="py-6 text-sm text-muted-foreground">No transcript drafts yet. Omny currently publishes episode audio and show notes even when a public transcript is unavailable.</CardContent></Card>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <Card key={row.episodeSlug}>
              <CardHeader className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Badge variant={statusVariant(row.status)}>{row.status.replaceAll("_", " ")}</Badge>
                    <CardTitle className="mt-2 text-xl">{row.episodeTitle}</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">{row.transcriptLength.toLocaleString()} transcript characters · {row.transcriptSourceKind.replaceAll("_", " ")}</p>
                  </div>
                  <div className="flex gap-2">
                    {row.status !== "published" && (
                      <Button variant="outline" size="sm" className="gap-2" disabled={busy !== null} onClick={() => generateDraft(row.episodeSlug)}>
                        <WandSparkles className="h-4 w-4" /> Regenerate
                      </Button>
                    )}
                    <Button size="sm" className="gap-2" disabled={busy !== null || row.status !== "ready_for_review"} onClick={() => publishDraft(row.episodeSlug)}>
                      <CheckCircle2 className="h-4 w-4" /> {row.status === "published" ? "Published" : "Publish reviewed brief"}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {row.generationError && <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{row.generationError}</div>}
                {row.summaryText && <div><h3 className="text-sm font-semibold">Summary</h3><p className="mt-1 whitespace-pre-line text-sm leading-6 text-muted-foreground">{row.summaryText}</p></div>}
                {row.keyTakeawaysJson.length > 0 && (
                  <div><h3 className="text-sm font-semibold">Takeaways</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{row.keyTakeawaysJson.map((item) => <li key={item}>{item}</li>)}</ul></div>
                )}
                {row.faqJson.length > 0 && (
                  <div><h3 className="text-sm font-semibold">FAQ</h3><div className="mt-2 space-y-2">{row.faqJson.map((item) => <div key={item.question} className="rounded-md border p-3 text-sm"><p className="font-medium">{item.question}</p><p className="mt-1 text-muted-foreground">{item.answer}</p></div>)}</div></div>
                )}
                <p className="text-xs text-muted-foreground">Publishing confirms a human reviewed the draft against the private transcript. Speaker claims remain attributed, not independently verified.</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
