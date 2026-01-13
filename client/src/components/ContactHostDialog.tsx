import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Mail, User, Phone, MessageSquare, Loader2 } from "lucide-react";
import type { MeetupHost } from "@/lib/meetupHosts";

const contactHostSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email"),
  phone: z.string().min(10, "Please enter a valid phone number"),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

type ContactHostFormValues = z.infer<typeof contactHostSchema>;

interface ContactHostDialogProps {
  host: MeetupHost;
  eventName: string;
  eventId: string;
  children: React.ReactNode;
}

export function ContactHostDialog({ host, eventName, eventId, children }: ContactHostDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<ContactHostFormValues>({
    resolver: zodResolver(contactHostSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      message: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: ContactHostFormValues) => {
      return apiRequest("POST", "/api/events/contact-host", {
        ...data,
        name: `${data.firstName} ${data.lastName}`,
        hostId: host.id,
        hostEmail: host.email,
        hostName: host.name,
        eventName,
        eventId,
        city: host.city,
      });
    },
    onSuccess: () => {
      toast({
        title: "Message sent",
        description: `Your message has been sent to ${host.name}. They'll be in touch soon.`,
      });
      form.reset();
      setOpen(false);
    },
    onError: () => {
      toast({
        title: "Failed to send message",
        description: "Please try again or contact us directly.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ContactHostFormValues) => {
    mutation.mutate(data);
  };

  const initials = host.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md" data-testid="dialog-contact-host">
        <DialogHeader>
          <DialogTitle>Contact Meetup Host</DialogTitle>
          <DialogDescription>
            Send a message to the host of {eventName}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 mb-4">
          <Avatar className="h-12 w-12">
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold">{host.name}</p>
            {host.bio && (
              <p className="text-sm text-muted-foreground">{host.bio}</p>
            )}
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="John"
                          className="pl-10"
                          data-testid="input-contact-firstname"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Smith"
                        data-testid="input-contact-lastname"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="email"
                        placeholder="john@example.com"
                        className="pl-10"
                        data-testid="input-contact-email"
                        {...field}
                      />
                    </div>
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
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="tel"
                        placeholder="(416) 555-0123"
                        className="pl-10"
                        data-testid="input-contact-phone"
                        {...field}
                      />
                    </div>
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
                  <FormLabel>Message</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="I'd like to learn more about the meetup..."
                      className="min-h-[100px]"
                      data-testid="input-contact-message"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                className="flex-1"
                data-testid="button-contact-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending}
                className="flex-1 gap-2"
                data-testid="button-contact-submit"
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <MessageSquare className="h-4 w-4" />
                    Send Message
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
