import { Navigation } from "@/components/Navigation";
import { RepresentationGate, RepresentationStatusBanner } from "@/components/RepresentationGate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { 
  calculateComplexityScore, 
  jurisdictionLabels, 
  ownershipStructureLabels,
  propertyTypeLabels,
  strategyLabels,
  skillLabels,
  tierLabels 
} from "@/lib/coinvesting";
import type { CoInvestChecklistInput, CoInvestGroupFormData } from "@shared/schema";

const STEPS = ["Basics", "Property", "Partnership", "Checklist", "Review"];

export default function CoInvestingGroupNew() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [acknowledged, setAcknowledged] = useState(false);

  const [formData, setFormData] = useState<Partial<CoInvestGroupFormData>>({
    title: "",
    description: "",
    ownershipStructure: "tic",
    jurisdiction: "ON",
    visibility: "public",
    propertyAddress: "",
    propertyCity: "",
    propertyRegion: "",
    propertyCountry: "canada",
    propertyType: "single_family",
    unitsCount: 1,
    targetStrategy: "buy_hold",
    capitalTargetCad: undefined,
    minCommitmentCad: undefined,
    targetGroupSize: 4,
    skillsNeeded: [],
    requiresAccredited: false,
  });

  const [checklistInputs, setChecklistInputs] = useState<CoInvestChecklistInput>({
    numberOfProperties: 1,
    propertyType: formData.propertyType || "single_family",
    unitsCount: formData.unitsCount || 1,
    groupSize: formData.targetGroupSize || 4,
    marketingToPublic: formData.visibility === "public",
    passiveInvestors: false,
    profitSharingPromised: false,
    managerCentralized: false,
    multiplePropertiesOrPortfolioPlan: false,
    relianceOnSponsorEfforts: false,
    sophisticatedStructure: false,
    renovationDevelopmentIntensity: "light",
  });

  const checklistResult = calculateComplexityScore(checklistInputs);
  const tierInfo = tierLabels[checklistResult.tier];

  const createGroupMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/coinvesting/groups", {
        ...formData,
        checklistInputs,
        checklistResult,
      });
      if (!response.ok) {
        const data = await response.json();
        throw { ...data, message: data.error || "Failed to create group" };
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Group Created",
        description: "Your co-investing group has been created successfully.",
      });
      setLocation(`/coinvesting/groups/${data.group.id}`);
    },
    onError: (error: any) => {
      if (error?.requiresRepresentation) {
        toast({
          title: "Representation Required",
          description: "You need to complete the representation agreement to access this feature.",
        });
        setLocation("/tools/coinvest/representation");
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to create group",
        variant: "destructive",
      });
    },
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    setLocation("/login");
    return null;
  }

  const updateForm = (key: keyof CoInvestGroupFormData, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const toggleSkill = (skill: string) => {
    const current = formData.skillsNeeded || [];
    if (current.includes(skill)) {
      updateForm("skillsNeeded", current.filter(s => s !== skill));
    } else {
      updateForm("skillsNeeded", [...current, skill]);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 0:
        return formData.title && formData.ownershipStructure && formData.jurisdiction;
      case 1:
        return true;
      case 2:
        return true;
      case 3:
        return acknowledged;
      case 4:
        return true;
      default:
        return false;
    }
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Define your group and ownership structure</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Group Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g., Downtown Toronto Duplex Investment"
                  value={formData.title}
                  onChange={(e) => updateForm("title", e.target.value)}
                  data-testid="input-title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe your investment opportunity..."
                  value={formData.description}
                  onChange={(e) => updateForm("description", e.target.value)}
                  data-testid="input-description"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Ownership Structure *</Label>
                  <Select value={formData.ownershipStructure} onValueChange={(v: "tic" | "joint_tenancy") => updateForm("ownershipStructure", v)}>
                    <SelectTrigger data-testid="select-ownership">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ownershipStructureLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Jurisdiction *</Label>
                  <Select value={formData.jurisdiction} onValueChange={(v) => updateForm("jurisdiction", v)}>
                    <SelectTrigger data-testid="select-jurisdiction">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(jurisdictionLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Visibility</Label>
                <Select value={formData.visibility} onValueChange={(v: "public" | "members_only" | "unlisted") => updateForm("visibility", v)}>
                  <SelectTrigger data-testid="select-visibility">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public - Visible to all users</SelectItem>
                    <SelectItem value="members_only">Members Only - Details visible to members</SelectItem>
                    <SelectItem value="unlisted">Unlisted - Only accessible via direct link</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        );

      case 1:
        return (
          <Card>
            <CardHeader>
              <CardTitle>Property Details</CardTitle>
              <CardDescription>Information about the target property</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="propertyAddress">Property Address</Label>
                <Input
                  id="propertyAddress"
                  placeholder="123 Main Street"
                  value={formData.propertyAddress}
                  onChange={(e) => updateForm("propertyAddress", e.target.value)}
                  data-testid="input-address"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="propertyCity">City</Label>
                  <Input
                    id="propertyCity"
                    placeholder="Toronto"
                    value={formData.propertyCity}
                    onChange={(e) => updateForm("propertyCity", e.target.value)}
                    data-testid="input-city"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="propertyRegion">Province/State</Label>
                  <Input
                    id="propertyRegion"
                    placeholder="Ontario"
                    value={formData.propertyRegion}
                    onChange={(e) => updateForm("propertyRegion", e.target.value)}
                    data-testid="input-region"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Property Type</Label>
                  <Select value={formData.propertyType} onValueChange={(v) => updateForm("propertyType", v)}>
                    <SelectTrigger data-testid="select-property-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(propertyTypeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unitsCount">Number of Units</Label>
                  <Input
                    id="unitsCount"
                    type="number"
                    min={1}
                    value={formData.unitsCount}
                    onChange={(e) => updateForm("unitsCount", parseInt(e.target.value) || 1)}
                    data-testid="input-units"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Investment Strategy</Label>
                <Select value={formData.targetStrategy} onValueChange={(v) => updateForm("targetStrategy", v)}>
                  <SelectTrigger data-testid="select-strategy">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(strategyLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        );

      case 2:
        return (
          <Card>
            <CardHeader>
              <CardTitle>Partnership Details</CardTitle>
              <CardDescription>Capital requirements and skills needed</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="capitalTarget">Total Capital Target (CAD)</Label>
                  <Input
                    id="capitalTarget"
                    type="number"
                    min={0}
                    placeholder="500000"
                    value={formData.capitalTargetCad || ""}
                    onChange={(e) => updateForm("capitalTargetCad", parseInt(e.target.value) || undefined)}
                    data-testid="input-capital-target"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="minCommitment">Minimum Commitment (CAD)</Label>
                  <Input
                    id="minCommitment"
                    type="number"
                    min={0}
                    placeholder="50000"
                    value={formData.minCommitmentCad || ""}
                    onChange={(e) => updateForm("minCommitmentCad", parseInt(e.target.value) || undefined)}
                    data-testid="input-min-commitment"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="groupSize">Target Group Size</Label>
                <Input
                  id="groupSize"
                  type="number"
                  min={2}
                  max={50}
                  value={formData.targetGroupSize}
                  onChange={(e) => updateForm("targetGroupSize", parseInt(e.target.value) || 4)}
                  data-testid="input-group-size"
                />
              </div>

              <div className="space-y-2">
                <Label>Skills Needed (select all that apply)</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                  {Object.entries(skillLabels).map(([value, label]) => (
                    <div key={value} className="flex items-center gap-2">
                      <Checkbox
                        id={`skill-${value}`}
                        checked={formData.skillsNeeded?.includes(value)}
                        onCheckedChange={() => toggleSkill(value)}
                        data-testid={`checkbox-skill-${value}`}
                      />
                      <Label htmlFor={`skill-${value}`} className="text-sm cursor-pointer">
                        {label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <div>
                  <Label htmlFor="requiresAccredited">Require Accredited Investors</Label>
                  <p className="text-sm text-muted-foreground">Only accredited investors can join</p>
                </div>
                <Switch
                  id="requiresAccredited"
                  checked={formData.requiresAccredited}
                  onCheckedChange={(v) => updateForm("requiresAccredited", v)}
                  data-testid="switch-accredited"
                />
              </div>
            </CardContent>
          </Card>
        );

      case 3:
        return (
          <Card>
            <CardHeader>
              <CardTitle>Complexity Checklist</CardTitle>
              <CardDescription>Assess the complexity of your co-investing arrangement</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Card className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
                <CardContent className="pt-6">
                  <div className="flex gap-4">
                    <AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0" />
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      This checklist helps you understand the complexity of your arrangement. 
                      It is for educational purposes only and does not constitute legal advice.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Passive investors who won't participate in decisions?</Label>
                  <Switch
                    checked={checklistInputs.passiveInvestors}
                    onCheckedChange={(v) => setChecklistInputs(prev => ({ ...prev, passiveInvestors: v }))}
                    data-testid="switch-passive"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Promised profit distributions or returns?</Label>
                  <Switch
                    checked={checklistInputs.profitSharingPromised}
                    onCheckedChange={(v) => setChecklistInputs(prev => ({ ...prev, profitSharingPromised: v }))}
                    data-testid="switch-profit"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Centralized manager or sponsor?</Label>
                  <Switch
                    checked={checklistInputs.managerCentralized}
                    onCheckedChange={(v) => setChecklistInputs(prev => ({ ...prev, managerCentralized: v }))}
                    data-testid="switch-manager"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Reliance on sponsor's efforts for success?</Label>
                  <Switch
                    checked={checklistInputs.relianceOnSponsorEfforts}
                    onCheckedChange={(v) => setChecklistInputs(prev => ({ ...prev, relianceOnSponsorEfforts: v }))}
                    data-testid="switch-reliance"
                  />
                </div>
              </div>

              <div className="p-4 rounded-lg bg-muted">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Complexity Score</span>
                  <Badge className={tierInfo.color}>{tierInfo.label}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{tierInfo.description}</p>
              </div>

              <div className="flex items-start gap-3 pt-4 border-t">
                <Checkbox
                  id="acknowledge"
                  checked={acknowledged}
                  onCheckedChange={(v) => setAcknowledged(v as boolean)}
                  data-testid="checkbox-acknowledge"
                />
                <Label htmlFor="acknowledge" className="text-sm cursor-pointer">
                  I understand this is educational information only and I should consult 
                  with qualified professionals before proceeding with any investment arrangement.
                </Label>
              </div>
            </CardContent>
          </Card>
        );

      case 4:
        return (
          <Card>
            <CardHeader>
              <CardTitle>Review & Create</CardTitle>
              <CardDescription>Review your group details before creating</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Basic Info</h4>
                  <dl className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Title:</dt>
                      <dd>{formData.title}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Structure:</dt>
                      <dd>{ownershipStructureLabels[formData.ownershipStructure as keyof typeof ownershipStructureLabels]}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Jurisdiction:</dt>
                      <dd>{jurisdictionLabels[formData.jurisdiction as keyof typeof jurisdictionLabels]}</dd>
                    </div>
                  </dl>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Property</h4>
                  <dl className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Location:</dt>
                      <dd>{formData.propertyCity || "Not specified"}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Type:</dt>
                      <dd>{propertyTypeLabels[formData.propertyType as keyof typeof propertyTypeLabels]}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Strategy:</dt>
                      <dd>{strategyLabels[formData.targetStrategy as keyof typeof strategyLabels]}</dd>
                    </div>
                  </dl>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-muted flex items-center justify-between">
                <span>Complexity Assessment:</span>
                <Badge className={tierInfo.color}>{tierInfo.label}</Badge>
              </div>
            </CardContent>
          </Card>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <RepresentationGate featureName="create a co-investing group">
        <main className="container mx-auto px-4 py-12 max-w-3xl">
          <RepresentationStatusBanner className="mb-6" />
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-4">Create Co-Investing Group</h1>
            <div className="flex items-center gap-2">
              {STEPS.map((s, i) => (
                <div key={s} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    i <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    {i < step ? <Check className="h-4 w-4" /> : i + 1}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`w-8 h-0.5 ${i < step ? "bg-primary" : "bg-muted"}`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {renderStep()}

          <div className="flex justify-between mt-8">
            <Button
              variant="outline"
              onClick={() => setStep(s => Math.max(0, s - 1))}
              disabled={step === 0}
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>

            {step < STEPS.length - 1 ? (
              <Button
                onClick={() => setStep(s => s + 1)}
                disabled={!canProceed()}
                data-testid="button-next"
              >
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={() => createGroupMutation.mutate()}
                disabled={createGroupMutation.isPending}
                data-testid="button-create"
              >
                {createGroupMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Create Group
              </Button>
            )}
          </div>
        </main>
      </RepresentationGate>
    </div>
  );
}
