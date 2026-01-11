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
import { getProvinceCode } from "@/lib/provinces";
import { getPropertyManager, type PropertyManager } from "@/lib/propertyManagers";
import { Phone, Mail, Loader2, Building2, ChevronDown, ChevronUp } from "lucide-react";

const consultationFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(10, "Please enter a valid phone number"),
  consent: z.boolean().default(false),
});

type ConsultationFormValues = z.infer<typeof consultationFormSchema>;

interface PropertyManagerPanelProps {
  region?: string;
  city?: string;
  country: "canada" | "usa";
  dealInfo: {
    address: string;
    purchasePrice: number;
    monthlyRent: number;
    cashFlow: number;
    capRate: number;
  };
  defaultValues?: { name?: string; email?: string; phone?: string };
}

export function PropertyManagerPanel({ region, city, country, dealInfo, defaultValues }: PropertyManagerPanelProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const provinceCode = getProvinceCode(region || "Ontario");
  const displayCity = city || "Toronto";
  const displayRegion = region || "Ontario";
  
  // Get property manager (Royal York as default, future: area-specific from database)
  const displayManager: PropertyManager = getPropertyManager(displayCity, provinceCode);

  const form = useForm<ConsultationFormValues>({
    resolver: zodResolver(consultationFormSchema),
    defaultValues: {
      name: defaultValues?.name || "",
      email: defaultValues?.email || "",
      phone: defaultValues?.phone || "",
      consent: false,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: ConsultationFormValues) => {
      return apiRequest("POST", "/api/leads/engage", {
        ...data,
        formType: "Property Management Consultation",
        formTag: "property_management",
        tags: [`LEAD_${provinceCode}`, "property_management"],
        province: provinceCode,
        city: displayCity,
        expertName: displayManager.companyName,
        dealInfo,
      });
    },
    onSuccess: () => {
      toast({ 
        title: "Consultation Request Sent!", 
        description: `${displayManager.companyName} will be in touch shortly.` 
      });
      setIsOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit request. Please try again.", variant: "destructive" });
    },
  });

  // Only show for Canadian properties
  if (country !== "canada") {
    return null;
  }

  const managerContent = (
    <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
      <div className="flex items-center gap-3 min-w-0">
        <Avatar className="h-10 w-10 border-2 border-primary/20 shrink-0">
          <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
            <Building2 className="h-5 w-5" />
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h4 className="font-semibold text-sm" data-testid="text-pm-name">{displayManager.companyName}</h4>
          <p className="text-xs text-muted-foreground truncate">Property Management - {displayManager.city}, {displayManager.province}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
        <Button size="sm" variant="outline" className="gap-1 flex-1 sm:flex-none" asChild data-testid="button-pm-book-call">
          <a href={displayManager.calendlyUrl || "https://calendly.com/royalyork/consultation"} target="_blank" rel="noopener noreferrer">
            <Phone className="h-3 w-3" />
            Book a Call
          </a>
        </Button>
        <Button 
          size="sm"
          className="gap-1 flex-1 sm:flex-none" 
          onClick={() => setIsOpen(true)}
          data-testid="button-pm-send-email"
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
            <Button variant="outline" className="w-full justify-between gap-2" data-testid="button-property-manager-mobile">
              <span className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Property Manager
              </span>
              {mobileExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <Card data-testid="card-property-manager-mobile">
              <CardContent className="py-3 px-4">
                {managerContent}
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Desktop: Full panel */}
      <Card className="hidden sm:block" data-testid="card-property-manager">
        <CardContent className="py-3 px-4">
          {managerContent}
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Connect with {displayManager.companyName}
            </DialogTitle>
            <DialogDescription>
              Request a free consultation to discuss property management services for your investment.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-muted/50 rounded-md p-3 mb-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-primary text-sm">
                  <Building2 className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-sm">{displayManager.companyName}</p>
                <p className="text-xs text-muted-foreground">Property Management</p>
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
                      <Input placeholder="John Smith" className="h-11" data-testid="input-pm-name" {...field} />
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
                      <Input type="email" placeholder="john@example.com" className="h-11" data-testid="input-pm-email" {...field} />
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
                      <Input type="tel" placeholder="(416) 555-0123" className="h-11" data-testid="input-pm-phone" {...field} />
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
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-pm-consent" />
                    </FormControl>
                    <FormLabel className="text-sm font-normal text-muted-foreground cursor-pointer">
                      I agree to receive communications about property management services
                    </FormLabel>
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full h-11" disabled={mutation.isPending} data-testid="button-pm-submit">
                {mutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Building2 className="mr-2 h-4 w-4" />
                    Request Consultation
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
