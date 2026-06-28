import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
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
  admin: '/admin',
  coordinator: '/coordinator',
  claimant: '/my-dashboard',
  mayor: '/reports',
  auditor: '/audit-logs',
};

export function PublicHeader({ user, loading }: PublicHeaderProps) {
  const location = useLocation();
  const currentPath = location.pathname;

  // Prevent flash of wrong auth state
  if (loading) {
    return (
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border h-16" />
    );
  }

  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 flex items-center h-16 justify-between">
        {/* Logo/brand */}
        <Link to="/" className="flex items-center gap-2">
          <span className="font-heading text-xl font-bold">KAPWA</span>
        </Link>

        {/* Nav links */}
        <nav aria-label="Main navigation" className="hidden sm:flex items-center gap-1">
          <Button variant="ghost" asChild>
            <Link
              to="/"
              className={cn(
                currentPath === '/' && 'text-accent font-semibold'
              )}
              aria-current={currentPath === '/' ? 'page' : undefined}
            >
              Home
            </Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link
              to="/about"
              className={cn(
                currentPath === '/about' && 'text-accent font-semibold'
              )}
              aria-current={currentPath === '/about' ? 'page' : undefined}
            >
              About
            </Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link
              to="/contact"
              className={cn(
                currentPath === '/contact' && 'text-accent font-semibold'
              )}
              aria-current={currentPath === '/contact' ? 'page' : undefined}
            >
              Contact
            </Link>
          </Button>
        </nav>

        {/* Auth-sensitive CTA */}
        {user ? (
          <Button variant="outline" asChild>
            <Link to={roleRedirectMap[user.role] || '/dashboard'}>
              Go to Dashboard
            </Link>
          </Button>
        ) : (
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90" asChild>
            <Link to="/login">Login</Link>
          </Button>
        )}
      </div>
    </header>
  );
}
