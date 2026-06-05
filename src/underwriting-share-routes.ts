import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import { db as defaultDb } from './db';
import { authenticateOptional, authenticateToken, AuthRequest } from './auth-middleware';

export type QualifiedShareAction = 'unique_open' | 'challenge' | 'fork' | 'signup' | 'saved_version';

type DatabaseAdapter = {
  query: (text: string, params?: readonly unknown[]) => Promise<{ rows: any[]; rowCount?: number | null }>;
};

interface QualifiedActionPolicy {
  creditAmount: number;
  dailyShareCap: number;
  dailyRecipientCap: number;
}

type QualifiedActionCatalogItem = QualifiedActionPolicy & {
  action: QualifiedShareAction;
  qualifiesWhen: string;
  recipientPrompt: string;
  ownerPrompt: string;
  antiAbuseRule: string;
};

type QualifiedActionProofGuideItem = {
  action: QualifiedShareAction;
  creditAmount: number;
  requiredEvidence: string[];
  acceptedMetadataKeys: string[];
  sampleMetadata: Record<string, unknown>;
  qualificationCopy: string;
  antiAbuseGuardrail: string;
};

const ACTION_POLICIES: Record<QualifiedShareAction, QualifiedActionPolicy> = {
  unique_open: { creditAmount: 1, dailyShareCap: 5, dailyRecipientCap: 1 },
  challenge: { creditAmount: 2, dailyShareCap: 8, dailyRecipientCap: 2 },
  fork: { creditAmount: 3, dailyShareCap: 8, dailyRecipientCap: 2 },
  signup: { creditAmount: 5, dailyShareCap: 5, dailyRecipientCap: 1 },
  saved_version: { creditAmount: 4, dailyShareCap: 8, dailyRecipientCap: 2 },
};

const QUALIFIED_ACTIONS: QualifiedShareAction[] = [
  'unique_open',
  'challenge',
  'fork',
  'signup',
  'saved_version',
];

const GOOGLE_SHEETS_EXPORT_CREDIT_TYPE = 'google_sheets_export';

const ACTION_CATALOG_COPY: Record<QualifiedShareAction, Omit<QualifiedActionCatalogItem, keyof QualifiedActionPolicy | 'action'>> = {
  unique_open: {
    qualifiesWhen: 'A distinct recipient opens a tracked underwriting link for the first time today within caps.',
    recipientPrompt: 'Open the deal, then challenge one assumption instead of just clicking through.',
    ownerPrompt: 'Send recipient-specific links so unique opens can be attributed without exposing raw recipient identity.',
    antiAbuseRule: 'Duplicate opens from the same recipient/share/action are ignored; daily share and recipient caps still apply.',
  },
  challenge: {
    qualifiesWhen: 'The recipient submits a specific disagreement: changed fields, assumptions, metrics, inputs, notes, or a 10+ character comment.',
    recipientPrompt: 'Challenge my underwriting — rent, vacancy, expenses, or exit cap: pick one number you would change.',
    ownerPrompt: 'Ask opened recipients for one concrete assumption challenge, not a generic opinion.',
    antiAbuseRule: 'Credits require meaningful challenge evidence and are capped by share and recipient per day.',
  },
  fork: {
    qualifiesWhen: 'The recipient forks the analysis with changed assumptions or metrics that create a comparison version.',
    recipientPrompt: 'Fork my underwriting with your assumptions so we can compare versions side by side.',
    ownerPrompt: 'Push strong challengers to fork the deal so their version can be shared onward.',
    antiAbuseRule: 'Fork credits require changed underwriting payloads and only the first qualifying recipient/share/action counts.',
  },
  signup: {
    qualifiesWhen: 'The recipient creates or associates an account after engaging with the shared underwriting.',
    recipientPrompt: 'Create an account to keep your challenged version and share it onward.',
    ownerPrompt: 'Convert people who saved or forked versions into accounts so the loop can continue.',
    antiAbuseRule: 'Signup credits are limited by recipient and share daily caps; repeated signups from the same recipient are duplicates.',
  },
  saved_version: {
    qualifiesWhen: 'The recipient saves a version with changed assumptions, metrics, inputs, notes, or challenged fields.',
    recipientPrompt: 'Save your version after changing the assumptions you disagree with.',
    ownerPrompt: 'Ask challengers to save their version so it can become the next shareable underwriting artifact.',
    antiAbuseRule: 'Saved-version credits require a meaningful changed payload and are capped per share and recipient.',
  },
};


const ACTION_PROOF_GUIDE: Record<QualifiedShareAction, Omit<QualifiedActionProofGuideItem, 'action' | 'creditAmount' | 'antiAbuseGuardrail'>> = {
  unique_open: {
    requiredEvidence: ['A recipient-specific share URL or a distinct anonymous visitor fingerprint opens the underwriting page.'],
    acceptedMetadataKeys: ['referrer'],
    sampleMetadata: { referrer: 'https://example.com/investor-thread' },
    qualificationCopy: 'A unique open is recorded automatically on the tracked underwriting link; it is capped and deduped per recipient.',
  },
  challenge: {
    requiredEvidence: ['At least one changed/challenged assumption or a clear 10+ character disagreement comment.'],
    acceptedMetadataKeys: ['challengedFields', 'assumptions', 'inputs', 'metrics', 'comment', 'notes'],
    sampleMetadata: { challengedFields: ['rent', 'vacancy'], comment: 'I would underwrite lower rent growth and higher vacancy.' },
    qualificationCopy: 'Challenge my underwriting by naming the exact number or assumption you would change.',
  },
  fork: {
    requiredEvidence: ['Changed assumptions or metrics that create a comparison version of the shared underwriting.'],
    acceptedMetadataKeys: ['assumptions', 'inputs', 'metrics', 'notes'],
    sampleMetadata: { assumptions: { rentGrowth: 0.01, exitCapRate: 0.0575 }, notes: 'Forked with more conservative growth.' },
    qualificationCopy: 'Forks qualify only when the recipient changes the underwriting payload enough to compare versions.',
  },
  signup: {
    requiredEvidence: ['Authenticated recipient account associated with the shared underwriting journey.'],
    acceptedMetadataKeys: ['userId'],
    sampleMetadata: { userId: 77 },
    qualificationCopy: 'Signup credits require authentication so a real account can save and share the challenged version onward.',
  },
  saved_version: {
    requiredEvidence: ['Saved analysis version with changed assumptions, inputs, metrics, challenged fields, notes, or comment.'],
    acceptedMetadataKeys: ['challengedFields', 'assumptions', 'inputs', 'metrics', 'comment', 'notes', 'savedAnalysisId'],
    sampleMetadata: { inputs: { monthlyRent: 3200, vacancyRate: 0.05 }, notes: 'Saved with my revised rent and vacancy assumptions.' },
    qualificationCopy: 'Saved-version credits require proof that the recipient changed and saved a version, not merely clicked save.',
  },
};

function randomToken() {
  return crypto.randomBytes(18).toString('base64url');
}

function randomRecipientKey() {
  return crypto.randomBytes(12).toString('base64url');
}

export async function createUnderwritingShare(database: DatabaseAdapter, input: {
  analysisId: number | string;
  inviterUserId: number | null;
  source?: string;
  parentShareId?: number | null;
  parentShareActionId?: number | null;
  parentShareDepth?: number | null;
}) {
  const token = randomToken();
  const source = hasNonEmptyString(input.source) ? input.source.trim().slice(0, 64) : 'analysis';
  const parentShareId = input.parentShareId || null;
  const parentShareActionId = input.parentShareActionId || null;
  const shareDepth = parentShareId ? Number(input.parentShareDepth || 0) + 1 : 0;

  const created = await database.query(
    `INSERT INTO underwriting_shares (
       analysis_id, inviter_user_id, token, status, source, parent_share_id, parent_share_action_id, share_depth
     ) VALUES ($1, $2, $3, 'active', $4, $5, $6, $7)
     RETURNING id, token, share_depth`,
    [input.analysisId, input.inviterUserId, token, source, parentShareId, parentShareActionId, shareDepth],
  );

  const row = created.rows[0];
  return {
    id: row.id,
    token: row.token,
    shareDepth: Number(row.share_depth || shareDepth),
    shareUrl: `/underwriting/${row.token}`,
    cta: 'Challenge my underwriting.',
    shareCard: getChallengeShareCard({ token: row.token, source }),
    rewardPolicy: getRewardPolicySnapshot(),
  };
}

