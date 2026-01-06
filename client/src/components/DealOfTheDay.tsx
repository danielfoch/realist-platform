import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, DollarSign, Percent, Building2, ArrowRight, Flame } from "lucide-react";
import dealImage from "@assets/stock_images/modern_luxury_real_e_8d8b52c6.jpg";

interface DealOfTheDayProps {
  onAnalyzeClick: () => void;
}

export function DealOfTheDay({ onAnalyzeClick }: DealOfTheDayProps) {
  const featuredDeal = {
    title: "Duplex Investment Opportunity",
    location: "Hamilton, Ontario",
    price: 649000,
    monthlyRent: 4200,
    capRate: 6.8,
    cashOnCash: 9.2,
    monthlyCashFlow: 485,
    dscr: 1.32,
    strategy: "Buy & Hold",
    highlights: ["Below market value", "Strong rental demand", "Value-add potential"],
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <section className="py-12 md:py-16 bg-gradient-to-b from-background to-muted/30">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Flame className="h-6 w-6 text-primary" />
          <h2 className="text-2xl md:text-3xl font-bold text-center">Deal of the Day</h2>
          <Flame className="h-6 w-6 text-primary" />
        </div>

        <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-card to-card/80">
          <div className="grid md:grid-cols-2 gap-0">
            <div className="relative h-64 md:h-auto min-h-[300px]">
              <img
                src={dealImage}
                alt={featuredDeal.title}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <Badge className="mb-2 bg-primary text-primary-foreground">
                  {featuredDeal.strategy}
                </Badge>
                <h3 className="text-xl md:text-2xl font-bold text-white mb-1">
                  {featuredDeal.title}
                </h3>
                <p className="text-white/80 text-sm">{featuredDeal.location}</p>
              </div>
            </div>

            <CardContent className="p-6 md:p-8 flex flex-col justify-between">
              <div>
                <div className="flex items-baseline gap-2 mb-6">
                  <span className="text-3xl md:text-4xl font-bold font-mono">
                    {formatCurrency(featuredDeal.price)}
                  </span>
                  <span className="text-muted-foreground text-sm">asking price</span>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                      <Percent className="h-4 w-4" />
                      <span>Cap Rate</span>
                    </div>
                    <span className="text-2xl font-bold font-mono text-accent">
                      {featuredDeal.capRate}%
                    </span>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                      <TrendingUp className="h-4 w-4" />
                      <span>Cash on Cash</span>
                    </div>
                    <span className="text-2xl font-bold font-mono text-accent">
                      {featuredDeal.cashOnCash}%
                    </span>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                      <DollarSign className="h-4 w-4" />
                      <span>Monthly Cash Flow</span>
                    </div>
                    <span className="text-2xl font-bold font-mono text-accent">
                      {formatCurrency(featuredDeal.monthlyCashFlow)}
                    </span>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                      <Building2 className="h-4 w-4" />
                      <span>DSCR</span>
                    </div>
                    <span className="text-2xl font-bold font-mono text-accent">
                      {featuredDeal.dscr}x
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-6">
                  {featuredDeal.highlights.map((highlight, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {highlight}
                    </Badge>
                  ))}
                </div>
              </div>

              <Button 
                size="lg" 
                className="w-full gap-2"
                onClick={onAnalyzeClick}
                data-testid="button-analyze-similar"
              >
                Analyze Your Own Deal
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </div>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-4">
          Featured deal updated daily. Use our analyzer to evaluate any property.
        </p>
      </div>
    </section>
  );
}
