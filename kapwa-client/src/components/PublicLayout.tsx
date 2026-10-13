import { Outlet } from 'react-router-dom';
import { Suspense } from 'react';
import { useAuth } from '@/lib/auth-context';
import { SkipToContent } from '@/components/a11y/SkipToContent';
import { PublicHeader } from './PublicHeader';
import { PublicFooter } from './PublicFooter';
import { PublicBackground } from './public/PublicBackground';
import { RouteLoadingFallback } from './Layout';

export function PublicLayout() {
  const { user, loading } = useAuth();

  return (
    <div className="relative flex min-h-dvh flex-col">
      <SkipToContent />
      {/* One shared brand background for every public page, instead of the
          blurred-blob stack each page used to render for itself. */}
      <PublicBackground />
      <PublicHeader user={user} loading={loading} />
      {/* `relative` keeps page content painting above the background layer.
          The Suspense boundary keeps a code-split page's load inside the
          content slot: the header and footer stay mounted while the module
          arrives (the router-wide boundary used to blank the whole page). */}
      <main id="main-content" className="relative flex-1">
        <Suspense fallback={<RouteLoadingFallback />}>
          <Outlet />
        </Suspense>
      </main>
      <PublicFooter />
    </div>
  );
}
