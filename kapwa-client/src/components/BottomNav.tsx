import { Link, useLocation } from 'react-router-dom';
import { useMediaQuery } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FolderOpen,
  Plus,
  Users,
  UserCircle,
  type LucideIcon,
} from 'lucide-react';

interface Tab {
  path: string;
  label: string;
  icon: LucideIcon;
  isQuick?: boolean;
}

const TABS: Tab[] = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/cases', label: 'Cases', icon: FolderOpen },
  { path: '/intake', label: 'Quick Action', icon: Plus, isQuick: true },
  { path: '/beneficiaries', label: 'Beneficiaries', icon: Users },
  { path: '/my-dashboard', label: 'Profile', icon: UserCircle },
];

export function BottomNav() {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const location = useLocation();

  if (!isMobile) return null;

  return (
    <nav aria-label="Mobile navigation" className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border h-16 lg:hidden">
      <div className="flex items-center justify-around h-full px-2">
        {TABS.map((tab) => {
          if (tab.isQuick) {
            return (
              <Link
                key={tab.path}
                to={tab.path}
                aria-label="New Intake (Quick Action)"
                className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center -mt-4 shadow-lg min-w-0 flex-shrink-0"
              >
                <Plus size={24} aria-hidden="true" />
              </Link>
            );
          }

          const isActive =
            tab.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(tab.path);

          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-1 rounded-md transition-colors min-w-0 flex-shrink-0',
                isActive
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground'
              )}
            >
              <tab.icon size={20} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
