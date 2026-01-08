import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
import { getProvinceCode, isOntario } from "@/lib/provinces";
import { DollarSign, Loader2, Gift } from "lucide-react";

const engageFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(10, "Please enter a valid phone number"),
  consent: z.boolean().default(false),
});

type EngageFormValues = z.infer<typeof engageFormSchema>;

interface CashbackDisplayProps {
  purchasePrice: number;
  region: string;
  city: string;
  country: "canada" | "usa";
  dealInfo: {
    address: string;
    monthlyRent: number;
    cashFlow: number;
    capRate: number;
  };
  defaultValues?: { name?: string; email?: string; phone?: string };
}

export function CashbackDisplay({ purchasePrice, region, city, country, dealInfo, defaultValues }: CashbackDisplayProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const provinceCode = getProvinceCode(region);
  const isOntarioDeal = isOntario(region);

  const commissionRate = 0.025;
  // Default to high end (Ontario 80%) when no region is selected, otherwise use actual rate
  const hasRegionSelected = region && region.trim() !== '';
  const cashbackPercent = (!hasRegionSelected || isOntarioDeal) ? 0.80 : 0.125;
  const cashbackAmount = purchasePrice * commissionRate * cashbackPercent;

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
        formType: "Cashback Request",
        tags: ["Keypr"],
        province: provinceCode,
        city,
        dealInfo: {
          ...dealInfo,
          purchasePrice,
          cashbackAmount,
          cashbackPercent: cashbackPercent * 100,
          isOntario: isOntarioDeal,
        },
      });
    },
    onSuccess: () => {
      toast({ title: "Cashback Request Submitted!", description: "We'll be in touch about your cashback offer." });
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="cashback">Estimated Cashback</Label>
        <div 
          className="h-12 pl-3 pr-1.5 font-mono flex items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors"
          onClick={() => setIsOpen(true)}
          data-testid="button-cashback-box"
        >
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            <span className="text-primary font-semibold">
              {formatCurrency(cashbackAmount)}
            </span>
          </div>
          <Button 
            size="sm" 
            className="text-xs h-8"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(true);
            }}
            data-testid="button-claim-cashback"
          >
            <Gift className="h-3 w-3 mr-1" />
            Claim
          </Button>
        </div>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              Claim Your {formatCurrency(cashbackAmount)} Cashback
            </DialogTitle>
            <DialogDescription>
              Get cashback when you purchase this property through our trusted partner network. 
              Complete the form below and we'll connect you with a local expert.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-primary/10 border border-primary/20 rounded-md p-3 mb-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Purchase Price</span>
              <span className="font-mono font-medium">{formatCurrency(purchasePrice)}</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-sm font-medium text-primary">Your Cashback ({(cashbackPercent * 100).toFixed(1)}% of commission)</span>
              <span className="font-mono font-bold text-primary">{formatCurrency(cashbackAmount)}</span>
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
                      <Input placeholder="John Smith" className="h-11" data-testid="input-cashback-name" {...field} />
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
                      <Input type="email" placeholder="john@example.com" className="h-11" data-testid="input-cashback-email" {...field} />
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
                      <Input type="tel" placeholder="(416) 555-0123" className="h-11" data-testid="input-cashback-phone" {...field} />
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
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-cashback-consent" />
                    </FormControl>
                    <FormLabel className="text-sm font-normal text-muted-foreground cursor-pointer">
                      I agree to receive communications about this cashback offer
                    </FormLabel>
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full h-11" disabled={mutation.isPending} data-testid="button-cashback-submit">
                {mutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Gift className="mr-2 h-4 w-4" />
                    Claim Cashback
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
