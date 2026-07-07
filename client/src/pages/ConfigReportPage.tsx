/**
 * ConfigReportPage — the route target for config reports at
 * /insights/reports/:slug. Looks the slug up in the shared/reports content dir
 * and renders it via ReportRenderer. Unknown slugs show a friendly not-found
 * (the server SEO layer already returns HTTP 404 + noindex for these).
 */
import { Link, useRoute } from "wouter";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { CONFIG_REPORT_ROUTE_PREFIX } from "@shared/reportContent";
import { getConfigReport } from "@shared/reports";
import { ReportRenderer } from "@/components/reports/ReportRenderer";

export default function ConfigReportPage() {
  const [, params] = useRoute(`${CONFIG_REPORT_ROUTE_PREFIX}/:slug`);
  const report = getConfigReport(params?.slug);

  if (!report) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container max-w-3xl mx-auto px-4 py-20 text-center">
          <p className="text-muted-foreground mb-4">This report could not be found.</p>
          <Link href="/reports">
            <Button>Browse Reports</Button>
          </Link>
        </main>
      </div>
    );
  }

  return <ReportRenderer report={report} />;
}
