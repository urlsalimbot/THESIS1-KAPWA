export interface BreadcrumbItem {
  label: string;
  href: string;
}

const BREADCRUMB_LABELS: Record<string, string> = {
  '/': 'Dashboard',
  '/intake': 'GIS Intake',
  '/cases': 'Cases',
  '/beneficiaries': 'Beneficiaries',
  '/interventions': 'Interventions',
  '/approvals': 'Approvals',
  '/admin/programs': 'Programs',
  '/tracker': 'Daily Tracker',
  '/reports': 'Reports',
  '/audit-logs': 'Audit Logs',
  '/admin': 'Admin Panel',
  '/settings/mfa': 'MFA Settings',
  '/my-dashboard': 'My Dashboard',
  '/my-access-card': 'My Access Card',
  '/irf': 'Incident Reports',
  '/access-cards': 'Access Cards',
  '/messages': 'Messages',
  '/coordinator': 'Barangay Coordinator',
  '/settings': 'Settings',
};

// UUID-deep routes (a case, beneficiary, IRF, program, …) carry the id in the
// URL, but the crumb should read something human (a control number, a name, a
// blotter number). Pages register their label here after loading; the breadcrumb
// re-renders when the registry changes.
const entityLabels = new Map<string, string>();
const listeners = new Set<() => void>();
let registryVersion = 0;

export function setBreadcrumbLabel(id: string, label: string): void {
  if (!id || !label || entityLabels.get(id) === label) return;
  entityLabels.set(id, label);
  registryVersion++;
  listeners.forEach((l) => l());
}

/** @deprecated Use setBreadcrumbLabel — kept for existing case-view callers. */
export const setCaseLabel = setBreadcrumbLabel;

export function subscribeCaseLabels(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function caseLabelVersion(): number {
  return registryVersion;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Singular noun for the parent segment, so an unregistered UUID crumb reads
// "Beneficiary 01a0cdc7" / "Incident Report 01a0cdd8" instead of always "Case …".
const UUID_PARENT_NOUN: Record<string, string> = {
  cases: 'Case',
  beneficiaries: 'Beneficiary',
  beneficiary: 'Access Card',
  irf: 'Incident Report',
  programs: 'Program',
  messages: 'Message',
  referrals: 'Referral',
  announcements: 'Announcement',
  users: 'User',
  agencies: 'Agency',
};

export function createBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean);
  const crumbs: BreadcrumbItem[] = [];
  let accumulated = '';

  segments.forEach((segment, i) => {
    accumulated += '/' + segment;
    if (UUID_RE.test(segment)) {
      const noun = UUID_PARENT_NOUN[segments[i - 1]] || 'Record';
      const label = entityLabels.get(segment) ?? `${noun} ${segment.slice(0, 8)}`;
      crumbs.push({ label, href: accumulated });
      return;
    }
    const label = BREADCRUMB_LABELS[accumulated]
      || segment.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    crumbs.push({ label, href: accumulated });
  });

  return crumbs;
}
