import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";
import { Bell, Briefcase, MessageSquare, Search } from "lucide-react";
import { EXPERT_CATEGORY_LABELS, type ExpertCategory } from "@shared/contributorReputation";
import { Navigation } from "@/components/Navigation";
import { type PropertyQuestion } from "@/components/PropertyQuestionsPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";

const CATEGORY_OPTIONS: ExpertCategory[] = [
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

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
}

function snapshotText(snapshot: Record<string, unknown> | null): string | null {
  if (!snapshot) return null;
  if (typeof snapshot.address === "string" && snapshot.address) return snapshot.address;
  const parts = [snapshot.city, snapshot.province].filter((part): part is string => typeof part === "string" && Boolean(part));
  return parts.length ? parts.join(", ") : null;
}

export default function PropertyQuestions() {
  const [category, setCategory] = useState<string>("all");
  const query = category === "all" ? "" : `?category=${encodeURIComponent(category)}`;
  const { data, isLoading } = useQuery<{ questions: PropertyQuestion[] }>({
    queryKey: ["/api/community/questions", category],
    queryFn: async () => {
      const res = await fetch(`/api/community/questions${query}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load property questions");
      return res.json();
    },
    staleTime: 60_000,
  });

  const questions = data?.questions ?? [];
  const stats = useMemo(() => {
    const open = questions.filter((question) => question.questionStatus !== "resolved").length;
    const answered = questions.filter((question) => question.answerCount > 0).length;
    return { open, answered };
  }, [questions]);

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Open Property Questions | Realist.ca</title>
        <meta
          name="description"
          content="Outstanding real estate investor questions by property, routed to architects, planners, mortgage brokers, lawyers, realtors, and other Realist Power Team experts."
        />
      </Helmet>
      <Navigation />
      <main className="container mx-auto max-w-6xl px-4 py-8">
        <section className="mb-8 grid gap-6 lg:grid-cols-[1.7fr_1fr]">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border bg-cyan-50 px-3 py-1 text-sm font-medium text-cyan-800">
              <MessageSquare className="h-4 w-4" />
              Property Q&A
            </div>
            <h1 className="max-w-3xl text-4xl font-bold tracking-tight">
              Ask better deal questions. Let the right expert answer publicly.
            </h1>
            <p className="mt-4 max-w-3xl text-lg text-muted-foreground">
              Every question is tied to a listing and tagged by the expert lens needed: architecture, planning, mortgage, legal, tax, construction, inspection, appraisal, property management, or realtor context.
            </p>
          </div>
          <Card className="border-cyan-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-cyan-700" />
                For Power Team members
              </CardTitle>
              <CardDescription>
                Answer questions in your trade lane, prove expertise, and turn public help into business development.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="rounded-md bg-muted p-3">
                  <div className="text-2xl font-bold">{stats.open}</div>
                  <div className="text-xs text-muted-foreground">Outstanding</div>
                </div>
                <div className="rounded-md bg-muted p-3">
                  <div className="text-2xl font-bold">{stats.answered}</div>
                  <div className="text-xs text-muted-foreground">With answers</div>
                </div>
              </div>
              <Link href="/account/notifications">
                <Button variant="outline" className="w-full gap-2">
                  <Bell className="h-4 w-4" />
                  Manage question alerts
                </Button>
              </Link>
            </CardContent>
          </Card>
        </section>

        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Search className="h-4 w-4" />
            Filter outstanding questions by expert category.
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full sm:w-72">
              <SelectValue placeholder="All expert categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All expert categories</SelectItem>
              {CATEGORY_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>{EXPERT_CATEGORY_LABELS[option]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-4">
          {isLoading && <p className="text-sm text-muted-foreground">Loading questions...</p>}
          {!isLoading && questions.length === 0 && (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                No outstanding questions in this category yet.
              </CardContent>
            </Card>
          )}
          {questions.map((question) => (
            <Card key={question.id} id={`question-${question.id}`}>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={question.answerCount > 0 ? "secondary" : "default"}>
                    {question.answerCount > 0 ? `${question.answerCount} answer${question.answerCount === 1 ? "" : "s"}` : "Open"}
                  </Badge>
                  {question.requestedExpertLabels.map((label) => (
                    <Badge key={label} variant="outline">{label}</Badge>
                  ))}
                </div>
                <CardTitle className="text-xl">MLS {question.listingMlsNumber}</CardTitle>
                <CardDescription>
                  {snapshotText(question.listingSnapshot) || "Listing-linked question"} · Asked by {question.authorName} on {formatDate(question.createdAt)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="leading-7">{question.body}</p>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/listings/${encodeURIComponent(question.listingMlsNumber)}#questions`}>
                    <Button className="gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Answer on listing
                    </Button>
                  </Link>
                  <Link href="/power-team">
                    <Button variant="outline">Join the Power Team</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
