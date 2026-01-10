import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  CreditCard, 
  Palette, 
  BarChart3, 
  Settings, 
  Crown,
  Zap,
  ArrowUpRight,
  Check,
  Star,
  MapPin,
  Users
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";

interface Subscription {
  id: string;
  userId: string;
  tier: string;
  monthlyPullLimit: number | null;
  pullsUsedThisMonth: number | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  status: string | null;
}

interface BrandingAssets {
  id?: string;
  companyName?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  website?: string | null;
  disclaimerText?: string | null;
}

const TIER_INFO = {
  free: { 
    name: 'Free', 
    pulls: 5, 
    price: 0,
    features: ['5 deal analyses/month', 'Basic export', 'No branding']
  },
  starter: { 
    name: 'Starter', 
    pulls: 25, 
    price: 10,
    features: ['25 deal analyses/month', 'PDF & Sheets export', 'Basic branding', 'Company logo on exports']
  },
  pro: { 
    name: 'Pro', 
    pulls: -1, 
    price: 25,
    features: ['Unlimited analyses', 'All export formats', 'Full branding', 'Priority support', 'Custom disclaimer']
  },
};

export default function ProfessionalDashboard() {
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  const { data: subscription, isLoading: subLoading } = useQuery<Subscription>({
    queryKey: ['/api/subscription'],
    enabled: !!user,
  });

  const { data: branding, isLoading: brandingLoading } = useQuery<BrandingAssets>({
    queryKey: ['/api/branding'],
    enabled: !!user,
  });

  const { data: analyticsData } = useQuery<{ count: number }>({
    queryKey: ['/api/analytics/deals-count'],
  });

  const { data: expertApplication } = useQuery<any>({
    queryKey: ['/api/market-expert/application'],
    enabled: !!user,
  });

  const [expertForm, setExpertForm] = useState({
    marketRegion: '',
    marketCity: '',
    includeMeetupHost: false,
  });

  const brandingForm = useForm<BrandingAssets>({
    defaultValues: branding || {},
  });

  const checkoutMutation = useMutation({
    mutationFn: async (tier: string) => {
      const response = await apiRequest('POST', '/api/subscription/checkout', { tier });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to start checkout. Please try again.",
        variant: "destructive",
      });
    },
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/subscription/portal', {});
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
  });

  const brandingMutation = useMutation({
    mutationFn: async (data: BrandingAssets) => {
      const response = await apiRequest('PUT', '/api/branding', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/branding'] });
      toast({
        title: "Saved",
        description: "Your branding settings have been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save branding. You may need a paid subscription.",
        variant: "destructive",
      });
    },
  });

  const expertMutation = useMutation({
    mutationFn: async (data: { marketRegion: string; marketCity: string; includeMeetupHost: boolean }) => {
      const response = await apiRequest('POST', '/api/market-expert/apply', data);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      } else {
        queryClient.invalidateQueries({ queryKey: ['/api/market-expert/application'] });
        toast({
          title: "Application Submitted",
          description: "Redirecting to checkout...",
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit application. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (authLoading || subLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4">
          <CardHeader className="text-center">
            <CardTitle>Professional Dashboard</CardTitle>
            <CardDescription>Sign in to access your professional tools</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={() => setLocation('/login')} data-testid="button-login">
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentTier = subscription?.tier || 'free';
  const tierInfo = TIER_INFO[currentTier as keyof typeof TIER_INFO] || TIER_INFO.free;
  const pullsUsed = subscription?.pullsUsedThisMonth || 0;
  const pullLimit = subscription?.monthlyPullLimit || 5;
  const usagePercent = pullLimit === -1 ? 0 : (pullsUsed / pullLimit) * 100;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Professional Dashboard</h1>
            <p className="text-muted-foreground">Manage your subscription and branding</p>
          </div>
          <Badge variant={currentTier === 'pro' ? 'default' : 'secondary'} className="text-sm px-3 py-1">
            {currentTier === 'pro' && <Crown className="w-4 h-4 mr-1" />}
            {tierInfo.name} Plan
          </Badge>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList data-testid="tabs-dashboard">
            <TabsTrigger value="overview" data-testid="tab-overview">
              <BarChart3 className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="subscription" data-testid="tab-subscription">
              <CreditCard className="w-4 h-4 mr-2" />
              Subscription
            </TabsTrigger>
            <TabsTrigger value="branding" data-testid="tab-branding">
              <Palette className="w-4 h-4 mr-2" />
              Branding
            </TabsTrigger>
            <TabsTrigger value="expert" data-testid="tab-expert">
              <Star className="w-4 h-4 mr-2" />
              Featured Expert
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Usage</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold font-mono">{pullsUsed}</span>
                    <span className="text-muted-foreground">/ {pullLimit === -1 ? 'Unlimited' : pullLimit}</span>
                  </div>
                  {pullLimit !== -1 && (
                    <Progress value={usagePercent} className="mt-3 h-2" />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Current Plan</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{tierInfo.name}</div>
                  <p className="text-muted-foreground text-sm mt-1">
                    ${tierInfo.price}/month
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Deals on Platform</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold font-mono">{analyticsData?.count || 0}</div>
                  <p className="text-muted-foreground text-sm mt-1">Last 30 days</p>
                </CardContent>
              </Card>
            </div>

            {currentTier === 'free' && (
              <Card className="border-primary/50 bg-primary/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-primary" />
                    Upgrade to Unlock More
                  </CardTitle>
                  <CardDescription>
                    Get more analyses, custom branding, and priority support
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex gap-4 flex-wrap">
                  <Button 
                    onClick={() => checkoutMutation.mutate('starter')}
                    disabled={checkoutMutation.isPending}
                    data-testid="button-upgrade-starter"
                  >
                    Upgrade to Starter - $10/mo
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => checkoutMutation.mutate('pro')}
                    disabled={checkoutMutation.isPending}
                    data-testid="button-upgrade-pro"
                  >
                    Upgrade to Pro - $25/mo
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="subscription" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {Object.entries(TIER_INFO).map(([tier, info]) => (
                <Card 
                  key={tier} 
                  className={currentTier === tier ? 'border-primary ring-2 ring-primary/20' : ''}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>{info.name}</CardTitle>
                      {currentTier === tier && <Badge>Current</Badge>}
                    </div>
                    <div className="text-3xl font-bold">
                      ${info.price}
                      <span className="text-base font-normal text-muted-foreground">/month</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {info.features.map((feature, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm">
                          <Check className="w-4 h-4 text-green-500" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <Separator className="my-4" />
                    {currentTier === tier ? (
                      subscription?.stripeSubscriptionId && (
                        <Button 
                          variant="outline" 
                          className="w-full"
                          onClick={() => portalMutation.mutate()}
                          disabled={portalMutation.isPending}
                          data-testid={`button-manage-${tier}`}
                        >
                          <Settings className="w-4 h-4 mr-2" />
                          Manage Subscription
                        </Button>
                      )
                    ) : tier !== 'free' && (
                      <Button 
                        className="w-full"
                        onClick={() => checkoutMutation.mutate(tier)}
                        disabled={checkoutMutation.isPending}
                        data-testid={`button-subscribe-${tier}`}
                      >
                        {currentTier === 'free' ? 'Subscribe' : 'Switch Plan'}
                        <ArrowUpRight className="w-4 h-4 ml-2" />
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="branding" className="space-y-6">
            {currentTier === 'free' ? (
              <Card>
                <CardHeader>
                  <CardTitle>Custom Branding</CardTitle>
                  <CardDescription>
                    Upgrade to Starter or Pro to add your branding to PDF exports
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    onClick={() => checkoutMutation.mutate('starter')}
                    disabled={checkoutMutation.isPending}
                    data-testid="button-upgrade-for-branding"
                  >
                    Upgrade to Enable Branding
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Branding Settings</CardTitle>
                  <CardDescription>
                    Customize how your PDF exports appear to clients. All exports include 
                    "This report was prepared on realist.ca" footer.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...brandingForm}>
                    <form 
                      onSubmit={brandingForm.handleSubmit((data) => brandingMutation.mutate(data))}
                      className="space-y-4"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={brandingForm.control}
                          name="companyName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Company Name</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  value={field.value || ''} 
                                  placeholder="Your Company Name"
                                  data-testid="input-company-name"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={brandingForm.control}
                          name="logoUrl"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Logo URL</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  value={field.value || ''} 
                                  placeholder="https://..."
                                  data-testid="input-logo-url"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={brandingForm.control}
                          name="contactEmail"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Contact Email</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  value={field.value || ''} 
                                  placeholder="you@company.com"
                                  type="email"
                                  data-testid="input-contact-email"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={brandingForm.control}
                          name="contactPhone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Contact Phone</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  value={field.value || ''} 
                                  placeholder="(555) 123-4567"
                                  data-testid="input-contact-phone"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={brandingForm.control}
                          name="website"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Website</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  value={field.value || ''} 
                                  placeholder="https://yoursite.com"
                                  data-testid="input-website"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <div className="flex items-end gap-2">
                          <FormField
                            control={brandingForm.control}
                            name="primaryColor"
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel>Primary Color</FormLabel>
                                <FormControl>
                                  <div className="flex gap-2">
                                    <Input 
                                      type="color"
                                      {...field} 
                                      value={field.value || '#000000'} 
                                      className="w-12 h-9 p-1 cursor-pointer"
                                      data-testid="input-primary-color"
                                    />
                                    <Input 
                                      {...field} 
                                      value={field.value || ''} 
                                      placeholder="#000000"
                                      className="flex-1"
                                    />
                                  </div>
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      {currentTier === 'pro' && (
                        <FormField
                          control={brandingForm.control}
                          name="disclaimerText"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Custom Disclaimer (Pro only)</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  value={field.value || ''} 
                                  placeholder="Additional disclaimer text for your exports..."
                                  data-testid="input-disclaimer"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      )}

                      <Button 
                        type="submit" 
                        disabled={brandingMutation.isPending}
                        data-testid="button-save-branding"
                      >
                        {brandingMutation.isPending ? 'Saving...' : 'Save Branding'}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="expert" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-500" />
                  Become a Featured Market Expert
                </CardTitle>
                <CardDescription>
                  Get featured on Realist.ca as the go-to expert for your market. Receive investor leads and build your reputation.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {expertApplication ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <Check className="w-5 h-5 text-green-500" />
                      <div>
                        <p className="font-medium text-green-600">Application Submitted</p>
                        <p className="text-sm text-muted-foreground">
                          {expertApplication.marketCity}, {expertApplication.marketRegion}
                          {expertApplication.includeMeetupHost && ' (with Meetup Host)'}
                        </p>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Status: <Badge variant={expertApplication.status === 'approved' ? 'default' : 'secondary'}>
                        {expertApplication.status}
                      </Badge>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card className="border-2">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg">Featured Expert</CardTitle>
                          <div className="text-2xl font-bold">$1,000<span className="text-sm font-normal text-muted-foreground">/month</span></div>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2 text-sm">
                            <li className="flex items-center gap-2">
                              <Check className="w-4 h-4 text-green-500" />
                              Featured listing on your market page
                            </li>
                            <li className="flex items-center gap-2">
                              <Check className="w-4 h-4 text-green-500" />
                              Direct investor lead referrals
                            </li>
                            <li className="flex items-center gap-2">
                              <Check className="w-4 h-4 text-green-500" />
                              20% referral fee on closed deals
                            </li>
                            <li className="flex items-center gap-2">
                              <Check className="w-4 h-4 text-green-500" />
                              Priority support and marketing
                            </li>
                          </ul>
                        </CardContent>
                      </Card>

                      <Card className="border-2 border-primary/50">
                        <CardHeader className="pb-2">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-lg">+ Meetup Host</CardTitle>
                            <Badge variant="secondary">Add-on</Badge>
                          </div>
                          <div className="text-2xl font-bold">+$250<span className="text-sm font-normal text-muted-foreground">/month</span></div>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2 text-sm">
                            <li className="flex items-center gap-2">
                              <Users className="w-4 h-4 text-primary" />
                              Host local investor meetups
                            </li>
                            <li className="flex items-center gap-2">
                              <Users className="w-4 h-4 text-primary" />
                              Event promotion on platform
                            </li>
                            <li className="flex items-center gap-2">
                              <Users className="w-4 h-4 text-primary" />
                              Connect with local investors
                            </li>
                            <li className="flex items-center gap-2">
                              <Users className="w-4 h-4 text-primary" />
                              Build your local network
                            </li>
                          </ul>
                        </CardContent>
                      </Card>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <h3 className="font-semibold">Select Your Market</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Province/State</Label>
                          <Select 
                            value={expertForm.marketRegion}
                            onValueChange={(value) => setExpertForm(prev => ({ ...prev, marketRegion: value }))}
                          >
                            <SelectTrigger data-testid="select-market-region">
                              <SelectValue placeholder="Select region" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ON">Ontario</SelectItem>
                              <SelectItem value="BC">British Columbia</SelectItem>
                              <SelectItem value="AB">Alberta</SelectItem>
                              <SelectItem value="QC">Quebec</SelectItem>
                              <SelectItem value="MB">Manitoba</SelectItem>
                              <SelectItem value="SK">Saskatchewan</SelectItem>
                              <SelectItem value="NS">Nova Scotia</SelectItem>
                              <SelectItem value="NB">New Brunswick</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>City</Label>
                          <Input 
                            value={expertForm.marketCity}
                            onChange={(e) => setExpertForm(prev => ({ ...prev, marketCity: e.target.value }))}
                            placeholder="e.g., Toronto, Vancouver"
                            data-testid="input-market-city"
                          />
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 p-4 bg-muted rounded-lg">
                        <Checkbox 
                          id="meetupHost"
                          checked={expertForm.includeMeetupHost}
                          onCheckedChange={(checked) => setExpertForm(prev => ({ ...prev, includeMeetupHost: !!checked }))}
                          data-testid="checkbox-meetup-host"
                        />
                        <label htmlFor="meetupHost" className="text-sm font-medium leading-none cursor-pointer">
                          Add Meetup Host (+$250/month) - Host local investor meetups in your area
                        </label>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg">
                        <div>
                          <p className="font-semibold">Total Monthly</p>
                          <p className="text-2xl font-bold">
                            ${expertForm.includeMeetupHost ? '1,250' : '1,000'}
                            <span className="text-sm font-normal text-muted-foreground">/month + 20% referral fee</span>
                          </p>
                        </div>
                        <Button
                          size="lg"
                          onClick={() => expertMutation.mutate(expertForm)}
                          disabled={!expertForm.marketRegion || !expertForm.marketCity || expertMutation.isPending}
                          data-testid="button-apply-expert"
                        >
                          {expertMutation.isPending ? 'Submitting...' : 'Apply Now'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
