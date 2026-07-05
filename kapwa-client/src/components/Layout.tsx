import { useState, useEffect } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { loadQueue } from '@/lib/offline-queue';
import { createBreadcrumbs } from '@/lib/breadcrumbs';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { SidebarNavContent } from './Sidebar';
import {
  Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { cn } from '@/lib/utils';
import { BottomNav } from '@/components/BottomNav';
import { SyncStatusBanner } from '@/components/SyncStatusBanner';
import { SyncQueuePanel } from '@/components/SyncQueuePanel';
import { SkipToContent } from '@/components/a11y/SkipToContent';
import { AriaLiveRegion } from '@/components/a11y/AriaLiveRegion';

function computePendingCount(): number {
  try { const queue = loadQueue(); return queue.filter(c => c.status === 'pending').length; }
  catch { return 0; }
}

function BreadcrumbNav({ pathname }: { pathname: string }) {
  const crumbs = createBreadcrumbs(pathname);

  return (
    <Breadcrumb className="mb-4">
      <BreadcrumbList>
        {crumbs.map((crumb, i) => (
          <BreadcrumbItem key={crumb.href}>
            {i > 0 && <BreadcrumbSeparator />}
            {i < crumbs.length - 1 ? (
              <BreadcrumbLink asChild>
                <Link to={crumb.href}>{crumb.label}</Link>
              </BreadcrumbLink>
            ) : (
              <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
            )}
          </BreadcrumbItem>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export function Layout({ children }: { children?: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const [offline, setOffline] = useState(!navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);

  useEffect(() => {
    setPendingCount(computePendingCount());
    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'kapwa_sync_queue') setPendingCount(computePendingCount());
    };
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  useEffect(() => {
    setSheetOpen(false);
  }, [location.pathname]);

  const isOnline = !offline;

  return (
    <div className="h-screen overflow-hidden flex flex-col">
      <SkipToContent />

      <AriaLiveRegion
        message={offline ? 'You are offline. Some features may be unavailable.' : ''}
        role="status"
        aria-live="polite"
      />

      <SyncStatusBanner
        pendingCount={pendingCount}
        isOnline={isOnline}
        onOpenQueue={() => setQueueOpen(true)}
      />

      <div className="no-print shrink-0">
        <Topbar onMenuToggle={() => setSheetOpen(s => !s)} />
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="no-print shrink-0">
          <Sidebar />
        </div>

        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="left" className="w-[16rem] p-0">
            <SidebarNavContent onNavClick={() => setSheetOpen(false)} />
          </SheetContent>
        </Sheet>

        <main id="main-content" className="flex-1 min-h-0 p-6 bg-background overflow-auto pb-16 lg:pb-6">
          <ErrorBoundary>
            <BreadcrumbNav pathname={location.pathname} />
            {children || <Outlet />}
          </ErrorBoundary>
        </main>
      </div>

      <div className="no-print">
        <BottomNav />
      </div>

      <SyncQueuePanel
        open={queueOpen}
        onClose={() => setQueueOpen(false)}
      />
    </div>
  );
}
