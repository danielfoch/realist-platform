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
import { Loader2, Mail, Lock, User, ArrowRight, ClipboardCheck, Wrench } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { authPath, clearAuthReturnUrl, getAuthReturnUrl, rememberAuthReturnUrl } from "@/lib/authReturn";

const signupSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
  role: z.enum(["investor", "partner"]),
  professionalType: z.enum(["contractor", "inspector"]).optional(),
  certificationNumber: z.string().optional(),
  serviceArea: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
}).refine((data) => data.role !== "partner" || !!data.professionalType, {
  message: "Choose contractor or inspector",
  path: ["professionalType"],
});

type SignupFormValues = z.infer<typeof signupSchema>;

export default function CreateAccount() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const returnUrl = getAuthReturnUrl("/signup");
  rememberAuthReturnUrl(returnUrl);

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
      role: "investor",
      professionalType: undefined,
      certificationNumber: "",
      serviceArea: "",
    },
  });

  const signupMutation = useMutation({
    mutationFn: async (data: SignupFormValues) => {
      const response = await apiRequest("POST", "/api/auth/signup", {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
        role: data.role,
        professionalType: data.role === "partner" ? data.professionalType : undefined,
        certificationNumber: data.role === "partner" ? data.certificationNumber : undefined,
        serviceArea: data.role === "partner" ? data.serviceArea : undefined,
        // Anonymous analyzer session — lets the server adopt pre-signup
        // analyses so the portal isn't empty on first login.
        sessionId: localStorage.getItem("realist_session_id") || undefined,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Account created!", description: "Welcome to Realist." });
      clearAuthReturnUrl();
      setLocation(returnUrl);
    },
    onError: (error: any) => {
      toast({
        title: "Signup failed",
        description: error.message || "Failed to create account",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Create Your Account</CardTitle>
          <CardDescription>Join Realist to analyze real estate deals</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => signupMutation.mutate(data))} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input 
                            placeholder="John" 
                            className="pl-10 h-11" 
                            data-testid="input-signup-firstname"
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
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Doe" 
                          className="h-11" 
                          data-testid="input-signup-lastname"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account type</FormLabel>
                    <FormControl>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => field.onChange("investor")}
                          className={`rounded-md border p-3 text-left text-sm ${field.value === "investor" ? "border-primary bg-primary/5" : "border-border"}`}
                          data-testid="button-signup-role-investor"
                        >
                          <User className="mb-2 h-4 w-4" />
                          Investor
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            field.onChange("partner");
                            form.setValue("professionalType", "inspector");
                          }}
                          className={`rounded-md border p-3 text-left text-sm ${field.value === "partner" && form.watch("professionalType") === "inspector" ? "border-primary bg-primary/5" : "border-border"}`}
                          data-testid="button-signup-role-inspector"
                        >
                          <ClipboardCheck className="mb-2 h-4 w-4" />
                          Inspector
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            field.onChange("partner");
                            form.setValue("professionalType", "contractor");
                          }}
                          className={`rounded-md border p-3 text-left text-sm ${field.value === "partner" && form.watch("professionalType") === "contractor" ? "border-primary bg-primary/5" : "border-border"}`}
                          data-testid="button-signup-role-contractor"
                        >
                          <Wrench className="mb-2 h-4 w-4" />
                          Contractor
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {form.watch("role") === "partner" && (
                <div className="grid grid-cols-2 gap-4 rounded-md border bg-muted/30 p-3">
                  <FormField
                    control={form.control}
                    name="certificationNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Certification / license</FormLabel>
                        <FormControl>
                          <Input placeholder="Optional" data-testid="input-signup-certification" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="serviceArea"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Service area</FormLabel>
                        <FormControl>
                          <Input placeholder="Toronto, Hamilton..." data-testid="input-signup-service-area" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

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
                          data-testid="input-signup-email"
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
                          placeholder="At least 8 characters" 
                          className="pl-10 h-11"
                          data-testid="input-signup-password"
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
                          data-testid="input-signup-confirm"
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
                disabled={signupMutation.isPending}
                data-testid="button-signup-submit"
              >
                {signupMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  <>
                    Create Account
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                </div>
              </div>

              <GoogleSignInButton variant="signup" />
            </form>
          </Form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href={authPath("/login", returnUrl)}>
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
