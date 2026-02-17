import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { PenTool, FileText, MapPin, Calendar, Shield, AlertTriangle, Loader2, Check } from "lucide-react";
import { format, addDays } from "date-fns";

export default function BuyBoxAgreement() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const { data: premiumStatus } = useQuery<{
    isPremium: boolean;
    hasBraSigned?: boolean;
    premiumSource?: string;
  }>({
    queryKey: ["/api/subscription/status"],
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const submittedRef = useRef(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string>("");
  
  const [polygonGeoJson, setPolygonGeoJson] = useState<any>(null);
  const [centroid, setCentroid] = useState<{ lat: number; lng: number } | null>(null);
  const [mandateData, setMandateData] = useState<any>({});

  // Cleanup sessionStorage on unmount if flow was abandoned (not submitted)
  useEffect(() => {
    return () => {
      if (!submittedRef.current) {
        sessionStorage.removeItem("buybox_polygon");
        sessionStorage.removeItem("buybox_centroid");
        sessionStorage.removeItem("buybox_mandate");
      }
    };
  }, []);

  const [formData, setFormData] = useState({
    signedName: "",
    termDays: 90,
    holdoverDays: 60,
    commissionPercent: 2.5,
    agreedToTerms: false,
    extendedTermConsent: false,
  });

  useEffect(() => {
    // Retrieve data from sessionStorage (set by BuyBox page)
    try {
      const polygon = sessionStorage.getItem("buybox_polygon");
      const cent = sessionStorage.getItem("buybox_centroid");
      const mandate = sessionStorage.getItem("buybox_mandate");
      
      if (polygon) setPolygonGeoJson(JSON.parse(polygon));
      if (cent) setCentroid(JSON.parse(cent));
      if (mandate) setMandateData(JSON.parse(mandate));
      
      // Redirect back if no polygon data
      if (!polygon) {
        toast({
          title: "No Area Selected",
          description: "Please draw your target area first.",
          variant: "destructive",
        });
        setLocation("/buybox");
      }
    } catch (e) {
      console.error("Failed to parse session data:", e);
      setLocation("/buybox");
    }
  }, [setLocation, toast]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Sign In Required",
        description: "Please sign in to submit your BuyBox mandate.",
        variant: "destructive",
      });
      setLocation("/login");
    }
  }, [authLoading, isAuthenticated, setLocation, toast]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    if ("touches" in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    
    setIsDrawing(true);
    const { x, y } = getCanvasCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    
    const { x, y } = getCanvasCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      setSignatureDataUrl(canvas.toDataURL());
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureDataUrl("");
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      const termEndDate = addDays(new Date(), formData.termDays);
      
      const response = await apiRequest("/api/buybox/submit", {
        method: "POST",
        body: JSON.stringify({
          agreement: {
            signedName: formData.signedName,
            signatureDataUrl,
            termEndDate: termEndDate.toISOString(),
            holdoverDays: formData.holdoverDays,
            commissionPercent: formData.commissionPercent,
            agreedToTerms: formData.agreedToTerms,
            extendedTermConsent: formData.extendedTermConsent,
          },
          mandate: {
            polygonGeoJson,
            centroidLat: centroid?.lat,
            centroidLng: centroid?.lng,
            ...mandateData,
          },
        }),
      });
      return response;
    },
    onSuccess: (data: any) => {
      // Mark as submitted to prevent cleanup on unmount from clearing storage
      submittedRef.current = true;
      
      // Clear sessionStorage after successful submission
      sessionStorage.removeItem("buybox_polygon");
      sessionStorage.removeItem("buybox_centroid");
      sessionStorage.removeItem("buybox_mandate");
      
      toast({
        title: "BuyBox Submitted Successfully",
        description: "Your mandate has been shared with our realtor network.",
      });
      setLocation(`/buybox/confirmation/${data.mandateId}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Submission Failed",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const hasBraAlready = premiumStatus?.hasBraSigned === true;

  const handleSubmit = () => {
    if (!hasBraAlready) {
      if (!formData.signedName.trim()) {
        toast({
          title: "Name Required",
          description: "Please enter your full legal name.",
          variant: "destructive",
        });
        return;
      }
      
      if (!signatureDataUrl) {
        toast({
          title: "Signature Required",
          description: "Please sign in the signature box.",
          variant: "destructive",
        });
        return;
      }
      
      if (!formData.agreedToTerms) {
        toast({
          title: "Agreement Required",
          description: "Please agree to the terms and conditions.",
          variant: "destructive",
        });
        return;
      }
    }

    if (formData.termDays > 180 && !formData.extendedTermConsent) {
      toast({
        title: "Extended Term Consent Required",
        description: "Please confirm you understand the extended term.",
        variant: "destructive",
      });
      return;
    }
    
    submitMutation.mutate();
  };

  const termEndDate = addDays(new Date(), formData.termDays);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Buyer Representation Agreement</h1>
          <p className="text-muted-foreground">
            Review and sign the agreement to submit your BuyBox mandate
          </p>
        </div>

        {premiumStatus?.hasBraSigned && (
          <Card className="mb-6 border-primary/30">
            <CardContent className="flex items-center gap-3 py-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Check className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">BRA Already Signed</p>
                <p className="text-xs text-muted-foreground">
                  You already signed a Buyer Representation Agreement through your Premium membership.
                  Your BuyBox mandate will use your existing agreement.
                </p>
              </div>
              <Badge variant="secondary">Active</Badge>
            </CardContent>
          </Card>
        )}

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Important Notice
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                <strong>This is not legal advice.</strong> This agreement is for informational purposes 
                and creates a business relationship. We recommend you consult with a licensed real estate 
                lawyer if you have questions about your rights and obligations.
              </p>
              <p>
                By signing below, you authorize Daniel Foch and Valery Real Estate Inc. (or their 
                referrals/assigns) to assist you in locating and purchasing real estate within your 
                specified search area.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Buyer Representation & BuyBox Terms
              </CardTitle>
              <CardDescription>Version 1.0 - Effective January 2026</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] rounded-md border p-4">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <h3>1. PARTIES</h3>
                  <p>
                    <strong>Buyer:</strong> {user?.firstName} {user?.lastName} ({user?.email})<br />
                    <strong>Brokerage:</strong> Valery Real Estate Inc.<br />
                    <strong>Agent:</strong> Daniel Foch (and any referrals, co-brokers, or assigns)
                  </p>

                  <h3>2. EXCLUSIVE AUTHORITY & SCOPE</h3>
                  <p>
                    The Buyer grants the Brokerage exclusive authority to act on behalf of the Buyer 
                    for the purpose of locating, negotiating, and facilitating the purchase of real 
                    property within the Geographic Area defined below during the Term of this Agreement.
                  </p>
                  <p>
                    The Buyer agrees not to engage any other real estate brokerage or agent for 
                    properties within the Geographic Area during the Term.
                  </p>

                  <h3>3. TERM & EXPIRY</h3>
                  <p>
                    This Agreement begins on the date of signing and expires on the date selected 
                    below. The maximum initial term is 6 months. Extensions require mutual written consent.
                  </p>

                  <h3>4. GEOGRAPHIC AREA</h3>
                  <p>
                    The Geographic Area is defined by the polygon drawn on the map during the BuyBox 
                    creation process. The Brokerage's exclusive authority applies only to properties 
                    located within this defined area.
                  </p>
                  {centroid && (
                    <p className="text-green-600">
                      <MapPin className="inline h-4 w-4 mr-1" />
                      Area centered at approximately {centroid.lat.toFixed(4)}, {centroid.lng.toFixed(4)}
                    </p>
                  )}

                  <h3>5. COMMISSION & COMPENSATION</h3>
                  <p>
                    The Brokerage is entitled to receive commission as follows:
                  </p>
                  <ul>
                    <li>
                      <strong>Seller-Paid Commission:</strong> If the property seller or listing 
                      brokerage offers commission to cooperating brokerages, the Brokerage is entitled 
                      to receive that commission.
                    </li>
                    <li>
                      <strong>Commission Deficiency:</strong> If the seller-offered commission is less 
                      than the Agreed Commission Rate (specified below), the Buyer agrees to pay the 
                      difference at closing.
                    </li>
                    <li>
                      <strong>No Seller Commission:</strong> If no commission is offered by the seller, 
                      the Buyer agrees to pay the full Agreed Commission Rate at closing.
                    </li>
                  </ul>

                  <h3>6. HOLDOVER PERIOD</h3>
                  <p>
                    If the Buyer purchases a property that was introduced, shown, or discussed during 
                    the Term, within the Holdover Period after this Agreement expires, the commission 
                    provisions above shall apply.
                  </p>

                  <h3>7. PROPERTY INTRODUCTIONS & REFERRALS</h3>
                  <p>
                    The Buyer acknowledges that properties may be sourced through the Brokerage's 
                    network of vetted realtor members. If a property is introduced to the Buyer through 
                    this network and a purchase occurs (during the Term or Holdover Period), commission 
                    is owed as described above.
                  </p>

                  <h3>8. MULTIPLE REPRESENTATION DISCLOSURE</h3>
                  <p>
                    The Buyer acknowledges that in some situations, the Brokerage may represent both 
                    the buyer and seller in the same transaction (with informed consent). In such cases, 
                    the Brokerage must act impartially and cannot advocate for one party over another.
                  </p>

                  <h3>9. PRIVACY & CONSENT TO SHARE</h3>
                  <p>
                    The Buyer consents to the Brokerage sharing their BuyBox mandate details (search 
                    criteria, budget, preferences) with vetted realtor members in the Brokerage's 
                    network for the purpose of sourcing suitable properties. Personal contact information 
                    will only be shared with realtors who have matching properties, with the Buyer's 
                    additional consent.
                  </p>

                  <h3>10. ELECTRONIC COMMUNICATIONS & E-SIGNATURE</h3>
                  <p>
                    The Buyer consents to receive communications electronically, including via email, 
                    text message, and in-app notifications. The Buyer agrees that their electronic 
                    signature below is legally binding and equivalent to a handwritten signature.
                  </p>

                  <h3>11. GOVERNING LAW</h3>
                  <p>
                    This Agreement shall be governed by and construed in accordance with the laws of 
                    the Province of Ontario and the applicable laws of Canada.
                  </p>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Agreement Terms
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label className="text-base">Agreement Duration: {formData.termDays} days</Label>
                  <p className="text-sm text-muted-foreground mb-3">
                    Expires: {format(termEndDate, "MMMM d, yyyy")}
                  </p>
                  <Slider
                    value={[formData.termDays]}
                    onValueChange={([value]) => setFormData(prev => ({ ...prev, termDays: value }))}
                    min={30}
                    max={180}
                    step={30}
                    className="w-full"
                    data-testid="slider-term-days"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>30 days</span>
                    <span>90 days</span>
                    <span>180 days</span>
                  </div>
                </div>

                {formData.termDays > 180 && (
                  <div className="flex items-start space-x-3 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                    <div className="space-y-2">
                      <p className="text-sm text-amber-800 dark:text-amber-200">
                        Terms exceeding 6 months require explicit acknowledgment.
                      </p>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="extendedTermConsent"
                          checked={formData.extendedTermConsent}
                          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, extendedTermConsent: checked as boolean }))}
                          data-testid="checkbox-extended-term"
                        />
                        <Label htmlFor="extendedTermConsent" className="text-sm">
                          I understand and accept the extended term
                        </Label>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="holdoverDays">Holdover Period (days)</Label>
                    <Input
                      id="holdoverDays"
                      type="number"
                      min={0}
                      max={180}
                      value={formData.holdoverDays}
                      onChange={(e) => setFormData(prev => ({ ...prev, holdoverDays: parseInt(e.target.value) || 60 }))}
                      data-testid="input-holdover-days"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="commissionPercent">Agreed Commission Rate (%)</Label>
                    <Input
                      id="commissionPercent"
                      type="number"
                      min={0}
                      max={10}
                      step={0.1}
                      value={formData.commissionPercent}
                      onChange={(e) => setFormData(prev => ({ ...prev, commissionPercent: parseFloat(e.target.value) || 2.5 }))}
                      data-testid="input-commission"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PenTool className="h-5 w-5" />
                Signature
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signedName">Full Legal Name</Label>
                <Input
                  id="signedName"
                  placeholder="Enter your full legal name"
                  value={formData.signedName}
                  onChange={(e) => setFormData(prev => ({ ...prev, signedName: e.target.value }))}
                  data-testid="input-signed-name"
                />
              </div>

              <div className="space-y-2">
                <Label>Signature (draw below)</Label>
                <div className="border rounded-lg p-1 bg-white">
                  <canvas
                    ref={canvasRef}
                    width={600}
                    height={150}
                    className="w-full h-[150px] cursor-crosshair touch-none"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    data-testid="canvas-signature"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearSignature}
                  data-testid="button-clear-signature"
                >
                  Clear Signature
                </Button>
              </div>

              <div className="flex items-start space-x-3 pt-4">
                <Checkbox
                  id="agreedToTerms"
                  checked={formData.agreedToTerms}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, agreedToTerms: checked as boolean }))}
                  data-testid="checkbox-agree-terms"
                />
                <Label htmlFor="agreedToTerms" className="text-sm leading-relaxed cursor-pointer">
                  I have read and agree to the Buyer Representation & BuyBox Terms above. I understand 
                  this creates a legal agreement and I am signing electronically.
                </Label>
              </div>

              <div className="pt-4">
                <Button
                  size="lg"
                  className="w-full"
                  onClick={handleSubmit}
                  disabled={submitMutation.isPending}
                  data-testid="button-submit-buybox"
                >
                  {submitMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <PenTool className="h-4 w-4 mr-2" />
                      Sign & Submit BuyBox
                    </>
                  )}
                </Button>
              </div>

              <p className="text-xs text-center text-muted-foreground">
                By clicking "Sign & Submit", you agree that your electronic signature is the legal 
                equivalent of your manual signature. Date: {format(new Date(), "MMMM d, yyyy, h:mm a")}
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
