import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Navigation } from "@/components/Navigation";
import { EventForm } from "@/components/events/EventForm";
import type { RealistEventPayload } from "@/components/events/types";

export default function AdminEventEdit() {
  const [, params] = useRoute("/admin/events/:id/edit");
  const id = params?.id;
  const { data: event, isLoading, error } = useQuery<RealistEventPayload>({
    queryKey: [`/api/admin/events/${id}`],
    enabled: !!id,
    retry: false,
  });

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="mx-auto max-w-5xl px-4 py-8 md:px-6">
        <h1 className="mb-6 text-3xl font-bold tracking-tight">Edit event</h1>
        {isLoading && <p className="text-sm text-muted-foreground">Loading event...</p>}
        {error && <p className="text-sm text-destructive">Event not found or access denied.</p>}
        {event && <EventForm event={event} />}
      </main>
    </div>
  );
}
