import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Lock, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

/**
 * Soft, dismissible "add a password (optional)" banner shown after a magic
 * sign-in link lands a passwordless user on the dashboard (?setpw=offer).
 * Saving posts to /api/auth/create-password, which only works for accounts
 * that don't have a password yet — email ownership was already proven by the
 * sign-in link. Purely optional: email sign-in keeps working either way.
 */
export function AddPasswordBanner() {
  const { toast } = useToast();
  const [visible, setVisible] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("setpw") === "offer";
  });
  const [password, setPassword] = useState("");

  const clearParam = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("setpw");
    window.history.replaceState({}, "", url.pathname + url.search);
  };

  const createPasswordMutation = useMutation({
    mutationFn: async (newPassword: string) => {
      const response = await apiRequest("POST", "/api/auth/create-password", { password: newPassword });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Password added",
        description: "You can now sign in with your password or an email link — whichever you prefer.",
      });
      setVisible(false);
      clearParam();
    },
    onError: (error: any) => {
      toast({
        title: "Could not add password",
        description: error?.message?.replace(/^\d{3}:\s*/, "") || "Please try again.",
        variant: "destructive",
      });
    },
  });

  if (!visible) return null;

  return (
    <div
      className="rounded-lg border border-primary/30 bg-primary/5 p-4"
      data-testid="banner-add-password"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            You're in — no password needed
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            You signed in with an email link. Want to add a password too? It's optional — you can
            always sign in with just your email.
          </p>
          <div className="mt-3 flex flex-col sm:flex-row gap-2 sm:items-center">
            <Input
              type="password"
              placeholder="Choose a password (8+ characters)"
              className="h-10 sm:max-w-xs"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              data-testid="input-banner-password"
            />
            <Button
              type="button"
              className="h-10"
              disabled={password.length < 8 || createPasswordMutation.isPending}
              onClick={() => createPasswordMutation.mutate(password)}
              data-testid="button-banner-save-password"
            >
              {createPasswordMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save password"
              )}
            </Button>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => {
            setVisible(false);
            clearParam();
          }}
          aria-label="Dismiss"
          data-testid="button-banner-dismiss"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