function sha256(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function getClientIp(req: Request) {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0]?.trim() || req.ip || 'unknown';
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

export function getRecipientHash(req: Request, explicitRecipient?: string) {
  const visitor = typeof explicitRecipient === 'string' && explicitRecipient.trim()
    ? explicitRecipient.trim().toLowerCase()
    : `${getClientIp(req)}:${req.headers['user-agent'] || 'unknown'}`;

  return sha256(visitor);
}

export function getExplicitRecipientHash(recipientKey: string) {
  return sha256(recipientKey.trim().toLowerCase());
}

function getRecipientLabelHash(label: unknown) {
  return hasNonEmptyString(label) ? sha256(String(label).trim().toLowerCase()) : null;
}

export async function createUnderwritingShareRecipientLinks(database: DatabaseAdapter, input: {
  shareId: number;
  token: string;
  createdByUserId: number;
  recipients: Array<string | { label?: string; source?: string }>;
  source?: string;
}) {
  const recipientInputs = input.recipients.slice(0, 25);
  const links = [];

  for (const recipientInput of recipientInputs) {
    const label = typeof recipientInput === 'string' ? recipientInput : recipientInput.label;
    const source = typeof recipientInput === 'object' && recipientInput.source
      ? recipientInput.source
      : input.source || 'manual';
    const recipientKey = randomRecipientKey();
    const recipientHash = getExplicitRecipientHash(recipientKey);
    const labelHash = getRecipientLabelHash(label);

    const result = await database.query(
      `INSERT INTO underwriting_share_recipients (
         share_id, recipient_hash, recipient_label_hash, source, created_by_user_id
       ) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (share_id, recipient_hash) DO NOTHING
       RETURNING id, created_at`,
      [input.shareId, recipientHash, labelHash, String(source).slice(0, 64), input.createdByUserId],
    );

    links.push({
      id: result.rows[0]?.id || null,
      recipientKey,
      recipientHash,
      shareUrl: `/underwriting/${input.token}?recipient=${recipientKey}`,
      cta: 'Challenge my underwriting.',
      shareCard: getChallengeShareCard({
        token: input.token,
        recipientKey,
        source: String(source).slice(0, 64),
        nextQualifiedAction: 'challenge',
      }),
      createdAt: result.rows[0]?.created_at || null,
      qualifiedActionsRequired: ['unique_open', 'challenge', 'fork', 'signup', 'saved_version'] as QualifiedShareAction[],
    });
  }

  return links;
}

export function getActionPolicy(action: QualifiedShareAction) {
  return ACTION_POLICIES[action];
}

export function getRewardPolicySnapshot() {
  return Object.fromEntries(
    QUALIFIED_ACTIONS.map((action) => [action, ACTION_POLICIES[action]]),
  ) as Record<QualifiedShareAction, QualifiedActionPolicy>;
}

export function getQualifiedActionCatalog(): QualifiedActionCatalogItem[] {
  return QUALIFIED_ACTIONS.map((action) => ({
    action,
    ...ACTION_POLICIES[action],
    ...ACTION_CATALOG_COPY[action],
  }));
}

export function getQualifiedActionProofGuide(action?: QualifiedShareAction): QualifiedActionProofGuideItem[] {
  const actions = action ? [action] : QUALIFIED_ACTIONS;

  return actions.map((qualifiedAction) => ({
    action: qualifiedAction,
    creditAmount: ACTION_POLICIES[qualifiedAction].creditAmount,
    ...ACTION_PROOF_GUIDE[qualifiedAction],
    antiAbuseGuardrail: ACTION_CATALOG_COPY[qualifiedAction].antiAbuseRule,
  }));
}

export async function getGoogleSheetsExportCreditBalance(database: DatabaseAdapter, userId: number) {
  const result = await database.query(
    `SELECT
       COALESCE((
         SELECT SUM(credit_amount)::int
         FROM premium_credit_ledger
         WHERE user_id = $1 AND credit_type = $2
       ), 0)::int AS earned_credits,
       COALESCE((
         SELECT SUM(credit_amount)::int
         FROM premium_credit_redemptions
         WHERE user_id = $1 AND credit_type = $2
       ), 0)::int AS redeemed_credits`,
    [userId, GOOGLE_SHEETS_EXPORT_CREDIT_TYPE],
  );

  const earnedCredits = Number(result.rows[0]?.earned_credits || 0);
  const redeemedCredits = Number(result.rows[0]?.redeemed_credits || 0);

  return {
    creditType: GOOGLE_SHEETS_EXPORT_CREDIT_TYPE,
    earnedCredits,
    redeemedCredits,
    availableCredits: Math.max(earnedCredits - redeemedCredits, 0),
    cta: 'Challenge my underwriting.',
    earnPolicy: getRewardPolicySnapshot(),
    antiAbuseGuardrail: 'Google Sheets export credits are earned only from qualified underwriting share actions — never raw share clicks alone.',
  };
}

export async function redeemGoogleSheetsExportCredits(database: DatabaseAdapter, input: {
  userId: number;
  creditAmount?: number;
  reason?: string;
  metadata?: Record<string, unknown>;
}) {
  const creditAmount = Math.max(1, Math.floor(Number(input.creditAmount || 1)));
  const reason = hasNonEmptyString(input.reason)
    ? String(input.reason).trim().slice(0, 255)
    : 'Google Sheets export';

  const result = await database.query(
    `WITH balance AS (
       SELECT
         COALESCE((
           SELECT SUM(credit_amount)::int
           FROM premium_credit_ledger
           WHERE user_id = $1 AND credit_type = $2
         ), 0)
         - COALESCE((
           SELECT SUM(credit_amount)::int
           FROM premium_credit_redemptions
           WHERE user_id = $1 AND credit_type = $2
         ), 0) AS available_credits
     ), inserted AS (
       INSERT INTO premium_credit_redemptions (user_id, credit_type, credit_amount, reason, metadata)
       SELECT $1, $2, $3, $4, $5
       FROM balance
       WHERE available_credits >= $3
       RETURNING id, credit_amount, created_at
     )
     SELECT
       balance.available_credits::int AS available_credits_before,
       inserted.id,
       inserted.credit_amount,
       inserted.created_at
     FROM balance
     LEFT JOIN inserted ON true`,
    [input.userId, GOOGLE_SHEETS_EXPORT_CREDIT_TYPE, creditAmount, reason, input.metadata || {}],
  );

  const row = result.rows[0] || {};
  const availableCreditsBefore = Number(row.available_credits_before || 0);
  if (!row.id) {
    return {
      status: 'insufficient_credits' as const,
      redeemed: false,
      creditAmount,
      availableCreditsBefore,
      availableCreditsAfter: availableCreditsBefore,
      cta: 'Challenge my underwriting.',
    };
  }

  return {
    status: 'redeemed' as const,
    redeemed: true,
    redemptionId: row.id,
    creditAmount: Number(row.credit_amount || creditAmount),
    availableCreditsBefore,
    availableCreditsAfter: Math.max(availableCreditsBefore - creditAmount, 0),
    createdAt: row.created_at,
    cta: 'Challenge my underwriting.',
  };
}

function isQualifiedShareAction(action: string): action is QualifiedShareAction {
  return Object.prototype.hasOwnProperty.call(ACTION_POLICIES, action);
}

function hasObjectKeys(value: unknown) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0);
}

function hasNonEmptyString(value: unknown, minLength = 1) {
  return typeof value === 'string' && value.trim().length >= minLength;
}

export function hasMeaningfulChallengePayload(action: QualifiedShareAction, metadata: unknown) {
  if (action === 'unique_open' || action === 'signup') {
    return true;
  }

  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return false;
  }

  const payload = metadata as Record<string, unknown>;
  const challengedFields = payload.challengedFields;
  const challengedFieldCount = Array.isArray(challengedFields)
    ? challengedFields.filter((field) => hasNonEmptyString(field)).length
    : 0;

  return (
    challengedFieldCount > 0
    || hasObjectKeys(payload.assumptions)
    || hasObjectKeys(payload.inputs)
    || hasObjectKeys(payload.metrics)
    || hasNonEmptyString(payload.comment, 10)
    || hasNonEmptyString(payload.notes, 10)
  );
}

export function getShareActionQualificationBlockReason(
  action: QualifiedShareAction,
  metadata: unknown,
  authenticatedUserId?: number | null,
) {
  if (action === 'signup' && !authenticatedUserId) {
    return 'Signup credits require the recipient to be authenticated so a real account can be associated with the shared underwriting.';
  }

  if (!hasMeaningfulChallengePayload(action, metadata)) {
    return 'Challenge/fork/saved-version credits require changed assumptions, challenged fields, metrics, inputs, notes, or a 10+ character comment.';
  }

  return null;
}

async function countDailyShareActions(database: DatabaseAdapter, shareId: number, action: QualifiedShareAction) {
  const result = await database.query(
    `SELECT COUNT(*)::int AS count
     FROM underwriting_share_actions
     WHERE share_id = $1 AND action = $2 AND qualified = true AND created_at >= CURRENT_DATE`,
    [shareId, action],
  );

  return Number(result.rows[0]?.count || 0);
}

