import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, 
  Circle, 
  CreditCard, 
  FileText, 
  Search, 
  ShieldCheck, 
  Scale, 
  Building2, 
  Key, 
  Hammer, 
  Users,
  ChevronDown,
  ChevronUp
} from "lucide-react";

export interface DealTimelineStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  ctaLabel?: string;
  ctaHref?: string;
  estimatedDays?: string;
}

const dealTimelineSteps: DealTimelineStep[] = [
  {
    id: "preapproval",
    title: "Get a Pre-Approval",
    description: "Secure mortgage pre-approval to know your budget and show sellers you're a serious buyer.",
    icon: <CreditCard className="h-5 w-5" />,
    estimatedDays: "1-3 days",
    ctaLabel: "Find a Mortgage Broker",
  },
  {
    id: "offer",
    title: "Make an Offer",
    description: "Work with your realtor to craft a competitive offer with the right conditions and terms.",
    icon: <FileText className="h-5 w-5" />,
    estimatedDays: "1-2 days",
    ctaLabel: "Find an Agent",
  },
  {
    id: "deposit",
    title: "Submit a Deposit",
    description: "Once your offer is accepted, submit the deposit (typically held in trust by the listing brokerage).",
    icon: <CreditCard className="h-5 w-5" />,
    estimatedDays: "24-48 hours",
  },
  {
    id: "due-diligence",
    title: "Conduct Due Diligence",
    description: "Get a home inspection, review condo documents if applicable, and verify all property details.",
    icon: <Search className="h-5 w-5" />,
    estimatedDays: "5-10 days",
    ctaLabel: "Find an Inspector",
  },
  {
    id: "firm-up",
    title: "Firm Up the Deal",
    description: "Remove conditions (financing, inspection) once you're satisfied with your due diligence.",
    icon: <ShieldCheck className="h-5 w-5" />,
    estimatedDays: "1 day",
  },
  {
    id: "lawyer",
    title: "Get a Lawyer",
    description: "Hire a real estate lawyer to review documents, conduct title search, and handle closing.",
    icon: <Scale className="h-5 w-5" />,
    estimatedDays: "Throughout closing",
    ctaLabel: "Find a Lawyer",
  },
  {
    id: "property-manager",
    title: "Get a Property Manager",
    description: "If you won't self-manage, hire a property manager to handle tenant relations and maintenance.",
    icon: <Building2 className="h-5 w-5" />,
    estimatedDays: "Before closing",
    ctaLabel: "Find a Property Manager",
  },
  {
    id: "close",
    title: "Close the Deal",
    description: "Complete the transaction, transfer funds, and take possession of your new investment property.",
    icon: <Key className="h-5 w-5" />,
    estimatedDays: "Closing day",
  },
  {
    id: "renovate",
    title: "Renovate (If Required)",
    description: "Complete any value-add renovations to increase rents or improve the property condition.",
    icon: <Hammer className="h-5 w-5" />,
    estimatedDays: "2-8 weeks",
    ctaLabel: "Find a Contractor",
  },
  {
    id: "lease-up",
    title: "Lease Up",
    description: "Market the property, screen tenants, and sign lease agreements to start generating income.",
    icon: <Users className="h-5 w-5" />,
    estimatedDays: "2-4 weeks",
    ctaLabel: "Find Tenants",
  },
];

interface DealTimelineProps {
  activeStepId?: string;
  onStepAction?: (stepId: string) => void;
}

export function DealTimeline({ activeStepId, onStepAction }: DealTimelineProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const visibleSteps = isExpanded ? dealTimelineSteps : dealTimelineSteps.slice(0, 4);

  return (
    <Card data-testid="card-deal-timeline">
      <CardHeader>
        <CardTitle className="text-xl">Next Steps to Close Your Deal</CardTitle>
        <CardDescription>
          Your roadmap from offer to cash flow. Coming soon: connect with trusted professionals for each step.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <div className="absolute left-[19px] top-3 bottom-3 w-0.5 bg-border" />
          
          <div className="space-y-4">
            {visibleSteps.map((step, index) => (
              <div 
                key={step.id} 
                className="relative flex gap-4"
                data-testid={`timeline-step-${step.id}`}
              >
                <div 
                  className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 ${
                    activeStepId === step.id 
                      ? "border-primary bg-primary text-primary-foreground" 
                      : "border-muted-foreground/30 bg-background text-muted-foreground"
                  }`}
                >
                  {step.icon}
                </div>
                
                <div className="flex-1 pb-4">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h4 className="font-semibold" data-testid={`text-step-title-${step.id}`}>
                      {index + 1}. {step.title}
                    </h4>
                    {step.estimatedDays && (
                      <Badge variant="secondary" className="text-xs">
                        {step.estimatedDays}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground" data-testid={`text-step-desc-${step.id}`}>
                    {step.description}
                  </p>
                  {step.ctaLabel && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-2 text-xs"
                      disabled
                      onClick={() => onStepAction?.(step.id)}
                      data-testid={`button-step-cta-${step.id}`}
                    >
                      {step.ctaLabel}
                      <Badge variant="secondary" className="ml-2 text-[10px]">Coming Soon</Badge>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <Button
          variant="ghost"
          className="w-full mt-2 gap-2"
          onClick={() => setIsExpanded(!isExpanded)}
          data-testid="button-toggle-timeline"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="h-4 w-4" />
              Show Less
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" />
              Show All {dealTimelineSteps.length} Steps
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
