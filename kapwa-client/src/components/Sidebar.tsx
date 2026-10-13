import { Link, useLocation } from 'react-router-dom';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth-context';
import { NAV_GROUPS } from '@/lib/nav-config';
import { prefetchRoute } from '@/routes';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export const SIDEBAR_STATE_KEY = 'kapwa:sidebar-collapsed';

export interface SidebarNavContentProps {
  onNavClick?: () => void;
  /** Icon-only rail mode: labels stay as tooltips for the collapsed desktop sidebar. */
  collapsed?: boolean;
}

export function SidebarNavContent({ onNavClick, collapsed = false }: SidebarNavContentProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();

  return (
    <nav aria-label={t('a11y.mainNavigation', 'Main navigation')} className="flex flex-col gap-4 px-3 py-4">
      {NAV_GROUPS.map(group => {
        const visibleItems = group.items.filter(item => item.roles.includes(user?.role ?? ''));
        if (visibleItems.length === 0) return null;
        return (
          <div key={group.label}>
            {!collapsed && (
              <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </p>
            )}
            <div className={cn('flex flex-col gap-0.5 mt-1', collapsed && 'mt-0')}>
              {visibleItems.map(item => {
                // An item is active only when it is the LONGEST nav path that
                // matches the current route. Prefix matching alone would also
                // highlight ancestors — with `/admin` and `/admin/programs`
                // both defined, EVERY admin subroute would light up "Admin
                // Panel". Longest-match keeps detail-page highlighting
                // (/cases/123 → Cases) while letting the specific item win.
                const isActive = visibleItems
                  .map(i => i.path)
                  .filter(p => p === '/'
                    ? location.pathname === '/'
                    : location.pathname.startsWith(p))
                  .sort((a, b) => b.length - a.length)[0] === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={onNavClick}
                    // Warm the route's module before the click: hovering a nav
                    // item is the strongest signal of what comes next.
                    onMouseEnter={() => prefetchRoute(item.path)}
                    onFocus={() => prefetchRoute(item.path)}
                    aria-label={collapsed ? item.label : undefined}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      'flex items-center rounded-md text-sm font-medium no-underline transition-all duration-200',
                      collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2',
                      isActive
                        ? 'bg-muted text-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground hover:translate-x-0.5'
                    )}
                  >
                    {item.icon}
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

export interface SidebarProps {
  className?: string;
  /** Controlled by Layout: the Topbar's KAPWA mark is the collapse control. */
  collapsed?: boolean;
}

export const Sidebar = memo(function Sidebar({ className, collapsed = false }: SidebarProps) {
  return (
    <aside
      className={cn(
        'bg-card border-r border-border shrink-0 top-0 h-full',
        'hidden lg:block transition-[width] duration-200',
        collapsed ? 'w-[4.75rem]' : 'w-[16rem]',
        className
      )}
    >
      <div className="flex h-full flex-col">
        <ScrollArea className="flex-1">
          <SidebarNavContent collapsed={collapsed} />
        </ScrollArea>
      </div>
    </aside>
  );
});
