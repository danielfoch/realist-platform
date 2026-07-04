import { Navigation } from "@/components/Navigation";
import { NextStepBlock } from "@/components/NextStepBlock";
import { SEO } from "@/components/SEO";
import { SHARED_ROUTE_META } from "@shared/routeMeta";
import { RentToOwnCalculator } from "@/components/RentToOwnCalculator";

export default function RentToOwn() {
  const meta = SHARED_ROUTE_META["/tools/rent-to-own"];

  return (
    <div className="min-h-screen bg-background">
      <SEO title={meta.title} description={meta.description} canonicalUrl="/tools/rent-to-own" />
      <Navigation />

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8 max-w-3xl">
          <h1 className="text-3xl md:text-4xl font-bold mb-3" data-testid="page-title">
            Buy vs Rent-to-Own Calculator
          </h1>
          <p className="text-muted-foreground" data-testid="page-description">
            Compare a traditional CMHC-insured purchase against a rent-to-own pathway like KeyOwn.
            See the upfront cash, monthly cost, equity path, and total 5-year cost side by side —
            then adjust the assumptions to your own numbers.
          </p>
        </div>

        <RentToOwnCalculator />
        <NextStepBlock sourcePage="/tools/rent-to-own" className="mt-8" />
      </main>
    </div>
  );
}