async function countDailyRecipientActions(database: DatabaseAdapter, recipientHash: string, action: QualifiedShareAction) {
  const result = await database.query(
    `SELECT COUNT(*)::int AS count
     FROM underwriting_share_actions
     WHERE recipient_hash = $1 AND action = $2 AND qualified = true AND created_at >= CURRENT_DATE`,
    [recipientHash, action],
  );

  return Number(result.rows[0]?.count || 0);
}

async function findExistingAction(database: DatabaseAdapter, shareId: number, recipientHash: string, action: QualifiedShareAction) {
  const result = await database.query(
    `SELECT id, qualified, credit_amount
     FROM underwriting_share_actions
     WHERE share_id = $1 AND recipient_hash = $2 AND action = $3
     LIMIT 1`,
    [shareId, recipientHash, action],
  );

  return result.rows[0] || null;
}

export async function recordQualifiedShareAction(database: DatabaseAdapter, input: {
  shareId: number;
  inviterUserId: number | null;
  action: QualifiedShareAction;
  recipientHash: string;
  metadata?: Record<string, unknown>;
  authenticatedUserId?: number | null;
}) {
  const qualificationBlockReason = getShareActionQualificationBlockReason(
    input.action,
    input.metadata,
    input.authenticatedUserId,
  );

  if (qualificationBlockReason) {
    return {
      status: 'blocked' as const,
      qualified: false,
      creditAmount: 0,
      blockReason: qualificationBlockReason,
    };
  }

  const existing = await findExistingAction(database, input.shareId, input.recipientHash, input.action);
  if (existing) {
    return {
      status: 'duplicate' as const,
      qualified: Boolean(existing.qualified),
      creditAmount: Number(existing.credit_amount || 0),
    };
  }

  const policy = ACTION_POLICIES[input.action];
  const [shareActionCount, recipientActionCount] = await Promise.all([
    countDailyShareActions(database, input.shareId, input.action),
    countDailyRecipientActions(database, input.recipientHash, input.action),
  ]);

  const qualified = shareActionCount < policy.dailyShareCap && recipientActionCount < policy.dailyRecipientCap;
  const creditAmount = qualified ? policy.creditAmount : 0;
  const status = qualified ? 'qualified' : 'capped';

  const result = await database.query(
    `INSERT INTO underwriting_share_actions (
       share_id, action, recipient_hash, qualified, credit_type, credit_amount, metadata
     ) VALUES ($1, $2, $3, $4, 'google_sheets_export', $5, $6)
     RETURNING id`,
    [input.shareId, input.action, input.recipientHash, qualified, creditAmount, input.metadata || {}],
  );

  const actionId = result.rows[0]?.id;

  if (qualified && input.inviterUserId && creditAmount > 0) {
    await database.query(
      `INSERT INTO premium_credit_ledger (
         user_id, share_id, share_action_id, credit_type, credit_amount, reason
       ) VALUES ($1, $2, $3, 'google_sheets_export', $4, $5)`,
      [input.inviterUserId, input.shareId, actionId, creditAmount, `Qualified underwriting share action: ${input.action}`],
    );
  }

  await database.query(
    `UPDATE underwriting_shares
     SET qualified_action_count = qualified_action_count + $2,
         credit_awarded = credit_awarded + $3,
         last_qualified_action_at = CASE WHEN $2 = 1 THEN NOW() ELSE last_qualified_action_at END,
         updated_at = NOW()
     WHERE id = $1`,
    [input.shareId, qualified ? 1 : 0, creditAmount],
  );

  return { status, qualified, creditAmount, actionId };
}

export async function previewQualifiedShareActionCredit(database: DatabaseAdapter, input: {
  shareId: number;
  action: QualifiedShareAction;
  recipientHash: string;
  metadata?: Record<string, unknown>;
  authenticatedUserId?: number | null;
}) {
  const qualificationBlockReason = getShareActionQualificationBlockReason(
    input.action,
    input.metadata,
    input.authenticatedUserId,
  );

  if (qualificationBlockReason) {
    return {
      status: 'blocked' as const,
      eligible: false,
      qualified: false,
      creditAmount: 0,
      blockReason: qualificationBlockReason,
      cta: 'Challenge my underwriting.',
      creditGuardrail: 'Credits require qualified opens, challenges, forks, signups, or saved versions within anti-abuse caps — never raw share clicks alone.',
    };
  }

  const existing = await findExistingAction(database, input.shareId, input.recipientHash, input.action);
  if (existing) {
    return {
      status: 'duplicate' as const,
      eligible: false,
      qualified: Boolean(existing.qualified),
      creditAmount: Number(existing.credit_amount || 0),
      blockReason: 'This recipient already completed this qualified action for the shared underwriting.',
      cta: 'Challenge my underwriting.',
      creditGuardrail: 'Duplicate recipient/share/action combinations do not earn additional credits.',
    };
  }

  const policy = ACTION_POLICIES[input.action];
  const [shareActionCount, recipientActionCount] = await Promise.all([
    countDailyShareActions(database, input.shareId, input.action),
    countDailyRecipientActions(database, input.recipientHash, input.action),
  ]);
  const shareRemainingToday = Math.max(policy.dailyShareCap - shareActionCount, 0);
  const recipientRemainingToday = Math.max(policy.dailyRecipientCap - recipientActionCount, 0);
  const eligible = shareRemainingToday > 0 && recipientRemainingToday > 0;

  return {
    status: eligible ? 'eligible' as const : 'capped' as const,
    eligible,
    qualified: eligible,
    creditAmount: eligible ? policy.creditAmount : 0,
    potentialCreditAmount: policy.creditAmount,
    shareRemainingToday,
    recipientRemainingToday,
    dailyShareCap: policy.dailyShareCap,
    dailyRecipientCap: policy.dailyRecipientCap,
    blockReason: eligible ? null : 'Daily share or recipient caps have already been reached for this qualified action.',
    cta: 'Challenge my underwriting.',
    creditGuardrail: 'This is a preview only. Credits are awarded only after the qualified action is recorded and anti-abuse checks pass.',
  };
}

type ShareActionSummary = Record<QualifiedShareAction, {
  totalCount: number;
  qualifiedCount: number;
  cappedCount: number;
  creditAwarded: number;
  dailyQualifiedCount: number;
  dailyRemainingShareCap: number;
  lastActionAt: string | null;
}>;

type RecipientInviteFunnelSegment = {
  source: string;
  invitedCount: number;
  openedCount: number;
  challengedCount: number;
  versionedCount: number;
  signupCount: number;
  creditAwarded: number;
  openRate: number;
  challengeRate: number;
  versionRate: number;
  signupRate: number;
};

type RecipientShareCoaching = {
  source: string;
  priority: number;
  stage: 'get_opens' | 'ask_for_challenges' | 'convert_to_versions' | 'convert_to_accounts' | 'amplify';
  nextQualifiedAction: QualifiedShareAction;
  headline: string;
  suggestedCopy: string;
  creditGuardrail: string;
};

type ChallengeResponseNudge = {
  rank: number;
  nextQualifiedAction: QualifiedShareAction;
  recipientSource: string | null;
  prompt: string;
  rewardCopy: string;
  antiAbuseGuardrail: string;
};

type QualifiedSharePlaybookStep = {
  rank: number;
  qualifiedAction: QualifiedShareAction;
  status: 'ready' | 'capped';
  recipientSource: string | null;
  prompt: string;
  ownerAction: string;
  qualifiesWhen: string;
  creditAmount: number;
  remainingShareCreditsToday: number;
  antiAbuseGuardrail: string;
};

type QualifiedShareDigest = {
  headline: string;
  cta: string;
  loopStage: string;
  healthScore: number;
  earnedCredits: number;
  remainingCreditsToday: number;
  nextQualifiedAction: QualifiedShareAction;
  prioritizedRecipientSource: string | null;
  morningChecklist: Array<{
    rank: number;
    ownerAction: string;
    recipientCopy: string;
    qualifiesWhen: string;
    creditAmount: number;
  }>;
  exportCreditCopy: string;
  riskFlags: string[];
  antiAbuseGuardrail: string;
};

export type ChallengeShareCardInput = {
  token: string;
  recipientKey?: string | null;
  nextQualifiedAction?: QualifiedShareAction;
  source?: string | null;
};

