import { useState, useEffect } from 'react';
import { useToast } from './use-toast';

export function useFeatureAccess(feature: string) {
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setHasAccess(false);
          return;
        }

        const response = await fetch(`/api/auth/feature-access/${feature}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const result = await response.json();
        if (result.success) {
          setHasAccess(result.data.has_access);
        } else {
          setHasAccess(false);
          toast({
            title: 'Access Denied',
            description: result.error || 'You do not have access to this feature.',
            variant: 'destructive',
          });
        }
      } catch (error) {
        console.error('Failed to check feature access:', error);
        setHasAccess(false);
      } finally {
        setLoading(false);
      }
    };

    checkAccess();
  }, [feature, toast]);

  return { hasAccess, loading };
}