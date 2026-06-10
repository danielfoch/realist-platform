import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Phone, Mail, Loader2, DollarSign, ChevronDown, ChevronUp } from "lucide-react";

const financingExpert = {
  name: "Nick Hill",
  title: "Financing Expert",
  company: "Mortgage Broker",
  calendlyUrl: "https://calendly.com",
  email: "nick@example.com",
};

const consultationFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(10, "Please enter a valid phone number"),
  consent: z.boolean().default(false),
});

type ConsultationFormValues = z.infer<typeof consultationFormSchema>;

interface FinancingExpertPanelProps {
  purchasePrice: number;
  downPaymentPercent: number;
  interestRate: number;
  region?: string;
  city?: string;
  address?: string;
  defaultValues?: { name?: string; email?: string; phone?: string };
}

export function FinancingExpertPanel({ 
  purchasePrice, 
  downPaymentPercent, 
  interestRate, 
  region, 
  city, 
  address, 
  defaultValues 
}: FinancingExpertPanelProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(false);

  const form = useForm<ConsultationFormValues>({
    resolver: zodResolver(consultationFormSchema),
    defaultValues: {
      name: defaultValues?.name || "",
      email: defaultValues?.email || "",
      phone: defaultValues?.phone || "",
      consent: false,
    },
  });

  const loanAmount = purchasePrice * (1 - downPaymentPercent / 100);

  const mutation = useMutation({
    mutationFn: async (data: ConsultationFormValues) => {
      return apiRequest("POST", "/api/leads/engage", {
        ...data,
        formType: "Financing Consultation",
        formTag: "financing_consultation",
        tags: ["financing_consultation", "mortgage_request"],
        province: region,
        city,
        expertName: financingExpert.name,
        dealInfo: {
          address: address || "Not specified",
          purchasePrice,
          downPaymentPercent,
          loanAmount,
          currentRate: interestRate,
        },
      });
    },
    onSuccess: () => {
      toast({ 
        title: "Consultation Request Sent!", 
        description: `${financingExpert.name} will be in touch shortly.`
      });
      setIsOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit request. Please try again.", variant: "destructive" });
    },
  });

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase();
  };

  const expertContent = (
    <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
      <div className="flex items-center gap-3 min-w-0">
        <Avatar className="h-10 w-10 border-2 border-primary/20 shrink-0">
          <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
            {getInitials(financingExpert.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h4 className="font-semibold text-sm" data-testid="text-financing-expert-name">{financingExpert.name}</h4>
          <p className="text-xs text-muted-foreground truncate">{financingExpert.title}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
        <a href={financingExpert.calendlyUrl} target="_blank" rel="noopener noreferrer" className="flex-1 sm:flex-none">
          <Button size="sm" variant="outline" className="gap-1 w-full sm:w-auto" data-testid="button-financing-book-call">
            <Phone className="h-3 w-3" />
            Book a Call
          </Button>
        </a>
        <Button 
          size="sm"
          className="gap-1 flex-1 sm:flex-none" 
          onClick={() => setIsOpen(true)}
          data-testid="button-financing-send-email"
        >
          <Mail className="h-3 w-3" />
          Send Email
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile: Collapsible button */}
      <div className="sm:hidden">
        <Collapsible open={mobileExpanded} onOpenChange={setMobileExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between gap-2" data-testid="button-financing-expert-mobile">
              <span className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Financing Expert
              </span>
              {mobileExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <Card data-testid="card-financing-expert-mobile">
              <CardContent className="py-3 px-4">
                {expertContent}
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Desktop: Full panel */}
      <Card className="hidden sm:block" data-testid="card-financing-expert">
        <CardContent className="py-3 px-4">
          {expertContent}
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Connect with {financingExpert.name}
            </DialogTitle>
            <DialogDescription>
              Request a free consultation to discuss financing options for your deal.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-muted/50 rounded-md p-3 mb-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-primary text-sm">
                  {getInitials(financingExpert.name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-sm">{financingExpert.name}</p>
                <p className="text-xs text-muted-foreground">{financingExpert.title}</p>
              </div>
            </div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => mutation.mutateAsync(data))} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="John Smith" className="h-11" data-testid="input-financing-name" {...field} />
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
                    <FormLabel>Email *</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="john@example.com" className="h-11" data-testid="input-financing-email" {...field} />
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
                    <FormLabel>Phone Number *</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="(416) 555-0123" className="h-11" data-testid="input-financing-phone" {...field} />
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
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-financing-consent" />
                    </FormControl>
                    <FormLabel className="text-sm font-normal text-muted-foreground cursor-pointer">
                      I agree to receive communications about this consultation
                    </FormLabel>
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full h-11" disabled={mutation.isPending} data-testid="button-financing-submit">
                {mutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Send Email
                  </>
                )}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
