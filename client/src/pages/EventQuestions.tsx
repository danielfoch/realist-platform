import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock3,
  Loader2,
  MessageCircle,
  Mic2,
  Monitor,
  Pin,
  ShieldCheck,
  X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import {
  EVENT_QA,
  type EventQaFeed,
  type EventQuestion,
  type QuestionStatus,
} from "@shared/eventQa";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { authPath } from "@/lib/authReturn";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/SEO";

type ModerationFeed = {
  isOpen: boolean;
  blockedWords: string[];
  defaultRejectedWords: string[];
  questions: EventQuestion[];
};
const draftKey = `realist-qa-draft:${EVENT_QA.slug}`;
const statusLabels = {
  pending: "Awaiting host review",
  approved: "Live",
  answered: "Answered",
  rejected: "Not published",
};
async function read<T>(url: string): Promise<T> {
  return (await apiRequest("GET", url)).json();
}

function Brand() {
  return (
    <Link href="/">
      <span className="text-2xl font-bold tracking-tight">
        realist<span className="text-[#ff3355]">.</span>
      </span>
    </Link>
  );
}

export default function EventQuestions() {
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(() => {
    try { return sessionStorage.getItem(draftKey) || ""; }
    catch { return ""; }
  });
  const [panel, setPanel] = useState<string>(EVENT_QA.panels[0]);
  const [filter, setFilter] = useState("All panels");
  const [sort, setSort] = useState("top");
  const [showAnswered, setShowAnswered] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const feed = useQuery<EventQaFeed>({
    queryKey: [EVENT_QA.api, user?.id || "guest"],
    queryFn: () => read(EVENT_QA.api),
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
  useEffect(() => {
    try { sessionStorage.setItem(draftKey, draft); }
    catch { /* The form still works when browser storage is unavailable. */ }
  }, [draft]);
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: [EVENT_QA.api] });
  const fail = (e: Error & { status?: number }) => {
    setError(e.message);
    if (e.status === 401)
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
  };
  const submit = useMutation({
    mutationFn: () =>
      apiRequest("POST", `${EVENT_QA.api}/questions`, { body: draft, panel }),
    onSuccess: () => {
      setDraft("");
      setError("");
      setMessage(
        "Question received. The host will review it before it appears in the live feed.",
      );
      refresh();
    },
    onError: fail,
  });
  const vote = useMutation({
    mutationFn: ({ id, value }: { id: string; value: number }) =>
      apiRequest("PUT", `${EVENT_QA.api}/questions/${id}/vote`, { value }),
    onSuccess: () => {
      setError("");
      refresh();
    },
    onError: fail,
  });
  const questions = (feed.data?.questions || [])
    .filter(
      (q) =>
        (showAnswered ? q.status === "answered" : q.status === "approved") &&
        (filter === "All panels" || q.panel === filter),
    )
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        (sort === "new"
          ? Date.parse(b.createdAt) - Date.parse(a.createdAt)
          : b.score - a.score ||
            Date.parse(a.createdAt) - Date.parse(b.createdAt)),
    );
  const paused = feed.data?.isOpen === false;

  return (
    <div className="min-h-screen bg-[#f8f9fb] text-[#0b0f19]">
      <SEO
        title="Live panel Q&A | Unpacking Multiplexes"
        description="Ask the panelists a question and vote on what you want to hear at Unpacking Multiplexes Toronto."
        canonicalUrl="/ask"
        noIndex
      />
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <Brand />
          <div className="flex items-center gap-4 text-sm">
            <Link
              href="/community/events/unpacking-multiplexes-toronto"
              className="hidden sm:block"
            >
              Event details ↗
            </Link>
            {user ? (
              <span className="flex items-center gap-1.5 text-slate-600">
                <CheckCircle2 size={16} /> Signed in
              </span>
            ) : (
              <Link href={authPath("/login", "/ask")} className="font-semibold">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>
      <section className="bg-[#0b0f19] text-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 md:grid-cols-[1fr_auto] md:py-16">
          <div>
            <div className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.18em] text-slate-300">
              <span
                className={`h-2 w-2 rounded-full ${paused ? "bg-amber-400" : "bg-[#ff3355]"}`}
              />{" "}
              {EVENT_QA.title} · Live Q&A
            </div>
            <h1 className="max-w-2xl text-4xl font-semibold leading-[1.08] tracking-tight md:text-6xl">
              Your questions.
              <br />
              <span className="text-[#ff3355]">On the panel.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300">
              Ask what matters to your next multiplex project.
              <br className="hidden sm:block" /> Vote on the questions you want
              the panelists to answer.
            </p>
          </div>
          <div className="hidden items-center gap-5 md:flex">
            <div className="rounded-xl bg-white p-3">
              <QRCodeSVG
                value="https://realist.ca/ask"
                size={112}
                level="M"
                marginSize={2}
              />
            </div>
            <div className="text-sm text-slate-300">
              Join from your phone
              <br />
              <strong className="mt-1 block text-lg text-white">
                realist.ca/ask
              </strong>
            </div>
          </div>
        </div>
      </section>
      <nav
        aria-label="Q&A sections"
        className="sticky top-0 z-20 flex border-b border-slate-200 bg-white lg:hidden"
      >
        <a
          href="#qa-feed"
          className="flex-1 px-5 py-3 text-center text-sm font-semibold"
        >
          Live questions ↓
        </a>
        <a
          href="#qa-compose"
          className="flex-1 border-l border-slate-200 px-5 py-3 text-center text-sm font-semibold text-[#ce183a]"
        >
          Ask a question ↓
        </a>
      </nav>
      <main className="mx-auto grid max-w-6xl gap-8 px-5 py-8 lg:grid-cols-[340px_1fr]">
        <aside id="qa-compose" className="scroll-mt-20">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <Mic2 className="mb-4 text-[#e82447]" size={24} />
            <h2 className="text-xl font-semibold">Ask the panelists</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Keep it focused. One question per post. Approved questions appear
              anonymously.
            </p>
            {paused && (
              <p
                role="status"
                className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"
              >
                The host has paused questions and voting.
              </p>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setMessage("");
                setError("");
                submit.mutate();
              }}
              className="mt-5 space-y-4"
            >
              <div>
                <label
                  htmlFor="qa-panel"
                  className="mb-2 block text-sm font-medium"
                >
                  For which panel?
                </label>
                <select
                  id="qa-panel"
                  value={panel}
                  onChange={(e) => setPanel(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm"
                >
                  {EVENT_QA.panels.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="qa-question"
                  className="mb-2 block text-sm font-medium"
                >
                  Your question
                </label>
                <textarea
                  id="qa-question"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  minLength={10}
                  maxLength={500}
                  rows={5}
                  placeholder="What would you like to ask about building, financing or operating a multiplex?"
                  className="w-full resize-y rounded-lg border border-slate-300 bg-white p-3 text-base leading-6 focus:border-[#e82447] focus:outline-none focus:ring-2 focus:ring-[#ff3355]/20"
                />
                <p className="mt-1 text-right text-xs text-slate-500">
                  {draft.length}/500
                </p>
              </div>
              {user ? (
                <Button
                  type="submit"
                  disabled={
                    paused ||
                    !feed.data ||
                    submit.isPending ||
                    draft.trim().length < 10
                  }
                  className="w-full bg-[#e82447] text-white hover:bg-[#ce183a]"
                >
                  {submit.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowUpRight className="mr-2 h-4 w-4" />
                  )}
                  Submit question
                </Button>
              ) : (
                <div>
                  <Button
                    asChild
                    className="w-full bg-[#e82447] text-white hover:bg-[#ce183a]"
                  >
                    <Link href={authPath("/create-account", "/ask")}>
                      {authLoading
                        ? "Checking account…"
                        : "Create a free account"}
                    </Link>
                  </Button>
                  <p className="mt-3 text-center text-sm text-slate-600">
                    To ask questions and vote.{" "}
                    <Link
                      href={authPath("/login", "/ask")}
                      className="font-semibold underline"
                    >
                      Sign in
                    </Link>
                  </p>
                </div>
              )}
            </form>
            <div className="mt-5 flex gap-2 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              Questions are screened for inappropriate language and reviewed by
              the host before going live.
            </div>
          </section>
          {submit.isError && error && (
            <p
              role="alert"
              className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
            >
              {error}
            </p>
          )}
          {message && (
            <p
              role="status"
              className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
            >
              {message}
            </p>
          )}
          {feed.data?.mine.some(
            (q) => q.status === "pending" || q.status === "rejected",
          ) && (
            <section className="mt-6">
              <h2 className="mb-3 text-sm font-semibold">Your submissions</h2>
              {feed.data.mine
                .filter(
                  (q) => q.status === "pending" || q.status === "rejected",
                )
                .slice(0, 5)
                .map((q) => (
                  <div
                    key={q.id}
                    className="mb-2 rounded-xl border border-slate-200 bg-white p-4"
                  >
                    <p className="text-sm break-words">{q.body}</p>
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                      <Clock3 size={12} />
                      {statusLabels[q.status]} · Only visible to you and hosts
                    </p>
                  </div>
                ))}
            </section>
          )}
          {feed.data?.canModerate && (
            <Link
              href="/ask/moderate"
              className="mt-5 flex items-center gap-2 text-sm font-semibold"
            >
              <ShieldCheck size={18} /> Open host moderation{" "}
              <ArrowUpRight size={16} />
            </Link>
          )}
        </aside>
        <section
          id="qa-feed"
          className="scroll-mt-20"
          aria-label="Live questions"
        >
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold tracking-tight">
              The room is asking<span className="text-[#e82447]">.</span>
            </h2>
            <span
              role="status"
              className={`text-xs ${feed.isError ? "text-amber-700" : "text-slate-500"}`}
            >
              {feed.isError
                ? "Connection interrupted · retrying"
                : "Updates every 3 seconds"}
            </span>
          </div>
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowAnswered(false)}
              aria-pressed={!showAnswered}
              className={`rounded-full px-4 py-2 text-sm font-medium ${!showAnswered ? "bg-[#0b0f19] text-white" : "bg-white text-slate-600"}`}
            >
              Open questions
            </button>
            <button
              onClick={() => setShowAnswered(true)}
              aria-pressed={showAnswered}
              className={`rounded-full px-4 py-2 text-sm font-medium ${showAnswered ? "bg-[#0b0f19] text-white" : "bg-white text-slate-600"}`}
            >
              Answered
            </button>
            <select
              aria-label="Filter by panel"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="min-w-0 rounded-lg border border-slate-200 bg-white p-2 text-sm"
            >
              <option>All panels</option>
              {EVENT_QA.panels.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <select
              aria-label="Sort questions"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white p-2 text-sm"
            >
              <option value="top">Top voted</option>
              <option value="new">Newest</option>
            </select>
          </div>
          {vote.isError && error && (
            <p
              role="alert"
              className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
            >
              {error}
            </p>
          )}
          {feed.isError && (
            <p
              role="alert"
              className="mb-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900"
            >
              We couldn’t refresh the feed. Check your connection.{" "}
              <button
                onClick={() => feed.refetch()}
                className="font-semibold underline"
              >
                Retry now
              </button>
            </p>
          )}
          {feed.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
              <Loader2 className="animate-spin" size={20} />
              Loading questions…
            </div>
          ) : questions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
              <MessageCircle
                className="mx-auto mb-4 text-slate-300"
                size={40}
              />
              <h3 className="text-lg font-semibold">
                {showAnswered
                  ? "The conversation is just getting started."
                  : "What should we unpack first?"}
              </h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
                {showAnswered
                  ? "Questions marked answered by the host will appear here."
                  : "Submit a question or check back as the host approves questions from the room."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {questions.map((q) => (
                <article
                  key={q.id}
                  className={`flex gap-4 rounded-2xl border bg-white p-5 shadow-sm ${q.pinned ? "border-[#ff3355]/60" : "border-slate-200"}`}
                >
                  <div className="flex w-12 shrink-0 flex-col items-center gap-1">
                    {([1, -1] as const).map((value) => (
                      <div key={value} className="contents">
                        {value === -1 && (
                          <span
                            aria-label={`Score ${q.score}`}
                            className="py-1 text-xl font-semibold tabular-nums"
                          >
                            {q.score}
                          </span>
                        )}
                        {user ? (
                          <button
                            aria-label={
                              value === 1
                                ? "Upvote question"
                                : "Downvote question"
                            }
                            aria-pressed={q.myVote === value}
                            disabled={
                              paused ||
                              q.status !== "approved" ||
                              vote.isPending
                            }
                            onClick={() =>
                              vote.mutate({
                                id: q.id,
                                value: q.myVote === value ? 0 : value,
                              })
                            }
                            className={`flex h-11 w-11 items-center justify-center rounded-lg border disabled:opacity-40 ${q.myVote === value ? "border-[#e82447] bg-rose-50 text-[#ce183a]" : "border-slate-200 text-slate-600 hover:bg-slate-100"}`}
                          >
                            {value === 1 ? (
                              <ArrowUp size={20} />
                            ) : (
                              <ArrowDown size={20} />
                            )}
                          </button>
                        ) : (
                          <Link
                            href={authPath("/create-account", "/ask")}
                            aria-label={
                              value === 1
                                ? "Create an account to upvote"
                                : "Create an account to downvote"
                            }
                            className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-500"
                          >
                            {value === 1 ? (
                              <ArrowUp size={20} />
                            ) : (
                              <ArrowDown size={20} />
                            )}
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1">
                        {q.panel}
                      </span>
                      {q.pinned && (
                        <span className="flex items-center gap-1 font-semibold text-[#ce183a]">
                          <Pin size={12} />
                          On the panel now
                        </span>
                      )}
                      {q.status === "answered" && (
                        <span className="flex items-center gap-1 text-emerald-700">
                          <Check size={13} />
                          Answered
                        </span>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap break-words text-lg font-medium leading-relaxed">
                      {q.body}
                    </p>
                    <p className="mt-4 text-xs text-slate-400">
                      {q.upvotes} up · {q.downvotes} down
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export function EventQuestionScreen() {
  const feed = useQuery<{ isOpen: boolean; questions: EventQuestion[] }>({
    queryKey: [EVENT_QA.api, "screen"],
    queryFn: () => read(`${EVENT_QA.api}/screen`),
    refetchInterval: 3000,
    refetchIntervalInBackground: true,
    staleTime: 0,
  });
  // Hide stale content on a failed refresh; a question may have just been removed.
  const questions = feed.isError ? [] : feed.data?.questions || [];
  const pinned = questions.find((q) => q.pinned);
  return (
    <div className="min-h-screen bg-[#0b0f19] p-8 text-white md:p-12">
      <SEO
        title="Panel Q&A screen | Realist"
        description="Live approved audience questions."
        noIndex
      />
      <header className="flex items-center justify-between gap-6 border-b border-white/15 pb-7">
        <Brand />
        <span className="text-sm tracking-wide text-slate-400">
          {EVENT_QA.title}
        </span>
        <span className="flex items-center gap-2 text-sm">
          <span
            className={`h-2 w-2 rounded-full ${feed.isError ? "bg-amber-400" : "bg-[#ff3355]"}`}
          />
          {feed.isError
            ? "Reconnecting…"
            : feed.data?.isOpen === false
              ? "Questions paused"
              : "Audience Q&A"}
        </span>
      </header>
      <main className="grid gap-10 py-10 md:grid-cols-[1fr_240px]">
        <div>
          <p className="mb-6 text-sm font-semibold uppercase tracking-[.2em] text-[#ff6680]">
            {pinned ? "On the panel now" : "Top question from the room"}
          </p>
          {questions.length ? (
            (pinned ? [pinned] : questions.slice(0, 1)).map((q) => (
              <article
                key={q.id}
                className="mb-6 border-b border-white/10 pb-7"
              >
                <div className="mb-3 flex gap-4 text-sm text-slate-400">
                  <span>{q.panel}</span>
                  <span>{q.score} votes</span>
                </div>
                <p
                  className={`break-words font-medium leading-tight tracking-tight ${q.body.length > 300 ? "text-[clamp(1.5rem,2.5vw,2.6rem)]" : "text-[clamp(1.7rem,3.5vw,3.5rem)]"}`}
                >
                  {q.body}
                </p>
              </article>
            ))
          ) : (
            <div className="py-10">
              <h1 className="text-5xl font-semibold leading-tight tracking-tight md:text-7xl">
                Your questions.
                <br />
                <span className="text-[#ff3355]">On the panel.</span>
              </h1>
              <p className="mt-8 text-xl text-slate-300">
                {feed.isError
                  ? "Reconnecting to the live feed."
                  : "Scan the code. Ask a question. Vote on what comes next."}
              </p>
            </div>
          )}
        </div>
        <aside className="self-start rounded-2xl bg-white p-6 text-[#0b0f19]">
          <QRCodeSVG
            value="https://realist.ca/ask"
            size={192}
            className="h-auto w-full"
            level="M"
            marginSize={2}
          />
          <p className="mt-5 text-center text-2xl font-bold tracking-tight">
            realist.ca/ask
          </p>
          <p className="mt-3 text-center text-sm leading-6 text-slate-500">
            Create a free account
            <br />
            to ask questions and vote.
          </p>
        </aside>
      </main>
    </div>
  );
}

export function EventQuestionModeration() {
  const { user, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<QuestionStatus>("pending");
  const [wordDraft, setWordDraft] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const feed = useQuery<ModerationFeed>({
    queryKey: [EVENT_QA.api, "moderation", user?.id],
    queryFn: () => read(`${EVENT_QA.api}/moderation`),
    enabled: !!user,
    refetchInterval: 3000,
    staleTime: 0,
    retry: false,
  });
  const change = useMutation({
    mutationFn: ({
      id,
      status,
      pinned = false,
    }: {
      id: string;
      status: QuestionStatus;
      pinned?: boolean;
    }) =>
      apiRequest("PATCH", `${EVENT_QA.api}/questions/${id}/moderation`, {
        status,
        pinned,
      }),
    onSuccess: () => {
      setNotice("Question updated.");
      queryClient.invalidateQueries({ queryKey: [EVENT_QA.api] });
    },
    onError: (e: Error) => setNotice(e.message),
  });
  const settings = useMutation({
    mutationFn: ({
      isOpen,
      saveWords = false,
    }: {
      isOpen: boolean;
      saveWords?: boolean;
    }) =>
      apiRequest("PUT", `${EVENT_QA.api}/settings`, {
        isOpen,
        blockedWords: saveWords
          ? (wordDraft ?? "")
              .split("\n")
              .map((w) => w.trim())
              .filter(Boolean)
          : feed.data?.blockedWords || [],
      }),
    onSuccess: () => {
      setWordDraft(null);
      setNotice("Settings saved.");
      queryClient.invalidateQueries({ queryKey: [EVENT_QA.api] });
    },
    onError: (e: Error) => setNotice(e.message),
  });
  return (
    <div className="min-h-screen bg-[#f8f9fb] px-5 py-8 text-[#0b0f19]">
      <SEO
        title="Host moderation | Realist"
        description="Review live event questions."
        noIndex
      />
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <Brand />
          <div className="flex gap-5 text-sm">
            <Link href="/ask">Audience feed</Link>
            <a
              href="/ask/screen"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2"
            >
              <Monitor size={16} />
              Open projector
            </a>
          </div>
        </header>
        <h1 className="text-3xl font-semibold tracking-tight">
          Host moderation
        </h1>
        <p className="mt-2 text-slate-500">
          {EVENT_QA.title} · Approve questions before they reach the room.
        </p>
        {isLoading || (feed.isLoading && user) ? (
          <p className="py-12">Loading…</p>
        ) : !user ? (
          <div className="py-10">
            <Button asChild>
              <Link href={authPath("/login", "/ask/moderate")}>
                Sign in as an event host
              </Link>
            </Button>
          </div>
        ) : feed.isError ? (
          <p role="alert" className="mt-8 rounded-xl bg-white p-6">
            {feed.error.message}{" "}
            <button className="underline" onClick={() => feed.refetch()}>
              Try again
            </button>
          </p>
        ) : (
          feed.data && (
            <>
              {notice && (
                <p
                  role="status"
                  className="my-4 rounded-lg bg-white p-4 text-sm"
                >
                  {notice}
                </p>
              )}
              <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_300px]">
                <section>
                  <div className="mb-5 flex flex-wrap gap-2">
                    {(
                      ["pending", "approved", "answered", "rejected"] as const
                    ).map((s) => (
                      <button
                        key={s}
                        aria-pressed={s === tab}
                        onClick={() => setTab(s)}
                        className={`rounded-full px-4 py-2 text-sm ${s === tab ? "bg-[#0b0f19] text-white" : "bg-white"}`}
                      >
                        {s === "pending"
                          ? "Review queue"
                          : s === "approved"
                            ? "Live"
                            : s === "answered"
                              ? "Answered"
                              : "Rejected"}{" "}
                        (
                        {
                          feed.data.questions.filter((q) => q.status === s)
                            .length
                        }
                        )
                      </button>
                    ))}
                  </div>
                  {feed.data.questions.filter((q) => q.status === tab)
                    .length === 0 && (
                    <p className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
                      No questions here.
                    </p>
                  )}
                  {feed.data.questions
                    .filter((q) => q.status === tab)
                    .map((q) => (
                      <article
                        key={q.id}
                        className="mb-3 rounded-xl border border-slate-200 bg-white p-5"
                      >
                        <div className="mb-3 flex justify-between text-xs text-slate-500">
                          <span>
                            {q.panel} ·{" "}
                            {new Date(q.createdAt).toLocaleTimeString([], {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </span>
                          <span>
                            {q.score} votes {q.pinned && "· Featured"}
                          </span>
                        </div>
                        <p className="break-words text-lg leading-relaxed">
                          {q.body}
                        </p>
                        <div className="mt-5 flex flex-wrap gap-2">
                          {q.status !== "approved" && (
                            <Button
                              size="sm"
                              disabled={change.isPending}
                              onClick={() =>
                                change.mutate({ id: q.id, status: "approved" })
                              }
                            >
                              <Check size={16} className="mr-1" />
                              Approve
                            </Button>
                          )}
                          {q.status === "approved" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={change.isPending}
                                onClick={() =>
                                  change.mutate({
                                    id: q.id,
                                    status: "approved",
                                    pinned: !q.pinned,
                                  })
                                }
                              >
                                <Pin size={16} className="mr-1" />
                                {q.pinned ? "Unfeature" : "Feature on screen"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={change.isPending}
                                onClick={() =>
                                  change.mutate({
                                    id: q.id,
                                    status: "answered",
                                  })
                                }
                              >
                                Mark answered
                              </Button>
                            </>
                          )}
                          {q.status !== "rejected" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-700"
                              disabled={change.isPending}
                              onClick={() =>
                                change.mutate({ id: q.id, status: "rejected" })
                              }
                            >
                              <X size={16} className="mr-1" />
                              {q.status === "pending"
                                ? "Reject"
                                : "Hide / reject"}
                            </Button>
                          )}
                        </div>
                      </article>
                    ))}
                </section>
                <aside className="space-y-5">
                  <section className="rounded-xl border border-slate-200 bg-white p-5">
                    <h2 className="font-semibold">Participation</h2>
                    <p className="my-3 text-sm text-slate-500">
                      Questions and voting are{" "}
                      {feed.data.isOpen ? "open" : "paused"}. Review and
                      projector controls remain available.
                    </p>
                    <Button
                      variant="outline"
                      disabled={settings.isPending}
                      onClick={() =>
                        settings.mutate({ isOpen: !feed.data!.isOpen })
                      }
                    >
                      {feed.data.isOpen
                        ? "Pause questions & voting"
                        : "Open questions & voting"}
                    </Button>
                  </section>
                  <section className="rounded-xl border border-slate-200 bg-white p-5">
                    <h2 className="font-semibold">Rejected words</h2>
                    <p className="my-3 text-sm leading-6 text-slate-500">
                      The built-in list blocks profanity and slurs, including
                      common disguised spellings. Host review catches what a
                      word list misses.
                    </p>
                    <details className="my-4 text-sm">
                      <summary className="cursor-pointer font-medium">
                        View built-in list (
                        {feed.data.defaultRejectedWords.length})
                      </summary>
                      <p className="mt-3 break-words leading-6 text-slate-500">
                        {feed.data.defaultRejectedWords.join(", ")}
                      </p>
                    </details>
                    <label
                      htmlFor="qa-blocked"
                      className="mb-2 block text-sm font-medium"
                    >
                      Additional rejected words / phrases
                    </label>
                    <textarea
                      id="qa-blocked"
                      rows={6}
                      value={wordDraft ?? feed.data.blockedWords.join("\n")}
                      onChange={(e) => setWordDraft(e.target.value)}
                      placeholder="One word or phrase per line"
                      className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm"
                    />
                    <p className="my-3 text-xs leading-5 text-slate-500">
                      Up to 250 entries. New matches are removed from the live
                      feed and returned to review.
                    </p>
                    <Button
                      disabled={settings.isPending || wordDraft === null}
                      onClick={() =>
                        settings.mutate({
                          isOpen: feed.data!.isOpen,
                          saveWords: true,
                        })
                      }
                    >
                      Save rejected words
                    </Button>
                  </section>
                </aside>
              </div>
            </>
          )
        )}
      </div>
    </div>
  );
}
