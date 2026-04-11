/**
 * Investor Dashboard — personalized deal analysis history, saved listings, and profile
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useToast } from '../hooks/use-toast';
import { track } from '../lib/event-tracking';
import {
  TrendingUp,
  ClipboardList,
  BookmarkIcon,
  MapPin,
  BarChart3,
  LogOut,
  UserRound,
  ChevronRight,
} from 'lucide-react';

interface AnalyzedDeal {
  id: number;
  address: string;
  city: string;
  province: string;
  property_type: string;
  purchase_price: number;
  rent_monthly: number;
  cap_rate: number;
  cash_on_cash: number;
  dscr: number;
  monthly_cash_flow: number;
  analyzed_at: string;
}

interface UserProfile {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  strategy: string[];
  experience_level: string;
  budget_range: string;
  preferred_cities: string;
  property_types: string[];
  created_at: string;
}

interface DashboardStats {
  total_deals_analyzed: number;
  avg_cap_rate: number;
  avg_cash_on_cash: number;
  avg_cash_flow: number;
  saved_listings: number;
}

export function InvestorDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [recentDeals, setRecentDeals] = useState<AnalyzedDeal[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    total_deals_analyzed: 0,
    avg_cap_rate: 0,
    avg_cash_on_cash: 0,
    avg_cash_flow: 0,
    saved_listings: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('investor_token');
    const storedUser = localStorage.getItem('investor_user');

    if (!token) {
      navigate('/investor/login');
      return;
    }

    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        // ignore
      }
    }

    track('page_view', { page: 'investor_dashboard' });
    fetchDashboardData(token);
  }, [navigate]);

  const fetchDashboardData = async (token: string) => {
    try {
      const headers = { Authorization: `Bearer ${token}` };

      // Fetch recent deals
      const dealsRes = await fetch('/api/deals?limit=5', { headers });
      if (dealsRes.ok) {
        const dealsData = await dealsRes.json();
        setRecentDeals(dealsData.deals || []);
        setStats((prev) => ({
          ...prev,
          total_deals_analyzed: dealsData.pagination?.total || dealsData.deals?.length || 0,
          avg_cap_rate: dealsData.avg_cap_rate || 0,
          avg_cash_on_cash: dealsData.avg_cash_on_cash || 0,
          avg_cash_flow: dealsData.avg_cash_flow || 0,
        }));
      }

      // Fetch saved listings count
      try {
        const raw = localStorage.getItem('realist.favoriteListings');
        if (raw) {
          const favs = JSON.parse(raw);
          setStats((prev) => ({ ...prev, saved_listings: favs.length || 0 }));
        }
      } catch {
        // ignore
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('investor_token');
    localStorage.removeItem('investor_user');
    track('logout', { role: 'investor' });
    toast({ title: 'Signed out' });
    navigate('/investor/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  const displayName = user?.full_name || user?.email || 'Investor';
  const experienceLabel = user?.experience_level || 'Not set';
  const budgetLabel = user?.budget_range || 'Not set';
  const preferredCities = user?.preferred_cities || 'Not set';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b bg-white">
        <div className="container mx-auto px-4 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Investor Dashboard</h1>
            <p className="text-gray-600">Welcome back, {displayName}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="outline" size="sm">
                Browse Listings
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="mr-1 h-4 w-4" /> Sign Out
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Deals Analyzed"
            value={stats.total_deals_analyzed.toString()}
            icon={<ClipboardList className="h-5 w-5" />}
          />
          <StatCard
            title="Avg Cap Rate"
            value={stats.avg_cap_rate ? `${stats.avg_cap_rate}%` : '--'}
            icon={<BarChart3 className="h-5 w-5" />}
          />
          <StatCard
            title="Avg Monthly Cash Flow"
            value={stats.avg_cash_flow ? `$${stats.avg_cash_flow.toFixed(0)}` : '--'}
            icon={<TrendingUp className="h-5 w-5" />}
          />
          <StatCard
            title="Saved Listings"
            value={stats.saved_listings.toString()}
            icon={<BookmarkIcon className="h-5 w-5" />}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Profile */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserRound className="h-5 w-5" /> Investor Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <ProfileDetail label="Experience" value={experienceLabel} />
              <ProfileDetail label="Budget Range" value={budgetLabel} />
              <ProfileDetail label="Cities" value={preferredCities} />
              {user?.strategy && user.strategy.length > 0 && (
                <div>
                  <span className="font-medium text-gray-500">Strategies</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {user.strategy.map((s) => (
                      <span
                        key={s}
                        className="inline-block bg-primary/10 text-primary text-xs rounded-full px-2 py-0.5"
                      >
                        {s.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <Link to="/">
                <Button className="w-full mt-4" variant="default">
                  Analyze a Deal
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Recent Deal Analyses */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Recent Analyses</CardTitle>
              <CardDescription>Properties you've underwrote on Realist</CardDescription>
            </CardHeader>
            <CardContent>
              {recentDeals.length === 0 ? (
                <div className="text-center py-8">
                  <MapPin className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-600">No deals analyzed yet</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Browse listings and use the deal analyzer to get started.
                  </p>
                  <Link to="/">
                    <Button className="mt-3">Browse Listings</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentDeals.map((deal) => (
                    <div
                      key={deal.id}
                      className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-accent/50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/listings/${deal.address || ''}`)}
                    >
                      <div>
                        <p className="font-medium text-sm">
                          {deal.address || 'Unknown Address'}, {deal.city}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {deal.property_type} · ${deal.purchase_price?.toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-sm">{deal.cap_rate ?? '--'}% Cap</p>
                        <p className="text-xs text-muted-foreground">
                          ${deal.monthly_cash_flow?.toFixed(0)}/mo
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-sm text-muted-foreground mt-1">{title}</p>
          </div>
          <div className="text-primary">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProfileDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="font-medium text-gray-500">{label}</span>
      <p className="text-sm">{value}</p>
    </div>
  );
}

export default InvestorDashboard;
