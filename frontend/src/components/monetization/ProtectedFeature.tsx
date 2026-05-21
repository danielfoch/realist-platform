import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Lock } from 'lucide-react';
import { useFeatureAccess } from '../../hooks/useFeatureAccess';
import { SubscriptionTierCard } from './SubscriptionTierCard';

interface ProtectedFeatureProps {
  feature: string;
  title: string;
  description: string;
  children: React.ReactNode;
  requiredTier?: 'premium' | 'enterprise';
}

export function ProtectedFeature({
  feature,
  title,
  description,
  children,
  requiredTier = 'premium',
}: ProtectedFeatureProps) {
  const { hasAccess, loading } = useFeatureAccess(feature);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center">Checking access...</div>
        </CardContent>
      </Card>
    );
  }

  if (hasAccess) {
    return <>{children}</>;
  }

  return (
    <Card className="border-dashed">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-muted-foreground" />
          <CardTitle>{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-center py-4">
          <p className="text-lg font-medium mb-2">This feature requires a {requiredTier} subscription</p>
          <p className="text-muted-foreground mb-6">
            Upgrade your plan to unlock {title} and other premium tools.
          </p>
          <SubscriptionTierCard currentTier="free" />
        </div>
      </CardContent>
    </Card>
  );
}