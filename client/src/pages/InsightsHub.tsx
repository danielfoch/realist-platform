import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Radio, BookOpen, FileText, TrendingUp, AlertTriangle } from "lucide-react";

const insightItems = [
  {
    href: "/insights/podcast",
    title: "Podcast",
    description: "Listen to in-depth discussions with successful real estate investors, market analysts, and industry experts.",
    icon: Radio,
  },
  {
    href: "/insights/blog",
    title: "Blog & Research",
    description: "Read the latest articles, market analysis, and investment strategies from our team.",
    icon: BookOpen,
  },
  {
    href: "/insights/guides",
    title: "Guides & Resources",
    description: "Educational resources, how-to guides, and templates to help you become a better investor.",
    icon: FileText,
  },
  {
    href: "/insights/distress-report",
    title: "Distress Report",
    description: "Monthly snapshot of foreclosures, power of sale, motivated sellers, and VTB opportunities across Canada.",
    icon: AlertTriangle,
  },
];

export default function InsightsHub() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Insights</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Stay informed with podcasts, articles, and educational resources from real estate experts.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {insightItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <Card className="h-full hover-elevate cursor-pointer transition-all">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center mb-4">
                    <item.icon className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-xl">{item.title}</CardTitle>
                  <CardDescription className="text-sm">{item.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full" data-testid={`button-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                    Explore
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
