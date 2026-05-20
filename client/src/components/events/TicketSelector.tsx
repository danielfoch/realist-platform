import { useState } from "react";
import { Loader2, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { RealistEventTicketType } from "./types";

function formatPrice(ticket: RealistEventTicketType) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: ticket.currency || "cad",
  }).format((ticket.priceCents || 0) / 100);
}

function remaining(ticket: RealistEventTicketType) {
  if (ticket.quantityTotal == null) return null;
  return Math.max(0, ticket.quantityTotal - (ticket.quantitySold || 0));
}

export function TicketSelector({ slug, tickets }: { slug: string; tickets: RealistEventTicketType[] }) {
  const activeTickets = tickets.filter((ticket) => ticket.isActive);
  const [ticketTypeId, setTicketTypeId] = useState(activeTickets[0]?.id || "");
  const [quantity, setQuantity] = useState("1");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const selected = activeTickets.find((ticket) => ticket.id === ticketTypeId);
  const selectedRemaining = selected ? remaining(selected) : 0;
  const soldOut = selectedRemaining === 0;

  async function checkout() {
    if (!selected?.id) return;
    setLoading(true);
    try {
      const response = await apiRequest("POST", `/api/events/${slug}/checkout`, {
        ticketTypeId: selected.id,
        quantity: Number(quantity),
      });
      const data = await response.json();
      if (data.url) window.location.href = data.url;
    } catch (error: any) {
      toast({
        title: "Checkout unavailable",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
      setLoading(false);
    }
  }

  if (activeTickets.length === 0) {
    return <div className="rounded-lg border p-5 text-sm text-muted-foreground">Tickets are not available yet.</div>;
  }

  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Ticket className="h-5 w-5" />
        <h2 className="text-lg font-semibold">Tickets</h2>
      </div>
      <div className="space-y-4">
        <Select value={ticketTypeId} onValueChange={setTicketTypeId}>
          <SelectTrigger>
            <SelectValue placeholder="Choose a ticket" />
          </SelectTrigger>
          <SelectContent>
            {activeTickets.map((ticket) => {
              const left = remaining(ticket);
              return (
                <SelectItem key={ticket.id} value={ticket.id || ""} disabled={left === 0}>
                  {ticket.name} · {formatPrice(ticket)}{left === 0 ? " · Sold out" : ""}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        {selected?.description && <p className="text-sm text-muted-foreground">{selected.description}</p>}
        <Select value={quantity} onValueChange={setQuantity}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: Math.min(10, selectedRemaining || 10) }, (_, i) => String(i + 1)).map((value) => (
              <SelectItem key={value} value={value}>{value}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button className="w-full" size="lg" onClick={checkout} disabled={loading || soldOut}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {soldOut ? "Sold out" : "Checkout"}
        </Button>
      </div>
    </div>
  );
}
