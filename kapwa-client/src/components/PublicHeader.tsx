import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { HandHeart, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

interface PublicHeaderProps {
  user: User | null;
  loading: boolean;
}

const roleRedirectMap: Record<string, string> = {
  social_worker: '/dashboard',
  admin: '/dashboard',
  coordinator: '/dashboard',
  claimant: '/dashboard',
  mayor: '/dashboard',
  auditor: '/dashboard',
};

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
];

export function PublicHeader({ user, loading }: PublicHeaderProps) {
  const location = useLocation();
  const currentPath = location.pathname;
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 h-17 min-h-[4.5rem] flex flex-col justify-center bg-background/95 backdrop-blur-sm border-b border-border overflow-visible">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 flex items-center justify-between">
        {/* Logo/brand */}
        <Link to="/" className="touch-sm flex items-center gap-2.5 no-underline group">
          <div className="w-24 h-24 rounded-lg bg-accent/10 flex items-center justify-center transition-all duration-200 group-hover:shadow-md">
            <HandHeart className="w-64 h-64 text-accent" />
          </div>
          <span className="font-heading text-xl font-bold text-foreground tracking-tight">KAPWA</span>
        </Link>

        {/* Desktop nav */}
        <nav aria-label="Main navigation" className="hidden sm:flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive = currentPath === link.to || (link.to !== '/' && currentPath.startsWith(link.to));
            return (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  'touch-sm px-3 py-2 rounded-md text-sm font-medium transition-all duration-200',
                  'hover:bg-muted hover:text-foreground hover:translate-y-px',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  isActive ? 'text-accent font-semibold' : 'text-muted-foreground'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Right side: CTA + mobile menu */}
        <div className="flex items-center gap-3">
          {!loading && (
            user ? (
              <Button variant="outline" size="sm" asChild>
                <Link to={roleRedirectMap[user.role] || '/dashboard'}>
                  Go to Dashboard
                </Link>
              </Button>
            ) : (
              <Button size="sm" className="touch-sm" asChild>
                <Link to="/login">Login</Link>
              </Button>
            )
          )}

          {/* Mobile menu trigger */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button
                className="touch-sm sm:hidden w-9 h-9 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all duration-200 hover:scale-105"
                aria-label="Open menu"
              >
                <Menu size={20} />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-0">
              <div className="flex items-center justify-between px-6 h-14 border-b">
                <Link to="/" className="flex items-center gap-2 no-underline" onClick={() => setMobileOpen(false)}>
                  <div className="w-7 h-7 rounded-md bg-accent/10 flex items-center justify-center">
                    <HandHeart size={16} className="text-accent" />
                  </div>
                  <span className="font-heading text-base font-bold text-foreground tracking-tight">KAPWA</span>
                </Link>
                <button
                  className="touch-sm w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close menu"
                >
                  <X size={18} />
                </button>
              </div>
              <nav className="flex flex-col p-4 gap-1">
                {navLinks.map((link) => {
                  const isActive = currentPath === link.to;
                  return (
                    <Link
                      key={link.to}
                      to={link.to}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        'touch-sm px-4 py-3 rounded-md text-sm font-medium transition-all duration-200 no-underline',
                        'hover:bg-muted hover:text-foreground hover:translate-x-0.5',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        isActive ? 'text-accent font-semibold bg-accent/5' : 'text-muted-foreground'
                      )}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
