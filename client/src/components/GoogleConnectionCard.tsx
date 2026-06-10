import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { SiGoogle } from "react-icons/si";
import { Link2, Unlink, FileSpreadsheet, Loader2 } from "lucide-react";

interface GoogleStatus {
  connected: boolean;
  configured: boolean;
  email: string | null;
}

export function GoogleConnectionCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: status, isLoading } = useQuery<GoogleStatus>({
    queryKey: ["/api/integrations/google/status"],
  });

  const disconnectMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/integrations/google"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/google/status"] });
      toast({ title: "Google account disconnected" });
    },
    onError: () => {
      toast({ title: "Failed to disconnect Google account", variant: "destructive" });
    },
  });

  const handleConnect = async () => {
    try {
      const res = await fetch("/api/integrations/google/auth-url", { credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Failed to start Google authorization");
      window.location.href = data.url;
    } catch {
      toast({ title: "Failed to start Google authorization", variant: "destructive" });
    }
  };

  const handleDisconnect = () => {
    disconnectMutation.mutate();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SiGoogle className="h-5 w-5" />
            Google Sheets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-muted-foreground">Checking connection...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!status?.configured) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SiGoogle className="h-5 w-5" />
            Google Sheets
          </CardTitle>
          <CardDescription>
            Export your deal analyses to Google Sheets
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Google integration is not configured. Contact support to enable this feature.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SiGoogle className="h-5 w-5" />
          Google Sheets
          {status?.connected && (
            <Badge variant="secondary" className="ml-2">
              Connected
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Connect your Google account to export analyses directly to your Google Drive
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status?.connected ? (
          <>
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <FileSpreadsheet className="h-5 w-5 text-green-600" />
              <div className="flex-1">
                <p className="font-medium">Connected to Google</p>
                {status.email && (
                  <p className="text-sm text-muted-foreground">{status.email}</p>
                )}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              When you export deals to Google Sheets, they will be saved to your own Google Drive.
            </p>
            <Button
              variant="outline"
              onClick={handleDisconnect}
              disabled={disconnectMutation.isPending}
              className="gap-2"
              data-testid="button-disconnect-google"
            >
              {disconnectMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Unlink className="h-4 w-4" />
              )}
              Disconnect Google Account
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Connect your Google account to export your deal analyses directly to your own Google Drive.
              Connecting is required before exporting to Sheets.
            </p>
            <Button
              onClick={handleConnect}
              className="gap-2"
              data-testid="button-connect-google"
            >
              <Link2 className="h-4 w-4" />
              Connect Google Account
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
