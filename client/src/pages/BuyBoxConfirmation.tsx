import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Download, FileText, MapPin, Users, ArrowRight } from "lucide-react";
import { format } from "date-fns";

export default function BuyBoxConfirmation() {
  const [, params] = useRoute("/buybox/confirmation/:id");
  const mandateId = params?.id;

  const { data: mandate, isLoading } = useQuery({
    queryKey: ["/api/buybox", mandateId],
    enabled: !!mandateId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="max-w-2xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold mb-2">BuyBox Submitted Successfully</h1>
          <p className="text-muted-foreground">
            Your property search mandate has been shared with our realtor network
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Mandate Details</span>
              <Badge variant="secondary" data-testid="badge-mandate-id">
                ID: {mandateId?.slice(0, 8)}
              </Badge>
            </CardTitle>
            <CardDescription>
              Created on {format(new Date(), "MMMM d, yyyy 'at' h:mm a")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium">Target Area Defined</p>
                <p className="text-sm text-muted-foreground">
                  Your search polygon has been saved and will be visible to realtors
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Users className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium">Shared with Realtor Network</p>
                <p className="text-sm text-muted-foreground">
                  Realtors with matching listings will be notified
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-purple-600 mt-0.5" />
              <div>
                <p className="font-medium">Agreement Signed</p>
                <p className="text-sm text-muted-foreground">
                  Your buyer representation agreement has been recorded
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Download Your Documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-start" data-testid="button-download-agreement">
              <Download className="h-4 w-4 mr-2" />
              Signed Agreement PDF
            </Button>
            <Button variant="outline" className="w-full justify-start" data-testid="button-download-mandate">
              <Download className="h-4 w-4 mr-2" />
              Mandate Summary PDF
            </Button>
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>What Happens Next?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">1</div>
              <div>
                <p className="font-medium">Realtors Review Your BuyBox</p>
                <p className="text-sm text-muted-foreground">
                  Our network of vetted realtors will see your search criteria
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">2</div>
              <div>
                <p className="font-medium">You'll Receive Property Matches</p>
                <p className="text-sm text-muted-foreground">
                  When a realtor has a matching property, they'll reach out to you
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">3</div>
              <div>
                <p className="font-medium">Schedule Showings & Make Offers</p>
                <p className="text-sm text-muted-foreground">
                  Work directly with realtors to find your perfect property
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/investor" className="flex-1">
            <Button variant="outline" className="w-full" data-testid="button-view-portal">
              View Investor Portal
            </Button>
          </Link>
          <Link href="/buybox" className="flex-1">
            <Button className="w-full" data-testid="button-create-another">
              Create Another BuyBox
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
