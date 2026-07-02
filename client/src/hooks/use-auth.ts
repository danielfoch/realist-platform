import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User } from "@shared/models/auth";
import { apiRequest } from "@/lib/queryClient";

async function fetchUser(): Promise<User | null> {
  const response = await fetch("/api/auth/user", {
    credentials: "include",
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }

  return response.json();
}

export function useAuth() {
  const queryClient = useQueryClient();
  const { data: user, isLoading, refetch } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: fetchUser,
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // After a Google OAuth login (flagged by GoogleSignInButton before the
  // redirect), claim the anonymous analyzer session exactly once so
  // pre-signup analyses show up in the portal. The marker is cleared before
  // the request, so this never repeats or races across components.
  useEffect(() => {
    if (!user) return;
    if (localStorage.getItem("realist_oauth_claim_pending") !== "1") return;
    localStorage.removeItem("realist_oauth_claim_pending");
    const sessionId = localStorage.getItem("realist_session_id");
    if (!sessionId) return;
    apiRequest("POST", "/api/auth/claim-session", { sessionId }).catch(() => {
      // Best-effort: analyses stay claimable via the next explicit auth flow.
    });
  }, [user?.id]);

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout", {});
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/user"], null);
      window.location.href = "/";
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
    refetch,
  };
}