export function getChallengeShareCard(input: ChallengeShareCardInput) {
  const nextQualifiedAction = input.nextQualifiedAction || 'challenge';
  const actionCopy = ACTION_CATALOG_COPY[nextQualifiedAction];
  const shareUrl = input.recipientKey
    ? `/underwriting/${input.token}?recipient=${encodeURIComponent(input.recipientKey)}`
    : `/underwriting/${input.token}`;

  return {
    headline: 'Challenge my underwriting.',
    cta: 'Challenge my underwriting.',
    shareUrl,
    source: input.source || 'analysis',
    nextQualifiedAction,
    recipientInstruction: actionCopy.recipientPrompt,
    ownerInstruction: actionCopy.ownerPrompt,
    rewardTeaser: `Earn ${ACTION_POLICIES[nextQualifiedAction].creditAmount} Google Sheets export credit${ACTION_POLICIES[nextQualifiedAction].creditAmount === 1 ? '' : 's'} when this becomes a qualified ${nextQualifiedAction.replace('_', ' ')}.`,
    loopSteps: [
      'Analyze deal',
      'Share underwriting',
      'Recipient challenges or forks assumptions',
      'Save account-tied version',
      'Share onward',
    ],
    qualifiedActionsRequired: QUALIFIED_ACTIONS,
    proofGuide: getQualifiedActionProofGuide(nextQualifiedAction),
    antiAbuseGuardrail: 'Credits require qualified actions with unique recipient tracking and daily caps. Raw share clicks alone never earn credits.',
  };
}

export function getRecipientLoopHandoff(input: {
  action: QualifiedShareAction;
  status: string;
  qualified: boolean;
  creditAmount: number;
  savedAnalysisId?: number | null;
  onwardShare?: { token: string; shareUrl?: string; cta?: string } | null;
}) {
  const hasAccountTiedVersion = Boolean(input.savedAnalysisId);
  const canShareOnward = input.qualified && hasAccountTiedVersion && Boolean(input.onwardShare?.token);
  const nextQualifiedAction: QualifiedShareAction = canShareOnward
    ? 'unique_open'
    : input.action === 'challenge'
      ? 'saved_version'
      : input.action === 'signup'
        ? 'fork'
        : 'signup';
  const actionCopy = ACTION_CATALOG_COPY[nextQualifiedAction];

  return {
    cta: 'Challenge my underwriting.',
    status: input.status,
    qualified: input.qualified,
    creditAmount: input.creditAmount,
    hasAccountTiedVersion,
    canShareOnward,
    nextQualifiedAction,
    headline: canShareOnward
      ? 'Your challenged version is ready to share onward.'
      : hasAccountTiedVersion
        ? 'Save the account-tied version, then share it onward.'
        : 'Turn this challenge into a saved version so the loop can continue.',
    recipientNextStep: canShareOnward
      ? 'Send the onward link to one specific investor or realtor and ask them to challenge your assumptions.'
      : actionCopy.recipientPrompt,
    ownerNextStep: canShareOnward
      ? 'Track qualified opens, challenges, signups, and saved versions from the onward share before awarding more credits.'
      : actionCopy.ownerPrompt,
    onwardShareCard: canShareOnward && input.onwardShare?.token
      ? getChallengeShareCard({
        token: input.onwardShare.token,
        source: 'recipient_onward',
        nextQualifiedAction: 'challenge',
      })
      : null,
    rewardTeaser: `Next qualified ${nextQualifiedAction.replace('_', ' ')} can earn ${ACTION_POLICIES[nextQualifiedAction].creditAmount} Google Sheets export credit${ACTION_POLICIES[nextQualifiedAction].creditAmount === 1 ? '' : 's'} after anti-abuse checks pass.`,
    antiAbuseGuardrail: 'Do not award credits for raw share clicks. Credits require qualified unique opens, challenges, forks, signups, or saved versions with unique-recipient tracking and daily caps.',
  };
}

function getConversionRate(numerator: number, denominator: number) {
  return denominator > 0 ? Number((numerator / denominator).toFixed(4)) : 0;
}

export function getShareGrowthNudge(byAction: ShareActionSummary) {
  const opens = byAction.unique_open.qualifiedCount;
  const challenges = byAction.challenge.qualifiedCount;
  const forks = byAction.fork.qualifiedCount;
  const savedVersions = byAction.saved_version.qualifiedCount;
  const signups = byAction.signup.qualifiedCount;

  if (opens === 0) {
    return {
      stage: 'get_first_qualified_open',
      headline: 'Share the underwriting link with one specific investor or realtor.',
      suggestedCopy: 'Challenge my underwriting — tell me which assumption you disagree with.',
    };
  }

  if (challenges === 0) {
    return {
      stage: 'convert_opens_to_challenges',
      headline: 'Qualified opens are landing. Ask recipients to challenge one assumption.',
      suggestedCopy: 'Challenge my underwriting — rent, vacancy, expenses, or exit cap: what would you change?',
    };
  }

  if (forks + savedVersions === 0) {
    return {
      stage: 'convert_challenges_to_versions',
      headline: 'Challenges are coming in. Push recipients to fork or save their version next.',
      suggestedCopy: 'Challenge my underwriting and save your version — I want to compare your assumptions side by side.',
    };
  }

  if (signups === 0) {
    return {
      stage: 'convert_versions_to_accounts',
      headline: 'Version activity is working. Invite challengers to create an account so the loop can continue.',
      suggestedCopy: 'Challenge my underwriting, save your version, and share it onward for Google Sheets export credits.',
    };
  }

  return {
    stage: 'amplify_working_loop',
    headline: 'The underwriting loop is working. Re-share the strongest challenged version.',
    suggestedCopy: 'Challenge my underwriting — this version already has investor feedback. What did we miss?',
  };
}

export function getQualifiedShareRewardBrief(byAction: ShareActionSummary) {
  const earnedCredits = Object.values(byAction).reduce(
    (total, actionSummary) => total + actionSummary.creditAwarded,
    0,
  );
  const remainingCreditsToday = Object.values(byAction).reduce(
    (total, actionSummary) => total + actionSummary.dailyRemainingShareCap,
    0,
  );
  const qualifiedActions = QUALIFIED_ACTIONS.filter((action) => byAction[action].qualifiedCount > 0);
  const bestNextReward = QUALIFIED_ACTIONS
    .filter((action) => byAction[action].dailyRemainingShareCap > 0)
    .sort((left, right) => ACTION_POLICIES[right].creditAmount - ACTION_POLICIES[left].creditAmount)[0] || null;

  return {
    headline: 'Earn Google Sheets export credits when recipients take qualified underwriting actions.',
    cta: 'Challenge my underwriting.',
    earnedCredits,
    remainingCreditsToday,
    qualifiedActions,
    bestNextReward: bestNextReward ? {
      action: bestNextReward,
      creditAmount: ACTION_POLICIES[bestNextReward].creditAmount,
      remainingToday: byAction[bestNextReward].dailyRemainingShareCap,
    } : null,
    sharePrompt: 'Challenge my underwriting — fork the assumptions you disagree with, save your version, and share it onward.',
    antiAbuseGuardrail: 'Credits are never granted for raw clicks alone. Rewards require unique opens, challenges, forks, signups, or saved versions within daily caps.',
    qualifiedActionCatalog: getQualifiedActionCatalog(),
  };
}

export function getChallengeResponseNudges(input: {
  byAction: ShareActionSummary;
  inviteFunnel: RecipientInviteFunnelSegment[];
}): ChallengeResponseNudge[] {
  const coaching = getRecipientShareCoaching(input.inviteFunnel);
  const fallbackActions: QualifiedShareAction[] = ['challenge', 'saved_version', 'fork', 'signup'];
  const sourceByAction = new Map<QualifiedShareAction, string>();
  const bestSource = coaching[0]?.source || input.inviteFunnel[0]?.source || null;

  for (const item of coaching) {
    if (!sourceByAction.has(item.nextQualifiedAction)) {
      sourceByAction.set(item.nextQualifiedAction, item.source);
    }
  }

  const candidateActions = [
    ...coaching.map((item) => item.nextQualifiedAction),
    ...fallbackActions,
  ].filter((action, index, actions) => actions.indexOf(action) === index);

  return candidateActions
    .filter((action) => input.byAction[action].dailyRemainingShareCap > 0)
    .slice(0, 3)
    .map((action, index) => ({
      rank: index + 1,
      nextQualifiedAction: action,
      recipientSource: sourceByAction.get(action) || bestSource,
      prompt: ACTION_CATALOG_COPY[action].recipientPrompt,
      rewardCopy: `This can earn ${ACTION_POLICIES[action].creditAmount} Google Sheets export credit${ACTION_POLICIES[action].creditAmount === 1 ? '' : 's'} only after a qualified ${action.replace('_', ' ')} passes unique-recipient and daily-cap checks.`,
      antiAbuseGuardrail: ACTION_CATALOG_COPY[action].antiAbuseRule,
    }));
}

