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
import { cn } from '@/lib/utils';

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

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-accent focus:text-accent-foreground focus:rounded-md"
      >
        Skip to content
      </a>

      {offline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 px-4 py-1.5 text-center text-xs font-medium text-white">
          You are offline{pendingCount > 0 ? ` — ${pendingCount} change(s) pending sync` : ''}
        </div>
      )}

      <Topbar onMenuToggle={() => setSheetOpen(s => !s)} />

      <div className="flex min-h-[calc(100vh-4rem)]">
        <Sidebar />

        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="left" className="w-64 p-0">
            <SidebarNavContent onNavClick={() => setSheetOpen(false)} />
          </SheetContent>
        </Sheet>

        <main id="main-content" className="flex-1 p-6 bg-background min-h-[calc(100vh-4rem)] overflow-auto">
          <BreadcrumbNav pathname={location.pathname} />
          {children || <Outlet />}
        </main>
      </div>
    </>
  );
}
