import { Link, useLocation } from 'react-router-dom';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useAuth } from '@/lib/auth-context';
import { NAV_GROUPS } from '@/lib/nav-config';
import { cn } from '@/lib/utils';
import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';

interface Tab {
  path: string;
  label: string;
  icon: ReactNode;
}

const QUICK_ACTIONS: Record<string, string | null> = {
  admin: '/intake',
  social_worker: '/intake',
  coordinator: '/coordinator/referrals/new',
  claimant: null,
  mayor: null,
  auditor: null,
  agency_staff: '/agency/referrals',
};

const QUICK_ACTION_LABELS: Record<string, string> = {
  '/intake': 'New Intake (Quick Action)',
  '/coordinator/referrals/new': 'New Referral (Quick Action)',
  '/agency/referrals': 'New Referral (Quick Action)',
};

export function BottomNav() {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const location = useLocation();
  const { user } = useAuth();
  if (!isMobile) return null;

  const role = user?.role ?? '';
  const tabs: Tab[] = NAV_GROUPS
    .flatMap(g => g.items)
    .filter(item => item.roles.includes(role))
    .slice(0, 4)
    .map(item => ({ path: item.path, label: item.label, icon: item.icon }));

  const quickPath = QUICK_ACTIONS[role] ?? null;
  const quickLabel = quickPath ? QUICK_ACTION_LABELS[quickPath] ?? 'Quick Action' : null;

  return (
    <nav aria-label="Mobile navigation" className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border h-16 lg:hidden">
      <div className="flex items-center justify-around h-full px-2">
        {quickPath && quickLabel && (
          <Link
            to={quickPath}
            aria-label={quickLabel}
            className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center -mt-4 shadow-lg min-w-0 flex-shrink-0"
          >
            <Plus size={24} aria-hidden="true" />
          </Link>
        )}
        {tabs.map(tab => {
          const isActive = tab.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(tab.path);
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-1 rounded-md transition-colors min-w-0 flex-shrink-0',
                isActive ? 'bg-muted text-foreground' : 'text-muted-foreground'
              )}
            >
              {tab.icon}
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