export function getQualifiedSharePlaybook(input: {
  byAction: ShareActionSummary;
  inviteFunnel: RecipientInviteFunnelSegment[];
  invitedRecipientCount: number;
  unopenedRecipientCount: number;
}) {
  const { byAction, inviteFunnel, invitedRecipientCount, unopenedRecipientCount } = input;
  const insights = getShareConversionInsights({ byAction, invitedRecipientCount, unopenedRecipientCount });
  const coaching = getRecipientShareCoaching(inviteFunnel);
  const sourceByAction = new Map<QualifiedShareAction, string>();
  const topSource = coaching[0]?.source || inviteFunnel[0]?.source || null;

  for (const item of coaching) {
    if (!sourceByAction.has(item.nextQualifiedAction)) {
      sourceByAction.set(item.nextQualifiedAction, item.source);
    }
  }

  const candidateActions = [
    insights.nextQualifiedAction,
    ...coaching.map((item) => item.nextQualifiedAction),
    'challenge' as const,
    'saved_version' as const,
    'fork' as const,
    'signup' as const,
    'unique_open' as const,
  ].filter((action, index, actions) => actions.indexOf(action) === index);

  const steps: QualifiedSharePlaybookStep[] = candidateActions.slice(0, 4).map((action, index) => {
    const policy = ACTION_POLICIES[action];
    const copy = ACTION_CATALOG_COPY[action];
    const remainingShareCreditsToday = byAction[action].dailyRemainingShareCap;

    return {
      rank: index + 1,
      qualifiedAction: action,
      status: remainingShareCreditsToday > 0 ? 'ready' : 'capped',
      recipientSource: sourceByAction.get(action) || topSource,
      prompt: copy.recipientPrompt,
      ownerAction: action === insights.nextQualifiedAction ? insights.ownerAction : copy.ownerPrompt,
      qualifiesWhen: copy.qualifiesWhen,
      creditAmount: policy.creditAmount,
      remainingShareCreditsToday,
      antiAbuseGuardrail: copy.antiAbuseRule,
    };
  });

  const primaryStep = steps.find((step) => step.status === 'ready') || steps[0] || null;

  return {
    headline: 'Next qualified share actions',
    cta: 'Challenge my underwriting.',
    phase: insights.bottleneck,
    primaryStep,
    steps,
    dailyCapSummary: Object.fromEntries(
      QUALIFIED_ACTIONS.map((action) => [
        action,
        {
          creditAmount: ACTION_POLICIES[action].creditAmount,
          remainingShareCreditsToday: byAction[action].dailyRemainingShareCap,
          dailyShareCap: ACTION_POLICIES[action].dailyShareCap,
          dailyRecipientCap: ACTION_POLICIES[action].dailyRecipientCap,
        },
      ]),
    ),
    creditGuardrail: 'Use this playbook only for qualified actions: unique tracked opens, meaningful challenges, forks, signups, or saved versions within caps. Raw share clicks alone never earn Google Sheets export credits.',
  };
}

export function getShareConversionInsights(input: {
  byAction: ShareActionSummary;
  invitedRecipientCount: number;
  unopenedRecipientCount: number;
}) {
  const { byAction, invitedRecipientCount, unopenedRecipientCount } = input;
  const opens = byAction.unique_open.qualifiedCount;
  const challenges = byAction.challenge.qualifiedCount;
  const forkOrSavedVersions = byAction.fork.qualifiedCount + byAction.saved_version.qualifiedCount;
  const signups = byAction.signup.qualifiedCount;
  const openedInvites = Math.max(invitedRecipientCount - unopenedRecipientCount, 0);
  const unopenedInviteRate = getConversionRate(unopenedRecipientCount, invitedRecipientCount);
  const openToChallenge = getConversionRate(challenges, opens);
  const challengeToVersion = getConversionRate(forkOrSavedVersions, challenges);
  const versionToSignup = getConversionRate(signups, forkOrSavedVersions);

  let bottleneck: 'recipient_distribution' | 'open_to_challenge' | 'challenge_to_version' | 'version_to_signup' | 'amplify_loop';
  let nextQualifiedAction: QualifiedShareAction;
  let ownerAction: string;

  if (opens === 0 || (invitedRecipientCount > 0 && openedInvites === 0)) {
    bottleneck = 'recipient_distribution';
    nextQualifiedAction = 'unique_open';
    ownerAction = 'Send recipient-specific links to a short list and ask each person for one underwriting disagreement.';
  } else if (openToChallenge < 0.35) {
    bottleneck = 'open_to_challenge';
    nextQualifiedAction = 'challenge';
    ownerAction = 'Follow up with opened recipients using the “Challenge my underwriting” CTA and name 2-3 assumptions they can dispute.';
  } else if (challengeToVersion < 0.5) {
    bottleneck = 'challenge_to_version';
    nextQualifiedAction = 'saved_version';
    ownerAction = 'Ask challengers to save or fork their changed assumptions so both versions can be compared.';
  } else if (versionToSignup < 0.4) {
    bottleneck = 'version_to_signup';
    nextQualifiedAction = 'signup';
    ownerAction = 'Prompt version creators to create an account so they can keep the version and share it onward.';
  } else {
    bottleneck = 'amplify_loop';
    nextQualifiedAction = 'fork';
    ownerAction = 'Re-share the strongest challenged version to a new qualified recipient segment.';
  }

  const remainingCreditsToday = Object.values(byAction).reduce(
    (remaining, actionSummary) => remaining + actionSummary.dailyRemainingShareCap,
    0,
  );

  return {
    bottleneck,
    nextQualifiedAction,
    ownerAction,
    healthScore: Math.min(100, Math.round(
      (Math.min(opens, 5) * 8)
      + (Math.min(challenges, 4) * 10)
      + (Math.min(forkOrSavedVersions, 3) * 12)
      + (Math.min(signups, 2) * 12),
    )),
    openedInvites,
    unopenedInviteRate,
    remainingCreditsToday,
    creditGuardrail: 'Credits are only awarded for qualified opens, challenges, forks, signups, and saved versions within anti-abuse caps — never raw share clicks alone.',
  };
}

export function getQualifiedShareLoopPlan(input: {
  byAction: ShareActionSummary;
  inviteFunnel: RecipientInviteFunnelSegment[];
  invitedRecipientCount: number;
  unopenedRecipientCount: number;
}) {
  const { byAction, inviteFunnel, invitedRecipientCount, unopenedRecipientCount } = input;
  const conversionInsights = getShareConversionInsights({ byAction, invitedRecipientCount, unopenedRecipientCount });
  const rewardBrief = getQualifiedShareRewardBrief(byAction);
  const topSegment = inviteFunnel[0] || null;
  const opens = byAction.unique_open.qualifiedCount;
  const challenges = byAction.challenge.qualifiedCount;
  const versions = byAction.fork.qualifiedCount + byAction.saved_version.qualifiedCount;
  const signups = byAction.signup.qualifiedCount;

  const milestones = [
    {
      key: 'first_qualified_open',
      complete: opens > 0,
      qualifiedAction: 'unique_open' as const,
      label: 'Get one qualified recipient open from a tracked underwriting link.',
    },
    {
      key: 'first_challenge',
      complete: challenges > 0,
      qualifiedAction: 'challenge' as const,
      label: 'Turn an open into a concrete assumption challenge.',
    },
    {
      key: 'first_version',
      complete: versions > 0,
      qualifiedAction: 'saved_version' as const,
      label: 'Convert a challenge into a saved or forked comparison version.',
    },
    {
      key: 'account_tied_loop',
      complete: signups > 0,
      qualifiedAction: 'signup' as const,
      label: 'Tie a challenged version to an account so it can be saved and shared onward.',
    },
  ];
  const completedMilestones = milestones.filter((milestone) => milestone.complete).length;
  const nextMilestone = milestones.find((milestone) => !milestone.complete) || null;

  return {
    headline: 'Qualified sharing loop plan',
    cta: 'Challenge my underwriting.',
    loop: 'Analyze deal -> Share underwriting -> Recipient challenges/forks assumptions -> Account/save version -> Share onward',
    phase: conversionInsights.bottleneck,
    healthScore: conversionInsights.healthScore,
    completedMilestones,
    totalMilestones: milestones.length,
    nextMilestone,
    milestones,
    nextQualifiedAction: conversionInsights.nextQualifiedAction,
    ownerAction: conversionInsights.ownerAction,
    recommendedRecipientSource: topSegment ? {
      source: topSegment.source,
      openRate: topSegment.openRate,
      challengeRate: topSegment.challengeRate,
      versionRate: topSegment.versionRate,
      signupRate: topSegment.signupRate,
      creditAwarded: topSegment.creditAwarded,
    } : null,
    earnedCredits: rewardBrief.earnedCredits,
    bestNextReward: rewardBrief.bestNextReward,
    challengeResponseNudges: getChallengeResponseNudges({ byAction, inviteFunnel }),
    sharePlaybook: getQualifiedSharePlaybook({ byAction, inviteFunnel, invitedRecipientCount, unopenedRecipientCount }),
    creditGuardrail: 'Premium credits, including Google Sheets export credits, are earned only from qualified actions with unique recipient tracking and daily caps — never raw share clicks alone.',
    sharePrompt: rewardBrief.sharePrompt,
  };
}

