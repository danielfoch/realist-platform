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
  Check
} from "lucide-react";
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
            <Button onClick={() => setLocation('/api/login')} data-testid="button-login">
              Sign In with Replit
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
        </Tabs>
      </div>
    </div>
  );
}
