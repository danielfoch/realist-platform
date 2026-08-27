/**
 * ConfigReportPage — the route target for config reports at
 * /insights/reports/:slug. Looks the slug up in the shared/reports content dir
 * and renders it via ReportRenderer. Unknown slugs show a friendly not-found
 * (the server SEO layer already returns HTTP 404 + noindex for these).
 */
import { Link, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CONFIG_REPORT_ROUTE_PREFIX, type ReportContent } from "@shared/reportContent";
import { getConfigReport } from "@shared/reports";
import { ReportRenderer } from "@/components/reports/ReportRenderer";

export default function ConfigReportPage() {
  const [, params] = useRoute(`${CONFIG_REPORT_ROUTE_PREFIX}/:slug`);
  const staticReport = getConfigReport(params?.slug);
  const search = typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const previewId = search.get("previewId");
  const previewToken = search.get("token");
  const isPreview = Boolean(previewId && previewToken);
  const { data: dynamicReport, isLoading } = useQuery<ReportContent>({
    queryKey: ["research-report", params?.slug, previewId, previewToken],
    enabled: Boolean(params?.slug && (isPreview || !staticReport)),
    retry: false,
    queryFn: async () => {
      const preview = previewId && previewToken;
      const url = preview
        ? `/api/research/preview/${encodeURIComponent(previewId)}?token=${encodeURIComponent(previewToken)}`
        : `/api/research/articles/${encodeURIComponent(params!.slug!)}`;
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Report not found");
      const payload = await response.json();
      return preview ? payload.article.articleJson : payload;
    },
  });
  const report = isPreview ? dynamicReport : staticReport || dynamicReport;

  if ((isPreview || !staticReport) && isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container max-w-6xl mx-auto space-y-6 px-4 py-12">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-6 w-full max-w-2xl" />
          <Skeleton className="h-72 w-full" />
        </main>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container max-w-3xl mx-auto px-4 py-20 text-center">
          <p className="text-muted-foreground mb-4">This report could not be found.</p>
          <Link href="/insights">
            <Button>Browse Research</Button>
          </Link>
        </main>
      </div>
    );
  }

  return <ReportRenderer report={report} noIndex={isPreview} />;
}