export function getQualifiedShareDigest(input: {
  byAction: ShareActionSummary;
  inviteFunnel: RecipientInviteFunnelSegment[];
  invitedRecipientCount: number;
  unopenedRecipientCount: number;
}): QualifiedShareDigest {
  const { byAction, inviteFunnel, invitedRecipientCount, unopenedRecipientCount } = input;
  const insights = getShareConversionInsights({ byAction, invitedRecipientCount, unopenedRecipientCount });
  const rewardBrief = getQualifiedShareRewardBrief(byAction);
  const playbook = getQualifiedSharePlaybook({ byAction, inviteFunnel, invitedRecipientCount, unopenedRecipientCount });
  const primaryStep = playbook.primaryStep;
  const prioritizedRecipientSource = primaryStep?.recipientSource || inviteFunnel[0]?.source || null;
  const versions = byAction.fork.qualifiedCount + byAction.saved_version.qualifiedCount;
  const allDailyCapsExhausted = QUALIFIED_ACTIONS.every((action) => byAction[action].dailyRemainingShareCap <= 0);

  const riskFlags = [
    invitedRecipientCount > 0 && unopenedRecipientCount === invitedRecipientCount
      ? 'All generated recipient links are still unopened; do not count these as credit-worthy activity yet.'
      : null,
    byAction.unique_open.qualifiedCount > 0 && byAction.challenge.qualifiedCount === 0
      ? 'Recipients are opening without submitting a meaningful challenge; tighten the “Challenge my underwriting” ask.'
      : null,
    byAction.challenge.qualifiedCount > 0 && versions === 0
      ? 'Challenges are not becoming saved or forked versions, so the onward-sharing loop can stall.'
      : null,
    allDailyCapsExhausted
      ? 'All qualified-action daily share caps are exhausted; wait until tomorrow before promising more export credits.'
      : null,
  ].filter((flag): flag is string => Boolean(flag));

  const readySteps = playbook.steps
    .filter((step) => step.status === 'ready')
    .slice(0, 3);

  return {
    headline: 'Morning qualified-share digest',
    cta: 'Challenge my underwriting.',
    loopStage: insights.bottleneck,
    healthScore: insights.healthScore,
    earnedCredits: rewardBrief.earnedCredits,
    remainingCreditsToday: insights.remainingCreditsToday,
    nextQualifiedAction: insights.nextQualifiedAction,
    prioritizedRecipientSource,
    morningChecklist: readySteps.map((step, index) => ({
      rank: index + 1,
      ownerAction: step.ownerAction,
      recipientCopy: step.prompt,
      qualifiesWhen: step.qualifiesWhen,
      creditAmount: step.creditAmount,
    })),
    exportCreditCopy: rewardBrief.bestNextReward
      ? `Next best reward: ${rewardBrief.bestNextReward.creditAmount} Google Sheets export credit${rewardBrief.bestNextReward.creditAmount === 1 ? '' : 's'} for a qualified ${rewardBrief.bestNextReward.action.replace('_', ' ')}.`
      : 'No Google Sheets export credits should be promised until a qualified action has remaining cap.',
    riskFlags,
    antiAbuseGuardrail: 'This digest is qualified-action only: unique opens, meaningful challenges, forks, signups, and saved versions can earn Google Sheets export credits within caps. Raw share clicks never earn credits.',
  };
}

export function getRecipientShareCoaching(funnel: RecipientInviteFunnelSegment[]): RecipientShareCoaching[] {
  return funnel
    .map((segment) => {
      const unopenedCount = Math.max(segment.invitedCount - segment.openedCount, 0);
      const baseGuardrail = 'Reward copy should promise Google Sheets export credits only for qualified opens, challenges, forks, signups, or saved versions — never raw share clicks.';

      if (segment.openedCount === 0) {
        return {
          source: segment.source,
          priority: segment.invitedCount * 10,
          stage: 'get_opens' as const,
          nextQualifiedAction: 'unique_open' as const,
          headline: `${segment.source} has ${unopenedCount} unopened Challenge my underwriting invite${unopenedCount === 1 ? '' : 's'}.`,
          suggestedCopy: 'Challenge my underwriting — open the deal and tell me which assumption you disagree with first.',
          creditGuardrail: baseGuardrail,
        };
      }

      if (segment.challengeRate < 0.35) {
        return {
          source: segment.source,
          priority: Math.round((segment.openedCount - segment.challengedCount) * 12),
          stage: 'ask_for_challenges' as const,
          nextQualifiedAction: 'challenge' as const,
          headline: `${segment.source} recipients are opening, but not challenging assumptions yet.`,
          suggestedCopy: 'Challenge my underwriting — rent, vacancy, expenses, or exit cap: pick one number you would change.',
          creditGuardrail: baseGuardrail,
        };
      }

      if (segment.versionRate < 0.5) {
        return {
          source: segment.source,
          priority: Math.round((segment.challengedCount - segment.versionedCount) * 14),
          stage: 'convert_to_versions' as const,
          nextQualifiedAction: 'saved_version' as const,
          headline: `${segment.source} is producing challenges. Push for saved/forked versions next.`,
          suggestedCopy: 'Challenge my underwriting and save your version — I want to compare your assumptions side by side.',
          creditGuardrail: baseGuardrail,
        };
      }

      if (segment.signupRate < 0.4) {
        return {
          source: segment.source,
          priority: Math.round((segment.versionedCount - segment.signupCount) * 16),
          stage: 'convert_to_accounts' as const,
          nextQualifiedAction: 'signup' as const,
          headline: `${segment.source} has saved/forked versions that are not tied to accounts yet.`,
          suggestedCopy: 'Challenge my underwriting, save your version, and create an account so you can share it onward for Google Sheets export credits.',
          creditGuardrail: baseGuardrail,
        };
      }

      return {
        source: segment.source,
        priority: Math.max(1, segment.signupCount * 8 + segment.versionedCount * 4),
        stage: 'amplify' as const,
        nextQualifiedAction: 'fork' as const,
        headline: `${segment.source} is moving recipients through the underwriting loop.`,
        suggestedCopy: 'Challenge my underwriting — this version already has investor feedback. What did we miss?',
        creditGuardrail: baseGuardrail,
      };
    })
    .filter((coaching) => coaching.priority > 0)
    .sort((left, right) => right.priority - left.priority || left.source.localeCompare(right.source));
}

export async function getRecipientInviteFunnel(database: DatabaseAdapter, shareId: number): Promise<RecipientInviteFunnelSegment[]> {
  const result = await database.query(
    `SELECT r.source,
            COUNT(DISTINCT r.id)::int AS invited_count,
            COUNT(DISTINCT r.id) FILTER (WHERE r.last_opened_at IS NOT NULL)::int AS opened_count,
            COUNT(DISTINCT r.recipient_hash) FILTER (WHERE a.action = 'challenge' AND a.qualified = true)::int AS challenged_count,
            COUNT(DISTINCT r.recipient_hash) FILTER (WHERE a.action IN ('fork', 'saved_version') AND a.qualified = true)::int AS versioned_count,
            COUNT(DISTINCT r.recipient_hash) FILTER (WHERE a.action = 'signup' AND a.qualified = true)::int AS signup_count,
            COALESCE(SUM(a.credit_amount) FILTER (WHERE a.qualified = true), 0)::int AS credit_awarded
     FROM underwriting_share_recipients r
     LEFT JOIN underwriting_share_actions a
       ON a.share_id = r.share_id AND a.recipient_hash = r.recipient_hash
     WHERE r.share_id = $1
     GROUP BY r.source
     ORDER BY invited_count DESC, r.source ASC`,
    [shareId],
  );

  return result.rows.map((row) => {
    const invitedCount = Number(row.invited_count || 0);
    const openedCount = Number(row.opened_count || 0);
    const challengedCount = Number(row.challenged_count || 0);
    const versionedCount = Number(row.versioned_count || 0);
    const signupCount = Number(row.signup_count || 0);

    return {
      source: row.source || 'manual',
      invitedCount,
      openedCount,
      challengedCount,
      versionedCount,
      signupCount,
      creditAwarded: Number(row.credit_awarded || 0),
      openRate: getConversionRate(openedCount, invitedCount),
      challengeRate: getConversionRate(challengedCount, openedCount),
      versionRate: getConversionRate(versionedCount, challengedCount),
      signupRate: getConversionRate(signupCount, versionedCount),
    };
  });
}

