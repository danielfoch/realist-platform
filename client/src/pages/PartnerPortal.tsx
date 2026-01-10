import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { User, Briefcase, Users, CheckCircle, Clock, Phone, Mail, MapPin, Building } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import type { IndustryPartner, PartnerLead, Lead } from "@shared/schema";

const PARTNER_TYPES = [
  { value: "realtor", label: "Realtor" },
  { value: "mortgage_broker", label: "Mortgage Broker" },
  { value: "lawyer", label: "Real Estate Lawyer" },
  { value: "accountant", label: "Accountant" },
  { value: "property_manager", label: "Property Manager" },
  { value: "contractor", label: "Contractor" },
  { value: "appraiser", label: "Appraiser" },
  { value: "inspector", label: "Inspector" },
  { value: "other", label: "Other" },
];

const SERVICE_AREAS = [
  "Ontario", "British Columbia", "Alberta", "Quebec", "Manitoba", 
  "Saskatchewan", "Nova Scotia", "New Brunswick", "Newfoundland and Labrador", 
  "Prince Edward Island", "Greater Toronto Area", "Greater Vancouver Area",
  "Calgary Area", "Edmonton Area", "Montreal Area", "Ottawa Area"
];

const LEAD_STATUSES = [
  { value: "new", label: "New", color: "bg-blue-500" },
  { value: "contacted", label: "Contacted", color: "bg-yellow-500" },
  { value: "in_progress", label: "In Progress", color: "bg-purple-500" },
  { value: "closed_won", label: "Closed - Won", color: "bg-green-500" },
  { value: "closed_lost", label: "Closed - Lost", color: "bg-red-500" },
];

type PartnerLeadWithLead = PartnerLead & { lead: Lead };

