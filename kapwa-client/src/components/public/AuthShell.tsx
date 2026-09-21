import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, HandHeart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PublicBackground } from './PublicBackground';

interface AuthShellProps {
  children: ReactNode;
  /** Registration needs a wider card for its two-column field grid. */
  cardWidth?: 'md' | 'lg';
}

/**
 * Shared chrome for the standalone auth screens (login, register, verify,
 * forgot, reset). Previously each page re-implemented the same shell: an
 * absolutely positioned back link, `min-h-screen` centring, and an identical
 * blurred-blob background. This also gives every auth screen a brand mark and
 * a way back, including the success states that were dead ends.
 */
export function AuthShell({ children, cardWidth = 'md' }: AuthShellProps) {
  const { t } = useTranslation();

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-background">
      <PublicBackground />

      <div className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground no-underline transition-colors hover:text-foreground"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          {t('auth.backToHome', 'Back to Home')}
        </Link>
        <Link to="/" className="inline-flex items-center gap-2 no-underline">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
            <HandHeart size={16} className="text-accent" aria-hidden="true" />
          </span>
          <span className="font-heading text-base font-bold tracking-tight text-foreground">
            KAPWA
          </span>
        </Link>
      </div>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 pb-16 pt-4 sm:px-6">
        <div className={cn('w-full', cardWidth === 'lg' ? 'max-w-lg' : 'max-w-md')}>{children}</div>
      </main>
    </div>
  );
}
