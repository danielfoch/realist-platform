import { useQuery } from "@tanstack/react-query";
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
import { RefreshCw, Users, FileText, Webhook, Database } from "lucide-react";
import type { Lead } from "@shared/schema";
import { format } from "date-fns";

export default function Admin() {
  const { data: leads, isLoading: leadsLoading, refetch: refetchLeads } = useQuery<Lead[]>({
    queryKey: ["/api/admin/leads"],
  });

  const { data: stats, isLoading: statsLoading } = useQuery<{
    totalLeads: number;
    totalAnalyses: number;
    todayLeads: number;
  }>({
    queryKey: ["/api/admin/stats"],
  });

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="py-8">
        <div className="max-w-7xl mx-auto px-4 md:px-6 space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold" data-testid="text-admin-title">Admin Dashboard</h1>
              <p className="text-muted-foreground">Manage leads and view analytics</p>
            </div>
            <Button 
              variant="outline" 
              className="gap-2"
              onClick={() => refetchLeads()}
              data-testid="button-refresh"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
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

            <Card data-testid="stat-webhooks">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-chart-4/10 flex items-center justify-center">
                    <Webhook className="h-6 w-6 text-chart-4" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Webhook Status</p>
                    <Badge variant="outline" className="mt-1">
                      Configured
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

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
                          <Badge variant="secondary" size="sm">
                            {lead.leadSource || "Deal Analyzer"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={lead.consent ? "default" : "outline"} size="sm">
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
        </div>
      </main>
    </div>
  );
}
