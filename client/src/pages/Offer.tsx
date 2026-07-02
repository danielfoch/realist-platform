import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, ArrowRight, FileSignature } from "lucide-react";

const OFFER_CONDITIONS = [
  "Financing",
  "Home inspection",
  "Status certificate / condo docs",
  "Sale of buyer's property",
  "Lawyer review",
] as const;

const formSchema = z.object({
  name: z.string().min(1, "Full name is required"),
  email: z.string().email("Enter a valid email address"),
  phone: z.string().optional(),
  propertyAddress: z.string().min(1, "Property address is required"),
  listingId: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  offerPrice: z.coerce.number().positive("Must be a positive number").optional().or(z.literal("")),
  depositAmount: z.coerce.number().positive("Must be a positive number").optional().or(z.literal("")),
  closingDate: z.string().optional(),
  conditions: z.array(z.string()).default([]),
  financingHelpWanted: z.boolean().default(false),
  representationHelpWanted: z.boolean().default(false),
  notes: z.string().optional(),
  consentEmail: z.boolean().refine(v => v === true, { message: "Consent is required to continue" }),
});

type FormValues = z.infer<typeof formSchema>;

export default function Offer() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const searchString = useSearch();

  const params = new URLSearchParams(searchString);
  const prefillAddress = params.get("address") || "";
  const prefillCity = params.get("city") || "";
  const prefillProvince = params.get("province") || "";
  const prefillListingId = params.get("listingId") || "";
  const prefillPrice = params.get("price") || "";
  const prefillDealId = params.get("dealId") || null;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      propertyAddress: prefillAddress,
      listingId: prefillListingId,
      city: prefillCity,
      province: prefillProvince,
      offerPrice: prefillPrice ? Number(prefillPrice) : "",
      depositAmount: "",
      closingDate: "",
      conditions: [],
      financingHelpWanted: false,
      representationHelpWanted: true,
      notes: "",
      consentEmail: false,
    },
  });

  useEffect(() => {
    if (prefillAddress) form.setValue("propertyAddress", prefillAddress);
  }, [prefillAddress]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        name: values.name,
        email: values.email,
        phone: values.phone || null,
        propertyAddress: values.propertyAddress,
        listingId: values.listingId || null,
        city: values.city || null,
        province: values.province || null,
        offerPrice: values.offerPrice ? Number(values.offerPrice) : null,
        depositAmount: values.depositAmount ? Number(values.depositAmount) : null,
        closingDate: values.closingDate || null,
        conditions: values.conditions,
        financingHelpWanted: values.financingHelpWanted,
        representationHelpWanted: values.representationHelpWanted,
        notes: values.notes || null,
        consentEmail: values.consentEmail,
        analysisId: prefillDealId || null,
      };
      const res = await apiRequest("POST", "/api/offers", payload);
      return (await res.json()) as { success: boolean; id?: string };
    },
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: () => {
      toast({ title: "Submission failed", description: "Please try again or contact us directly.", variant: "destructive" });
    },
  });

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-lg w-full text-center" data-testid="offer-success">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <CheckCircle className="h-16 w-16 text-green-500" />
            </div>
            <CardTitle className="text-2xl">Offer request received</CardTitle>
            <CardDescription>
              A Realist advisor will reach out to finalize your offer terms and connect you with a realtor to write and submit it.
            </CardDescription>
          </CardHeader>
          <CardContent>
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
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="mb-8 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <FileSignature className="h-6 w-6 text-primary" />
            <span className="text-sm font-semibold text-primary tracking-wide uppercase">Make an Offer</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Start your offer</h1>
          <p className="text-muted-foreground">
            Tell us your terms and a Realist advisor will connect you with a realtor to draft and submit your offer on this property.
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(v => mutation.mutate(v))} className="space-y-6" data-testid="form-offer">

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
                <CardTitle className="text-base">Property</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="propertyAddress"
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
                  name="listingId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>MLS # <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                      <FormControl>
                        <Input placeholder="MLS number" data-testid="input-listing-id" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Offer Terms</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="offerPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Offer price</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="750000" data-testid="input-offer-price" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="depositAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Deposit <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="25000" data-testid="input-deposit" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="closingDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preferred closing date <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                      <FormControl>
                        <Input type="date" data-testid="input-closing-date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="conditions"
                  render={() => (
                    <FormItem>
                      <FormLabel>Conditions <span className="text-muted-foreground font-normal">(select any that apply)</span></FormLabel>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {OFFER_CONDITIONS.map((condition) => (
                          <FormField
                            key={condition}
                            control={form.control}
                            name="conditions"
                            render={({ field }) => (
                              <FormItem className="flex items-center gap-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(condition)}
                                    onCheckedChange={(checked) => {
                                      const current = field.value || [];
                                      field.onChange(
                                        checked
                                          ? [...current, condition]
                                          : current.filter((c) => c !== condition),
                                      );
                                    }}
                                    data-testid={`checkbox-condition-${condition}`}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal cursor-pointer">{condition}</FormLabel>
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">How can we help?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <FormField
                  control={form.control}
                  name="representationHelpWanted"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-3 space-y-0">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-representation-help" />
                      </FormControl>
                      <FormLabel className="font-normal cursor-pointer">Connect me with a realtor to write and submit the offer</FormLabel>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="financingHelpWanted"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-3 space-y-0">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-financing-help" />
                      </FormControl>
                      <FormLabel className="font-normal cursor-pointer">I also want help arranging financing</FormLabel>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notes & Consent</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Anything the advisor should know about your offer, timeline, or conditions..."
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
                <FormField
                  control={form.control}
                  name="consentEmail"
                  render={({ field }) => (
                    <FormItem className="flex items-start gap-3 space-y-0">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-consent-email" />
                      </FormControl>
                      <div className="space-y-1">
                        <FormLabel className="font-normal cursor-pointer">
                          I agree to be contacted by Realist.ca about this offer and next steps.
                        </FormLabel>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Button
              type="submit"
              className="w-full"
              disabled={mutation.isPending}
              data-testid="button-submit-offer"
            >
              {mutation.isPending ? "Submitting..." : "Submit offer request"}
              {!mutation.isPending && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
