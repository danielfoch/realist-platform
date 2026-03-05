import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ShoppingCart, MapPin, Mail, Phone, Voicemail, ArrowLeft, Loader2, CheckCircle, AlertCircle } from "lucide-react";

const SERVICE_META: Record<string, { title: string; icon: any; provider: string }> = {
  direct_mail: { title: "Direct Mail Campaign", icon: Mail, provider: "PostGrid" },
  ai_phone_calls: { title: "AI Phone Outreach", icon: Phone, provider: "ElevenLabs" },
  voicemail_drops: { title: "Voicemail Drops", icon: Voicemail, provider: "SlyBroadcast" },
};

interface ServiceItem {
  serviceId: string;
  qty: number;
  unitPrice: number;
  total: number;
}

export default function BuyBoxCheckout() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [services, setServices] = useState<ServiceItem[]>([]);
  const [mandateData, setMandateData] = useState<any>(null);
  const [polygonGeoJson, setPolygonGeoJson] = useState<any>(null);
  const [centroid, setCentroid] = useState<any>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const servicesRaw = sessionStorage.getItem("buybox_services");
    const polygonRaw = sessionStorage.getItem("buybox_polygon");
    const centroidRaw = sessionStorage.getItem("buybox_centroid");
    const mandateRaw = sessionStorage.getItem("buybox_mandate");

    if (!servicesRaw || !polygonRaw) {
      setLocation("/buybox");
      return;
    }

    setServices(JSON.parse(servicesRaw));
    setPolygonGeoJson(JSON.parse(polygonRaw));
    setCentroid(centroidRaw ? JSON.parse(centroidRaw) : null);
    setMandateData(mandateRaw ? JSON.parse(mandateRaw) : {});
  }, []);

  const total = services.reduce((sum, s) => sum + s.total, 0);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        mandate: mandateData,
        polygon: polygonGeoJson,
        centroid,
        services: services.map(s => ({
          serviceId: s.serviceId,
          qty: s.qty,
          unitPrice: s.unitPrice,
          total: s.total,
        })),
        totalAmount: total,
      };
      const response = await apiRequest("POST", "/api/buybox/submit-services", payload);
      return response.json();
    },
    onSuccess: () => {
      setSubmitted(true);
      sessionStorage.removeItem("buybox_services");
      sessionStorage.removeItem("buybox_polygon");
      sessionStorage.removeItem("buybox_centroid");
      sessionStorage.removeItem("buybox_mandate");
      toast({ title: "Order submitted!", description: "We'll start processing your outreach campaigns shortly." });
    },
    onError: (error: any) => {
      toast({
        title: "Submission failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="max-w-2xl mx-auto px-4 py-16 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-amber-500" />
          <h2 className="text-2xl font-bold mb-2">Sign In Required</h2>
          <p className="text-muted-foreground mb-6">Please sign in to complete your BuyBox order.</p>
          <Button onClick={() => setLocation("/login")} data-testid="button-login">Sign In</Button>
        </main>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="max-w-2xl mx-auto px-4 py-16 text-center">
          <div className="mx-auto mb-6 h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold mb-2" data-testid="text-success-heading">Order Submitted!</h2>
          <p className="text-muted-foreground mb-2">
            Your BuyBox has been created and your outreach services are being queued.
          </p>
          <p className="text-sm text-muted-foreground mb-8">
            We'll process your campaigns and notify you as responses come in. You can track your BuyBox status from your investor dashboard.
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => setLocation("/buybox")} data-testid="button-new-buybox">
              Create Another BuyBox
            </Button>
            <Button onClick={() => setLocation("/investor")} data-testid="button-go-dashboard">
              Go to Dashboard
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <Button
          variant="ghost"
          className="mb-6"
          onClick={() => setLocation("/buybox")}
          data-testid="button-back-buybox"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to BuyBox
        </Button>

        <h1 className="text-2xl font-bold mb-2" data-testid="text-checkout-heading">Confirm Your Order</h1>
        <p className="text-muted-foreground mb-8">Review your BuyBox details and selected services before submitting.</p>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4" />
                BuyBox Details
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              {centroid && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Target Area Center</span>
                  <span>{centroid.lat.toFixed(4)}, {centroid.lng.toFixed(4)}</span>
                </div>
              )}
              {mandateData?.targetPrice && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Target Price</span>
                  <span>${mandateData.targetPrice.toLocaleString()}</span>
                </div>
              )}
              {mandateData?.maxPrice && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Max Price</span>
                  <span>${mandateData.maxPrice.toLocaleString()}</span>
                </div>
              )}
              {mandateData?.buildingType && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Property Type</span>
                  <span className="capitalize">{mandateData.buildingType.replace("_", " ")}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShoppingCart className="h-4 w-4" />
                Selected Services
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {services.map(service => {
                const meta = SERVICE_META[service.serviceId];
                if (!meta) return null;
                const Icon = meta.icon;
                return (
                  <div key={service.serviceId} className="flex items-center gap-4 p-3 border rounded-lg" data-testid={`checkout-service-${service.serviceId}`}>
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{meta.title}</p>
                        <Badge variant="secondary" className="text-[10px]">{meta.provider}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {service.qty.toLocaleString()} × ${service.unitPrice.toFixed(2)}
                      </p>
                    </div>
                    <p className="font-semibold text-sm">${service.total.toFixed(2)}</p>
                  </div>
                );
              })}

              <div className="pt-4 border-t flex justify-between items-center">
                <span className="text-lg font-semibold">Total</span>
                <span className="text-lg font-bold text-primary" data-testid="text-total">${total.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">
                By submitting this order, you authorize Realist Inc. to process payment and execute the selected outreach services in your target area. Campaigns typically begin within 2-3 business days. Results and responses will be delivered to your account email ({user?.email}).
              </p>
            </CardContent>
          </Card>

          <Button
            className="w-full h-12 text-base"
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending}
            data-testid="button-submit-order"
          >
            {submitMutation.isPending ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <ShoppingCart className="h-5 w-5 mr-2" />
                Submit Order — ${total.toFixed(2)}
              </>
            )}
          </Button>
        </div>
      </main>
    </div>
  );
}
