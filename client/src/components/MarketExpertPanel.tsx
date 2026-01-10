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
import { getMarketExpertByCity, hasMarketExpertByCity, partnerApplicationUrl, type MarketExpert } from "@/lib/marketExperts";
import { Phone, Mail, Loader2, UserPlus, MapPin } from "lucide-react";

const consultationFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(10, "Please enter a valid phone number"),
  consent: z.boolean().default(false),
});

type ConsultationFormValues = z.infer<typeof consultationFormSchema>;

interface MarketExpertPanelProps {
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

export function MarketExpertPanel({ region, city, country, dealInfo, defaultValues }: MarketExpertPanelProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const provinceCode = getProvinceCode(region);
  const expert = getMarketExpertByCity(city, provinceCode);
  const hasExpert = hasMarketExpertByCity(city, provinceCode);

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
        formType: "Expert Consultation",
        tags: [`LEAD_${provinceCode}`, "expert_consultation"],
        province: provinceCode,
        city,
        expertName: expert?.name,
        dealInfo,
      });
    },
    onSuccess: () => {
      toast({ 
        title: "Consultation Request Sent!", 
        description: expert ? `${expert.name} will be in touch shortly.` : "We'll connect you with a local expert." 
      });
      setIsOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit request. Please try again.", variant: "destructive" });
    },
  });

  if (country !== "canada") {
    return null;
  }

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase();
  };

  if (!hasExpert) {
    return (
      <Card className="border-dashed border-2" data-testid="card-no-expert">
        <CardContent className="pt-6">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto">
              <UserPlus className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <h4 className="font-medium">No Market Expert Yet</h4>
              <p className="text-sm text-muted-foreground mt-1">
                We're looking for a trusted expert in {region || "this province"}
              </p>
            </div>
            <a
              href={partnerApplicationUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" className="gap-2 mt-2" data-testid="button-apply-expert">
                <UserPlus className="h-4 w-4" />
                Apply to be Market Expert
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card data-testid="card-market-expert">
        <CardContent className="py-3 px-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar className="h-10 w-10 border-2 border-primary/20 shrink-0">
                <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                  {getInitials(expert!.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h4 className="font-semibold text-sm" data-testid="text-expert-name">{expert!.name}</h4>
                <p className="text-xs text-muted-foreground truncate">{expert!.title} - {expert!.city}, {expert!.province}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a href="https://calendly.com/danielfoch/consultation-realist-ca" target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline" className="gap-1" data-testid="button-book-call">
                  <Phone className="h-3 w-3" />
                  Book a Call
                </Button>
              </a>
              <Button 
                size="sm"
                className="gap-1" 
                onClick={() => setIsOpen(true)}
                data-testid="button-send-email"
              >
                <Mail className="h-3 w-3" />
                Send Email
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Connect with {expert!.name}
            </DialogTitle>
            <DialogDescription>
              Request a free consultation to discuss this deal and get expert insights on the {expert!.province} market.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-muted/50 rounded-md p-3 mb-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-primary text-sm">
                  {getInitials(expert!.name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-sm">{expert!.name}</p>
                <p className="text-xs text-muted-foreground">{expert!.title}</p>
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
                      <Input placeholder="John Smith" className="h-11" data-testid="input-consult-name" {...field} />
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
                      <Input type="email" placeholder="john@example.com" className="h-11" data-testid="input-consult-email" {...field} />
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
                      <Input type="tel" placeholder="(416) 555-0123" className="h-11" data-testid="input-consult-phone" {...field} />
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
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-consult-consent" />
                    </FormControl>
                    <FormLabel className="text-sm font-normal text-muted-foreground cursor-pointer">
                      I agree to receive communications about this consultation
                    </FormLabel>
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full h-11" disabled={mutation.isPending} data-testid="button-consult-submit">
                {mutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Phone className="mr-2 h-4 w-4" />
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
