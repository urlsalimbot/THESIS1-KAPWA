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
  '/csr': 'CSR Generator',
  '/filing': 'Digital Filing',
  '/programs': 'Programs',
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
  '/coordinator': 'Coordinator',
  '/settings': 'Settings',
};

export function createBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean);
  const crumbs: BreadcrumbItem[] = [];

  crumbs.push({ label: 'Dashboard', href: '/' });

  let accumulated = '';
  for (const segment of segments) {
    accumulated += '/' + segment;
    const label = BREADCRUMB_LABELS[accumulated]
      || segment.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    crumbs.push({ label, href: accumulated });
  }

  return crumbs;
}
