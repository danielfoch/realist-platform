import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isOntario, getProvinceCode, getMarketExpert } from "@/lib/provinces";
import { HelpCircle, DollarSign, Phone, Loader2, Percent } from "lucide-react";

const engageFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(10, "Please enter a valid phone number"),
  consent: z.boolean().default(false),
});

type EngageFormValues = z.infer<typeof engageFormSchema>;

interface DealPromotionsProps {
  region: string;
  city: string;
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

type ModalType = "cashback" | "expert" | "mortgage" | null;

export function DealPromotions({ region, city, country, dealInfo, defaultValues }: DealPromotionsProps) {
  const { toast } = useToast();
  const [modalType, setModalType] = useState<ModalType>(null);
  
  const provinceCode = getProvinceCode(region);
  const isOntarioDeal = country === "canada" && isOntario(region);
  const expert = country === "canada" ? getMarketExpert(region, city) : null;
  
  const form = useForm<EngageFormValues>({
    resolver: zodResolver(engageFormSchema),
    defaultValues: {
      name: defaultValues?.name || "",
      email: defaultValues?.email || "",
      phone: defaultValues?.phone || "",
      consent: false,
    },
  });

  const engageMutation = useMutation({
    mutationFn: async (data: EngageFormValues & { formType: string; tags: string[] }) => {
      return apiRequest("POST", "/api/leads/engage", {
        ...data,
        province: provinceCode,
        city,
        dealInfo,
      });
    },
    onSuccess: () => {
      const messages: Record<string, { title: string; description: string }> = {
        cashback: { title: "Cashback Request Submitted!", description: "We'll be in touch about your cashback offer." },
        expert: { title: "Call Request Submitted!", description: "Our local expert will reach out soon." },
        mortgage: { title: "Consultation Requested!", description: "A mortgage specialist will contact you shortly." },
      };
      const msg = messages[modalType || "cashback"];
      toast({ title: msg.title, description: msg.description });
      setModalType(null);
      form.reset();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit request. Please try again.", variant: "destructive" });
    },
  });

  const handleSubmit = async (data: EngageFormValues) => {
    const formConfigs: Record<string, { formType: string; tags: string[] }> = {
      cashback: { formType: "Cashback Request", tags: ["Keypr"] },
      expert: { formType: "Local Expert Request", tags: [] },
      mortgage: { formType: "Mortgage Consultation", tags: ["mortgage_consultation"] },
    };
    const config = formConfigs[modalType || "cashback"];
    await engageMutation.mutateAsync({ ...data, ...config });
  };

  const getModalContent = () => {
    switch (modalType) {
      case "cashback":
        return {
          title: "Get Cashback on This Deal",
          description: "Sign up to receive cashback when you purchase this property through our network.",
        };
      case "expert":
        return {
          title: "Request a Call",
          description: expert?.name 
            ? `Connect with ${expert.name}, our local market expert in ${region}.`
            : `Connect with a local market expert in ${region}.`,
        };
      case "mortgage":
        return {
          title: "Request a Mortgage Consultation",
          description: "Get the best mortgage rate for this deal with our trusted lending partners.",
        };
      default:
        return { title: "", description: "" };
    }
  };

  const modalContent = getModalContent();

  if (country !== "canada") {
    return null;
  }

  return (
    <>
      <div className="space-y-3">
        {isOntarioDeal ? (
          <div 
            className="flex items-center gap-2 cursor-pointer group"
            onClick={() => setModalType("cashback")}
            data-testid="button-cashback"
          >
            <Badge className="bg-orange-500 hover:bg-orange-600 text-white gap-1.5 py-1 px-3">
              <DollarSign className="h-3.5 w-3.5" />
              Cashback
            </Badge>
            <button 
              className="text-muted-foreground hover:text-foreground transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setModalType("cashback");
              }}
              data-testid="button-cashback-info"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Phone className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">Chat with our local market expert</p>
                  {expert?.name && !expert.becomePartner && (
                    <p className="text-xs text-muted-foreground mt-0.5">{expert.name}</p>
                  )}
                  {expert?.becomePartner && (
                    <Link href="/events#become-partner">
                      <span className="text-xs text-primary hover:underline cursor-pointer">
                        {expert.name} - Become a Realist Partner
                      </span>
                    </Link>
                  )}
                  {!expert?.name && !expert?.becomePartner && (
                    <p className="text-xs text-muted-foreground mt-0.5">Expert coming soon for this area</p>
                  )}
                </div>
                <Button 
                  size="sm" 
                  onClick={() => setModalType("expert")}
                  disabled={!expert?.available && !expert?.becomePartner}
                  data-testid="button-chat-expert"
                >
                  Request Call
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={modalType !== null} onOpenChange={(open) => !open && setModalType(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{modalContent.title}</DialogTitle>
            <DialogDescription>{modalContent.description}</DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="John Smith" className="h-11" data-testid="input-engage-name" {...field} />
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
                      <Input type="email" placeholder="john@example.com" className="h-11" data-testid="input-engage-email" {...field} />
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
                      <Input type="tel" placeholder="(416) 555-0123" className="h-11" data-testid="input-engage-phone" {...field} />
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
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-engage-consent" />
                    </FormControl>
                    <FormLabel className="text-sm font-normal text-muted-foreground cursor-pointer">
                      I agree to receive communications about this inquiry
                    </FormLabel>
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full h-11" disabled={engageMutation.isPending} data-testid="button-engage-submit">
                {engageMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Request"
                )}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface MortgageButtonProps {
  region: string;
  city: string;
  dealInfo: {
    address: string;
    purchasePrice: number;
    monthlyRent: number;
    cashFlow: number;
    capRate: number;
  };
  defaultValues?: { name?: string; email?: string; phone?: string };
}

export function MortgageConsultationButton({ region, city, dealInfo, defaultValues }: MortgageButtonProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const provinceCode = getProvinceCode(region);

  const form = useForm<EngageFormValues>({
    resolver: zodResolver(engageFormSchema),
    defaultValues: {
      name: defaultValues?.name || "",
      email: defaultValues?.email || "",
      phone: defaultValues?.phone || "",
      consent: false,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: EngageFormValues) => {
      return apiRequest("POST", "/api/leads/engage", {
        ...data,
        formType: "Mortgage Consultation",
        tags: ["mortgage_consultation"],
        province: provinceCode,
        city,
        dealInfo,
      });
    },
    onSuccess: () => {
      toast({ title: "Consultation Requested!", description: "A mortgage specialist will contact you shortly." });
      setIsOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit request. Please try again.", variant: "destructive" });
    },
  });

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs"
        onClick={() => setIsOpen(true)}
        data-testid="button-mortgage-consultation"
      >
        <Percent className="h-3.5 w-3.5" />
        Get Best Rate
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Request a Mortgage Consultation</DialogTitle>
            <DialogDescription>
              Get the best mortgage rate for this deal with our trusted lending partners.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => mutation.mutateAsync(data))} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="John Smith" className="h-11" data-testid="input-mortgage-name" {...field} />
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
                      <Input type="email" placeholder="john@example.com" className="h-11" data-testid="input-mortgage-email" {...field} />
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
                      <Input type="tel" placeholder="(416) 555-0123" className="h-11" data-testid="input-mortgage-phone" {...field} />
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
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-mortgage-consent" />
                    </FormControl>
                    <FormLabel className="text-sm font-normal text-muted-foreground cursor-pointer">
                      I agree to receive communications about this inquiry
                    </FormLabel>
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full h-11" disabled={mutation.isPending} data-testid="button-mortgage-submit">
                {mutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Request Consultation"
                )}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
