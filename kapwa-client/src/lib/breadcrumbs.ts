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

// A case route carries the UUID, but the crumb should read the human-readable
// control number (KAPWA-2026-00001). Pages that load the case register the label
// here; the breadcrumb re-renders when the registry changes.
const caseLabels = new Map<string, string>();
const listeners = new Set<() => void>();
let registryVersion = 0;

export function setCaseLabel(caseId: string, controlNo: string): void {
  if (!caseId || !controlNo || caseLabels.get(caseId) === controlNo) return;
  caseLabels.set(caseId, controlNo);
  registryVersion++;
  listeners.forEach((l) => l());
}

export function subscribeCaseLabels(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function caseLabelVersion(): number {
  return registryVersion;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean);
  const crumbs: BreadcrumbItem[] = [];
  let accumulated = '';

  for (const segment of segments) {
    accumulated += '/' + segment;
    if (UUID_RE.test(segment)) {
      // Case UUID: show the control number, and keep the real href.
      const label = caseLabels.get(segment) ?? `Case ${segment.slice(0, 8)}`;
      crumbs.push({ label, href: accumulated });
      continue;
    }
    const label = BREADCRUMB_LABELS[accumulated]
      || segment.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    crumbs.push({ label, href: accumulated });
  }

  return crumbs;
}
