import { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Check } from 'lucide-react';
import { useToast } from '../../hooks/use-toast';

interface TierFeature {
  name: string;
  included: boolean;
}

interface Tier {
  id: 'free' | 'premium' | 'enterprise';
  name: string;
  price: string;
  description: string;
  features: TierFeature[];
  cta: string;
  popular?: boolean;
}

const tiers: Tier[] = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    description: 'Basic access for individual investors',
    cta: 'Current Plan',
    features: [
      { name: 'Search listings', included: true },
      { name: 'View listing details', included: true },
      { name: 'Basic filters', included: true },
      { name: 'Map view', included: true },
      { name: 'Save up to 5 favorites', included: true },
      { name: 'Save up to 2 searches', included: true },
      { name: 'Investment metrics', included: false },
      { name: 'Cap rate calculator', included: false },
      { name: 'Rent estimate access', included: false },
      { name: 'Export to CSV', included: false },
      { name: 'Priority support', included: false },
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '$29/month',
    description: 'Advanced tools for serious investors',
    cta: 'Upgrade to Premium',
    popular: true,
    features: [
      { name: 'Search listings', included: true },
      { name: 'View listing details', included: true },
      { name: 'Advanced filters', included: true },
      { name: 'Map view', included: true },
      { name: 'Unlimited favorites', included: true },
      { name: 'Unlimited saved searches', included: true },
      { name: 'Investment metrics', included: true },
      { name: 'Cap rate calculator', included: true },
      { name: 'Rent estimate access', included: true },
      { name: 'Export to CSV', included: true },
      { name: 'Priority support', included: true },
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    description: 'Full platform access for teams and businesses',
    cta: 'Contact Sales',
    features: [
      { name: 'Everything in Premium', included: true },
      { name: 'API access', included: true },
      { name: 'Custom reports', included: true },
      { name: 'Team accounts', included: true },
      { name: 'White labeling', included: true },
      { name: 'Dedicated account manager', included: true },
      { name: 'Custom integrations', included: true },
    ],
  },
];

interface SubscriptionTierCardProps {
  currentTier?: 'free' | 'premium' | 'enterprise';
  onUpgrade?: (tier: 'premium' | 'enterprise') => Promise<void>;
}

export function SubscriptionTierCard({ currentTier = 'free', onUpgrade }: SubscriptionTierCardProps) {
  const [loading, setLoading] = useState<'premium' | 'enterprise' | null>(null);
  const { toast } = useToast();

  const handleUpgrade = async (tier: 'premium' | 'enterprise') => {
    if (onUpgrade) {
      setLoading(tier);
      try {
        await onUpgrade(tier);
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to start upgrade process. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setLoading(null);
      }
      return;
    }

    // Default behavior: call API to create checkout session
    setLoading(tier);
    try {
      const response = await fetch('/api/auth/subscription/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier,
          success_url: `${window.location.origin}/subscription/success`,
          cancel_url: `${window.location.origin}/subscription`,
        }),
      });

      const result = await response.json();

      if (result.success && result.data.url) {
        // Redirect to Stripe Checkout
        window.location.href = result.data.url;
      } else {
        throw new Error(result.error || 'Failed to create checkout session');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to start upgrade process',
        variant: 'destructive',
      });
      setLoading(null);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
      {tiers.map((tier) => {
        const isCurrent = currentTier === tier.id;
        const isPopular = tier.popular;

        return (
          <Card
            key={tier.id}
            className={`relative flex flex-col ${isPopular ? 'border-2 border-primary shadow-lg' : ''}`}
          >
            {isPopular && (
              <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 px-4 py-1">
                Most Popular
              </Badge>
            )}
            <CardHeader>
              <CardTitle className="text-2xl">{tier.name}</CardTitle>
              <div className="flex items-baseline mt-2">
                <span className="text-3xl font-bold">{tier.price}</span>
                {tier.id === 'premium' && <span className="text-muted-foreground ml-2">/month</span>}
              </div>
              <CardDescription>{tier.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
              <ul className="space-y-3">
                {tier.features.map((feature) => (
                  <li key={feature.name} className="flex items-start">
                    {feature.included ? (
                      <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                    ) : (
                      <span className="h-5 w-5 mr-2 flex-shrink-0" />
                    )}
                    <span className={feature.included ? '' : 'text-muted-foreground line-through'}>
                      {feature.name}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                variant={isCurrent ? 'outline' : isPopular ? 'default' : 'outline'}
                size="lg"
                disabled={isCurrent || loading === tier.id}
                onClick={() => {
                  if (tier.id !== 'free') {
                    handleUpgrade(tier.id as 'premium' | 'enterprise');
                  }
                }}
              >
                {loading === tier.id ? 'Processing...' : isCurrent ? 'Current Plan' : tier.cta}
              </Button>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}