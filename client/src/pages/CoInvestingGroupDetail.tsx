import { Navigation } from "@/components/Navigation";
import { RepresentationStatusBanner } from "@/components/RepresentationGate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  MapPin, Users, DollarSign, Loader2, Send, 
  CheckCircle, XCircle, Clock, AlertTriangle 
} from "lucide-react";
import { 
  propertyTypeLabels, 
  strategyLabels, 
  jurisdictionLabels,
  ownershipStructureLabels,
  skillLabels,
  tierLabels 
} from "@/lib/coinvesting";
import type { CoInvestGroup, CoInvestMembership, CoInvestChecklistResult, CoInvestMessage } from "@shared/schema";

export default function CoInvestingGroupDetail() {
  const [, params] = useRoute("/coinvesting/groups/:id");
  const groupId = params?.id;
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  const [joinNote, setJoinNote] = useState("");
  const [pledgedCapital, setPledgedCapital] = useState("");
  const [newMessage, setNewMessage] = useState("");

  const handleRepresentationError = (error: any) => {
    if (error?.requiresRepresentation) {
      toast({
        title: "Representation Required",
        description: "You need to complete the representation agreement to access this feature.",
      });
      setLocation("/tools/coinvest/representation");
      return true;
    }
    return false;
  };

  const { data, isLoading } = useQuery<{ 
    group: CoInvestGroup; 
    memberships: CoInvestMembership[];
    checklistResult: CoInvestChecklistResult | null;
  }>({
    queryKey: ["/api/coinvesting/groups", groupId],
    enabled: !!groupId,
  });

  const { data: messagesData } = useQuery<{ messages: CoInvestMessage[] }>({
    queryKey: ["/api/coinvesting/groups", groupId, "messages"],
    enabled: !!groupId && isAuthenticated,
  });

  const group = data?.group;
  const memberships = data?.memberships || [];
  const messages = messagesData?.messages || [];
  
  const isOwner = group?.ownerUserId === user?.id;
  const userMembership = memberships.find(m => m.userId === user?.id);
  const isApprovedMember = userMembership?.status === "approved";
  const approvedMembers = memberships.filter(m => m.status === "approved");
  const pendingMembers = memberships.filter(m => m.status === "requested");

  const joinMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/coinvesting/groups/${groupId}/join`, {
        pledgedCapitalCad: pledgedCapital ? parseFloat(pledgedCapital) : undefined,
        note: joinNote,
      });
      if (!response.ok) {
        const data = await response.json();
        throw { ...data, message: data.error || "Failed to join group" };
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Join Request Sent", description: "The group owner will review your request." });
      queryClient.invalidateQueries({ queryKey: ["/api/coinvesting/groups", groupId] });
    },
    onError: (error: any) => {
      if (!handleRepresentationError(error)) {
        toast({ title: "Error", description: error.message || "Failed to join group", variant: "destructive" });
      }
    },
  });

  const updateMembershipMutation = useMutation({
    mutationFn: async ({ membershipId, status }: { membershipId: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/coinvesting/memberships/${membershipId}`, { status });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Member Updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/coinvesting/groups", groupId] });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/coinvesting/groups/${groupId}/messages`, { message: newMessage });
      if (!response.ok) {
        const data = await response.json();
        throw { ...data, message: data.error || "Failed to send message" };
      }
      return response.json();
    },
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/coinvesting/groups", groupId, "messages"] });
    },
    onError: (error: any) => {
      if (!handleRepresentationError(error)) {
        toast({ title: "Error", description: error.message || "Failed to send message", variant: "destructive" });
      }
    },
  });

  const formatCurrency = (amount: number | null | undefined) => {
    if (!amount) return "Not specified";
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 py-12 text-center">
          <h1 className="text-2xl font-bold mb-4">Group Not Found</h1>
          <p className="text-muted-foreground">This group doesn't exist or has been removed.</p>
        </main>
      </div>
    );
  }

  const tierInfo = data?.checklistResult?.tier 
    ? tierLabels[data.checklistResult.tier as keyof typeof tierLabels]
    : null;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="container mx-auto px-4 py-12 max-w-5xl">
        {isAuthenticated && <RepresentationStatusBanner className="mb-6" />}
        <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary">{group.status === "forming" ? "Forming" : group.status}</Badge>
              {tierInfo && <Badge className={tierInfo.color}>{tierInfo.label}</Badge>}
            </div>
            <h1 className="text-3xl font-bold mb-2">{group.title}</h1>
            <p className="text-muted-foreground flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {group.propertyCity || jurisdictionLabels[group.jurisdiction as keyof typeof jurisdictionLabels]}
            </p>
          </div>
          
          {isAuthenticated && !userMembership && (
            <Button onClick={() => document.getElementById("join-section")?.scrollIntoView({ behavior: "smooth" })} data-testid="button-join-cta">
              Request to Join
            </Button>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <Tabs defaultValue="overview">
              <TabsList className="w-full">
                <TabsTrigger value="overview" className="flex-1">Overview</TabsTrigger>
                <TabsTrigger value="members" className="flex-1">Members ({approvedMembers.length})</TabsTrigger>
                {isApprovedMember && <TabsTrigger value="chat" className="flex-1">Chat</TabsTrigger>}
              </TabsList>

              <TabsContent value="overview" className="space-y-6 mt-6">
                {group.description && (
                  <Card>
                    <CardHeader>
                      <CardTitle>About</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{group.description}</p>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle>Property Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <dl className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <dt className="text-muted-foreground">Address</dt>
                        <dd className="font-medium">{group.propertyAddress || "Not specified"}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Type</dt>
                        <dd className="font-medium">{propertyTypeLabels[group.propertyType as keyof typeof propertyTypeLabels] || "Not set"}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Units</dt>
                        <dd className="font-medium">{group.unitsCount || 1}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Strategy</dt>
                        <dd className="font-medium">{strategyLabels[group.targetStrategy as keyof typeof strategyLabels] || "Not set"}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Ownership</dt>
                        <dd className="font-medium">{ownershipStructureLabels[group.ownershipStructure as keyof typeof ownershipStructureLabels]}</dd>
                      </div>
                    </dl>
                  </CardContent>
                </Card>

                {tierInfo && (
                  <Card className="border-amber-500/50">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                        Complexity Assessment
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{tierInfo.description}</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="members" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Approved Members ({approvedMembers.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {approvedMembers.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No members yet.</p>
                    ) : (
                      <div className="space-y-4">
                        {approvedMembers.map((m) => (
                          <div key={m.id} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Avatar>
                                <AvatarFallback>{m.role === "owner" ? "O" : "M"}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">
                                  {m.role === "owner" ? "Group Owner" : "Member"}
                                  {m.userId === user?.id && " (You)"}
                                </p>
                                {m.skillsOffered && m.skillsOffered.length > 0 && (
                                  <div className="flex gap-1 mt-1">
                                    {m.skillsOffered.map(s => (
                                      <Badge key={s} variant="outline" className="text-xs">
                                        {skillLabels[s as keyof typeof skillLabels] || s}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            {m.pledgedCapitalCad && (
                              <span className="text-sm text-muted-foreground">
                                {formatCurrency(m.pledgedCapitalCad)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {isOwner && pendingMembers.length > 0 && (
                  <Card className="mt-6">
                    <CardHeader>
                      <CardTitle>Pending Requests ({pendingMembers.length})</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {pendingMembers.map((m) => (
                        <div key={m.id} className="flex items-center justify-between p-4 rounded-lg border">
                          <div>
                            <p className="font-medium">Join Request</p>
                            {m.note && <p className="text-sm text-muted-foreground">{m.note}</p>}
                            {m.pledgedCapitalCad && (
                              <p className="text-sm">Pledged: {formatCurrency(m.pledgedCapitalCad)}</p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateMembershipMutation.mutate({ membershipId: m.id, status: "approved" })}
                              data-testid={`button-approve-${m.id}`}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateMembershipMutation.mutate({ membershipId: m.id, status: "rejected" })}
                              data-testid={`button-reject-${m.id}`}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {isApprovedMember && (
                <TabsContent value="chat" className="mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Group Chat</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64 overflow-y-auto space-y-4 mb-4 p-4 bg-muted rounded-lg">
                        {messages.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center">No messages yet. Start the conversation!</p>
                        ) : (
                          messages.map((msg) => (
                            <div key={msg.id} className="flex gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="text-xs">U</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-sm">{msg.message}</p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(msg.createdAt).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Type a message..."
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && newMessage && sendMessageMutation.mutate()}
                          data-testid="input-message"
                        />
                        <Button 
                          onClick={() => sendMessageMutation.mutate()}
                          disabled={!newMessage || sendMessageMutation.isPending}
                          data-testid="button-send"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              )}
            </Tabs>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>What We Need</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Capital Target</p>
                  <p className="text-lg font-semibold">{formatCurrency(group.capitalTargetCad)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Minimum Commitment</p>
                  <p className="text-lg font-semibold">{formatCurrency(group.minCommitmentCad)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Target Group Size</p>
                  <p className="text-lg font-semibold">{group.targetGroupSize || "Not set"} members</p>
                </div>
                {group.skillsNeeded && group.skillsNeeded.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Skills Needed</p>
                    <div className="flex flex-wrap gap-1">
                      {group.skillsNeeded.map((skill) => (
                        <Badge key={skill} variant="outline" className="text-xs">
                          {skillLabels[skill as keyof typeof skillLabels] || skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {isAuthenticated && !userMembership && (
              <Card id="join-section">
                <CardHeader>
                  <CardTitle>Request to Join</CardTitle>
                  <CardDescription>Tell the group owner why you're interested</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="pledgedCapital">Your Capital Commitment (CAD)</Label>
                    <Input
                      id="pledgedCapital"
                      type="number"
                      placeholder="50000"
                      value={pledgedCapital}
                      onChange={(e) => setPledgedCapital(e.target.value)}
                      data-testid="input-pledged-capital"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="joinNote">Message to Owner</Label>
                    <Textarea
                      id="joinNote"
                      placeholder="Introduce yourself and explain why you'd be a good fit..."
                      value={joinNote}
                      onChange={(e) => setJoinNote(e.target.value)}
                      data-testid="input-join-note"
                    />
                  </div>
                  <Button 
                    className="w-full"
                    onClick={() => joinMutation.mutate()}
                    disabled={joinMutation.isPending}
                    data-testid="button-submit-join"
                  >
                    {joinMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Submit Request
                  </Button>
                </CardContent>
              </Card>
            )}

            {userMembership?.status === "requested" && (
              <Card>
                <CardContent className="py-6 text-center">
                  <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="font-medium">Request Pending</p>
                  <p className="text-sm text-muted-foreground">Waiting for owner approval</p>
                </CardContent>
              </Card>
            )}

            {!isAuthenticated && (
              <Card>
                <CardContent className="py-6 text-center">
                  <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="font-medium mb-2">Sign in to Join</p>
                  <Button asChild>
                    <a href="/login">Sign In</a>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
