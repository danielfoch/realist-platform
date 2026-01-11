import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { Percent, Loader2 } from "lucide-react";

const mortgageFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email"),
  phone: z.string().min(10, "Please enter a valid phone number"),
});

type MortgageFormData = z.infer<typeof mortgageFormSchema>;

interface MortgageConsultationButtonProps {
  purchasePrice: number;
  downPaymentPercent: number;
  interestRate: number;
  region?: string;
  city?: string;
  address?: string;
  defaultValues?: {
    name?: string;
    email?: string;
    phone?: string;
  };
}

export function MortgageConsultationButton({
  purchasePrice,
  downPaymentPercent,
  interestRate,
  region,
  city,
  address,
  defaultValues,
}: MortgageConsultationButtonProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<MortgageFormData>({
    resolver: zodResolver(mortgageFormSchema),
    defaultValues: {
      name: defaultValues?.name || "",
      email: defaultValues?.email || "",
      phone: defaultValues?.phone || "",
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (data: MortgageFormData) => {
      const loanAmount = purchasePrice * (1 - downPaymentPercent / 100);
      return apiRequest("POST", "/api/leads/engage", {
        ...data,
        formType: "Mortgage Consultation",
        formTag: "mortgage_rate_request",
        tags: ["mortgage_consultation", "rate_request"],
        province: region,
        city,
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
        title: "Request Submitted",
        description: "A mortgage specialist will contact you shortly with the best rates available.",
      });
      setOpen(false);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Submission Failed",
        description: "Please try again or contact us directly.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: MortgageFormData) => {
    submitMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="destructive"
          size="sm"
          className="gap-1.5 text-xs whitespace-nowrap"
          data-testid="button-get-best-rate"
        >
          <Percent className="h-3 w-3" />
          Get Best Rate
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request a Mortgage Consultation</DialogTitle>
          <DialogDescription>
            Our mortgage specialists will find you the best rate for this deal.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted/50 rounded-lg p-3 mb-4">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Purchase Price:</span>
              <span className="font-mono ml-2">${purchasePrice.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Down Payment:</span>
              <span className="font-mono ml-2">{downPaymentPercent}%</span>
            </div>
            <div>
              <span className="text-muted-foreground">Loan Amount:</span>
              <span className="font-mono ml-2">
                ${(purchasePrice * (1 - downPaymentPercent / 100)).toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Current Rate:</span>
              <span className="font-mono ml-2">{interestRate}%</span>
            </div>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Smith" {...field} data-testid="input-mortgage-name" />
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
                    <Input type="email" placeholder="john@example.com" {...field} data-testid="input-mortgage-email" />
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
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder="(416) 555-0123" {...field} data-testid="input-mortgage-phone" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full"
              disabled={submitMutation.isPending}
              data-testid="button-submit-mortgage"
            >
              {submitMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Submitting...
                </>
              ) : (
                "Get My Best Rate"
              )}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
