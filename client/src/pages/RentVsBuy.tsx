import { Navigation } from "@/components/Navigation";
import { RentVsBuyCalculator } from "@/components/RentVsBuyCalculator";

export default function RentVsBuy() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-3" data-testid="text-rent-vs-buy-title">Rent vs Buy Calculator</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="text-rent-vs-buy-description">
            Compare the true financial impact of renting versus buying over time. Factor in appreciation, opportunity cost, maintenance, and more.
          </p>
        </div>
        <RentVsBuyCalculator country="canada" />
      </main>
    </div>
  );
}
