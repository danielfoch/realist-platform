export const EVENT_QA = {
  slug: "unpacking-multiplexes-toronto-2026",
  title: "Unpacking Multiplexes Toronto",
  date: "September 15, 2026",
  path: "/ask",
  api: "/api/event-qa/unpacking-multiplexes-toronto-2026",
  panels: [
    "Any panel",
    "Economics & policy",
    "Finance",
    "Design & development",
    "Operations",
  ],
} as const;

export type QuestionStatus = "pending" | "approved" | "answered" | "rejected";
export interface EventQuestion {
  id: string;
  body: string;
  panel: string;
  status: QuestionStatus;
  pinned: boolean;
  createdAt: string;
  score: number;
  upvotes: number;
  downvotes: number;
  myVote: -1 | 0 | 1;
}
export interface EventQaFeed {
  isOpen: boolean;
  questions: EventQuestion[];
  mine: EventQuestion[];
  canModerate: boolean;
}
