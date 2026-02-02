import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { PROVINCES } from "@/lib/provinces";
import { 
  Shield, FileText, PenTool, Loader2, CheckCircle2, 
  AlertTriangle, MapPin, Building2, Users, BookOpen, Calculator
} from "lucide-react";

interface RepresentationGateProps {
  children: React.ReactNode;
  requireBra?: boolean;
  requireAck?: boolean;
  redirectUrl?: string;
}

interface ComplianceStatus {
  jurisdiction: string | null;
  braStatus: string;
  braSignedAt: string | null;
  coinvestAckStatus: string;
  coinvestAckSignedAt: string | null;
  isOntario: boolean;
  isRepresented: boolean;
  canAccess: boolean;
}

export function RepresentationGate({ 
  children, 
  requireBra = true, 
  requireAck = true,
  redirectUrl 
}: RepresentationGateProps) {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showGate, setShowGate] = useState(false);
  const [step, setStep] = useState<"jurisdiction" | "bra" | "ack" | "complete">("jurisdiction");
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<string>("");
  
  const { data: complianceStatus, isLoading: statusLoading } = useQuery<ComplianceStatus>({
    queryKey: ["/api/coinvest/compliance-status"],
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (authLoading || statusLoading) return;
    
    if (!isAuthenticated) {
      toast({
        title: "Sign In Required",
        description: "Please sign in to access Co-Investing features.",
        variant: "destructive",
      });
      setLocation("/login");
      return;
    }

    if (complianceStatus) {
      if (complianceStatus.canAccess) {
        setShowGate(false);
      } else if (complianceStatus.isOntario && !complianceStatus.isRepresented) {
        setShowGate(true);
        if (complianceStatus.braStatus === "signed" && complianceStatus.coinvestAckStatus !== "signed") {
          setStep("ack");
        } else if (complianceStatus.braStatus !== "signed") {
          setStep("bra");
        }
      } else if (!complianceStatus.jurisdiction) {
        setShowGate(true);
        setStep("jurisdiction");
      }
    }
  }, [authLoading, statusLoading, isAuthenticated, complianceStatus, setLocation, toast]);

  const handleJurisdictionChange = async (value: string) => {
    setSelectedJurisdiction(value);
    
    try {
      await apiRequest("POST", "/api/coinvest/set-jurisdiction", { jurisdiction: value });
      queryClient.invalidateQueries({ queryKey: ["/api/coinvest/compliance-status"] });
      
      if (value === "ON") {
        setStep("bra");
      } else {
        setShowGate(false);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save jurisdiction preference.",
        variant: "destructive",
      });
    }
  };

  const handleDecline = () => {
    setShowGate(false);
    if (redirectUrl) {
      setLocation(redirectUrl);
    } else {
      setLocation("/tools");
    }
  };

  if (authLoading || statusLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (complianceStatus?.canAccess) {
    return <>{children}</>;
  }

  if (!showGate && complianceStatus && !complianceStatus.isOntario && complianceStatus.jurisdiction) {
    return <>{children}</>;
  }

  return (
    <>
      <Dialog open={showGate} onOpenChange={(open) => !open && handleDecline()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {step === "jurisdiction" && (
            <JurisdictionStep 
              onSelect={handleJurisdictionChange}
              selectedJurisdiction={selectedJurisdiction}
            />
          )}
          
          {step === "bra" && (
            <BraSigningStep 
              onComplete={() => {
                queryClient.invalidateQueries({ queryKey: ["/api/coinvest/compliance-status"] });
                setStep("ack");
              }}
              onDecline={handleDecline}
            />
          )}
          
          {step === "ack" && (
            <AcknowledgementStep 
              onComplete={() => {
                queryClient.invalidateQueries({ queryKey: ["/api/coinvest/compliance-status"] });
                setShowGate(false);
                toast({
                  title: "Access Granted",
                  description: "You now have access to Co-Investing features.",
                });
              }}
              onDecline={handleDecline}
            />
          )}
        </DialogContent>
      </Dialog>
      
      {showGate && (
        <div className="min-h-[400px] flex items-center justify-center">
          <Card className="max-w-md text-center p-6">
            <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Representation Required</h3>
            <p className="text-muted-foreground">
              Please complete the representation agreement to access Co-Investing features.
            </p>
          </Card>
        </div>
      )}
    </>
  );
}

function JurisdictionStep({ onSelect, selectedJurisdiction }: { 
  onSelect: (value: string) => void; 
  selectedJurisdiction: string;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Select Your Jurisdiction
        </DialogTitle>
        <DialogDescription>
          Please select your province or territory to continue.
        </DialogDescription>
      </DialogHeader>
      
      <div className="py-4">
        <Label>Province/Territory</Label>
        <Select value={selectedJurisdiction} onValueChange={onSelect}>
          <SelectTrigger className="w-full mt-2" data-testid="select-jurisdiction">
            <SelectValue placeholder="Select your province" />
          </SelectTrigger>
          <SelectContent>
            {PROVINCES.map((province) => (
              <SelectItem key={province.value} value={province.value}>
                {province.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Alert className="mt-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Different provinces have different requirements for real estate transactions. 
            Ontario requires buyer representation to use Co-Investing features.
          </AlertDescription>
        </Alert>
      </div>
    </>
  );
}

function BraSigningStep({ onComplete, onDecline }: { 
  onComplete: () => void; 
  onDecline: () => void;
}) {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState("");
  const [formData, setFormData] = useState({
    signedName: "",
    agreedToTerms: false,
  });

  const mutation = useMutation({
    mutationFn: async (data: { signedName: string; signatureDataUrl: string }) => {
      return apiRequest("POST", "/api/coinvest/sign-bra", data);
    },
    onSuccess: () => {
      toast({
        title: "Agreement Signed",
        description: "Thank you for signing the Buyer Representation Agreement.",
      });
      onComplete();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to sign agreement. Please try again.",
        variant: "destructive",
      });
    },
  });

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
    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setSignatureDataUrl("");
    }
  };

  const handleSubmit = () => {
    if (!formData.signedName || !signatureDataUrl || !formData.agreedToTerms) {
      toast({
        title: "Missing Information",
        description: "Please complete all fields and sign.",
        variant: "destructive",
      });
      return;
    }
    mutation.mutate({
      signedName: formData.signedName,
      signatureDataUrl,
    });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Representation Required (Ontario)
        </DialogTitle>
        <DialogDescription>
          To use Co-Invest features in Ontario, you must be represented by Daniel Foch at Valery Real Estate Inc.
        </DialogDescription>
      </DialogHeader>

      <ScrollArea className="max-h-[60vh] pr-4">
        <div className="space-y-4 py-4">
          <Alert>
            <Building2 className="h-4 w-4" />
            <AlertDescription>
              This ensures your co-buying activity is handled as a real estate brokerage service 
              with clear duties, disclosures, and process under Ontario rules. If you are raising 
              capital from passive investors or marketing to the public, you may require a 
              securities-law compliant structure and professional advice.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Buyer Representation Agreement</CardTitle>
              <CardDescription className="text-xs">
                Daniel Foch, Valery Real Estate Inc.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-xs text-muted-foreground space-y-2 max-h-32 overflow-y-auto border rounded p-2 bg-muted/50">
                <p><strong>BUYER REPRESENTATION AGREEMENT</strong></p>
                <p>This Agreement is between the Buyer (you) and Valery Real Estate Inc., 
                Brokerage ("the Brokerage"), represented by Daniel Foch, Broker.</p>
                <p>By signing this agreement, you authorize the Brokerage to act as your 
                exclusive agent for real estate transactions facilitated through Realist.ca's 
                Co-Investing platform.</p>
                <p>The Brokerage will provide services including property searches, negotiations, 
                and transaction management in accordance with RECO regulations.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="signedName">Legal Name</Label>
                <Input
                  id="signedName"
                  placeholder="Enter your full legal name"
                  value={formData.signedName}
                  onChange={(e) => setFormData(prev => ({ ...prev, signedName: e.target.value }))}
                  data-testid="input-signed-name"
                />
              </div>

              <div className="space-y-2">
                <Label>Signature</Label>
                <div className="border rounded-lg p-2 bg-white">
                  <canvas
                    ref={canvasRef}
                    width={400}
                    height={100}
                    className="w-full border rounded cursor-crosshair touch-none"
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
                  variant="ghost" 
                  size="sm" 
                  onClick={clearSignature}
                  data-testid="button-clear-signature"
                >
                  Clear Signature
                </Button>
              </div>

              <div className="flex items-start gap-2">
                <Checkbox
                  id="agreed"
                  checked={formData.agreedToTerms}
                  onCheckedChange={(checked) => 
                    setFormData(prev => ({ ...prev, agreedToTerms: checked === true }))
                  }
                  data-testid="checkbox-agree-terms"
                />
                <Label htmlFor="agreed" className="text-xs leading-tight cursor-pointer">
                  I have read and agree to the Buyer Representation Agreement terms. 
                  I understand this is a brokerage service agreement and does not constitute 
                  legal, tax, or securities advice.
                </Label>
              </div>
            </CardContent>
          </Card>

          <Accordion type="single" collapsible>
            <AccordionItem value="faq">
              <AccordionTrigger className="text-sm">Frequently Asked Questions</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="font-medium">Why do I need to sign?</p>
                    <p className="text-muted-foreground text-xs">
                      Ontario real estate regulations require buyer representation for certain 
                      transaction types. This ensures proper fiduciary duties and disclosures.
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">What if I'm not in Ontario?</p>
                    <p className="text-muted-foreground text-xs">
                      Other provinces have different requirements. We're working to expand 
                      support to additional jurisdictions.
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">What if we're raising capital?</p>
                    <p className="text-muted-foreground text-xs">
                      If your arrangement involves passive investors, public marketing, or 
                      promised returns, you may need securities-law compliant structures. 
                      Consult a securities lawyer.
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">Does signing make my deal compliant?</p>
                    <p className="text-muted-foreground text-xs">
                      No. Compliance depends on your specific arrangement. This agreement 
                      provides real estate brokerage services, not legal or compliance advice.
                    </p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </ScrollArea>

      <div className="flex gap-2 pt-4">
        <Button variant="outline" onClick={onDecline} className="flex-1" data-testid="button-decline-bra">
          Not Now
        </Button>
        <Button 
          onClick={handleSubmit} 
          disabled={mutation.isPending || !formData.signedName || !signatureDataUrl || !formData.agreedToTerms}
          className="flex-1"
          data-testid="button-sign-bra"
        >
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PenTool className="h-4 w-4 mr-2" />}
          Sign Agreement
        </Button>
      </div>
    </>
  );
}

