import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Lock, User, ArrowRight, ClipboardCheck, Wrench, Award } from "lucide-react";
import { SIGNUP_EXPERT_TYPES, type SignupExpertType } from "@shared/models/auth";
import { apiRequest } from "@/lib/queryClient";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { authPath, clearAuthReturnUrl, getAuthReturnUrl, rememberAuthReturnUrl, goToReturnUrl } from "@/lib/authReturn";

const EXPERT_TYPE_OPTIONS: { value: SignupExpertType; label: string }[] = [
  { value: "architect", label: "Architect" },
  { value: "urban_planner", label: "Urban Planner" },
  { value: "realtor", label: "Realtor" },
  { value: "mortgage_broker", label: "Mortgage Broker" },
  { value: "lawyer", label: "Real Estate Lawyer" },
  { value: "accountant", label: "Accountant" },
  { value: "property_manager", label: "Property Manager" },
  { value: "contractor", label: "Contractor" },
  { value: "appraiser", label: "Appraiser" },
  { value: "inspector", label: "Inspector" },
];

const signupSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
  role: z.enum(["investor", "partner", "expert"]),
  professionalType: z.enum(["contractor", "inspector"]).optional(),
  expertType: z.enum(SIGNUP_EXPERT_TYPES).optional(),
  certificationNumber: z.string().optional(),
  serviceArea: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
}).refine((data) => data.role !== "partner" || !!data.professionalType, {
  message: "Choose contractor or inspector",
  path: ["professionalType"],
}).refine((data) => data.role !== "expert" || !!data.expertType, {
  message: "Choose your area of expertise",
  path: ["expertType"],
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
      expertType: undefined,
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
        expertType: data.role === "expert" ? data.expertType : undefined,
        certificationNumber: data.role === "investor" ? undefined : data.certificationNumber,
        serviceArea: data.role === "investor" ? undefined : data.serviceArea,
        // Anonymous analyzer session — lets the server adopt pre-signup
        // analyses so the portal isn't empty on first login.
        sessionId: localStorage.getItem("realist_session_id") || undefined,
      });
      return response.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Account created!", description: "Welcome to Realist." });
      // The role question is answered here — carry it through so /signup
      // doesn't re-ask it (it reads and clears this key on mount).
      sessionStorage.setItem(
        "realist_signup_role",
        JSON.stringify({
          role: variables.role,
          professionalType: variables.professionalType || null,
          expertType: variables.expertType || null,
        }),
      );
      clearAuthReturnUrl();
      goToReturnUrl(returnUrl, setLocation);
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
                      <div className="grid grid-cols-2 gap-2">
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
                        <button
                          type="button"
                          onClick={() => field.onChange("expert")}
                          className={`rounded-md border p-3 text-left text-sm ${field.value === "expert" ? "border-primary bg-primary/5" : "border-border"}`}
                          data-testid="button-signup-role-expert"
                        >
                          <Award className="mb-2 h-4 w-4" />
                          Industry Expert
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {form.watch("role") === "expert" && (
                <div className="space-y-3 rounded-md border bg-muted/30 p-3">
                  <FormField
                    control={form.control}
                    name="expertType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Area of expertise</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger data-testid="select-signup-expert-type">
                              <SelectValue placeholder="Architect, planner, lawyer..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {EXPERT_TYPE_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <p className="text-xs text-muted-foreground">
                    Free to join. Answer public property questions, publish field notes, and build a
                    public profile investors can find you through.
                  </p>
                </div>
              )}

              {(form.watch("role") === "partner" || form.watch("role") === "expert") && (
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
