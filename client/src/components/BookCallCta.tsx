/**
 * BookCallCta — "Talk to a financing specialist about this deal."
 *
 * Reusable booked-call lead capture, designed to sit on underwriter /
 * feasibility / analyzer result views (pass sourcePage + underwritingId /
 * analysisId + a small dealSnapshot) and on the generic /book-a-call page.
 * On submit it creates a booked_call_leads row (POST /api/booked-call-leads)
 * and shows an inline confirmation — no external send happens until Dan
 * wires the BLD destination (see server/bldLeadDestination.ts).
 */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { track } from "@/lib/analytics";
import { CheckCircle, PhoneCall } from "lucide-react";

const formSchema = z.object({
  fullName: z.string().trim().min(2, "Please enter your full name"),
  email: z.string().trim().email("Please enter a valid email"),
  phone: z.string().trim().optional(),
  message: z.string().trim().max(2000).optional(),
});
type FormData = z.infer<typeof formSchema>;

export interface BookCallCtaProps {
  intent?: "financing" | "coaching";
  /** Page the CTA sits on — defaults to the current pathname. */
  sourcePage?: string;
  /** multiplex_underwritings.id when rendered on an underwriter result. */
  underwritingId?: string | null;
  /** property_analyses.id when rendered on an analyzer result. */
  analysisId?: string | null;
  /** Small deal context (address, price, verdict, headline numbers). */
  dealSnapshot?: {
    address?: string;
    city?: string;
    purchasePrice?: number;
    units?: number;
    verdict?: string;
    toolName?: string;
    keyMetrics?: Record<string, string | number>;
  } | null;
  title?: string;
  description?: string;
  className?: string;
}

export function BookCallCta({
  intent = "financing",
  sourcePage,
  underwritingId,
  analysisId,
  dealSnapshot,
  title,
  description,
  className,
}: BookCallCtaProps) {
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const heading = title ?? (intent === "financing"
    ? "Talk to a financing specialist about this deal"
    : "Book a coaching call");
  const blurb = description ?? (intent === "financing"
    ? "Realist works with commercial financing partners who specialize in multiplex and small-building deals. Tell us where to reach you and we'll set up a call to walk through financing options for this property."
    : "Tell us where to reach you and we'll set up a call about working with the Realist coaching program.");

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "",
      email: user?.email || "",
      phone: "",
      message: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      return apiRequest("POST", "/api/booked-call-leads", {
        fullName: data.fullName,
        email: data.email,
        phone: data.phone || undefined,
        message: data.message || undefined,
        intent,
        sourcePage: sourcePage ?? window.location.pathname,
        underwritingId: underwritingId ?? undefined,
        analysisId: analysisId ?? undefined,
        dealSnapshot: dealSnapshot ?? undefined,
      });
    },
    onSuccess: () => {
      setSubmitted(true);
      track({
        event: "consultation_requested",
        type: intent === "financing" ? "mortgage" : "coaching",
        context: sourcePage ?? window.location.pathname,
      });
    },
    onError: () => {
      toast({
        title: "Something went wrong",
        description: "Please try again or contact us directly.",
        variant: "destructive",
      });
    },
  });

  if (submitted) {
    return (
      <Card className={`border-violet-200 bg-gradient-to-b from-violet-50/60 to-transparent ${className ?? ""}`} data-testid="card-book-call-success">
        <CardContent className="py-8 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <CheckCircle className="h-7 w-7 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-lg font-semibold mb-1" data-testid="text-book-call-success">Request received</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {intent === "financing"
              ? "A financing specialist will reach out to book your call and walk through the deal."
              : "We'll reach out to book your coaching call."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border-violet-200 bg-gradient-to-b from-violet-50/60 to-transparent ${className ?? ""}`} data-testid="card-book-call-cta">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <PhoneCall className="h-5 w-5 text-violet-600" />
          {heading}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{blurb}</p>
        {dealSnapshot?.address && (
          <p className="text-xs text-muted-foreground">
            Deal on the call: <span className="font-medium text-foreground">{dealSnapshot.address}</span>
          </p>
        )}
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full name</FormLabel>
                    <FormControl>
                      <Input placeholder="Your full name" {...field} data-testid="input-book-call-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="you@example.com" {...field} data-testid="input-book-call-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone <span className="text-muted-foreground font-normal">(optional — fastest way to book)</span></FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder="(555) 123-4567" {...field} data-testid="input-book-call-phone" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Anything we should know? <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={intent === "financing"
                        ? "Timeline, down payment, whether you already own the property..."
                        : "Where you are in your investing journey and what you want help with..."}
                      className="min-h-[80px] resize-none"
                      {...field}
                      data-testid="input-book-call-message"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={mutation.isPending} data-testid="button-book-call-submit">
              {mutation.isPending ? "Submitting..." : intent === "financing" ? "Book my financing call" : "Book my coaching call"}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              No obligation — we'll only use this to set up your call.
            </p>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
