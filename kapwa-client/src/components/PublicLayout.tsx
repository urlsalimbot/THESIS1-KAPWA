import { Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { SkipToContent } from '@/components/a11y/SkipToContent';
import { PublicHeader } from './PublicHeader';
import { PublicFooter } from './PublicFooter';

export function PublicLayout() {
  const { user, loading } = useAuth();

  return (
    <div className="flex flex-col min-h-screen">
      <SkipToContent />
      <PublicHeader user={user} loading={loading} />
      <main id="main-content" className="flex-1">
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  );
}
