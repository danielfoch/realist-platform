import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Navigation } from "@/components/Navigation";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, ArrowRight, Building2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useSearch } from "wouter";

const formSchema = z.object({
  name: z.string().min(1, "Full name is required"),
  email: z.string().email("Enter a valid email address"),
  phone: z.string().optional(),
  address: z.string().min(1, "Property address is required"),
  listingUrl: z.string().url("Enter a valid URL").optional().or(z.literal("")),
  market: z.string().optional(),
  propertyType: z.string().optional(),
  purchasePrice: z.coerce.number().positive("Must be a positive number").optional().or(z.literal("")),
  estimatedRent: z.coerce.number().positive("Must be a positive number").optional().or(z.literal("")),
  financingHelpWanted: z.boolean().default(false),
  buyingHelpWanted: z.boolean().default(false),
  userNotes: z.string().optional(),
  consentEmail: z.boolean().refine(v => v === true, { message: "Email consent is required" }),
  consentSms: z.boolean().default(false),
});

type FormValues = z.infer<typeof formSchema>;

const PROPERTY_TYPES = [
  "Single Family",
  "Duplex",
  "Triplex",
  "Fourplex",
  "5+ Unit Multiplex",
  "Condo / Strata",
  "Townhouse",
  "Mixed Use",
  "Commercial",
];

const CANADIAN_MARKETS = [
  "Toronto, ON",
  "Vancouver, BC",
  "Calgary, AB",
  "Edmonton, AB",
  "Ottawa, ON",
  "Montreal, QC",
  "Winnipeg, MB",
  "Hamilton, ON",
  "London, ON",
  "Kitchener-Waterloo, ON",
  "Other",
];

export default function DealDesk() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ status: string; suggestedNextAction: string; intentScore: number } | null>(null);
  const searchString = useSearch();

  const params = new URLSearchParams(searchString);
  const prefillAddress = params.get("address") || "";
  const prefillDealId = params.get("dealId") || null;
  const prefillPrice = Number(params.get("price")) || "";
  const prefillRent = Number(params.get("rent")) || "";

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      address: prefillAddress,
      listingUrl: "",
      market: "",
      propertyType: "",
      purchasePrice: prefillPrice,
      estimatedRent: prefillRent,
      financingHelpWanted: false,
      buyingHelpWanted: false,
      userNotes: "",
      consentEmail: false,
      consentSms: false,
    },
  });

  useEffect(() => {
    if (prefillAddress) {
      form.setValue("address", prefillAddress);
    }
  }, [prefillAddress]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        ...values,
        purchasePrice: values.purchasePrice ? Number(values.purchasePrice) : null,
        estimatedRent: values.estimatedRent ? Number(values.estimatedRent) : null,
        listingUrl: values.listingUrl || null,
        dealDeskCtaClicked: !!prefillDealId,
        analysisId: prefillDealId || null,
      };
      const res = await apiRequest("POST", "/api/deal-desk/submit", payload);
      return (await res.json()) as { ok: boolean; status: string; suggestedNextAction: string; intentScore: number };
    },
    onSuccess: (data) => {
      setResult({ status: data.status, suggestedNextAction: data.suggestedNextAction, intentScore: data.intentScore });
      setSubmitted(true);
    },
    onError: () => {
      toast({ title: "Submission failed", description: "Please try again or contact us directly.", variant: "destructive" });
    },
  });

  if (submitted && result) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-lg w-full text-center" data-testid="deal-desk-success">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <CheckCircle className="h-16 w-16 text-green-500" />
            </div>
            <CardTitle className="text-2xl">Deal Submitted</CardTitle>
            <CardDescription>We have received your deal and will be in touch shortly.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted p-4 space-y-2 text-left">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Lead score</span>
                <Badge variant={result.status === "hot" ? "destructive" : result.status === "warm" ? "default" : "secondary"} data-testid="result-status">
                  {result.intentScore} — {result.status.toUpperCase()}
                </Badge>
              </div>
              <p className="text-sm font-medium" data-testid="result-next-action">{result.suggestedNextAction}</p>
            </div>
            <Link href="/">
              <Button className="w-full" data-testid="button-back-home">
                Back to Realist.ca <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="mb-8 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="h-6 w-6 text-primary" />
            <span className="text-sm font-semibold text-primary tracking-wide uppercase">Deal Desk</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Submit Your Deal</h1>
          <p className="text-muted-foreground">
            Share a deal you are analyzing and our team will review it, score it, and reach out about next steps.
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(v => mutation.mutate(v))} className="space-y-6" data-testid="form-deal-desk">

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Your Contact Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full name</FormLabel>
                        <FormControl>
                          <Input placeholder="Jane Smith" data-testid="input-name" {...field} />
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
                          <Input type="email" placeholder="jane@example.com" data-testid="input-email" {...field} />
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
                      <FormLabel>Phone <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                      <FormControl>
                        <Input type="tel" placeholder="+1 416 555 0100" data-testid="input-phone" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Deal Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Property address</FormLabel>
                      <FormControl>
                        <Input placeholder="123 Main St, Toronto, ON" data-testid="input-address" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="listingUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Listing URL <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                      <FormControl>
                        <Input placeholder="https://www.realtor.ca/..." data-testid="input-listing-url" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="market"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Market <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-market">
                              <SelectValue placeholder="Select market" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {CANADIAN_MARKETS.map(m => (
                              <SelectItem key={m} value={m}>{m}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="propertyType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Property type <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-property-type">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {PROPERTY_TYPES.map(t => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="purchasePrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Purchase price <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="750000" data-testid="input-purchase-price" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="estimatedRent"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estimated rent / mo <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="3500" data-testid="input-estimated-rent" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="userNotes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Tell us more about the deal, your goals, or any questions you have..."
                          className="resize-none"
                          rows={3}
                          data-testid="textarea-notes"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">What kind of help do you need?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <FormField
                  control={form.control}
                  name="financingHelpWanted"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-3">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-financing-help"
                        />
                      </FormControl>
                      <FormLabel className="font-normal cursor-pointer">I want help with financing</FormLabel>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="buyingHelpWanted"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-3">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-buying-help"
                        />
                      </FormControl>
                      <FormLabel className="font-normal cursor-pointer">I want help finding or buying a property</FormLabel>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Consent</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <FormField
                  control={form.control}
                  name="consentEmail"
                  render={({ field }) => (
                    <FormItem className="flex items-start gap-3">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-consent-email"
                        />
                      </FormControl>
                      <div className="space-y-1">
                        <FormLabel className="font-normal cursor-pointer">
                          I agree to receive follow-up emails about my deal and relevant market insights from Realist.ca.
                        </FormLabel>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="consentSms"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-3">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-consent-sms"
                        />
                      </FormControl>
                      <FormLabel className="font-normal cursor-pointer">
                        I also consent to SMS follow-ups <span className="text-muted-foreground">(optional)</span>
                      </FormLabel>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Button
              type="submit"
              className="w-full"
              disabled={mutation.isPending}
              data-testid="button-submit-deal"
            >
              {mutation.isPending ? "Submitting..." : "Submit Deal to Deal Desk"}
              {!mutation.isPending && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
