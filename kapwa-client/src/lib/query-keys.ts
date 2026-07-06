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
    list: (params?: { status?: string; page?: number; limit?: number }) =>
      memo(`cases.list.${JSON.stringify(params ?? {})}`, () =>
        ['cases', 'list', params ?? {}] as const,
      ),
    detail: (id: string) => memo(`cases.detail.${id}`, () => ['cases', 'detail', id] as const),
  },
  beneficiaries: {
    all: ['beneficiaries'] as const,
    list: (params?: { search?: string; category?: string; barangay?: string; page?: number; limit?: number }) =>
      memo(`beneficiaries.list.${JSON.stringify(params ?? {})}`, () =>
        ['beneficiaries', 'list', params ?? {}] as const,
      ),
    detail: (id: string) => memo(`beneficiaries.detail.${id}`, () => ['beneficiaries', 'detail', id] as const),
    familyGraph: (id: string) =>
      memo(`beneficiaries.familyGraph.${id}`, () => ['beneficiaries', 'family-graph', id] as const),
    myAccessCard: () => memo('beneficiaries.myAccessCard', () => ['beneficiaries', 'me', 'access-card'] as const),
    myServices: () => memo('beneficiaries.myServices', () => ['beneficiaries', 'me', 'services'] as const),
    myConsent: () => memo('beneficiaries.myConsent', () => ['beneficiaries', 'me', 'consent'] as const),
  },
  dashboard: {
    all: ['dashboard'] as const,
    stats: () => memo('dashboard.stats', () => ['dashboard', 'stats'] as const),
    mayorReports: () => memo('dashboard.mayorReports', () => ['dashboard', 'reports', 'mayor'] as const),
  },
  notifications: {
    all: ['notifications'] as const,
    list: () => memo('notifications.list', () => ['notifications', 'list'] as const),
    unreadCount: () => memo('notifications.unreadCount', () => ['notifications', 'unread-count'] as const),
  },
  audit: {
    all: ['audit'] as const,
    hashChains: () => memo('audit.hashChains', () => ['audit', 'hash-chains'] as const),
    consentLedger: (beneficiaryId?: string) =>
      memo(`audit.consentLedger.${beneficiaryId ?? ''}`, () =>
        ['audit', 'consent-ledger', beneficiaryId ?? null] as const,
      ),
  },
  admin: {
    all: ['admin'] as const,
    programs: () => memo('admin.programs', () => ['admin', 'programs'] as const),
    users: () => memo('admin.users', () => ['admin', 'users'] as const),
    syncEntries: () => memo('admin.syncEntries', () => ['admin', 'sync-entries'] as const),
    auditLogs: () => memo('admin.auditLogs', () => ['admin', 'audit-logs'] as const),
  },
  accessCards: {
    all: ['accessCards'] as const,
    list: () => memo('accessCards.list', () => ['accessCards', 'list'] as const),
    log: () => memo('accessCards.log', () => ['accessCards', 'log'] as const),
    print: (id: string) => memo(`accessCards.print.${id}`, () => ['accessCards', 'print', id] as const),
  },
  filing: {
    all: ['filing'] as const,
    byCategory: (category: string) =>
      memo(`filing.byCategory.${category}`, () => ['filing', 'by-category', category] as const),
  },
  programs: {
    all: ['programs'] as const,
    list: () => memo('programs.list', () => ['programs', 'list'] as const),
    detail: (id: string) => memo(`programs.detail.${id}`, () => ['programs', 'detail', id] as const),
  },
  tracker: {
    all: ['tracker'] as const,
    daily: (params: { date: string }) =>
      memo(`tracker.daily.${params.date}`, () => ['tracker', 'daily', params.date] as const),
    stats: () => memo('tracker.stats', () => ['tracker', 'stats'] as const),
    list: () => memo('tracker.list', () => ['tracker', 'list'] as const),
  },
  messages: {
    all: ['messages'] as const,
    list: () => memo('messages.list', () => ['messages', 'list'] as const),
    conversation: (userId: string) =>
      memo(`messages.conversation.${userId}`, () => ['messages', 'conversation', userId] as const),
    unread: () => memo('messages.unread', () => ['messages', 'unread'] as const),
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
    list: () => memo('irf.list', () => ['irf', 'list'] as const),
    detail: (id: string) => memo(`irf.detail.${id}`, () => ['irf', 'detail', id] as const),
  },
  csr: {
    all: ['csr'] as const,
    list: () => memo('csr.list', () => ['csr', 'list'] as const),
  },
  intake: {
    all: ['intake'] as const,
    recent: () => memo('intake.recent', () => ['intake', 'recent'] as const),
  },
  programAssignments: {
    all: ['programAssignments'] as const,
    list: (caseId?: string) =>
      memo(`programAssignments.list.${caseId ?? ''}`, () =>
        ['program-assignments', 'list', caseId ?? null] as const,
      ),
    detail: (id: string) =>
      memo(`programAssignments.detail.${id}`, () => ['program-assignments', 'detail', id] as const),
  },
  auth: {
    me: () => memo('auth.me', () => ['auth', 'me'] as const),
  },
  users: {
    all: ['users'] as const,
    list: () => memo('users.list', () => ['users', 'list'] as const),
  },
} as const;
