import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Calendar, Users, Handshake, ExternalLink } from "lucide-react";

const communityItems = [
  {
    href: "/community/events",
    title: "Events & Workshops",
    description: "Join live workshops, meetups, and networking events to learn from experienced investors and connect with the community.",
    icon: Calendar,
  },
  {
    href: "/community/network",
    title: "Grow Your Network",
    description: "Find and connect with other investors, professionals, and potential partners in your area.",
    icon: Users,
  },
  {
    href: "/tools/coinvest",
    title: "Find Co-Investors",
    description: "Looking for partners to pool capital on a deal? Use our co-investing tool to find like-minded investors.",
    icon: Handshake,
  },
  {
    href: "https://www.skool.com/realist",
    title: "Online Community",
    description: "Join our active community on Skool for discussions, Q&A, and exclusive content.",
    icon: Users,
    external: true,
  },
];

export default function CommunityHub() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Community</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Connect with fellow investors, attend events, and grow your real estate network.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {communityItems.map((item) => (
            item.external ? (
              <a key={item.href} href={item.href} target="_blank" rel="noopener noreferrer">
                <Card className="h-full hover-elevate cursor-pointer transition-all">
                  <CardHeader>
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center mb-4">
                      <item.icon className="h-6 w-6" />
                    </div>
                    <CardTitle className="text-xl flex items-center gap-2">
                      {item.title}
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </CardTitle>
                    <CardDescription className="text-sm">{item.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" className="w-full" data-testid={`button-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                      Visit Community
                    </Button>
                  </CardContent>
                </Card>
              </a>
            ) : (
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
            )
          ))}
        </div>
      </main>
    </div>
  );
}
