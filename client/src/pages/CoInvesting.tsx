import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { Users, Search, PlusCircle, AlertTriangle, Shield, Home, TrendingUp, CheckCircle } from "lucide-react";

export default function CoInvesting() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="text-center mb-12">
          <Badge className="mb-4" variant="secondary">Beta</Badge>
          <h1 className="text-4xl font-bold mb-4">Co-Investing</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Find partners, pool capital, and invest in real estate together. 
            Connect with like-minded investors for your next deal.
          </p>
        </div>

        <Card className="mb-8 border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-2">Educational Information Only</h3>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  This tool provides general educational information about co-ownership and deal complexity. 
                  It does not provide legal, tax, or securities advice. If your deal involves passive investors, 
                  public fundraising, multiple properties, or a managing sponsor promising returns, 
                  you may need professional advice and/or a compliant structure.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <Card className="hover-elevate">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5 text-primary" />
                Browse Opportunities
              </CardTitle>
              <CardDescription>
                Explore active co-investing groups looking for partners
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Search groups by location, strategy, capital range, and skills needed. 
                Find the perfect fit for your investment goals.
              </p>
              <Link href="/coinvesting/opportunities">
                <Button className="w-full" data-testid="button-browse-groups">
                  <Search className="h-4 w-4 mr-2" />
                  Browse Groups
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PlusCircle className="h-5 w-5 text-primary" />
                Create a Group
              </CardTitle>
              <CardDescription>
                Start your own co-investing group for a specific property
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Define your target deal, set criteria, and invite partners 
                who bring complementary skills and capital.
              </p>
              <Link href={isAuthenticated ? "/coinvesting/groups/new" : "/login"}>
                <Button className="w-full" data-testid="button-create-group">
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Create Group
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6 text-center">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">1. Build Your Profile</h3>
                <p className="text-sm text-muted-foreground">
                  Share your skills, capital range, and investment preferences to find matching opportunities.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Home className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">2. Find or Create a Group</h3>
                <p className="text-sm text-muted-foreground">
                  Browse existing opportunities or start your own group for a specific property deal.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">3. Invest Together</h3>
                <p className="text-sm text-muted-foreground">
                  Coordinate with your group, run the complexity checklist, and pursue the deal together.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="mb-12">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Deal Complexity Checklist
            </CardTitle>
            <CardDescription>
              Understand whether your co-investing arrangement is simple co-ownership 
              or may require additional structure
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Our educational checklist helps you identify factors that commonly indicate 
              whether a deal has characteristics of simple co-ownership or may warrant 
              professional advice about securities, tax, or legal considerations.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/coinvesting/checklist">
                <Button variant="outline" data-testid="button-run-checklist">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Run Standalone Checklist
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground">
          <p>
            Co-investing through this platform is for educational and networking purposes. 
            Always consult with qualified professionals before making investment decisions.
          </p>
        </div>
      </main>
    </div>
  );
}
