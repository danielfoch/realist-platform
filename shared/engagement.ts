export type RealistUserRole =
  | "investor"
  | "realtor"
  | "contractor"
  | "property_manager"
  | "lender"
  | "appraiser"
  | "inspector"
  | "lawyer"
  | "insurance_broker"
  | "admin";

export type DealNote = {
  id: string;
  listingId: string;
  userId?: string;
  userName?: string;
  userRole: RealistUserRole;
  visibility: "private" | "public" | "professional" | "admin" | "team";
  noteType:
    | "general"
    | "price_feedback"
    | "rent_feedback"
    | "repair_estimate"
    | "arv_feedback"
    | "risk_flag"
    | "offer_strategy"
    | "financing_note"
    | "inspection_note"
    | "comparable_note";
  comment: string;
  suggestedValue?: number;
  originalValue?: number;
  confidence?: number;
  physicallyInspected?: boolean;
  createdAt: string;
};

export type LeaderboardEntry = {
  userId: string;
  name: string;
  role: "investor" | "realtor" | "contractor" | "property_manager" | "lender" | "admin";
  market?: string;
  avatarUrl?: string;
  totalPoints: number;
  weeklyPoints: number;
  monthlyPoints: number;
  contributionCount: number;
  verifiedContributionCount: number;
  badges: string[];
  rank: number;
};

export type InvestorReputation = {
  userId: string;
  contributionScore: number;
  accuracyScore?: number;
  dealAnalysisScore: number;
  professionalTrustScore?: number;
  communityHelpfulness: number;
  verifiedProfessional: boolean;
  marketExpertise: string[];
  badges: string[];
};

export type DealPipelineStage =
  | "watching"
  | "needs_review"
  | "underwriting"
  | "due_diligence"
  | "offer_planned"
  | "offer_submitted"
  | "passed"
  | "closed_won"
  | "archived";

export type WatchlistDeal = {
  id: string;
  listingId: string;
  address: string;
  city: string;
  price: number;
  stage: DealPipelineStage;
  interestLevel: "low" | "medium" | "high";
  privateNote?: string;
  targetOfferPrice?: number;
  estimatedRent?: number;
  estimatedRepairBudget?: number;
  nextAction?: string;
  dueDate?: string;
  assignedProfessional?: string;
  confidenceScore?: number;
  riskScore?: number;
  savedAt: string;
};

export type ProfessionalRequest = {
  id: string;
  listingId?: string;
  dealId?: string;
  name: string;
  email: string;
  phone?: string;
  professionalType:
    | "contractor"
    | "realtor"
    | "property_manager"
    | "lender"
    | "inspector"
    | "insurance_broker"
    | "lawyer";
  market: string;
  requestedService: string;
  timeline?: string;
  message?: string;
  createdAt: string;
};

export type CrmWebhookPayload = {
  eventId: string;
  eventType: string;
  eventVersion: "1.0";
  source: "realist.ca";
  occurredAt: string;
  environment: "development" | "staging" | "production";
  actor?: {
    id?: string;
    name?: string;
    email?: string;
    role?: string;
  };
  recipient?: {
    id?: string;
    name?: string;
    email?: string;
    phone?: string;
  };
  listing?: {
    id?: string;
    address?: string;
    city?: string;
    province?: string;
    price?: number;
    url?: string;
  };
  deal?: {
    id?: string;
    score?: number;
    stage?: string;
    cashFlow?: number;
    capRate?: number;
    targetOfferPrice?: number;
  };
  professionalRequest?: {
    role?: string;
    market?: string;
    requestedService?: string;
    message?: string;
  };
  email?: {
    templateKey?: string;
    subject?: string;
    to?: string;
    replyTo?: string;
    tags?: string[];
  };
  metadata?: Record<string, unknown>;
};

export type RealistEvent = {
  id: string;
  type: string;
  source: "realist.ca";
  createdAt: string;
  actor?: {
    id?: string;
    role?: string;
    name?: string;
    email?: string;
  };
  target?: {
    type: "listing" | "deal" | "tool" | "professional" | "leaderboard" | "user";
    id?: string;
  };
  payload: Record<string, unknown>;
  trainingRelevance?: {
    canTrainModel: boolean;
    category?:
      | "underwriting"
      | "rent_estimation"
      | "repair_estimation"
      | "risk_detection"
      | "pricing"
      | "professional_matching"
      | "user_engagement";
    confidence?: number;
  };
};
