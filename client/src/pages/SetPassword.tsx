import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Lock, CheckCircle2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const setPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SetPasswordFormValues = z.infer<typeof setPasswordSchema>;

export default function SetPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [success, setSuccess] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    // Check URL params for token (sent via email)
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get("token");
    
    if (urlToken) {
      setToken(urlToken);
      
      // Try to get email from localStorage for display
      const leadInfo = localStorage.getItem("realist_lead_info");
      if (leadInfo) {
        try {
          const parsed = JSON.parse(leadInfo);
          if (parsed.email) {
            setEmail(parsed.email);
          }
        } catch {
          // Invalid JSON
        }
      }
    }
  }, []);

  const form = useForm<SetPasswordFormValues>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const setPasswordMutation = useMutation({
    mutationFn: async (data: SetPasswordFormValues) => {
      const response = await apiRequest("POST", "/api/auth/set-password", {
        token,
        password: data.password,
      });
      return response.json();
    },
    onSuccess: () => {
      // Clear the needsPassword flag from localStorage
      const leadInfo = localStorage.getItem("realist_lead_info");
      if (leadInfo) {
        try {
          const parsed = JSON.parse(leadInfo);
          delete parsed.needsPassword;
          localStorage.setItem("realist_lead_info", JSON.stringify(parsed));
        } catch {
          // Ignore
        }
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setSuccess(true);
      toast({ title: "Password set successfully!" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to set password",
        description: error.message || "Please try again or request a new link",
        variant: "destructive",
      });
    },
  });

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <h2 className="text-xl font-semibold text-destructive">No Setup Token</h2>
              <p className="text-muted-foreground">
                You need a valid setup link to set your password.
              </p>
              <Link href="/login">
                <Button variant="outline" className="mt-4" data-testid="button-go-to-login">
                  Go to Login
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold">Account Ready!</h2>
              <p className="text-muted-foreground">
                Your password has been set and you're now logged in.
              </p>
              <Link href="/">
                <Button className="mt-4" data-testid="button-continue">
                  Continue to Analyzer
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Create Your Password</CardTitle>
          <CardDescription>
            {email ? `Set a password for ${email}` : "Set a password to secure your account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => setPasswordMutation.mutate(data))} className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                          type="password" 
                          placeholder="At least 8 characters" 
                          className="pl-10 h-11"
                          data-testid="input-set-password"
                          {...field} 
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                          type="password" 
                          placeholder="Confirm your password" 
                          className="pl-10 h-11"
                          data-testid="input-set-confirm"
                          {...field} 
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                className="w-full h-11" 
                disabled={setPasswordMutation.isPending}
                data-testid="button-set-password-submit"
              >
                {setPasswordMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Setting password...
                  </>
                ) : (
                  "Set Password"
                )}
              </Button>
            </form>
          </Form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Already have a password?{" "}
              <Link href="/login">
                <span className="text-primary hover:underline cursor-pointer" data-testid="link-login">
                  Sign in
                </span>
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