function AcknowledgementStep({ onComplete, onDecline }: { 
  onComplete: () => void; 
  onDecline: () => void;
}) {
  const { toast } = useToast();
  const [acknowledged, setAcknowledged] = useState(false);
  const [signedName, setSignedName] = useState("");

  const mutation = useMutation({
    mutationFn: async (data: { signedName: string }) => {
      return apiRequest("POST", "/api/coinvest/sign-acknowledgement", data);
    },
    onSuccess: () => {
      onComplete();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save acknowledgement. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!acknowledged || !signedName) {
      toast({
        title: "Missing Information",
        description: "Please acknowledge and enter your name.",
        variant: "destructive",
      });
      return;
    }
    mutation.mutate({ signedName });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Co-Investing Acknowledgement
        </DialogTitle>
        <DialogDescription>
          Please review and acknowledge the following disclosures.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="space-y-2 text-sm">
              <p className="font-medium">Important Disclosures:</p>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground text-xs">
                <li>This platform facilitates introductions between potential co-investors.</li>
                <li>Realist.ca does not provide legal, tax, securities, or investment advice.</li>
                <li>If your co-investing arrangement involves passive investors, profit sharing promises, 
                    or public marketing, it may constitute a securities offering requiring compliance 
                    with applicable securities laws.</li>
                <li>You are responsible for seeking independent legal and financial advice.</li>
                <li>Buyer representation through Valery Real Estate Inc. provides real estate 
                    brokerage services only.</li>
              </ul>
            </div>

            <Separator />

            <div className="flex items-start gap-2">
              <Checkbox
                id="ack-checkbox"
                checked={acknowledged}
                onCheckedChange={(checked) => setAcknowledged(checked === true)}
                data-testid="checkbox-acknowledge"
              />
              <Label htmlFor="ack-checkbox" className="text-xs leading-tight cursor-pointer">
                I acknowledge that I have read and understood the above disclosures. 
                I understand that this is not legal, tax, securities, or investment advice 
                and that I should consult appropriate professionals for my specific situation.
              </Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ack-name">Type your name to confirm</Label>
              <Input
                id="ack-name"
                placeholder="Your full name"
                value={signedName}
                onChange={(e) => setSignedName(e.target.value)}
                data-testid="input-ack-name"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2 pt-4">
        <Button variant="outline" onClick={onDecline} className="flex-1" data-testid="button-decline-ack">
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit} 
          disabled={mutation.isPending || !acknowledged || !signedName}
          className="flex-1"
          data-testid="button-confirm-ack"
        >
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
          Confirm
        </Button>
      </div>
    </>
  );
}

export function RepresentationStatusBanner({ className }: { className?: string }) {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  
  const { data: complianceStatus, isLoading } = useQuery<ComplianceStatus>({
    queryKey: ["/api/coinvest/compliance-status"],
    enabled: isAuthenticated,
  });

  if (!isAuthenticated || isLoading || !complianceStatus) return null;
  if (!complianceStatus.isOntario) return null;

  const getStatusBadge = () => {
    if (complianceStatus.isRepresented) {
      return <Badge variant="default" className="bg-green-600">Signed</Badge>;
    }
    if (complianceStatus.braStatus === "pending") {
      return <Badge variant="secondary">Pending</Badge>;
    }
    return <Badge variant="outline">Not Started</Badge>;
  };

  return (
    <Alert className={className}>
      <Shield className="h-4 w-4" />
      <div className="flex items-center justify-between w-full">
        <AlertDescription className="flex items-center gap-2">
          <span>Representation Required (Ontario)</span>
          {getStatusBadge()}
        </AlertDescription>
        {!complianceStatus.isRepresented && (
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => setLocation("/tools/coinvest/representation")}
            data-testid="button-sign-representation"
          >
            Sign Agreement
          </Button>
        )}
      </div>
    </Alert>
  );
}
