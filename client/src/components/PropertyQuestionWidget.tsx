import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { MessageSquarePlus, Send } from "lucide-react";
import { useLocation } from "wouter";
import { EXPERT_CATEGORY_LABELS, type ExpertCategory } from "@shared/contributorReputation";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { authPath } from "@/lib/authReturn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const ASKABLE_CATEGORIES: ExpertCategory[] = [
  "architecture",
  "urban_planning",
  "mortgage",
  "legal",
  "accounting_tax",
  "property_management",
  "construction",
  "appraisal",
  "inspection",
  "realtor",
];

interface PropertyQuestionWidgetProps {
  listingMlsNumber: string;
  listingSnapshot?: Record<string, unknown>;
  buttonLabel?: string;
  compact?: boolean;
}

export function PropertyQuestionWidget({
  listingMlsNumber,
  listingSnapshot,
  buttonLabel = "Ask a question",
  compact = false,
}: PropertyQuestionWidgetProps) {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [categories, setCategories] = useState<ExpertCategory[]>(["realtor"]);

  const categoryBadges = useMemo(
    () => categories.map((category) => EXPERT_CATEGORY_LABELS[category]).join(", "),
    [categories],
  );

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/community/questions", {
        listingMlsNumber,
        body,
        requestedExpertCategories: categories,
        listingSnapshot,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Question posted", description: "Experts can now answer it publicly." });
      queryClient.invalidateQueries({ queryKey: ["/api/community/questions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/community/questions", listingMlsNumber] });
      setBody("");
      setOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Could not post question", description: error?.message || "Try again.", variant: "destructive" });
    },
  });

  const toggleCategory = (category: ExpertCategory, checked: boolean) => {
    setCategories((current) => {
      if (checked) return Array.from(new Set([...current, category])).slice(0, 6);
      return current.filter((item) => item !== category);
    });
  };

  const submit = () => {
    if (!isAuthenticated) {
      setLocation(authPath("/login"));
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size={compact ? "sm" : "default"} variant={compact ? "outline" : "default"} className={compact ? "h-8 w-full gap-2" : "gap-2"}>
          <MessageSquarePlus className="h-4 w-4" />
          {buttonLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Ask a public question about this property</DialogTitle>
          <DialogDescription>
            Tag the expert lanes you want. The question appears publicly so architects, planners, lenders, lawyers, realtors, and other Power Team members can answer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <div className="font-medium">MLS {listingMlsNumber}</div>
            {typeof listingSnapshot?.address === "string" && (
              <div className="text-muted-foreground">{listingSnapshot.address}</div>
            )}
          </div>

          <Textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Example: Can this lot support a garden suite, and what would a planner or architect check first?"
            className="min-h-32"
          />

          <div>
            <div className="mb-2 text-sm font-medium">Ask these experts to weigh in</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {ASKABLE_CATEGORIES.map((category) => (
                <label key={category} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                  <Checkbox
                    checked={categories.includes(category)}
                    onCheckedChange={(checked) => toggleCategory(category, checked === true)}
                  />
                  <span>{EXPERT_CATEGORY_LABELS[category]}</span>
                </label>
              ))}
            </div>
          </div>

          {categoryBadges && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              Tagged:
              {categories.map((category) => (
                <Badge key={category} variant="secondary">{EXPERT_CATEGORY_LABELS[category]}</Badge>
              ))}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={body.trim().length < 8 || mutation.isPending} className="gap-2">
              <Send className="h-4 w-4" />
              {mutation.isPending ? "Posting..." : "Post question"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
