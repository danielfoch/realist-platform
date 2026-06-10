import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Navigation } from "@/components/Navigation";
import { EventPageTemplate } from "@/components/events/EventPageTemplate";
import type { RealistEventPayload } from "@/components/events/types";

export default function EventDetail() {
  const [, params] = useRoute("/events/:slug");
  const slug = params?.slug;
  const { data: event, isLoading, error } = useQuery<RealistEventPayload>({
    queryKey: [`/api/events/${slug}`],
    enabled: !!slug,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="mx-auto max-w-4xl px-4 py-16 text-muted-foreground">Loading event...</main>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="mx-auto max-w-4xl px-4 py-16">
          <h1 className="text-3xl font-bold">Event not found</h1>
          <p className="mt-2 text-muted-foreground">This event is unavailable or has not been published.</p>
        </main>
      </div>
    );
  }

  return <EventPageTemplate event={event} />;
}
