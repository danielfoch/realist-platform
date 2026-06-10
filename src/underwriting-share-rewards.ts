export type QualifiedShareAction = 'unique_open' | 'fork_challenge' | 'signup' | 'saved_version';
export type ShareActionStatus = 'qualified' | 'duplicate' | 'capped' | 'unqualified';

export interface ShareRewardPolicy {
  dailyCreditCap: number;
  creditsByAction: Record<QualifiedShareAction, number>;
}

export interface ShareActionInput {
  actionType: string;
  visitorKey?: string | null;
  recipientEmailHash?: string | null;
  actorUserId?: number | null;
  alreadyTrackedToday?: number;
}

export interface ShareRewardDecision {
  qualified: boolean;
  creditDelta: number;
  status: ShareActionStatus;
  reason: string;
}

export const DEFAULT_SHARE_REWARD_POLICY: ShareRewardPolicy = {
  dailyCreditCap: 5,
  creditsByAction: {
    unique_open: 1,
    fork_challenge: 2,
    signup: 3,
    saved_version: 3,
  },
};

export const QUALIFIED_SHARE_ACTIONS: QualifiedShareAction[] = [
  'unique_open',
  'fork_challenge',
  'signup',
  'saved_version',
];

const qualifiedActions = new Set<QualifiedShareAction>(QUALIFIED_SHARE_ACTIONS);

export function isQualifiedShareAction(actionType: string): actionType is QualifiedShareAction {
  return qualifiedActions.has(actionType as QualifiedShareAction);
}

export function normalizeVisitorKey(input: {
  visitorId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  actorUserId?: number | null;
}): string | null {
  if (input.actorUserId) {
    return `user:${input.actorUserId}`;
  }

  const visitorId = input.visitorId?.trim();
  if (visitorId) {
    return `visitor:${visitorId.slice(0, 128)}`;
  }

  const ip = input.ip?.trim();
  const userAgent = input.userAgent?.trim();
  if (ip && userAgent) {
    return `anon:${ip}:${userAgent.slice(0, 160)}`;
  }

  return null;
}

export function decideShareReward(
  input: ShareActionInput,
  policy: ShareRewardPolicy = DEFAULT_SHARE_REWARD_POLICY,
): ShareRewardDecision {
  if (!isQualifiedShareAction(input.actionType)) {
    return {
      qualified: false,
      creditDelta: 0,
      status: 'unqualified',
      reason: 'Raw share clicks are tracked but do not qualify for credits.',
    };
  }

  if (!input.visitorKey && !input.recipientEmailHash && !input.actorUserId) {
    return {
      qualified: false,
      creditDelta: 0,
      status: 'unqualified',
      reason: 'Qualified rewards require a unique visitor, recipient, or authenticated actor.',
    };
  }

  const alreadyTrackedToday = input.alreadyTrackedToday ?? 0;
  if (alreadyTrackedToday >= policy.dailyCreditCap) {
    return {
      qualified: true,
      creditDelta: 0,
      status: 'capped',
      reason: 'Daily qualified sharing credit cap reached.',
    };
  }

  return {
    qualified: true,
    creditDelta: policy.creditsByAction[input.actionType as QualifiedShareAction],
    status: 'qualified',
    reason: 'Qualified sharing action eligible for premium export credits.',
  };
}


export interface ShareActionStatusCount {
  actionType: string;
  status: ShareActionStatus | 'tracked';
  count: number;
  creditDelta: number;
}

export interface ShareRewardStatusInput {
  qualifiedActionCount: number;
  exportCreditBalance: number;
  creditedActionsToday: number;
  actionCounts: ShareActionStatusCount[];
  policy?: ShareRewardPolicy;
}

export interface ShareRewardStatusSummary {
  cta: 'Challenge my underwriting.';
  exportCreditBalance: number;
  qualifiedActionCount: number;
  dailyCreditCap: number;
  remainingCreditsToday: number;
  qualifiedActions: QualifiedShareAction[];
  nextQualifiedActions: QualifiedShareAction[];
  actionCounts: ShareActionStatusCount[];
  rewardStatus: 'pending' | 'earning' | 'capped';
  premiumCreditUse: 'Google Sheets export credits';
}

export function summarizeShareRewardStatus(input: ShareRewardStatusInput): ShareRewardStatusSummary {
  const policy = input.policy || DEFAULT_SHARE_REWARD_POLICY;
  const earnedActionTypes = new Set(
    input.actionCounts
      .filter((row) => row.status === 'qualified' && row.creditDelta > 0)
      .map((row) => row.actionType),
  );
  const remainingCreditsToday = Math.max(policy.dailyCreditCap - input.creditedActionsToday, 0);

  return {
    cta: 'Challenge my underwriting.',
    exportCreditBalance: input.exportCreditBalance,
    qualifiedActionCount: input.qualifiedActionCount,
    dailyCreditCap: policy.dailyCreditCap,
    remainingCreditsToday,
    qualifiedActions: QUALIFIED_SHARE_ACTIONS,
    nextQualifiedActions: QUALIFIED_SHARE_ACTIONS.filter((actionType) => !earnedActionTypes.has(actionType)),
    actionCounts: input.actionCounts,
    rewardStatus: remainingCreditsToday === 0 ? 'capped' : input.exportCreditBalance > 0 ? 'earning' : 'pending',
    premiumCreditUse: 'Google Sheets export credits',
  };
}
