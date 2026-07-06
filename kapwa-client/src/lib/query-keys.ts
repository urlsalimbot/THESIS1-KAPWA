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
} as const;
