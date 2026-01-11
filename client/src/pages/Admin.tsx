import { useQuery, useMutation } from "@tanstack/react-query";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, Users, FileText, Webhook, Database, CheckCircle, XCircle, Clock, Shield, Hammer } from "lucide-react";
import type { Lead, MarketExpertApplication, RenoQuote } from "@shared/schema";
import { format } from "date-fns";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type ApplicationWithUser = MarketExpertApplication & {
  user?: {
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
};

type AdminUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string | null;
  createdAt: Date | null;
};

export default function Admin() {
  const { toast } = useToast();
  
  const { data: leads, isLoading: leadsLoading, refetch: refetchLeads, error: leadsError } = useQuery<Lead[]>({
    queryKey: ["/api/admin/leads"],
    retry: false,
  });

  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery<{
    totalLeads: number;
    totalAnalyses: number;
    todayLeads: number;
  }>({
    queryKey: ["/api/admin/stats"],
    retry: false,
  });

  const { data: applications, isLoading: applicationsLoading, refetch: refetchApplications } = useQuery<ApplicationWithUser[]>({
    queryKey: ["/api/admin/applications"],
    retry: false,
  });

  const { data: users, isLoading: usersLoading, refetch: refetchUsers } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
    retry: false,
  });

  const { data: renoQuotes, isLoading: renoQuotesLoading, refetch: refetchRenoQuotes } = useQuery<RenoQuote[]>({
    queryKey: ["/api/admin/reno-quotes"],
    retry: false,
  });

  const updateApplicationMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiRequest(`/api/admin/applications/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/applications"] });
      toast({ title: "Application updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update application", variant: "destructive" });
    },
  });

  const updateUserRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      return apiRequest(`/api/admin/users/${id}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User role updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update user role", variant: "destructive" });
    },
  });

  const checkUnauthorized = (error: unknown): boolean => {
    if (!error) return false;
    const message = (error as Error)?.message || "";
    return message.startsWith("401:") || message.startsWith("403:");
  };

  const isUnauthorized = checkUnauthorized(leadsError) || checkUnauthorized(statsError);

  if (isUnauthorized) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="py-8">
          <div className="max-w-7xl mx-auto px-4 md:px-6">
            <Card className="max-w-md mx-auto">
              <CardContent className="pt-6 text-center">
                <Shield className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h2 className="text-xl font-bold mb-2">Admin Access Required</h2>
                <p className="text-muted-foreground">
                  You need admin privileges to access this page. Please contact the site administrator.
                </p>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  const pendingApplications = applications?.filter(a => a.status === "pending") || [];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="py-8">
        <div className="max-w-7xl mx-auto px-4 md:px-6 space-y-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold" data-testid="text-admin-title">Admin Dashboard</h1>
              <p className="text-muted-foreground">Manage leads, applications, and users</p>
            </div>
            <Button 
              variant="outline" 
              className="gap-2"
              onClick={() => {
                refetchLeads();
                refetchApplications();
                refetchUsers();
              }}
              data-testid="button-refresh"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh All
            </Button>
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
                    {statsLoading ? (
                      <Skeleton className="h-8 w-16" />
                    ) : (
                      <p className="text-2xl font-bold font-mono">{stats?.totalLeads || 0}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="stat-today-leads">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Users className="h-6 w-6 text-accent" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Today's Leads</p>
                    {statsLoading ? (
                      <Skeleton className="h-8 w-16" />
                    ) : (
                      <p className="text-2xl font-bold font-mono">{stats?.todayLeads || 0}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="stat-analyses">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-chart-3/10 flex items-center justify-center">
                    <FileText className="h-6 w-6 text-chart-3" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Analyses</p>
                    {statsLoading ? (
                      <Skeleton className="h-8 w-16" />
                    ) : (
                      <p className="text-2xl font-bold font-mono">{stats?.totalAnalyses || 0}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="stat-pending">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-chart-4/10 flex items-center justify-center">
                    <Clock className="h-6 w-6 text-chart-4" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Pending Approvals</p>
                    {applicationsLoading ? (
                      <Skeleton className="h-8 w-16" />
                    ) : (
                      <p className="text-2xl font-bold font-mono">{pendingApplications.length}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="applications" className="space-y-4">
            <TabsList>
              <TabsTrigger value="applications" data-testid="tab-applications">
                Applications {pendingApplications.length > 0 && (
                  <Badge variant="destructive" className="ml-2">{pendingApplications.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="users" data-testid="tab-users">Users</TabsTrigger>
              <TabsTrigger value="leads" data-testid="tab-leads">Leads</TabsTrigger>
              <TabsTrigger value="reno-quotes" data-testid="tab-reno-quotes">RenoQuotes</TabsTrigger>
            </TabsList>

            <TabsContent value="applications">
              <Card data-testid="card-applications-table">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Market Expert Applications
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {applicationsLoading ? (
                    <div className="space-y-4">
                      {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : applications && applications.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Applicant</TableHead>
                          <TableHead>Region</TableHead>
                          <TableHead>City</TableHead>
                          <TableHead>Package</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {applications.map((app) => (
                          <TableRow key={app.id} data-testid={`row-application-${app.id}`}>
                            <TableCell>
                              <div>
                                <p className="font-medium">
                                  {app.user?.firstName} {app.user?.lastName}
                                </p>
                                <p className="text-sm text-muted-foreground">{app.user?.email}</p>
                              </div>
                            </TableCell>
                            <TableCell>{app.marketRegion}</TableCell>
                            <TableCell>{app.marketCity || "-"}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {app.packageType}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={
                                  app.status === "approved" ? "default" : 
                                  app.status === "rejected" ? "destructive" : 
                                  "outline"
                                }
                              >
                                {app.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {app.createdAt ? format(new Date(app.createdAt), "MMM d, yyyy") : "N/A"}
                            </TableCell>
                            <TableCell>
                              {app.status === "pending" && (
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => updateApplicationMutation.mutate({ id: app.id, status: "approved" })}
                                    disabled={updateApplicationMutation.isPending}
                                    data-testid={`button-approve-${app.id}`}
                                  >
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => updateApplicationMutation.mutate({ id: app.id, status: "rejected" })}
                                    disabled={updateApplicationMutation.isPending}
                                    data-testid={`button-reject-${app.id}`}
                                  >
                                    <XCircle className="h-4 w-4 mr-1" />
                                    Reject
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-12">
                      <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No applications yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="users">
              <Card data-testid="card-users-table">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    All Users
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {usersLoading ? (
                    <div className="space-y-4">
                      {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : users && users.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Joined</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((user) => (
                          <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                            <TableCell className="font-medium">
                              {user.firstName} {user.lastName}
                            </TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>
                              <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                                {user.role || "investor"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {user.createdAt ? format(new Date(user.createdAt), "MMM d, yyyy") : "N/A"}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                {user.role !== "admin" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateUserRoleMutation.mutate({ id: user.id, role: "admin" })}
                                    disabled={updateUserRoleMutation.isPending}
                                    data-testid={`button-make-admin-${user.id}`}
                                  >
                                    Make Admin
                                  </Button>
                                )}
                                {user.role === "admin" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateUserRoleMutation.mutate({ id: user.id, role: "investor" })}
                                    disabled={updateUserRoleMutation.isPending}
                                    data-testid={`button-remove-admin-${user.id}`}
                                  >
                                    Remove Admin
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-12">
                      <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No users yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="leads">
              <Card data-testid="card-leads-table">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Recent Leads
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {leadsLoading ? (
                    <div className="space-y-4">
                      {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : leads && leads.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Source</TableHead>
                          <TableHead>Consent</TableHead>
                          <TableHead>Created</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {leads.map((lead) => (
                          <TableRow key={lead.id} data-testid={`row-lead-${lead.id}`}>
                            <TableCell className="font-medium">{lead.name}</TableCell>
                            <TableCell>{lead.email}</TableCell>
                            <TableCell className="font-mono">{lead.phone}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {lead.leadSource || "Deal Analyzer"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={lead.consent ? "default" : "outline"}>
                                {lead.consent ? "Yes" : "No"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {lead.createdAt ? format(new Date(lead.createdAt), "MMM d, yyyy h:mm a") : "N/A"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-12">
                      <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No leads yet</p>
                      <p className="text-sm text-muted-foreground">
                        Leads will appear here when users submit the analyzer form.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reno-quotes">
              <Card data-testid="card-reno-quotes-table">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Hammer className="h-5 w-5" />
                    RenoQuote Submissions
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchRenoQuotes()}
                    className="gap-2"
                    data-testid="button-refresh-reno-quotes"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </Button>
                </CardHeader>
                <CardContent>
                  {renoQuotesLoading ? (
                    <div className="space-y-4">
                      {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : renoQuotes && renoQuotes.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Contact</TableHead>
                          <TableHead>Persona</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Estimate Range</TableHead>
                          <TableHead>Created</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {renoQuotes.map((quote) => {
                          const pricing = quote.pricingResultJson as { totalLow?: number; totalBase?: number; totalHigh?: number } | null;
                          return (
                            <TableRow key={quote.id} data-testid={`row-reno-quote-${quote.id}`}>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{quote.leadName || "Anonymous"}</p>
                                  <p className="text-sm text-muted-foreground">{quote.leadEmail || "-"}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">{quote.persona}</Badge>
                              </TableCell>
                              <TableCell>
                                {quote.city && quote.region ? `${quote.city}, ${quote.region}` : quote.city || quote.region || "-"}
                              </TableCell>
                              <TableCell className="font-mono">
                                {pricing?.totalLow && pricing?.totalHigh ? (
                                  `$${pricing.totalLow.toLocaleString()} - $${pricing.totalHigh.toLocaleString()}`
                                ) : "-"}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {quote.createdAt ? format(new Date(quote.createdAt), "MMM d, yyyy h:mm a") : "N/A"}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-12">
                      <Hammer className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No RenoQuote submissions yet</p>
                      <p className="text-sm text-muted-foreground">
                        Quotes will appear here when users submit the RenoQuote calculator.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
