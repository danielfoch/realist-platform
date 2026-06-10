import { Link, useRoute } from "wouter";
import { CheckCircle2 } from "lucide-react";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function EventSuccess() {
  const [, params] = useRoute("/events/:slug/success");
  const slug = params?.slug || "";

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="mx-auto max-w-2xl px-4 py-16">
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
            <h1 className="mt-4 text-3xl font-bold tracking-tight">Payment received</h1>
            <p className="mt-3 text-muted-foreground">
              Your ticket is being fulfilled by Stripe webhook. Confirmation details will be sent by email.
            </p>
            <Button asChild className="mt-6">
              <Link href={`/events/${slug}`}>Back to event</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
