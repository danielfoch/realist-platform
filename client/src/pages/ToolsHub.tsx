import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Calculator, MapPin, Handshake, TrendingUp, Home, FileSpreadsheet } from "lucide-react";

const tools = [
  {
    href: "/tools/analyzer",
    title: "Deal Analyzer",
    description: "Analyze any real estate deal with institutional-grade financial calculations. Get cap rates, IRR, cash-on-cash returns, and multi-year projections.",
    icon: Calculator,
    primary: true,
  },
  {
    href: "/tools/buybox",
    title: "BuyBox Builder",
    description: "Define your investment criteria and let realtors find properties that match your specific requirements.",
    icon: MapPin,
  },
  {
    href: "/tools/coinvest",
    title: "Co-Invest Finder",
    description: "Find investment partners to pool capital and share expertise on real estate deals.",
    icon: Handshake,
  },
  {
    href: "/tools/analyzer?calc=mli",
    title: "MLI Select Calculator",
    description: "Calculate CMHC MLI Select points and optimize your financing for multi-family properties.",
    icon: TrendingUp,
  },
  {
    href: "/tools/analyzer?calc=reno",
    title: "Renovation Estimator",
    description: "Get accurate renovation cost estimates for your real estate projects.",
    icon: Home,
  },
  {
    href: "/compare",
    title: "Compare Analyses",
    description: "Compare multiple deal analyses side-by-side to make informed investment decisions.",
    icon: FileSpreadsheet,
  },
];

export default function ToolsHub() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Investment Tools</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Professional-grade calculators and tools to analyze, compare, and optimize your real estate investments.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tools.map((tool) => (
            <Link key={tool.href} href={tool.href}>
              <Card className={`h-full hover-elevate cursor-pointer transition-all ${tool.primary ? "border-primary/50 bg-primary/5" : ""}`}>
                <CardHeader>
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${tool.primary ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    <tool.icon className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-xl">{tool.title}</CardTitle>
                  <CardDescription className="text-sm">{tool.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant={tool.primary ? "default" : "outline"} className="w-full" data-testid={`button-${tool.title.toLowerCase().replace(/\s+/g, "-")}`}>
                    {tool.primary ? "Get Started" : "Open Tool"}
                  </Button>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
