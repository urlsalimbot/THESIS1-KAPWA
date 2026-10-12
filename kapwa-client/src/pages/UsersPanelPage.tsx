import { useTranslation } from 'react-i18next';
import { PageShell } from '@/components/PageShell';
import UsersPanel from '@/components/UsersPanel';

/**
 * User management outside the admin area: admins reach the same panel through
 * /admin, social workers get this route (claimant accounts only — enforced
 * server-side on the users endpoints).
 */
export function UsersPanelPage() {
  const { t } = useTranslation();
  return (
    <PageShell title={t('usersPanel.pageTitle', 'User Management')} description={t('usersPanel.pageDesc', 'Manage accounts — for social workers, the claimant accounts tab.')}>
      <UsersPanel />
    </PageShell>
  );
}