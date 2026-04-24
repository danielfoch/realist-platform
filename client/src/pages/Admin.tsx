import { useState } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Users, FileText, Webhook, Database, CheckCircle, XCircle, Clock, Shield, Hammer, GraduationCap, Phone, Mail, MessageSquare, PenLine, BookOpen, Plus, Pencil, Trash2 } from "lucide-react";
import type { Lead, MarketExpertApplication, RenoQuote, CoachingWaitlist, BlogPost, Guide } from "@shared/schema";
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

type LeaderboardHealth = {
  database?: { db_name?: string; schema_name?: string } | null;
  summary?: {
    users_count: number;
    leads_count: number;
    properties_count: number;
    analyses_count: number;
    leaderboard_eligible_count: number;
    orphan_analyses_count: number;
    oldest_analysis_at: string | null;
    newest_analysis_at: string | null;
  } | null;
  topEligibleLeaderboardUsers?: Array<{
    email: string;
    firstName: string | null;
    lastName: string | null;
    dealCount: number;
  }>;
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

  const { data: coachingWaitlist, isLoading: coachingLoading, refetch: refetchCoaching } = useQuery<CoachingWaitlist[]>({
    queryKey: ["/api/coaching-waitlist"],
    retry: false,
  });

  const { data: blogPosts, isLoading: blogLoading, refetch: refetchBlog } = useQuery<BlogPost[]>({
    queryKey: ["/api/blog/posts/admin/all"],
    retry: false,
  });

  const { data: guidesList, isLoading: guidesLoading, refetch: refetchGuides } = useQuery<Guide[]>({
    queryKey: ["/api/guides/admin/all"],
    retry: false,
  });

  const { data: leaderboardHealth, isLoading: leaderboardHealthLoading, refetch: refetchLeaderboardHealth } = useQuery<LeaderboardHealth>({
    queryKey: ["/api/admin/leaderboard-health"],
    retry: false,
  });

  const [blogDialogOpen, setBlogDialogOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [blogForm, setBlogForm] = useState({
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    coverImage: "",
    authorName: "Realist Team",
    category: "market-analysis",
    tags: "",
    status: "draft",
    metaTitle: "",
    metaDescription: "",
  });

  const [guideDialogOpen, setGuideDialogOpen] = useState(false);
  const [editingGuide, setEditingGuide] = useState<Guide | null>(null);
  const [guideForm, setGuideForm] = useState({
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    coverImage: "",
    icon: "BookOpen",
    category: "getting-started",
    difficulty: "beginner",
    authorName: "Realist Team",
    status: "draft",
    metaTitle: "",
    metaDescription: "",
    sortOrder: "0",
  });

  const resetBlogForm = () => {
    setBlogForm({
      title: "",
      slug: "",
      excerpt: "",
      content: "",
      coverImage: "",
      authorName: "Realist Team",
      category: "market-analysis",
      tags: "",
      status: "draft",
      metaTitle: "",
      metaDescription: "",
    });
    setEditingPost(null);
  };

  const resetGuideForm = () => {
    setGuideForm({
      title: "",
      slug: "",
      excerpt: "",
      content: "",
      coverImage: "",
      icon: "BookOpen",
      category: "getting-started",
      difficulty: "beginner",
      authorName: "Realist Team",
      status: "draft",
      metaTitle: "",
      metaDescription: "",
      sortOrder: "0",
    });
    setEditingGuide(null);
  };

  const openEditPost = (post: BlogPost) => {
    setEditingPost(post);
    setBlogForm({
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      content: post.content,
      coverImage: post.coverImage || "",
      authorName: post.authorName,
      category: post.category,
      tags: post.tags?.join(", ") || "",
      status: post.status,
      metaTitle: post.metaTitle || "",
      metaDescription: post.metaDescription || "",
    });
    setBlogDialogOpen(true);
  };

  const openEditGuide = (guide: Guide) => {
    setEditingGuide(guide);
    setGuideForm({
      title: guide.title,
      slug: guide.slug,
      excerpt: guide.excerpt,
      content: guide.content,
      coverImage: guide.coverImage || "",
      icon: guide.icon || "BookOpen",
      category: guide.category,
      difficulty: guide.difficulty,
      authorName: guide.authorName,
      status: guide.status,
      metaTitle: guide.metaTitle || "",
      metaDescription: guide.metaDescription || "",
      sortOrder: String(guide.sortOrder || 0),
    });
    setGuideDialogOpen(true);
  };

  const createBlogMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      return apiRequest("POST", "/api/blog/posts", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blog/posts/admin/all"] });
      toast({ title: "Blog post created" });
      setBlogDialogOpen(false);
      resetBlogForm();
    },
    onError: () => {
      toast({ title: "Failed to create blog post", variant: "destructive" });
    },
  });

  const updateBlogMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      return apiRequest("PATCH", `/api/blog/posts/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blog/posts/admin/all"] });
      toast({ title: "Blog post updated" });
      setBlogDialogOpen(false);
      resetBlogForm();
    },
    onError: () => {
      toast({ title: "Failed to update blog post", variant: "destructive" });
    },
  });

  const deleteBlogMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/blog/posts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blog/posts/admin/all"] });
      toast({ title: "Blog post deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete blog post", variant: "destructive" });
    },
  });

  const createGuideMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      return apiRequest("POST", "/api/guides", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/guides/admin/all"] });
      toast({ title: "Guide created" });
      setGuideDialogOpen(false);
      resetGuideForm();
    },
    onError: () => {
      toast({ title: "Failed to create guide", variant: "destructive" });
    },
  });

  const updateGuideMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      return apiRequest("PATCH", `/api/guides/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/guides/admin/all"] });
      toast({ title: "Guide updated" });
      setGuideDialogOpen(false);
      resetGuideForm();
    },
    onError: () => {
      toast({ title: "Failed to update guide", variant: "destructive" });
    },
  });

  const deleteGuideMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/guides/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/guides/admin/all"] });
      toast({ title: "Guide deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete guide", variant: "destructive" });
    },
  });

  const handleBlogSubmit = () => {
    const payload: Record<string, unknown> = {
      title: blogForm.title,
      slug: blogForm.slug || undefined,
      excerpt: blogForm.excerpt,
      content: blogForm.content,
      coverImage: blogForm.coverImage || undefined,
      authorName: blogForm.authorName,
      category: blogForm.category,
      tags: blogForm.tags ? blogForm.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      status: blogForm.status,
      metaTitle: blogForm.metaTitle || undefined,
      metaDescription: blogForm.metaDescription || undefined,
    };
    if (blogForm.status === "published" && !editingPost?.publishedAt) {
      payload.publishedAt = new Date().toISOString();
    }
    if (editingPost) {
      updateBlogMutation.mutate({ id: editingPost.id, data: payload });
    } else {
      createBlogMutation.mutate(payload);
    }
  };

  const handleGuideSubmit = () => {
    const payload: Record<string, unknown> = {
      title: guideForm.title,
      slug: guideForm.slug || undefined,
      excerpt: guideForm.excerpt,
      content: guideForm.content,
      coverImage: guideForm.coverImage || undefined,
      icon: guideForm.icon,
      category: guideForm.category,
      difficulty: guideForm.difficulty,
      authorName: guideForm.authorName,
      status: guideForm.status,
      metaTitle: guideForm.metaTitle || undefined,
      metaDescription: guideForm.metaDescription || undefined,
      sortOrder: parseInt(guideForm.sortOrder) || 0,
    };
    if (guideForm.status === "published" && !editingGuide?.publishedAt) {
      payload.publishedAt = new Date().toISOString();
    }
    if (editingGuide) {
      updateGuideMutation.mutate({ id: editingGuide.id, data: payload });
    } else {
      createGuideMutation.mutate(payload);
    }
  };

  const updateCoachingMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiRequest("PATCH", `/api/coaching-waitlist/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coaching-waitlist"] });
      toast({ title: "Waitlist entry updated" });
    },
    onError: () => {
      toast({ title: "Failed to update entry", variant: "destructive" });
    },
  });

  const updateApplicationMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiRequest("PATCH", `/api/admin/applications/${id}`, { status });
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
      return apiRequest("PATCH", `/api/admin/users/${id}/role`, { role });
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
  const pendingCoaching = coachingWaitlist?.filter(c => c.status === "pending") || [];

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
                refetchLeaderboardHealth();
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

          <Card className="border-amber-500/20" data-testid="card-leaderboard-health">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Leaderboard Health
              </CardTitle>
            </CardHeader>
            <CardContent>
              {leaderboardHealthLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : leaderboardHealth?.summary ? (
                <div className="space-y-3 text-sm">
                  <div className="flex flex-wrap gap-4 text-muted-foreground">
                    <span>DB: <span className="font-mono text-foreground">{leaderboardHealth.database?.db_name || "unknown"}</span></span>
                    <span>Analyses: <span className="font-mono text-foreground">{leaderboardHealth.summary.analyses_count}</span></span>
                    <span>Eligible: <span className="font-mono text-foreground">{leaderboardHealth.summary.leaderboard_eligible_count}</span></span>
                    <span>Orphans: <span className="font-mono text-foreground">{leaderboardHealth.summary.orphan_analyses_count}</span></span>
                    <span>Newest: <span className="font-mono text-foreground">{leaderboardHealth.summary.newest_analysis_at ? format(new Date(leaderboardHealth.summary.newest_analysis_at), "MMM d, yyyy h:mm a") : "none"}</span></span>
                  </div>
                  {(leaderboardHealth.summary.analyses_count < 25 || leaderboardHealth.summary.leaderboard_eligible_count < 10) && (
                    <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-amber-700 dark:text-amber-400">
                      Leaderboard dataset looks unusually small for this deployment. Verify the active `DATABASE_URL` before trusting rankings.
                    </div>
                  )}
                  {!!leaderboardHealth.topEligibleLeaderboardUsers?.length && (
                    <div className="text-muted-foreground">
                      Top eligible users:
                      {" "}
                      {leaderboardHealth.topEligibleLeaderboardUsers
                        .map((row) => `${row.firstName || ""} ${row.lastName || ""}`.trim() || row.email)
                        .join(", ")}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">Leaderboard health unavailable.</p>
              )}
            </CardContent>
          </Card>

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
              <TabsTrigger value="coaching" data-testid="tab-coaching">
                Coaching {pendingCoaching.length > 0 && (
                  <Badge variant="destructive" className="ml-2">{pendingCoaching.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="blog" data-testid="tab-blog">Blog</TabsTrigger>
              <TabsTrigger value="guides" data-testid="tab-guides">Guides</TabsTrigger>
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

            <TabsContent value="coaching">
              <Card data-testid="card-coaching-table">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <GraduationCap className="h-5 w-5" />
                    Coaching Waitlist
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchCoaching()}
                    className="gap-2"
                    data-testid="button-refresh-coaching"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </Button>
                </CardHeader>
                <CardContent>
                  {coachingLoading ? (
                    <div className="space-y-4">
                      {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : coachingWaitlist && coachingWaitlist.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Contact</TableHead>
                          <TableHead>Main Problem</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {coachingWaitlist.map((entry) => (
                          <TableRow key={entry.id} data-testid={`row-coaching-${entry.id}`}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{entry.fullName}</p>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Mail className="h-3 w-3" />
                                  <span>{entry.email}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Phone className="h-3 w-3" />
                                  <span>{entry.phone}</span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="max-w-xs">
                                <p className="text-sm truncate" title={entry.mainProblem}>
                                  {entry.mainProblem}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={
                                  entry.status === "contacted" ? "default" : 
                                  entry.status === "enrolled" ? "default" : 
                                  entry.status === "declined" ? "destructive" : 
                                  "outline"
                                }
                              >
                                {entry.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {entry.createdAt ? format(new Date(entry.createdAt), "MMM d, yyyy") : "N/A"}
                            </TableCell>
                            <TableCell>
                              {entry.status === "pending" && (
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => updateCoachingMutation.mutate({ id: entry.id, status: "contacted" })}
                                    disabled={updateCoachingMutation.isPending}
                                    data-testid={`button-contact-${entry.id}`}
                                  >
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                    Contacted
                                  </Button>
                                </div>
                              )}
                              {entry.status === "contacted" && (
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => updateCoachingMutation.mutate({ id: entry.id, status: "enrolled" })}
                                    disabled={updateCoachingMutation.isPending}
                                    data-testid={`button-enroll-${entry.id}`}
                                  >
                                    Enrolled
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateCoachingMutation.mutate({ id: entry.id, status: "declined" })}
                                    disabled={updateCoachingMutation.isPending}
                                    data-testid={`button-decline-${entry.id}`}
                                  >
                                    Declined
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
                      <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No coaching waitlist entries yet</p>
                      <p className="text-sm text-muted-foreground">
                        Entries will appear here when users join the coaching waitlist.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="blog">
              <Card data-testid="card-blog-table">
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                  <CardTitle className="flex items-center gap-2">
                    <PenLine className="h-5 w-5" />
                    Blog Posts
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refetchBlog()}
                      className="gap-2"
                      data-testid="button-refresh-blog"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Refresh
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        resetBlogForm();
                        setBlogDialogOpen(true);
                      }}
                      className="gap-2"
                      data-testid="button-new-post"
                    >
                      <Plus className="h-4 w-4" />
                      New Post
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {blogLoading ? (
                    <div className="space-y-4">
                      {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : blogPosts && blogPosts.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {blogPosts.map((post) => (
                          <TableRow key={post.id} data-testid={`row-blog-${post.id}`}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{post.title}</p>
                                <p className="text-sm text-muted-foreground truncate max-w-xs">{post.slug}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={post.status === "published" ? "default" : "outline"}>
                                {post.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{post.category}</Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {post.publishedAt
                                ? format(new Date(post.publishedAt), "MMM d, yyyy")
                                : post.createdAt
                                ? format(new Date(post.createdAt), "MMM d, yyyy")
                                : "N/A"}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => openEditPost(post)}
                                  data-testid={`button-edit-post-${post.id}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                {post.status === "draft" && (
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => updateBlogMutation.mutate({
                                      id: post.id,
                                      data: { status: "published", publishedAt: new Date().toISOString() },
                                    })}
                                    disabled={updateBlogMutation.isPending}
                                    data-testid={`button-publish-post-${post.id}`}
                                  >
                                    Publish
                                  </Button>
                                )}
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    if (confirm("Delete this blog post?")) {
                                      deleteBlogMutation.mutate(post.id);
                                    }
                                  }}
                                  disabled={deleteBlogMutation.isPending}
                                  data-testid={`button-delete-post-${post.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-12">
                      <PenLine className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No blog posts yet</p>
                      <p className="text-sm text-muted-foreground">
                        Create your first post to get started.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="guides">
              <Card data-testid="card-guides-table">
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    Guides
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refetchGuides()}
                      className="gap-2"
                      data-testid="button-refresh-guides"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Refresh
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        resetGuideForm();
                        setGuideDialogOpen(true);
                      }}
                      className="gap-2"
                      data-testid="button-new-guide"
                    >
                      <Plus className="h-4 w-4" />
                      New Guide
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {guidesLoading ? (
                    <div className="space-y-4">
                      {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : guidesList && guidesList.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Difficulty</TableHead>
                          <TableHead>Order</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {guidesList.map((guide) => (
                          <TableRow key={guide.id} data-testid={`row-guide-${guide.id}`}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{guide.title}</p>
                                <p className="text-sm text-muted-foreground truncate max-w-xs">{guide.slug}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={guide.status === "published" ? "default" : "outline"}>
                                {guide.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{guide.category}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={
                                guide.difficulty === "beginner" ? "outline" :
                                guide.difficulty === "intermediate" ? "secondary" :
                                "default"
                              }>
                                {guide.difficulty}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-muted-foreground">
                              {guide.sortOrder}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => openEditGuide(guide)}
                                  data-testid={`button-edit-guide-${guide.id}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                {guide.status === "draft" && (
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => updateGuideMutation.mutate({
                                      id: guide.id,
                                      data: { status: "published", publishedAt: new Date().toISOString() },
                                    })}
                                    disabled={updateGuideMutation.isPending}
                                    data-testid={`button-publish-guide-${guide.id}`}
                                  >
                                    Publish
                                  </Button>
                                )}
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    if (confirm("Delete this guide?")) {
                                      deleteGuideMutation.mutate(guide.id);
                                    }
                                  }}
                                  disabled={deleteGuideMutation.isPending}
                                  data-testid={`button-delete-guide-${guide.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-12">
                      <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No guides yet</p>
                      <p className="text-sm text-muted-foreground">
                        Create your first guide to get started.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <Dialog open={blogDialogOpen} onOpenChange={(open) => {
            setBlogDialogOpen(open);
            if (!open) resetBlogForm();
          }}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle data-testid="text-blog-dialog-title">
                  {editingPost ? "Edit Blog Post" : "New Blog Post"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="blog-title">Title</Label>
                  <Input
                    id="blog-title"
                    value={blogForm.title}
                    onChange={(e) => setBlogForm({ ...blogForm, title: e.target.value })}
                    data-testid="input-blog-title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="blog-slug">Slug (auto-generated if empty)</Label>
                  <Input
                    id="blog-slug"
                    value={blogForm.slug}
                    onChange={(e) => setBlogForm({ ...blogForm, slug: e.target.value })}
                    data-testid="input-blog-slug"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="blog-excerpt">Excerpt</Label>
                  <Textarea
                    id="blog-excerpt"
                    value={blogForm.excerpt}
                    onChange={(e) => setBlogForm({ ...blogForm, excerpt: e.target.value })}
                    className="resize-none"
                    rows={2}
                    data-testid="input-blog-excerpt"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="blog-content">Content (HTML)</Label>
                  <Textarea
                    id="blog-content"
                    value={blogForm.content}
                    onChange={(e) => setBlogForm({ ...blogForm, content: e.target.value })}
                    rows={10}
                    data-testid="input-blog-content"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="blog-category">Category</Label>
                    <Select
                      value={blogForm.category}
                      onValueChange={(val) => setBlogForm({ ...blogForm, category: val })}
                    >
                      <SelectTrigger data-testid="select-blog-category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="market-analysis">Market Analysis</SelectItem>
                        <SelectItem value="strategy">Strategy</SelectItem>
                        <SelectItem value="deal-breakdown">Deal Breakdown</SelectItem>
                        <SelectItem value="news">News</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="blog-status">Status</Label>
                    <Select
                      value={blogForm.status}
                      onValueChange={(val) => setBlogForm({ ...blogForm, status: val })}
                    >
                      <SelectTrigger data-testid="select-blog-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="published">Published</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="blog-cover">Cover Image URL</Label>
                  <Input
                    id="blog-cover"
                    value={blogForm.coverImage}
                    onChange={(e) => setBlogForm({ ...blogForm, coverImage: e.target.value })}
                    data-testid="input-blog-cover"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="blog-author">Author Name</Label>
                  <Input
                    id="blog-author"
                    value={blogForm.authorName}
                    onChange={(e) => setBlogForm({ ...blogForm, authorName: e.target.value })}
                    data-testid="input-blog-author"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="blog-tags">Tags (comma-separated)</Label>
                  <Input
                    id="blog-tags"
                    value={blogForm.tags}
                    onChange={(e) => setBlogForm({ ...blogForm, tags: e.target.value })}
                    data-testid="input-blog-tags"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="blog-meta-title">Meta Title</Label>
                    <Input
                      id="blog-meta-title"
                      value={blogForm.metaTitle}
                      onChange={(e) => setBlogForm({ ...blogForm, metaTitle: e.target.value })}
                      data-testid="input-blog-meta-title"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="blog-meta-desc">Meta Description</Label>
                    <Input
                      id="blog-meta-desc"
                      value={blogForm.metaDescription}
                      onChange={(e) => setBlogForm({ ...blogForm, metaDescription: e.target.value })}
                      data-testid="input-blog-meta-desc"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setBlogDialogOpen(false);
                    resetBlogForm();
                  }}
                  data-testid="button-blog-cancel"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleBlogSubmit}
                  disabled={createBlogMutation.isPending || updateBlogMutation.isPending || !blogForm.title || !blogForm.excerpt || !blogForm.content}
                  data-testid="button-blog-submit"
                >
                  {editingPost ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={guideDialogOpen} onOpenChange={(open) => {
            setGuideDialogOpen(open);
            if (!open) resetGuideForm();
          }}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle data-testid="text-guide-dialog-title">
                  {editingGuide ? "Edit Guide" : "New Guide"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="guide-title">Title</Label>
                  <Input
                    id="guide-title"
                    value={guideForm.title}
                    onChange={(e) => setGuideForm({ ...guideForm, title: e.target.value })}
                    data-testid="input-guide-title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guide-slug">Slug (auto-generated if empty)</Label>
                  <Input
                    id="guide-slug"
                    value={guideForm.slug}
                    onChange={(e) => setGuideForm({ ...guideForm, slug: e.target.value })}
                    data-testid="input-guide-slug"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guide-excerpt">Excerpt</Label>
                  <Textarea
                    id="guide-excerpt"
                    value={guideForm.excerpt}
                    onChange={(e) => setGuideForm({ ...guideForm, excerpt: e.target.value })}
                    className="resize-none"
                    rows={2}
                    data-testid="input-guide-excerpt"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guide-content">Content (HTML)</Label>
                  <Textarea
                    id="guide-content"
                    value={guideForm.content}
                    onChange={(e) => setGuideForm({ ...guideForm, content: e.target.value })}
                    rows={10}
                    data-testid="input-guide-content"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="guide-category">Category</Label>
                    <Select
                      value={guideForm.category}
                      onValueChange={(val) => setGuideForm({ ...guideForm, category: val })}
                    >
                      <SelectTrigger data-testid="select-guide-category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="getting-started">Getting Started</SelectItem>
                        <SelectItem value="strategy">Strategy</SelectItem>
                        <SelectItem value="analysis">Analysis</SelectItem>
                        <SelectItem value="advanced">Advanced</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="guide-difficulty">Difficulty</Label>
                    <Select
                      value={guideForm.difficulty}
                      onValueChange={(val) => setGuideForm({ ...guideForm, difficulty: val })}
                    >
                      <SelectTrigger data-testid="select-guide-difficulty">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="beginner">Beginner</SelectItem>
                        <SelectItem value="intermediate">Intermediate</SelectItem>
                        <SelectItem value="advanced">Advanced</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="guide-status">Status</Label>
                    <Select
                      value={guideForm.status}
                      onValueChange={(val) => setGuideForm({ ...guideForm, status: val })}
                    >
                      <SelectTrigger data-testid="select-guide-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="published">Published</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="guide-cover">Cover Image URL</Label>
                    <Input
                      id="guide-cover"
                      value={guideForm.coverImage}
                      onChange={(e) => setGuideForm({ ...guideForm, coverImage: e.target.value })}
                      data-testid="input-guide-cover"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="guide-icon">Icon Name</Label>
                    <Input
                      id="guide-icon"
                      value={guideForm.icon}
                      onChange={(e) => setGuideForm({ ...guideForm, icon: e.target.value })}
                      data-testid="input-guide-icon"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="guide-author">Author Name</Label>
                    <Input
                      id="guide-author"
                      value={guideForm.authorName}
                      onChange={(e) => setGuideForm({ ...guideForm, authorName: e.target.value })}
                      data-testid="input-guide-author"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="guide-sort">Sort Order</Label>
                    <Input
                      id="guide-sort"
                      type="number"
                      value={guideForm.sortOrder}
                      onChange={(e) => setGuideForm({ ...guideForm, sortOrder: e.target.value })}
                      data-testid="input-guide-sort"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="guide-meta-title">Meta Title</Label>
                    <Input
                      id="guide-meta-title"
                      value={guideForm.metaTitle}
                      onChange={(e) => setGuideForm({ ...guideForm, metaTitle: e.target.value })}
                      data-testid="input-guide-meta-title"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="guide-meta-desc">Meta Description</Label>
                    <Input
                      id="guide-meta-desc"
                      value={guideForm.metaDescription}
                      onChange={(e) => setGuideForm({ ...guideForm, metaDescription: e.target.value })}
                      data-testid="input-guide-meta-desc"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setGuideDialogOpen(false);
                    resetGuideForm();
                  }}
                  data-testid="button-guide-cancel"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleGuideSubmit}
                  disabled={createGuideMutation.isPending || updateGuideMutation.isPending || !guideForm.title || !guideForm.excerpt || !guideForm.content}
                  data-testid="button-guide-submit"
                >
                  {editingGuide ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </main>
    </div>
  );
}
