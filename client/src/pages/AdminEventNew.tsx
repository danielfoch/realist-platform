import { Navigation } from "@/components/Navigation";
import { EventForm } from "@/components/events/EventForm";

export default function AdminEventNew() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="mx-auto max-w-5xl px-4 py-8 md:px-6">
        <h1 className="mb-6 text-3xl font-bold tracking-tight">New event</h1>
        <EventForm />
      </main>
    </div>
  );
}
