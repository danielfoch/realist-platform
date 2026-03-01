/**
 * Realtor Dashboard
 * Shows leads, stats, and market management
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useToast } from '../hooks/use-toast'; 
import { 
  Loader2, 
  Building2, 
  Users, 
  DollarSign, 
  MapPin, 
  Plus, 
  Trash2,
  CheckCircle,
  Mail,
  Phone,
} from 'lucide-react';

interface RealtorStats {
  leads_received: number;
  leads_claimed: number;
  referral_earnings: number;
  total_earnings: number;
}

interface MarketClaim {
  id: number;
  market_type: string;
  market_value: string;
  status: string;
  total_leads: number;
}

interface LeadNotification {
  id: number;
  lead_id: number;
  full_name: string;
  email: string;
  phone: string;
  investment_type: string;
  budget_min: number;
  budget_max: number;
  target_cities: string[];
  timeline: string;
  created_at: string;
  claimed: boolean;
  claimed_at: string | null;
}

export function RealtorDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<RealtorStats>({
    leads_received: 0,
    leads_claimed: 0,
    referral_earnings: 0,
    total_earnings: 0, // Will be calculated from referral_earnings
  });
  const [marketClaims, setMarketClaims] = useState<MarketClaim[]>([]);
  const [leadNotifications, setLeadNotifications] = useState<LeadNotification[]>([]);
  const [newMarket, setNewMarket] = useState({ type: 'city', value: '' });

  const token = localStorage.getItem('realtor_token');
  const user = JSON.parse(localStorage.getItem('realtor_user') || '{}');

  useEffect(() => {
    if (!token) {
      navigate('/realtor/login');
      return;
    }
    fetchDashboardData();
  }, [token]);

  const fetchDashboardData = async () => {
    try {
      const [dashboardRes, marketsRes] = await Promise.all([
        fetch('/api/realtor/dashboard', {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch('/api/realtor/markets', {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
      ]);

      const dashboardData = await dashboardRes.json();
      const marketsData = await marketsRes.json();

      if (dashboardData.success) {
        const dashboardStats = dashboardData.data.stats;
        setStats({
          ...dashboardStats,
          total_earnings: dashboardStats.referral_earnings || 0,
        });
        // Transform recent_leads to match expected format
        const leads = (dashboardData.data.recent_leads || []).map((lead: any) => ({
          id: lead.id,
          lead_id: lead.id,
          full_name: lead.full_name,
          email: lead.email,
          phone: lead.phone,
          investment_type: lead.investment_type,
          budget_min: lead.budget_min,
          budget_max: lead.budget_max,
          target_cities: lead.target_cities,
          timeline: lead.timeline,
          created_at: lead.created_at,
          claimed: lead.claimed,
          claimed_at: lead.claimed_at,
        }));
        setLeadNotifications(leads);
      }
      if (marketsData.success) {
        setMarketClaims(marketsData.data.map((m: any) => ({
          id: m.id,
          market_type: m.market_type,
          market_value: m.market_value,
          status: m.status,
          total_leads: parseInt(m.leads_count) || 0,
        })));
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMarket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMarket.value.trim()) return;

    try {
      const response = await fetch('/api/realtor/markets/claim', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(newMarket),
      });

      const result = await response.json();

      if (result.success) {
        toast({ title: 'Market added!' });
        setNewMarket({ type: 'city', value: '' });
        fetchDashboardData();
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  const handleRemoveMarket = async (marketId: number) => {
    try {
      const response = await fetch(`/api/realtor/markets/${marketId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const result = await response.json();

      if (result.success) {
        toast({ title: 'Market removed' });
        fetchDashboardData();
      }
    } catch (error) {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  const handleClaimLead = async (leadId: number) => {
    try {
      const response = await fetch(`/api/realtor/leads/${leadId}/claim`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const result = await response.json();

      if (result.success) {
        toast({ 
          title: 'Lead claimed! 🎉',
          description: 'We\'ve sent an introduction email to the lead.',
        });
        fetchDashboardData();
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('realtor_token');
    localStorage.removeItem('realtor_user');
    navigate('/realtor/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Building2 className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-xl font-bold">Realtor Portal</h1>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout}>Sign Out</Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Leads Received</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.leads_received}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Leads Claimed</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.leads_claimed}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending Earnings</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.referral_earnings.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Earned</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.total_earnings.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="leads" className="space-y-4">
          <TabsList>
            <TabsTrigger value="leads">Leads ({leadNotifications.length})</TabsTrigger>
            <TabsTrigger value="markets">My Markets ({marketClaims.length})</TabsTrigger>
            <TabsTrigger value="earnings">Earnings</TabsTrigger>
          </TabsList>

          {/* Leads Tab */}
          <TabsContent value="leads">
            <Card>
              <CardHeader>
                <CardTitle>Lead Notifications</CardTitle>
                <CardDescription>
                  New investor leads in your claimed markets
                </CardDescription>
              </CardHeader>
              <CardContent>
                {leadNotifications.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No leads yet. Add more markets to receive leads.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {leadNotifications.map((lead) => (
                      <div key={lead.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <p className="font-semibold">{lead.full_name}</p>
                            <div className="flex gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {lead.email}
                              </span>
                              {lead.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {lead.phone}
                                </span>
                              )}
                            </div>
                          </div>
                          {lead.claimed ? (
                            <span className="inline-flex items-center gap-1 text-sm text-green-600">
                              <CheckCircle className="h-4 w-4" />
                              Claimed
                            </span>
                          ) : (
                            <Button 
                              size="sm" 
                              onClick={() => handleClaimLead(lead.id)}
                            >
                              Claim Lead
                            </Button>
                          )}
                        </div>
                        <div className="mt-3 flex gap-4 text-sm">
                          <span className="bg-slate-100 px-2 py-1 rounded">
                            {lead.investment_type || 'Investment'}
                          </span>
                          <span>
                            Budget: ${lead.budget_min?.toLocaleString() || '0'} - ${lead.budget_max?.toLocaleString() || 'No limit'}
                          </span>
                          <span>
                            Timeline: {lead.timeline || 'Not specified'}
                          </span>
                        </div>
                        {lead.target_cities && lead.target_cities.length > 0 && (
                          <div className="mt-2 text-sm text-muted-foreground">
                            <MapPin className="h-3 w-3 inline mr-1" />
                            {lead.target_cities.join(', ')}
                          </div>
                        )}
                        <div className="mt-2 text-xs text-muted-foreground">
                          Received: {new Date(lead.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Markets Tab */}
          <TabsContent value="markets">
            <Card>
              <CardHeader>
                <CardTitle>Claimed Markets</CardTitle>
                <CardDescription>
                  Areas where you want to receive investor leads
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Add Market Form */}
                <form onSubmit={handleAddMarket} className="flex gap-2 mb-6">
                  <select
                    value={newMarket.type}
                    onChange={(e) => setNewMarket(prev => ({ ...prev, type: e.target.value }))}
                    className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="city">City</option>
                    <option value="province">Province</option>
                    <option value="postal_code">Postal Code Prefix</option>
                  </select>
                  <Input
                    placeholder="e.g., Toronto, ON, M5V"
                    value={newMarket.value}
                    onChange={(e) => setNewMarket(prev => ({ ...prev, value: e.target.value }))}
                    className="flex-1"
                  />
                  <Button type="submit">
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </form>

                {/* Market List */}
                {marketClaims.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No markets claimed yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {marketClaims.map((market) => (
                      <div key={market.id} className="flex items-center justify-between border rounded-lg p-3">
                        <div className="flex items-center gap-3">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <span className="font-medium capitalize">{market.market_value}</span>
                            <span className="text-muted-foreground text-sm ml-2">
                              ({market.market_type})
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-muted-foreground">
                            {market.total_leads} leads
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveMarket(market.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Earnings Tab */}
          <TabsContent value="earnings">
            <Card>
              <CardHeader>
                <CardTitle>Referral Earnings</CardTitle>
                <CardDescription>
                  Your referral fee earnings from closed deals
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Earnings will appear here when your leads close deals.</p>
                  <p className="text-sm mt-2">
                    You earn 25% of the referral fee when a lead you claimed closes a deal.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

export default RealtorDashboard;
