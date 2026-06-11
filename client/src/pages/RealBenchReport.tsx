import { Navigation } from "@/components/Navigation";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function RealBenchReport() {
  return (
    <>
      <SEO
        title="RealBench AI Realtor Benchmark | Realist.ca"
        description="The RealBench AI Realtor Benchmark — measuring realtor performance with data-driven metrics across Canadian markets."
        noIndex={false}
      />
      <Navigation />
      <div className="min-h-screen bg-background">
        <div className="max-w-5xl mx-auto px-4 py-16">
          <div className="mb-8">
            <Badge variant="outline" className="mb-4">Report</Badge>
            <h1 className="text-4xl font-bold tracking-tight mb-3">
              RealBench AI Realtor Benchmark
            </h1>
            <p className="text-muted-foreground text-lg">
              Data-driven performance metrics for Canadian real estate agents.
            </p>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Coming Soon</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                The RealBench AI Realtor Benchmark report is currently being prepared.
                Check back soon for comprehensive performance data across Canadian markets.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
