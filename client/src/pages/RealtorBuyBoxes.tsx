import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { MapPin, DollarSign, Home, Calendar, MessageSquare, Filter, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { buyBoxMandateStatuses, buyBoxBuildingTypes, type BuyBoxMandate } from "@shared/schema";

const statusColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  contacted: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  showing_searching: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  offer_submitted: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  under_contract: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  closed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  not_proceeding: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
};

export default function RealtorBuyBoxes() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [selectedMandate, setSelectedMandate] = useState<BuyBoxMandate | null>(null);
  const [responseMessage, setResponseMessage] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [propertyLink, setPropertyLink] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [buildingTypeFilter, setBuildingTypeFilter] = useState<string>("all");

  const { data: mandates, isLoading } = useQuery<BuyBoxMandate[]>({
    queryKey: ["/api/buybox/all/mandates"],
    enabled: isAuthenticated && (user?.role === "admin" || user?.role === "realtor"),
  });

  const respondMutation = useMutation({
    mutationFn: async ({ mandateId, message, propertyAddress, propertyLink }: { 
      mandateId: string; 
      message: string; 
      propertyAddress?: string;
      propertyLink?: string;
    }) => {
      return apiRequest(`/api/buybox/${mandateId}/respond`, {
        method: "POST",
        body: JSON.stringify({ message, propertyAddress, propertyLink }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Response Sent",
        description: "Your response has been sent to the buyer.",
      });
      setSelectedMandate(null);
      setResponseMessage("");
      setPropertyAddress("");
      setPropertyLink("");
      queryClient.invalidateQueries({ queryKey: ["/api/buybox/all/mandates"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Send Response",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleRespond = () => {
    if (!selectedMandate || !responseMessage.trim()) {
      toast({
        title: "Message Required",
        description: "Please enter a message for the buyer.",
        variant: "destructive",
      });
      return;
    }
    respondMutation.mutate({
      mandateId: selectedMandate.id,
      message: responseMessage,
      propertyAddress: propertyAddress || undefined,
      propertyLink: propertyLink || undefined,
    });
  };

  const filteredMandates = mandates?.filter(mandate => {
    if (statusFilter !== "all" && mandate.status !== statusFilter) return false;
    if (buildingTypeFilter !== "all" && mandate.buildingType !== buildingTypeFilter) return false;
    return true;
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated || (user?.role !== "admin" && user?.role !== "realtor")) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="max-w-2xl mx-auto px-4 py-12 text-center">
          <h1 className="text-2xl font-bold mb-4">Access Restricted</h1>
          <p className="text-muted-foreground">
            This dashboard is only available to approved realtors in our network.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">BuyBox Mandates</h1>
            <p className="text-muted-foreground">
              Review buyer search mandates and respond with matching properties
            </p>
          </div>
          
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]" data-testid="select-status-filter">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {buyBoxMandateStatuses.map(status => (
                  <SelectItem key={status} value={status}>
                    {status.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={buildingTypeFilter} onValueChange={setBuildingTypeFilter}>
              <SelectTrigger className="w-[150px]" data-testid="select-type-filter">
                <Home className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {buyBoxBuildingTypes.map(type => (
                  <SelectItem key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredMandates?.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No mandates found matching your filters.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMandates?.map(mandate => (
              <Card key={mandate.id} className="hover-elevate">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-green-600" />
                      {mandate.areaName || "Target Area"}
                    </CardTitle>
                    <Badge className={statusColors[mandate.status] || ""}>
                      {mandate.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <CardDescription>
                    Submitted {format(new Date(mandate.createdAt), "MMM d, yyyy")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(mandate.targetPrice || mandate.maxPrice) && (
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {mandate.targetPrice ? `$${mandate.targetPrice.toLocaleString()}` : ""}
                        {mandate.targetPrice && mandate.maxPrice ? " - " : ""}
                        {mandate.maxPrice ? `$${mandate.maxPrice.toLocaleString()}` : ""}
                      </span>
                    </div>
                  )}

                  {mandate.buildingType && (
                    <div className="flex items-center gap-2 text-sm">
                      <Home className="h-4 w-4 text-muted-foreground" />
                      <span className="capitalize">{mandate.buildingType.replace("_", " ")}</span>
                    </div>
                  )}

                  {mandate.targetClosingDate && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>Close by {format(new Date(mandate.targetClosingDate), "MMM d, yyyy")}</span>
                    </div>
                  )}

                  {mandate.additionalNotes && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {mandate.additionalNotes}
                    </p>
                  )}

                  <Dialog>
                    <DialogTrigger asChild>
                      <Button 
                        className="w-full mt-2" 
                        size="sm"
                        onClick={() => setSelectedMandate(mandate)}
                        data-testid={`button-respond-${mandate.id}`}
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Respond to Buyer
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Respond to BuyBox</DialogTitle>
                        <DialogDescription>
                          Send a message to the buyer about a matching property
                        </DialogDescription>
                      </DialogHeader>
                      
                      <div className="space-y-4 mt-4">
                        <div className="space-y-2">
                          <Label htmlFor="propertyAddress">Property Address (optional)</Label>
                          <Input
                            id="propertyAddress"
                            placeholder="123 Main St, Toronto, ON"
                            value={propertyAddress}
                            onChange={(e) => setPropertyAddress(e.target.value)}
                            data-testid="input-property-address"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="propertyLink">Property Link (optional)</Label>
                          <Input
                            id="propertyLink"
                            placeholder="https://..."
                            value={propertyLink}
                            onChange={(e) => setPropertyLink(e.target.value)}
                            data-testid="input-property-link"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="message">Message *</Label>
                          <Textarea
                            id="message"
                            placeholder="Hi, I have a property that matches your criteria..."
                            rows={4}
                            value={responseMessage}
                            onChange={(e) => setResponseMessage(e.target.value)}
                            data-testid="textarea-response-message"
                          />
                        </div>

                        <Button
                          className="w-full"
                          onClick={handleRespond}
                          disabled={respondMutation.isPending}
                          data-testid="button-send-response"
                        >
                          {respondMutation.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Sending...
                            </>
                          ) : (
                            "Send Response"
                          )}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
