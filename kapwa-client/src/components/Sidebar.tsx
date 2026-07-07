import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { NAV_GROUPS } from '@/lib/nav-config';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export interface SidebarNavContentProps {
  onNavClick?: () => void;
}

export function SidebarNavContent({ onNavClick }: SidebarNavContentProps) {
  const { user } = useAuth();
  const location = useLocation();

  return (
    <nav aria-label="Main navigation" className="flex flex-col gap-4 px-3 py-4">
      {NAV_GROUPS.map(group => {
        const visibleItems = group.items.filter(item => item.roles.includes(user?.role ?? ''));
        if (visibleItems.length === 0) return null;
        return (
          <div key={group.label}>
            <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </p>
            <div className="flex flex-col gap-0.5 mt-1">
              {visibleItems.map(item => {
                const isActive = item.path === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={onNavClick}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium no-underline transition-all duration-200',
                      isActive
                        ? 'bg-muted text-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground hover:translate-x-0.5'
                    )}
                  >
                    {item.icon}
                    <span>{item.label}</span>
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
}

export function Sidebar({ className }: SidebarProps) {
  return (
    <aside className={cn(
      'w-[16rem] bg-card border-r border-border shrink-0',
      'top-0 h-full',
      'hidden lg:block',
      className
    )}>
      <ScrollArea className="h-full">
        <SidebarNavContent />
      </ScrollArea>
    </aside>
  );
}
