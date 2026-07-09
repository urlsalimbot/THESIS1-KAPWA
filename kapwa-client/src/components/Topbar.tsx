import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '@/lib/theme-context';
import { useAuth } from '@/lib/auth-context';
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
import { Sun, Moon, Menu, HelpCircle, Plus, CheckSquare, LogOut, Settings, User, HandHeart } from 'lucide-react';
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
    <TooltipProvider>
      <header className="z-40 h-[4.5rem] border-b bg-card flex items-center justify-between px-4 lg:px-6 overflow-visible">
        <div className="flex items-center gap-3">
          <button
            className="touch-sm lg:hidden w-9 h-9 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all duration-200 hover:scale-105"
            onClick={onMenuToggle}
            aria-label="Toggle navigation menu"
          >
            <Menu size={20} />
          </button>

          <Link to="/" className="touch-sm flex items-center gap-3 no-underline group">
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center shrink-0 transition-all duration-200 group-hover:shadow-md">
              <HandHeart size={20} className="text-primary-foreground" />
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
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="touch-sm w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all duration-200 hover:scale-105"
                  onClick={() => navigate('/intake')}
                  aria-label="New Intake"
                >
                  <Plus size={20} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">New Intake</TooltipContent>
            </Tooltip>
          )}

          {canApprove && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="touch-sm relative w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all duration-200 hover:scale-105"
                  onClick={() => navigate('/approvals')}
                  aria-label="Approvals Queue"
                >
                  <CheckSquare size={20} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Approvals Queue</TooltipContent>
            </Tooltip>
          )}

          <Separator orientation="vertical" className="h-6 hidden md:block" />

          <NotificationsDropdown />
          <MessagesPopover />

          <Tooltip>
            <TooltipTrigger asChild>
              <button className="touch-sm w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all duration-200 hover:scale-105" aria-label="Help">
                <HelpCircle size={20} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Help</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-6" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Open user menu"
                className="rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all duration-200 hover:shadow-md"
              >
                <Avatar className="cursor-pointer">
                  <AvatarFallback className="text-xs font-medium bg-muted text-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </button>
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
    </TooltipProvider>
  );
}
