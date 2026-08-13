// Memoization cache for stable tuple references (SWR uses reference equality for dedup).
const cache = new Map<string, readonly unknown[]>();
function memo<T extends readonly unknown[]>(key: string, build: () => T): T {
  let result = cache.get(key) as T | undefined;
  if (!result) {
    result = build();
    cache.set(key, result);
  }
  return result;
}

export const queryKeys = {
  cases: {
    all: ['cases'] as const,
    list: (params?: Record<string, unknown>) => {
      const key: unknown[] = ['cases'];
      if (params && Object.keys(params).length > 0) key.push(params);
      return memo(`cases.list.${JSON.stringify(params)}`, () => key as readonly unknown[]);
    },
    detail: (id: string) => memo(`cases.detail.${id}`, () => ['cases', id] as const),
    interventions: (caseId: string) =>
      memo(`cases.interventions.${caseId}`, () => ['cases', caseId, 'interventions'] as const),
  },
  beneficiaries: {
    all: ['beneficiaries'] as const,
    list: (params?: Record<string, unknown>) => {
      const key: unknown[] = ['beneficiaries'];
      if (params && Object.keys(params).length > 0) key.push(params);
      return memo(`beneficiaries.list.${JSON.stringify(params)}`, () => key as readonly unknown[]);
    },
    detail: (id: string) => memo(`beneficiaries.detail.${id}`, () => ['beneficiaries', id] as const),
    familyGraph: (id: string) =>
      memo(`beneficiaries.familyGraph.${id}`, () => ['beneficiaries', id, 'family-graph'] as const),
    myAccessCard: () => memo('beneficiaries.myAccessCard', () => ['beneficiaries', 'me', 'access-card'] as const),
    myServices: () => memo('beneficiaries.myServices', () => ['beneficiaries', 'me', 'services'] as const),
    myConsent: () => memo('beneficiaries.myConsent', () => ['beneficiaries', 'me', 'consent'] as const),
  },
  dashboard: {
    all: ['dashboard'] as const,
    stats: () => memo('dashboard.stats', () => ['dashboard'] as const),
    trends: () => memo('dashboard.trends', () => ['dashboard', 'trends'] as const),
    metrics: () => memo('dashboard.metrics', () => ['dashboard', 'metrics'] as const),
    dailyCounts: (year: number, month: number) =>
      memo(`dashboard.dailyCounts.${year}-${month}`, () => ['dashboard', 'daily-counts', { year, month }] as const),
    mayorReports: () => memo('dashboard.mayorReports', () => ['dashboard', 'reports', 'mayor'] as const),
  },
  notifications: {
    all: ['notifications'] as const,
    list: () => memo('notifications.list', () => ['notifications', 'my'] as const),
    unreadCount: () => memo('notifications.unreadCount', () => ['notifications', 'unread'] as const),
    preferences: () => memo('notifications.preferences', () => ['notifications', 'preferences'] as const),
  },
  audit: {
    all: ['audit'] as const,
    hashChains: () => memo('audit.hashChains', () => ['audit', 'verify-all'] as const),
    consentLedger: (beneficiaryId?: string) =>
      memo(`audit.consentLedger.${beneficiaryId ?? ''}`, () =>
        beneficiaryId
          ? ['audit', 'consent-ledger', { beneficiaryId }] as const
          : ['audit', 'consent-ledger'] as const,
      ),
  },
  admin: {
    all: ['admin'] as const,
    programs: () => memo('admin.programs', () => ['programs'] as const),
    users: () => memo('admin.users', () => ['users'] as const),
    syncEntries: () => memo('admin.syncEntries', () => ['sync', 'conflicts', 'admin'] as const),
    auditLogs: () => memo('admin.auditLogs', () => ['audit', 'logs'] as const),
    lcrImport: () => memo('admin.lcrImport', () => ['lcr', 'import'] as const),
  },
  accessCards: {
    all: ['access-cards'] as const,
    list: () => memo('accessCards.list', () => ['access-cards'] as const),
    log: () => memo('accessCards.log', () => ['access-cards', 'log'] as const),
    print: (id: string) => memo(`accessCards.print.${id}`, () => ['access-cards', 'print', id] as const),
    summary: (benId: string) => memo(`accessCards.summary.${benId}`, () => ['access-cards', 'beneficiary', benId, 'card', 'summary'] as const),
    detail: (benId: string) => memo(`accessCards.detail.${benId}`, () => ['access-cards', 'beneficiary', benId, 'card'] as const),
    agencySummary: (code: string) =>
      memo(`accessCards.agencySummary.${code}`, () => ['access-cards', code, 'summary'] as const),
  },
  agencies: {
    all: ['agencies'] as const,
    list: () => memo('agencies.list', () => ['agencies'] as const),
  },
  interAgencyReferrals: {
    all: ['inter-agency-referrals'] as const,
    inbox: () => memo('iar.inbox', () => ['inter-agency-referrals', 'inbox'] as const),
    byCase: (caseId: string) =>
      memo(`iar.case.${caseId}`, () => ['inter-agency-referrals', 'case', caseId] as const),
  },
  agencyPortal: {
    dashboard: () => memo('agencyPortal.dashboard', () => ['agency-portal', 'dashboard'] as const),
    profile: () => memo('agencyPortal.profile', () => ['agency-portal', 'profile'] as const),
  },
  programs: {
    all: ['programs'] as const,
    list: () => memo('programs.list', () => ['programs'] as const),
    detail: (id: string) => memo(`programs.detail.${id}`, () => ['programs', id] as const),
  },
  tracker: {
    all: ['tracker'] as const,
    daily: (params: { date: string }) =>
      memo(`tracker.daily.${params.date}`, () => {
        const key: unknown[] = ['cases', 'tracker', 'daily'];
        key.push(params);
        return key as readonly unknown[];
      }),
    range: (params: { start: string; end: string }) =>
      memo(`tracker.range.${params.start}.${params.end}`, () => {
        const key: unknown[] = ['cases', 'tracker', 'range'];
        key.push(params);
        return key as readonly unknown[];
      }),
    stats: () => memo('tracker.stats', () => ['cases', 'tracker', 'stats'] as const),
    list: () => memo('tracker.list', () => ['cases', 'tracker', 'daily'] as const),
  },
  announcements: {
    all: ['announcements'] as const,
    list: () => memo('announcements.list', () => ['announcements'] as const),
    public: {
      list: () => memo('announcements.public.list', () => ['announcements', 'public'] as const),
      detail: (slug: string) =>
        memo(`announcements.public.${slug}`, () => ['announcements', 'public', slug] as const),
    },
  },
  messages: {
    all: ['chat'] as const,
    list: () => memo('chat.list', () => ['chat', 'conversations'] as const),
    conversation: (userId: string) =>
      memo(`chat.conversation.${userId}`, () => ['chat', 'conversation', userId] as const),
    unread: () => memo('chat.unread', () => ['chat', 'unread'] as const),
    chatUsers: () => memo('chat.users', () => ['chat', 'users'] as const),
  },
  sync: {
    all: ['sync'] as const,
    sendBatch: () => memo('sync.sendBatch', () => ['sync', 'v1'] as const),
    pull: () => memo('sync.pull', () => ['sync', 'pull'] as const),
    resolveConflict: (id: string) =>
      memo(`sync.resolveConflict.${id}`, () => ['sync', 'conflicts', id, 'resolve'] as const),
  },
  irf: {
    all: ['irf'] as const,
    list: () => memo('irf.list', () => ['irf'] as const),
    detail: (id: string) => memo(`irf.detail.${id}`, () => ['irf', id] as const),
  },
  intake: {
    all: ['intake'] as const,
    recent: () => memo('intake.recent', () => ['intake', 'recent'] as const),
  },
  auth: {
    me: () => memo('auth.me', () => ['auth', 'me'] as const),
  },
  users: {
    all: ['users'] as const,
    list: () => memo('users.list', () => ['users'] as const),
  },
} as const;
