import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ROLE_REDIRECT_MAP } from '@/lib/role-access';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { HandHeart, Menu, X, Sun, Moon, Monitor, Languages, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { useTranslation } from 'react-i18next';
import { PageContainer } from './public/PageContainer';
import { useTheme } from '@/lib/theme-context';
import { useLanguage } from '@/i18n/useLanguage';

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

export function PublicHeader({ user, loading }: PublicHeaderProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const currentPath = location.pathname;
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { lang, setLang } = useLanguage();
  // Hydration guard: resolvedTheme is unknown until the browser mounts; the
  // trigger icon falls back to Sun (light) for the first render.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const navLinks = [
    { to: '/', label: t('public.home', 'Home') },
    { to: '/about', label: t('public.about', 'About') },
    { to: '/programs', label: t('public.programs', 'Programs') },
    { to: '/announcements', label: t('public.announcements', 'Announcements') },
    { to: '/contact', label: t('public.contact', 'Contact') },
  ];

  // Section links stay highlighted on their detail pages (/announcements/:slug).
  const isActive = (to: string) => (to === '/' ? currentPath === '/' : currentPath.startsWith(to));

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
      <PageContainer className="flex h-16 items-center gap-4 lg:gap-6">
        {/* Logo/brand */}
        <Link to="/" className="group flex shrink-0 items-center gap-2.5 no-underline">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 transition-shadow duration-200 group-hover:shadow-md">
            <HandHeart size={22} className="text-accent" aria-hidden="true" />
          </div>
          {/* Wordmark hidden on phone widths — the icon + CTA carry the header */}
          <span className="hidden font-heading text-xl font-bold tracking-tight text-foreground sm:inline">
            KAPWA
          </span>
        </Link>

        {/* Desktop nav — md, not sm: at 640px the five links overlapped the
            Login button (last link ended at x=584, CTA started at x=567). */}
        <nav
          aria-label={t('public.mainNavigation', 'Main navigation')}
          className="hidden min-w-0 flex-1 items-center justify-center gap-1 md:flex"
        >
          {navLinks.map((link) => {
            const active = isActive(link.to);
            return (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  'flex shrink-0 items-center rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200 lg:px-4',
                  'hover:bg-muted hover:text-foreground',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  active ? 'font-semibold text-accent' : 'text-muted-foreground'
                )}
                aria-current={active ? 'page' : undefined}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Right side: CTA + mobile menu. Appearance and language live in the
            drawer on small screens — two icon buttons in the header row were
            wasted space next to the Login CTA and the burger. */}
        <div className="flex shrink-0 items-center gap-1.5">
          {!loading &&
            (user ? (
              <Button variant="outline" size="sm" className="touch-sm" asChild>
                <Link to={ROLE_REDIRECT_MAP[user.role] ?? '/dashboard'}>
                  {t('public.goToDashboard', 'Go to Dashboard')}
                </Link>
              </Button>
            ) : (
              <Button variant="brand" size="sm" className="touch-sm" asChild>
                <Link to="/login">{t('public.login', 'Login')}</Link>
              </Button>
            ))}

          {/* Mobile menu trigger */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button
                className="touch-sm flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:hidden"
                aria-label={t('public.openMenu', 'Open menu')}
              >
                <Menu size={20} aria-hidden="true" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-0">
              <div className="flex h-14 items-center justify-between border-b px-6">
                <Link
                  to="/"
                  className="flex items-center gap-2 no-underline"
                  onClick={() => setMobileOpen(false)}
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent/10">
                    <HandHeart size={16} className="text-accent" aria-hidden="true" />
                  </div>
                  <span className="font-heading text-base font-bold tracking-tight text-foreground">
                    KAPWA
                  </span>
                </Link>
                <button
                  className="touch-sm flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted"
                  onClick={() => setMobileOpen(false)}
                  aria-label={t('public.closeMenu', 'Close menu')}
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>
              <nav className="flex flex-col gap-1 p-4">
                {navLinks.map((link) => {
                  const active = isActive(link.to);
                  return (
                    <Link
                      key={link.to}
                      to={link.to}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        'touch-sm flex items-center rounded-md px-4 py-3 text-sm font-medium no-underline transition-colors duration-200',
                        'hover:bg-muted hover:text-foreground',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        active ? 'bg-accent/5 font-semibold text-accent' : 'text-muted-foreground'
                      )}
                      aria-current={active ? 'page' : undefined}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </nav>
              {/* Appearance + language live here on small screens — the header
                  row keeps only the CTA and the burger */}
              <Separator />
              <div className="flex items-center gap-2 px-4 pb-4 pt-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="touch-sm flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-border text-sm text-muted-foreground transition-colors hover:bg-muted"
                      aria-label={t('topbar.theme', 'Theme')}
                    >
                      {mounted && resolvedTheme === 'dark' ? (
                        <Moon size={16} aria-hidden="true" />
                      ) : (
                        <Sun size={16} aria-hidden="true" />
                      )}
                      {t('topbar.theme', 'Theme')}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" sideOffset={8} className="w-44">
                    <DropdownMenuLabel className="font-semibold">{t('topbar.theme', 'Theme')}</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => setTheme('light')}>
                      <Sun size={16} className="mr-2" />
                      {t('topbar.themeLight', 'Light')}
                      {theme === 'light' && <Check size={14} className="ml-auto text-primary" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme('dark')}>
                      <Moon size={16} className="mr-2" />
                      {t('topbar.themeDark', 'Dark')}
                      {theme === 'dark' && <Check size={14} className="ml-auto text-primary" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme('system')}>
                      <Monitor size={16} className="mr-2" />
                      {t('topbar.themeSystem', 'System')}
                      {theme === 'system' && <Check size={14} className="ml-auto text-primary" />}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="touch-sm flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-border text-sm text-muted-foreground transition-colors hover:bg-muted"
                      aria-label={t('topbar.language', 'Language')}
                    >
                      <Languages size={16} aria-hidden="true" />
                      {t('topbar.language', 'Language')}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" sideOffset={8} className="w-44">
                    <DropdownMenuLabel className="font-semibold">{t('topbar.language', 'Language')}</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => setLang('en')}>
                      <Languages size={16} className="mr-2" />
                      {t('nav.english', 'English')}
                      {lang === 'en' && <Check size={14} className="ml-auto text-primary" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setLang('fil')}>
                      <Languages size={16} className="mr-2" />
                      {t('nav.filipino', 'Filipino')}
                      {lang === 'fil' && <Check size={14} className="ml-auto text-primary" />}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </PageContainer>
    </header>
  );
}
