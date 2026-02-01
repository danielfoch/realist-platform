import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { FileText, BookOpen, Calculator, TrendingUp, Home, DollarSign } from "lucide-react";

const guides = [
  {
    title: "Getting Started with Real Estate Investing",
    description: "A comprehensive beginner's guide to understanding real estate investment fundamentals.",
    icon: BookOpen,
    comingSoon: true,
  },
  {
    title: "How to Analyze a Deal",
    description: "Step-by-step walkthrough of using our Deal Analyzer to evaluate properties.",
    icon: Calculator,
    href: "/tools/analyzer",
  },
  {
    title: "Understanding Cap Rates & IRR",
    description: "Learn the key metrics that professional investors use to evaluate deals.",
    icon: TrendingUp,
    comingSoon: true,
  },
  {
    title: "BRRR Strategy Guide",
    description: "Master the Buy, Renovate, Rent, Refinance, Repeat strategy.",
    icon: Home,
    comingSoon: true,
  },
  {
    title: "Co-Investing Best Practices",
    description: "How to structure partnerships and pool capital effectively.",
    icon: DollarSign,
    href: "/tools/coinvest/checklist",
  },
];

export default function GuidesHub() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Guides & Resources</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Educational content to help you become a better real estate investor.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {guides.map((guide, index) => (
            guide.href ? (
              <Link key={index} href={guide.href}>
                <Card className="h-full hover-elevate cursor-pointer transition-all">
                  <CardHeader>
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center mb-4">
                      <guide.icon className="h-6 w-6" />
                    </div>
                    <CardTitle className="text-lg">{guide.title}</CardTitle>
                    <CardDescription className="text-sm">{guide.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" className="w-full">
                      Read Guide
                    </Button>
                  </CardContent>
                </Card>
              </Link>
            ) : (
              <Card key={index} className="h-full opacity-75">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center mb-4">
                    <guide.icon className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-lg">{guide.title}</CardTitle>
                  <CardDescription className="text-sm">{guide.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full" disabled>
                    Coming Soon
                  </Button>
                </CardContent>
              </Card>
            )
          ))}
        </div>
      </main>
    </div>
  );
}