export default function PartnerPortal() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: partner, isLoading: partnerLoading } = useQuery<IndustryPartner | null>({
    queryKey: ["/api/partner/profile"],
    enabled: isAuthenticated,
  });

  const { data: leads, isLoading: leadsLoading } = useQuery<PartnerLeadWithLead[]>({
    queryKey: ["/api/partner/leads"],
    enabled: isAuthenticated && !!partner,
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data: Partial<IndustryPartner>) => 
      apiRequest("PUT", "/api/partner/profile", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/partner/profile"] });
      toast({ title: "Profile updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update profile", variant: "destructive" });
    },
  });

  const updateLeadStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => 
      apiRequest("PUT", `/api/partner/leads/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/partner/leads"] });
      toast({ title: "Lead status updated" });
    },
    onError: () => {
      toast({ title: "Failed to update lead status", variant: "destructive" });
    },
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="py-8">
          <div className="max-w-4xl mx-auto px-4 md:px-6">
            <Skeleton className="h-12 w-64 mb-4" />
            <Skeleton className="h-96 w-full" />
          </div>
        </main>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="py-16">
          <div className="max-w-md mx-auto px-4 text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
              <Briefcase className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold mb-4" data-testid="text-login-required">Sign In Required</h1>
            <p className="text-muted-foreground mb-6">
              Please sign in to access your industry partner portal and manage leads.
            </p>
            <Button onClick={() => window.location.href = "/login"} data-testid="button-sign-in">
              Sign In
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const newLeads = leads?.filter(l => l.status === "new").length || 0;
  const inProgressLeads = leads?.filter(l => l.status === "in_progress" || l.status === "contacted").length || 0;
  const closedWonLeads = leads?.filter(l => l.status === "closed_won").length || 0;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="py-8">
        <div className="max-w-5xl mx-auto px-4 md:px-6 space-y-8">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-bold" data-testid="text-partner-portal-title">
                Partner Portal
              </h1>
              <p className="text-muted-foreground">
                {partner?.companyName || user?.firstName || "Welcome"} - {PARTNER_TYPES.find(t => t.value === partner?.partnerType)?.label || "Industry Partner"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {partner?.isApproved ? (
                <Badge variant="default" className="gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Approved Partner
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  <Clock className="h-3 w-3" />
                  Pending Approval
                </Badge>
              )}
              {partner?.isPublic && (
                <Badge variant="outline">Public Profile</Badge>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-4 gap-4">
            <Card data-testid="stat-total-leads">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Leads</p>
                    <p className="text-2xl font-bold font-mono">{leads?.length || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="stat-new-leads">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Users className="h-6 w-6 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">New Leads</p>
                    <p className="text-2xl font-bold font-mono">{newLeads}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="stat-in-progress">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <Clock className="h-6 w-6 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">In Progress</p>
                    <p className="text-2xl font-bold font-mono">{inProgressLeads}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="stat-closed-won">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <CheckCircle className="h-6 w-6 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Closed Won</p>
                    <p className="text-2xl font-bold font-mono">{closedWonLeads}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="leads" className="space-y-6">
            <TabsList data-testid="partner-tabs">
              <TabsTrigger value="leads" data-testid="tab-leads">Leads</TabsTrigger>
              <TabsTrigger value="profile" data-testid="tab-profile">My Profile</TabsTrigger>
            </TabsList>

            <TabsContent value="leads" className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-semibold">Your Leads</h2>
              </div>

              {leadsLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : !partner ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-semibold mb-2">Complete Your Profile First</h3>
                    <p className="text-muted-foreground mb-4">
                      Please complete your partner profile to start receiving leads.
                    </p>
                  </CardContent>
                </Card>
              ) : leads?.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-semibold mb-2">No leads yet</h3>
                    <p className="text-muted-foreground">
                      Leads matching your service areas will appear here once assigned.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Lead</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Assigned</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leads?.map((partnerLead) => (
                        <TableRow key={partnerLead.id} data-testid={`lead-row-${partnerLead.id}`}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{partnerLead.lead.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {partnerLead.lead.leadSource || "Direct"}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="text-sm flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {partnerLead.lead.email}
                              </p>
                              {partnerLead.lead.phone && (
                                <p className="text-sm flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {partnerLead.lead.phone}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(partnerLead.assignedAt), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={partnerLead.status || "new"}
                              onValueChange={(status) => 
                                updateLeadStatusMutation.mutate({ id: partnerLead.id, status })
                              }
                            >
                              <SelectTrigger className="w-40" data-testid={`select-status-${partnerLead.id}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {LEAD_STATUSES.map(s => (
                                  <SelectItem key={s.value} value={s.value}>
                                    {s.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="profile" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Partner Profile</CardTitle>
                  <CardDescription>
                    This information will be displayed on the Realist.ca website when your profile is approved and public.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PartnerProfileForm 
                    partner={partner}
                    onSubmit={(data) => updateProfileMutation.mutate(data)}
                    isPending={updateProfileMutation.isPending}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}

function PartnerProfileForm({ 
  partner, 
  onSubmit, 
  isPending 
}: { 
  partner: IndustryPartner | null | undefined; 
  onSubmit: (data: Partial<IndustryPartner>) => void;
  isPending: boolean;
}) {
  const [formData, setFormData] = useState({
    partnerType: partner?.partnerType || "realtor",
    companyName: partner?.companyName || "",
    licenseNumber: partner?.licenseNumber || "",
    phone: partner?.phone || "",
    publicEmail: partner?.publicEmail || "",
    bio: partner?.bio || "",
    headshotUrl: partner?.headshotUrl || "",
    serviceAreas: partner?.serviceAreas || [],
    isPublic: partner?.isPublic || false,
  });

  const toggleServiceArea = (area: string) => {
    setFormData(prev => ({
      ...prev,
      serviceAreas: prev.serviceAreas.includes(area)
        ? prev.serviceAreas.filter(a => a !== area)
        : [...prev.serviceAreas, area]
    }));
  };

  return (
    <form 
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(formData);
      }}
      className="space-y-6"
    >
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="partnerType">Partner Type</Label>
          <Select
            value={formData.partnerType}
            onValueChange={(value) => setFormData(prev => ({ ...prev, partnerType: value }))}
          >
            <SelectTrigger data-testid="select-partner-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PARTNER_TYPES.map(t => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="companyName">Company Name</Label>
          <Input
            id="companyName"
            value={formData.companyName}
            onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
            placeholder="Your company or brokerage"
            data-testid="input-company-name"
          />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="licenseNumber">License Number</Label>
          <Input
            id="licenseNumber"
            value={formData.licenseNumber}
            onChange={(e) => setFormData(prev => ({ ...prev, licenseNumber: e.target.value }))}
            placeholder="Your professional license number"
            data-testid="input-license"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number</Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
            placeholder="(416) 555-0123"
            data-testid="input-phone"
          />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="publicEmail">Public Email</Label>
          <Input
            id="publicEmail"
            type="email"
            value={formData.publicEmail}
            onChange={(e) => setFormData(prev => ({ ...prev, publicEmail: e.target.value }))}
            placeholder="contact@yourcompany.com"
            data-testid="input-public-email"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="headshotUrl">Headshot URL</Label>
          <Input
            id="headshotUrl"
            value={formData.headshotUrl}
            onChange={(e) => setFormData(prev => ({ ...prev, headshotUrl: e.target.value }))}
            placeholder="https://..."
            data-testid="input-headshot-url"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="bio">Bio</Label>
        <Textarea
          id="bio"
          value={formData.bio}
          onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
          placeholder="Tell potential clients about yourself and your experience..."
          rows={4}
          data-testid="input-bio"
        />
      </div>

      <div className="space-y-2">
        <Label>Service Areas</Label>
        <p className="text-sm text-muted-foreground mb-2">
          Select the areas where you provide services. Leads from these areas will be assigned to you.
        </p>
        <div className="flex flex-wrap gap-2">
          {SERVICE_AREAS.map(area => (
            <Badge
              key={area}
              variant={formData.serviceAreas.includes(area) ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => toggleServiceArea(area)}
              data-testid={`badge-area-${area.replace(/\s+/g, "-").toLowerCase()}`}
            >
              {area}
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div>
          <p className="font-medium">Public Profile</p>
          <p className="text-sm text-muted-foreground">
            Make your profile visible on the Realist.ca website (requires approval)
          </p>
        </div>
        <Switch
          checked={formData.isPublic}
          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isPublic: checked }))}
          data-testid="switch-public"
        />
      </div>

      <Button type="submit" disabled={isPending} data-testid="button-save-profile">
        {isPending ? "Saving..." : "Save Profile"}
      </Button>
    </form>
  );
}
