import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { useAuth } from '@/lib/auth-context';
import {
  Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip, TooltipContent, TooltipTrigger, TooltipProvider,
} from '@/components/ui/tooltip';
import { Sun, Moon, Menu, HelpCircle, Plus, CheckSquare, LogOut, Settings, User } from 'lucide-react';
import NotificationsDropdown from './NotificationsDropdown';
import MessagesPopover from './MessagesPopover';
import { GlobalSearch } from './search/GlobalSearch';
import { cn } from '@/lib/utils';

export interface TopbarProps {
  onMenuToggle?: () => void;
}

export function Topbar({ onMenuToggle }: TopbarProps) {
  const { user, logout } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const initials = user
    ? user.fullName.split(' ').map((s: string) => s[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  const isAdmin = user?.role === 'admin';
  const isSocialWorker = user?.role === 'social_worker';
  const isCoordinator = user?.role === 'coordinator';
  const canIntake = isAdmin || isSocialWorker || isCoordinator;
  const canApprove = isAdmin || isSocialWorker;

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <header className="sticky top-0 z-40 h-16 border-b bg-card flex items-center justify-between px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <button
          className="lg:hidden w-9 h-9 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
          onClick={onMenuToggle}
          aria-label="Toggle navigation menu"
        >
          <Menu size={20} />
        </button>

        <Link to="/" className="flex items-center gap-3 no-underline">
          <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-primary-foreground" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </div>
          <div className="hidden sm:block">
            <span className="font-heading font-bold text-sm tracking-tight text-primary">KAPWA</span>
            <span className="text-xs text-muted-foreground ml-1.5">Norzagaray MSWDO</span>
          </div>
        </Link>

        {user && (
          <Badge variant="secondary" className="hidden md:inline-flex text-[10px] uppercase tracking-wider">
            {user.role.replace(/_/g, ' ')}
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-2">
        <GlobalSearch />

        <Separator orientation="vertical" className="h-6 hidden md:block" />

        {canIntake && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                  onClick={() => navigate('/intake')}
                  aria-label="New Intake"
                >
                  <Plus size={19} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">New Intake</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {canApprove && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="relative w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                  onClick={() => navigate('/approvals')}
                  aria-label="Approvals Queue"
                >
                  <CheckSquare size={19} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Approvals Queue</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        <Separator orientation="vertical" className="h-6 hidden md:block" />

        <NotificationsDropdown />
        <MessagesPopover />

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors" aria-label="Help">
                <HelpCircle size={19} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Help</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Separator orientation="vertical" className="h-6" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Avatar className="cursor-pointer">
              <AvatarFallback className="text-xs font-medium bg-muted text-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold leading-none">{user?.fullName}</p>
                <p className="text-xs text-muted-foreground">
                  {user?.role?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {mounted && (
              <DropdownMenuItem onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                {resolvedTheme === 'dark' ? <Sun size={16} className="mr-2" /> : <Moon size={16} className="mr-2" />}
                {resolvedTheme === 'dark' ? 'Light Mode' : 'Dark Mode'}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <Link to="/settings" className="flex items-center gap-2 no-underline">
                <Settings size={16} />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
              <LogOut size={16} className="mr-2" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
