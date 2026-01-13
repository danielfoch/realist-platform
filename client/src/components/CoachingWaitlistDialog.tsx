import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Users, CheckCircle, Clock } from "lucide-react";

const waitlistSchema = z.object({
  fullName: z.string().min(2, "Please enter your full name"),
  email: z.string().email("Please enter a valid email"),
  phone: z.string().min(10, "Please enter a valid phone number"),
  mainProblem: z.string().min(20, "Please tell us more about what you're hoping to solve (at least 20 characters)"),
});

type WaitlistFormData = z.infer<typeof waitlistSchema>;

interface CoachingWaitlistDialogProps {
  trigger?: React.ReactNode;
  variant?: "default" | "outline" | "ghost";
  className?: string;
}

export function CoachingWaitlistDialog({ trigger, variant = "default", className }: CoachingWaitlistDialogProps) {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  const form = useForm<WaitlistFormData>({
    resolver: zodResolver(waitlistSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      mainProblem: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: WaitlistFormData) => {
      return apiRequest("POST", "/api/coaching-waitlist", data);
    },
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: () => {
      toast({
        title: "Something went wrong",
        description: "Please try again or contact us directly.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: WaitlistFormData) => {
    mutation.mutate(data);
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setTimeout(() => {
        setSubmitted(false);
        form.reset();
      }, 300);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant={variant} className={className} data-testid="button-join-waitlist">
            <Users className="h-4 w-4 mr-2" />
            Join Coaching Waitlist
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        {submitted ? (
          <div className="py-8 text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2" data-testid="text-waitlist-success">
              You're on the list!
            </h3>
            <p className="text-muted-foreground mb-6">
              We'll reach out when a spot opens. Keep an eye on your inbox.
            </p>
            <Button onClick={() => handleOpenChange(false)} data-testid="button-close-waitlist">
              Close
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Users className="h-5 w-5" />
                Join the Realist.ca Coaching Waitlist
              </DialogTitle>
              <DialogDescription className="pt-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Clock className="h-4 w-4" />
                  <span>Spots open monthly — limited availability</span>
                </div>
                Our coaching helps serious investors build wealth through real estate. Tell us about your goals and we'll reach out when there's an opening.
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Your full name" 
                          {...field} 
                          data-testid="input-waitlist-name"
                        />
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
                        <Input 
                          type="email" 
                          placeholder="you@example.com" 
                          {...field} 
                          data-testid="input-waitlist-email"
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
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input 
                          type="tel" 
                          placeholder="(555) 123-4567" 
                          {...field} 
                          data-testid="input-waitlist-phone"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="mainProblem"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-semibold">
                        What's the main problem you're hoping to fix with your real estate investing?
                      </FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Tell us about your current situation, challenges you're facing, and what success would look like for you..."
                          className="min-h-[120px] resize-none"
                          {...field} 
                          data-testid="input-waitlist-problem"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={mutation.isPending}
                  data-testid="button-submit-waitlist"
                >
                  {mutation.isPending ? "Submitting..." : "Join the Waitlist"}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  By joining, you agree to receive occasional updates about coaching availability.
                </p>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
