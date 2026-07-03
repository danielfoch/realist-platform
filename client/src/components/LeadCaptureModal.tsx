import { useState } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Lock } from "lucide-react";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

const leadFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email address"),
  // Optional on purpose: a mandatory phone field is the single biggest
  // form-abandonment lever, and email is all we need to save progress.
  phone: z
    .string()
    .optional()
    .refine((v) => !v || v.replace(/\D/g, "").length >= 10, "Please enter a valid phone number"),
  consent: z.boolean().default(false),
});

type LeadFormValues = z.infer<typeof leadFormSchema>;

interface LeadCaptureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: LeadFormValues) => Promise<void>;
  isSubmitting: boolean;
  defaultValues?: { firstName?: string; lastName?: string; email?: string; phone?: string };
}

export function LeadCaptureModal({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
  defaultValues,
}: LeadCaptureModalProps) {
  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      firstName: defaultValues?.firstName || "",
      lastName: defaultValues?.lastName || "",
      email: defaultValues?.email || "",
      phone: defaultValues?.phone || "",
      consent: false,
    },
  });

  // Post-submit, offer one on-platform next step: the live Deal Room. No
  // off-platform detours at the moment of highest intent.
  const [step, setStep] = useState<"form" | "dealRoom">("form");

  const handleSubmit = async (data: LeadFormValues) => {
    await onSubmit(data);
    form.reset();
    setStep("dealRoom");
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset();
      setStep("form");
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {step === "dealRoom" ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">
                Bring this deal to the Live Deal Room
              </DialogTitle>
              <DialogDescription className="text-base">
                Free live deal review — Mondays 11:30am ET. Get this deal reviewed on the call.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2 pt-2">
              <Link href="/deal-room">
                <Button
                  className="w-full h-12 text-base"
                  onClick={() => handleOpenChange(false)}
                  data-testid="button-lead-deal-room"
                >
                  Go to the Deal Room
                </Button>
              </Link>
              <Button
                type="button"
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={() => handleOpenChange(false)}
                data-testid="button-lead-maybe-later"
              >
                Maybe later
              </Button>
            </div>
          </>
        ) : (
        <>
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">
                Save Your Progress
              </DialogTitle>
              <DialogDescription className="text-base">
                You already have the first-pass result. Add your details to keep this deal, unlock the full breakdown, and pick up where you left off.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 gap-2 rounded-lg border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground sm:grid-cols-3">
              <div>Save this deal and your search criteria</div>
              <div>Unlock exports, charts, and comparison tools</div>
              <div>Get matched to lenders or local experts later</div>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="John"
                            className="h-12"
                            data-testid="input-lead-firstname"
                            {...field}
                          />
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
                        <FormLabel>Last Name *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Smith"
                            className="h-12"
                            data-testid="input-lead-lastname"
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
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email *</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="john@example.com"
                          className="h-12"
                          data-testid="input-lead-email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number (optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="tel"
                          placeholder="(416) 555-0123"
                          className="h-12"
                          data-testid="input-lead-phone"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="consent"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-lead-consent"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-sm font-normal text-muted-foreground cursor-pointer">
                          I agree to receive marketing communications from Realist.ca via e-mail and text message
                        </FormLabel>
                      </div>
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full h-12 text-base"
                  disabled={isSubmitting}
                  data-testid="button-lead-submit"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Save And Continue"
                  )}
                </Button>

                <div className="relative my-3">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or</span>
                  </div>
                </div>

                <GoogleSignInButton variant="continue" />

                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mt-3">
                  <Lock className="h-3 w-3" />
                  <span>Your information stays private and lets Realist save your workflow across sessions.</span>
                </div>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
