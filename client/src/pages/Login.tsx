import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Lock, ArrowRight, MailCheck, Sparkles } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { authPath, clearAuthReturnUrl, getAuthReturnUrl, rememberAuthReturnUrl, goToReturnUrl } from "@/lib/authReturn";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().default(false),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const returnUrl = getAuthReturnUrl("/");
  rememberAuthReturnUrl(returnUrl);

  // Set when a magic sign-in link redirect failed (expired/used/invalid).
  const [linkInvalid] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("error") === "link_invalid";
  });
  // Set when password login failed because the account has no password
  // (created via lead capture, event ticket, RSVP, ...).
  const [noPasswordAccount, setNoPasswordAccount] = useState(false);
  const [magicLinkSentTo, setMagicLinkSentTo] = useState<string | null>(null);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginFormValues) => {
      const response = await apiRequest("POST", "/api/auth/login", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Welcome back!", description: "You have been logged in successfully." });
      clearAuthReturnUrl();
      goToReturnUrl(returnUrl, setLocation);
    },
    onError: (error: any) => {
      if (typeof error?.message === "string" && error.message.includes("NO_PASSWORD_SET")) {
        setNoPasswordAccount(true);
        toast({
          title: "No password on this account",
          description: "Use the sign-in link option below — we'll email you a one-click login.",
        });
        return;
      }
      toast({
        title: "Login failed",
        description: error.message || "Invalid email or password",
        variant: "destructive",
      });
    },
  });

  const magicLinkMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await apiRequest("POST", "/api/auth/email-login-link", { email });
      return response.json();
    },
    onSuccess: (_data, email) => {
      setMagicLinkSentTo(email);
      toast({
        title: "Check your inbox",
        description: "If an account exists for that email, a sign-in link is on its way.",
      });
    },
    onError: (error: any) => {
      const message = typeof error?.message === "string" && error.message.startsWith("429")
        ? "Too many sign-in links requested. Please wait a bit and try again."
        : "Could not send a sign-in link. Please try again.";
      toast({ title: "Sign-in link failed", description: message, variant: "destructive" });
    },
  });

  const requestMagicLink = async () => {
    const emailValid = await form.trigger("email");
    if (!emailValid) return;
    magicLinkMutation.mutate(form.getValues("email"));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
          <CardDescription>Sign in to your Realist account</CardDescription>
        </CardHeader>
        <CardContent>
          {linkInvalid && !magicLinkSentTo && (
            <div
              className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-foreground"
              data-testid="banner-link-invalid"
            >
              That sign-in link is invalid or has expired. Enter your email below and choose{" "}
              <span className="font-medium">"Email me a sign-in link"</span> to get a fresh one.
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => loginMutation.mutate(data))} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="email"
                          placeholder="you@example.com"
                          className="pl-10 h-11"
                          data-testid="input-login-email"
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
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="password"
                          placeholder="Enter your password"
                          className="pl-10 h-11"
                          data-testid="input-login-password"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center justify-between">
                <FormField
                  control={form.control}
                  name="rememberMe"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-remember-me"
                        />
                      </FormControl>
                      <FormLabel className="text-sm font-normal cursor-pointer">
                        Remember me
                      </FormLabel>
                    </FormItem>
                  )}
                />
                <Link href="/forgot-password">
                  <span className="text-sm text-primary hover:underline cursor-pointer" data-testid="link-forgot-password">
                    Forgot password?
                  </span>
                </Link>
              </div>

              {noPasswordAccount && (
                <div
                  className="rounded-md border border-primary/40 bg-primary/5 p-3 text-sm"
                  data-testid="callout-no-password"
                >
                  <p className="font-medium flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    This account doesn't have a password yet
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    It was created when you used one of our tools or registered for an event. No
                    problem — we'll email you a one-click sign-in link instead.
                  </p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-11"
                disabled={loginMutation.isPending}
                data-testid="button-login-submit"
              >
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>

              {magicLinkSentTo ? (
                <div
                  className="rounded-md border border-primary/40 bg-primary/5 p-3 text-sm"
                  data-testid="notice-magic-link-sent"
                >
                  <p className="font-medium flex items-center gap-2">
                    <MailCheck className="h-4 w-4 text-primary" />
                    Sign-in link sent
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    If an account exists for <span className="font-medium">{magicLinkSentTo}</span>,
                    you'll get an email with a one-click sign-in link. It's valid for 30 minutes.
                  </p>
                </div>
              ) : (
                <Button
                  type="button"
                  variant={noPasswordAccount ? "default" : "outline"}
                  className="w-full h-11"
                  disabled={magicLinkMutation.isPending}
                  onClick={requestMagicLink}
                  data-testid="button-email-login-link"
                >
                  {magicLinkMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending link...
                    </>
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
                      Email me a sign-in link
                    </>
                  )}
                </Button>
              )}

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                </div>
              </div>

              <GoogleSignInButton variant="login" />
            </form>
          </Form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link href={authPath("/create-account", returnUrl)}>
                <span className="text-primary hover:underline cursor-pointer" data-testid="link-signup">
                  Create one
                </span>
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
