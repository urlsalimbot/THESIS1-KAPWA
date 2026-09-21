import { Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { SkipToContent } from '@/components/a11y/SkipToContent';
import { PublicHeader } from './PublicHeader';
import { PublicFooter } from './PublicFooter';
import { PublicBackground } from './public/PublicBackground';

export function PublicLayout() {
  const { user, loading } = useAuth();

  return (
    <div className="relative flex min-h-dvh flex-col">
      <SkipToContent />
      {/* One shared brand background for every public page, instead of the
          blurred-blob stack each page used to render for itself. */}
      <PublicBackground />
      <PublicHeader user={user} loading={loading} />
      {/* `relative` keeps page content painting above the background layer. */}
      <main id="main-content" className="relative flex-1">
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  );
}