export async function getShareActionSummary(database: DatabaseAdapter, shareId: number, recentLimit = 10) {
  const summaryResult = await database.query(
    `SELECT action,
            COUNT(*)::int AS total_count,
            COUNT(*) FILTER (WHERE qualified = true)::int AS qualified_count,
            COUNT(*) FILTER (WHERE qualified = false)::int AS capped_count,
            COUNT(*) FILTER (WHERE qualified = true AND created_at >= CURRENT_DATE)::int AS daily_qualified_count,
            COALESCE(SUM(credit_amount), 0)::int AS credit_awarded,
            MAX(created_at) AS last_action_at
     FROM underwriting_share_actions
     WHERE share_id = $1
     GROUP BY action`,
    [shareId],
  );

  const byAction = Object.fromEntries(
    QUALIFIED_ACTIONS.map((action) => [
      action,
      {
        totalCount: 0,
        qualifiedCount: 0,
        cappedCount: 0,
        creditAwarded: 0,
        dailyQualifiedCount: 0,
        dailyRemainingShareCap: ACTION_POLICIES[action].dailyShareCap,
        lastActionAt: null as string | null,
      },
    ]),
  ) as ShareActionSummary;

  for (const row of summaryResult.rows) {
    if (!isQualifiedShareAction(row.action)) {
      continue;
    }

    const dailyQualifiedCount = Number(row.daily_qualified_count || 0);
    byAction[row.action] = {
      totalCount: Number(row.total_count || 0),
      qualifiedCount: Number(row.qualified_count || 0),
      cappedCount: Number(row.capped_count || 0),
      creditAwarded: Number(row.credit_awarded || 0),
      dailyQualifiedCount,
      dailyRemainingShareCap: Math.max(ACTION_POLICIES[row.action].dailyShareCap - dailyQualifiedCount, 0),
      lastActionAt: row.last_action_at || null,
    };
  }

  const recipientResult = await database.query(
    `SELECT COUNT(DISTINCT recipient_hash)::int AS unique_recipient_count,
            COUNT(DISTINCT recipient_hash) FILTER (WHERE qualified = true)::int AS qualified_recipient_count
     FROM underwriting_share_actions
     WHERE share_id = $1`,
    [shareId],
  );

  const recentResult = await database.query(
    `SELECT id, action, qualified, credit_type, credit_amount, metadata, created_at
     FROM underwriting_share_actions
     WHERE share_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [shareId, recentLimit],
  );

  const inviteResult = await database.query(
    `SELECT COUNT(*)::int AS invited_recipient_count,
            COUNT(*) FILTER (WHERE last_opened_at IS NULL)::int AS unopened_recipient_count
     FROM underwriting_share_recipients
     WHERE share_id = $1`,
    [shareId],
  );

  const inviteFunnel = await getRecipientInviteFunnel(database, shareId);

  const totals = Object.values(byAction).reduce(
    (runningTotals, actionSummary) => ({
      totalCount: runningTotals.totalCount + actionSummary.totalCount,
      qualifiedCount: runningTotals.qualifiedCount + actionSummary.qualifiedCount,
      cappedCount: runningTotals.cappedCount + actionSummary.cappedCount,
      creditAwarded: runningTotals.creditAwarded + actionSummary.creditAwarded,
    }),
    { totalCount: 0, qualifiedCount: 0, cappedCount: 0, creditAwarded: 0 },
  );

  const uniqueRecipientCount = Number(recipientResult.rows[0]?.unique_recipient_count || 0);
  const qualifiedRecipientCount = Number(recipientResult.rows[0]?.qualified_recipient_count || 0);
  const invitedRecipientCount = Number(inviteResult.rows[0]?.invited_recipient_count || 0);
  const unopenedRecipientCount = Number(inviteResult.rows[0]?.unopened_recipient_count || 0);

  return {
    byAction,
    totals,
    uniqueRecipientCount,
    qualifiedRecipientCount,
    invitedRecipientCount,
    unopenedRecipientCount,
    inviteFunnel,
    conversionRates: {
      openToChallenge: getConversionRate(byAction.challenge.qualifiedCount, byAction.unique_open.qualifiedCount),
      challengeToForkOrSavedVersion: getConversionRate(
        byAction.fork.qualifiedCount + byAction.saved_version.qualifiedCount,
        byAction.challenge.qualifiedCount,
      ),
      forkOrSavedVersionToSignup: getConversionRate(
        byAction.signup.qualifiedCount,
        byAction.fork.qualifiedCount + byAction.saved_version.qualifiedCount,
      ),
    },
    growthNudge: getShareGrowthNudge(byAction),
    conversionInsights: getShareConversionInsights({ byAction, invitedRecipientCount, unopenedRecipientCount }),
    rewardBrief: getQualifiedShareRewardBrief(byAction),
    loopPlan: getQualifiedShareLoopPlan({ byAction, inviteFunnel, invitedRecipientCount, unopenedRecipientCount }),
    sharePlaybook: getQualifiedSharePlaybook({ byAction, inviteFunnel, invitedRecipientCount, unopenedRecipientCount }),
    qualifiedShareDigest: getQualifiedShareDigest({ byAction, inviteFunnel, invitedRecipientCount, unopenedRecipientCount }),
    challengeResponseNudges: getChallengeResponseNudges({ byAction, inviteFunnel }),
    recipientCoaching: getRecipientShareCoaching(inviteFunnel),
    recentActions: recentResult.rows.map((row) => ({
      id: row.id,
      action: row.action,
      qualified: Boolean(row.qualified),
      creditType: row.credit_type,
      creditAmount: Number(row.credit_amount || 0),
      metadata: row.metadata || {},
      createdAt: row.created_at,
    })),
  };
}

export function createUnderwritingShareRouter(database: DatabaseAdapter = defaultDb): Router {
  const router = Router();

  router.post('/analyses/:id/share', authenticateOptional, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.userId || null;
      const result = await database.query(
        `SELECT id, user_id FROM deal_analyses WHERE id = $1 AND ($2::int IS NULL OR user_id = $2)`,
        [id, userId],
      );

      if (!result.rows[0]) {
        res.status(404).json({ error: 'Analysis not found' });
        return;
      }

      const created = await createUnderwritingShare(database, {
        analysisId: id,
        inviterUserId: userId,
        source: req.body?.source || 'analysis',
      });

      res.json({
        success: true,
        shareId: created.id,
        token: created.token,
        shareUrl: created.shareUrl,
        cta: created.cta,
        shareDepth: created.shareDepth,
        shareCard: created.shareCard,
        rewardPolicy: created.rewardPolicy,
        qualifiedActionCatalog: getQualifiedActionCatalog(),
        qualifiedActionProofGuide: getQualifiedActionProofGuide(),
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.get('/underwriting-shares/:token', async (req: Request, res: Response) => {
    try {
      const result = await database.query(
        `SELECT s.id, s.token, s.status, s.analysis_id, s.inviter_user_id,
                a.property_address, a.metrics, a.inputs, a.verdict_check, a.notes, a.city, a.province
         FROM underwriting_shares s
         JOIN deal_analyses a ON a.id = s.analysis_id
         WHERE s.token = $1`,
        [req.params.token],
      );

      const row = result.rows[0];
      if (!row || row.status !== 'active') {
        res.status(404).json({ error: 'Share not found' });
        return;
      }

      const recipientHash = getRecipientHash(req, req.query.recipient as string | undefined);
      const open = await recordQualifiedShareAction(database, {
        shareId: row.id,
        inviterUserId: row.inviter_user_id,
        action: 'unique_open',
        recipientHash,
        metadata: { referrer: req.headers.referer || null },
      });

      if (typeof req.query.recipient === 'string' && req.query.recipient.trim()) {
        await database.query(
          `UPDATE underwriting_share_recipients
           SET last_opened_at = NOW()
           WHERE share_id = $1 AND recipient_hash = $2`,
          [row.id, recipientHash],
        );
      }

      res.json({
        token: row.token,
        cta: 'Challenge my underwriting.',
        analysis: {
          id: row.analysis_id,
          propertyAddress: row.property_address,
          city: row.city,
          province: row.province,
          metrics: row.metrics || {},
          inputs: row.inputs || {},
          verdictCheck: row.verdict_check,
          notes: row.notes,
        },
        visitorQualification: open,
        shareCard: getChallengeShareCard({
          token: row.token,
          recipientKey: typeof req.query.recipient === 'string' ? req.query.recipient : null,
          source: 'recipient_open',
          nextQualifiedAction: 'challenge',
        }),
        qualifiedActionCatalog: getQualifiedActionCatalog(),
        qualifiedActionProofGuide: getQualifiedActionProofGuide('challenge'),
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.post('/underwriting-shares/:token/recipients', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const recipients = Array.isArray(req.body?.recipients) ? req.body.recipients : [];
      if (recipients.length === 0 || recipients.length > 25) {
        res.status(400).json({ error: 'Provide 1-25 recipient labels or objects to generate tracked share links' });
        return;
      }

      const shareResult = await database.query(
        `SELECT id, token, status FROM underwriting_shares WHERE token = $1 AND inviter_user_id = $2`,
        [req.params.token, req.userId],
      );
      const share = shareResult.rows[0];
      if (!share || share.status !== 'active') {
        res.status(404).json({ error: 'Share not found' });
        return;
      }

      const links = await createUnderwritingShareRecipientLinks(database, {
        shareId: share.id,
        token: share.token,
        createdByUserId: req.userId!,
        recipients,
        source: req.body?.source || 'manual',
      });

      res.json({
        success: true,
        cta: 'Challenge my underwriting.',
        links,
        shareCard: getChallengeShareCard({ token: share.token, source: req.body?.source || 'manual' }),
        rewardPolicy: getRewardPolicySnapshot(),
        qualifiedActionCatalog: getQualifiedActionCatalog(),
        qualifiedActionProofGuide: getQualifiedActionProofGuide(),
        creditGuardrail: 'Creating recipient links never awards credits. Credits require qualified opens, challenges, forks, signups, or saved versions within caps.',
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.post('/underwriting-shares/:token/actions', authenticateOptional, async (req: AuthRequest, res: Response) => {
    try {
      const { action, recipient, metadata } = req.body || {};
      if (!isQualifiedShareAction(action) || action === 'unique_open') {
        res.status(400).json({ error: 'A qualified action is required: challenge, fork, signup, saved_version' });
        return;
      }

      const qualificationBlockReason = getShareActionQualificationBlockReason(action, metadata, req.userId);
      if (qualificationBlockReason) {
        res.status(action === 'signup' ? 401 : 400).json({
          error: qualificationBlockReason,
          cta: 'Challenge my underwriting.',
          creditGuardrail: 'Credits require qualified opens, challenges, forks, signups, or saved versions within anti-abuse caps — never raw share clicks alone.',
        });
        return;
      }

      const shareResult = await database.query(
        `SELECT id, inviter_user_id, analysis_id, status, share_depth FROM underwriting_shares WHERE token = $1`,
        [req.params.token],
      );
      const share = shareResult.rows[0];
      if (!share || share.status !== 'active') {
        res.status(404).json({ error: 'Share not found' });
        return;
      }

      const recorded = await recordQualifiedShareAction(database, {
        shareId: share.id,
        inviterUserId: share.inviter_user_id,
        action,
        recipientHash: getRecipientHash(req, recipient),
        metadata: { ...(metadata || {}), userId: req.userId || null },
        authenticatedUserId: req.userId || null,
      });

      let savedAnalysisId: number | null = null;
      let onwardShare: Awaited<ReturnType<typeof createUnderwritingShare>> | null = null;

      if (recorded.status === 'qualified' && (action === 'fork' || action === 'saved_version') && req.userId) {
        const source = await database.query(`SELECT * FROM deal_analyses WHERE id = $1`, [share.analysis_id]);
        const sourceAnalysis = source.rows[0];
        if (sourceAnalysis) {
          const saved = await database.query(
            `INSERT INTO deal_analyses (
               property_address, user_id, metrics, inputs, verdict_check, listing_id, city, province,
               property_type, bedrooms, bathrooms, sqft, year_built, matched_listing, notes
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
             RETURNING id`,
            [
              sourceAnalysis.property_address,
              req.userId,
              metadata?.metrics || sourceAnalysis.metrics,
              metadata?.inputs || sourceAnalysis.inputs,
              metadata?.verdictCheck || sourceAnalysis.verdict_check,
              sourceAnalysis.listing_id,
              sourceAnalysis.city,
              sourceAnalysis.province,
              sourceAnalysis.property_type,
              sourceAnalysis.bedrooms,
              sourceAnalysis.bathrooms,
              sourceAnalysis.sqft,
              sourceAnalysis.year_built,
              sourceAnalysis.matched_listing,
              metadata?.notes || `Forked via “Challenge my underwriting.” share ${req.params.token}`,
            ],
          );
          savedAnalysisId = saved.rows[0]?.id || null;

          if (savedAnalysisId) {
            onwardShare = await createUnderwritingShare(database, {
              analysisId: savedAnalysisId,
              inviterUserId: req.userId,
              source: `challenger_${action}`,
              parentShareId: share.id,
              parentShareActionId: recorded.actionId || null,
              parentShareDepth: Number(share.share_depth || 0),
            });

            if (recorded.actionId) {
              await database.query(
                `UPDATE underwriting_share_actions
                 SET metadata = metadata || $2::jsonb
                 WHERE id = $1`,
                [recorded.actionId, { savedAnalysisId, onwardShareId: onwardShare.id, onwardShareToken: onwardShare.token }],
              );
            }
          }
        }
      }

      res.json({
        success: true,
        ...recorded,
        savedAnalysisId,
        onwardShare,
        recipientLoopHandoff: getRecipientLoopHandoff({
          action,
          status: recorded.status,
          qualified: recorded.qualified,
          creditAmount: recorded.creditAmount,
          savedAnalysisId,
          onwardShare,
        }),
        challengeResponseNudges: onwardShare ? getChallengeResponseNudges({
          byAction: Object.fromEntries(
            QUALIFIED_ACTIONS.map((qualifiedAction) => [
              qualifiedAction,
              {
                totalCount: qualifiedAction === action ? 1 : 0,
                qualifiedCount: qualifiedAction === action && recorded.qualified ? 1 : 0,
                cappedCount: recorded.status === 'capped' && qualifiedAction === action ? 1 : 0,
                creditAwarded: qualifiedAction === action ? recorded.creditAmount : 0,
                dailyQualifiedCount: qualifiedAction === action && recorded.qualified ? 1 : 0,
                dailyRemainingShareCap: Math.max(ACTION_POLICIES[qualifiedAction].dailyShareCap - (qualifiedAction === action && recorded.qualified ? 1 : 0), 0),
                lastActionAt: null,
              },
            ]),
          ) as ShareActionSummary,
          inviteFunnel: [],
        }) : [],
        qualifiedActionCatalog: getQualifiedActionCatalog(),
        qualifiedActionProofGuide: getQualifiedActionProofGuide(action),
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.post('/underwriting-shares/:token/actions/preview', authenticateOptional, async (req: AuthRequest, res: Response) => {
    try {
      const { action, recipient, metadata } = req.body || {};
      if (!isQualifiedShareAction(action) || action === 'unique_open') {
        res.status(400).json({ error: 'A qualified action is required: challenge, fork, signup, saved_version' });
        return;
      }

      const shareResult = await database.query(
        `SELECT id, status FROM underwriting_shares WHERE token = $1`,
        [req.params.token],
      );
      const share = shareResult.rows[0];
      if (!share || share.status !== 'active') {
        res.status(404).json({ error: 'Share not found' });
        return;
      }

      const preview = await previewQualifiedShareActionCredit(database, {
        shareId: share.id,
        action,
        recipientHash: getRecipientHash(req, recipient),
        metadata,
        authenticatedUserId: req.userId || null,
      });

      res.json({
        success: true,
        action,
        ...preview,
        qualifiedActionCatalog: getQualifiedActionCatalog(),
        qualifiedActionProofGuide: getQualifiedActionProofGuide(action),
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.get('/underwriting-shares/:token/status', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const result = await database.query(
        `SELECT id, token, status, qualified_action_count, credit_awarded, last_qualified_action_at,
                parent_share_id, parent_share_action_id, share_depth
         FROM underwriting_shares
         WHERE token = $1 AND inviter_user_id = $2`,
        [req.params.token, req.userId],
      );

      if (!result.rows[0]) {
        res.status(404).json({ error: 'Share not found' });
        return;
      }

      const share = result.rows[0];
      const actionSummary = await getShareActionSummary(database, share.id);

      res.json({
        ...share,
        cta: 'Challenge my underwriting.',
        shareUrl: `/underwriting/${share.token}`,
        shareCard: getChallengeShareCard({
          token: share.token,
          source: 'status',
          nextQualifiedAction: actionSummary.conversionInsights.nextQualifiedAction,
        }),
        rewardPolicy: getRewardPolicySnapshot(),
        qualifiedActionCatalog: getQualifiedActionCatalog(),
        qualifiedActionProofGuide: getQualifiedActionProofGuide(actionSummary.conversionInsights.nextQualifiedAction),
        actionSummary,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.get('/premium-credits/google-sheets-export', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const balance = await getGoogleSheetsExportCreditBalance(database, req.userId!);
      res.json({ success: true, ...balance, qualifiedActionCatalog: getQualifiedActionCatalog() });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.post('/premium-credits/google-sheets-export/redemptions', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const redemption = await redeemGoogleSheetsExportCredits(database, {
        userId: req.userId!,
        creditAmount: req.body?.creditAmount || 1,
        reason: req.body?.reason || 'Google Sheets export',
        metadata: req.body?.metadata || {},
      });

      if (!redemption.redeemed) {
        res.status(402).json({
          success: false,
          ...redemption,
          earnPrompt: 'Challenge my underwriting — earn export credits when recipients open, challenge, fork, sign up, or save versions within anti-abuse caps.',
        });
        return;
      }

      res.json({
        success: true,
        ...redemption,
        creditGuardrail: 'Credits redeemed here must have been earned from qualified underwriting share actions, never raw share clicks alone.',
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  return router;
}

export default createUnderwritingShareRouter;
