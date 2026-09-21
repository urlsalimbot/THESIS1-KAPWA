import type { ComponentType, ReactNode, SVGProps } from 'react';
import { cn } from '@/lib/utils';

type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>;

interface PageHeroProps {
  icon: IconComponent;
  eyebrow: string;
  title: string;
  description?: ReactNode;
  className?: string;
}

/**
 * Standard opening block for public sub-pages (programs, announcements,
 * contact, legal). Keeps the icon badge, eyebrow, heading size and measure
 * identical everywhere instead of drifting page to page.
 */
export function PageHero({ icon: Icon, eyebrow, title, description, className }: PageHeroProps) {
  return (
    <header className={cn('mb-10 max-w-3xl sm:mb-12', className)}>
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 ring-1 ring-inset ring-accent/15">
        <Icon size={24} className="text-accent" aria-hidden="true" />
      </div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-accent">
        {eyebrow}
      </p>
      <h1 className="font-heading text-3xl font-bold leading-[1.15] tracking-tight text-balance sm:text-4xl">
        {title}
      </h1>
      {description && (
        <p className="mt-4 text-base leading-relaxed text-muted-foreground text-pretty sm:text-lg">
          {description}
        </p>
      )}
    </header>
  );
}
