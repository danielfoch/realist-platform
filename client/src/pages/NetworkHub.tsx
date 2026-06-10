import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Users, Handshake, Briefcase, MapPin, Calendar } from "lucide-react";

const networkOptions = [
  {
    href: "/tools/coinvest",
    title: "Find Co-Investors",
    description: "Connect with investors looking to pool capital on real estate deals. Browse opportunities or create your own investment group.",
    icon: Handshake,
    primary: true,
  },
  {
    href: "/realtor/buyboxes",
    title: "For Realtors",
    description: "View buyer mandates and connect with investors looking for properties in your market.",
    icon: Briefcase,
  },
  {
    href: "/community/events",
    title: "Local Events",
    description: "Attend workshops and meetups to meet investors in person.",
    icon: Calendar,
  },
];

export default function NetworkHub() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Grow Your Network</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Connect with investors, professionals, and potential partners to expand your real estate network.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {networkOptions.map((option) => (
            <Link key={option.href} href={option.href}>
              <Card className={`h-full hover-elevate cursor-pointer transition-all ${option.primary ? "border-primary/50 bg-primary/5" : ""}`}>
                <CardHeader>
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${option.primary ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    <option.icon className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-xl">{option.title}</CardTitle>
                  <CardDescription className="text-sm">{option.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant={option.primary ? "default" : "outline"} className="w-full" data-testid={`button-${option.title.toLowerCase().replace(/\s+/g, "-")}`}>
                    {option.primary ? "Find Partners" : "Explore"}
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
