import type { ComponentType, ReactNode, SVGProps } from 'react';
import { cn } from '@/lib/utils';

type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>;

interface PageHeroProps {
  icon: IconComponent;
  title: string;
  description?: ReactNode;
  className?: string;
}

/**
 * Standard opening block for public sub-pages (programs, announcements,
 * contact, legal). Keeps the icon, heading size and measure identical
 * everywhere instead of drifting page to page. The icon sits inline with the
 * title so the heading carries the section rather than a tile above it.
 */
export function PageHero({ icon: Icon, title, description, className }: PageHeroProps) {
  return (
    <header className={cn('mb-10 max-w-3xl sm:mb-12', className)}>
      <h1 className="flex items-center gap-3 font-heading text-3xl font-bold leading-[1.15] tracking-tight text-balance sm:text-4xl">
        <Icon size={28} className="shrink-0 text-accent" aria-hidden="true" />
        {title}
      </h1>
      {description && (
        <p className="mt-4 max-w-[65ch] text-base leading-relaxed text-muted-foreground text-pretty sm:text-lg">
          {description}
        </p>
      )}
    </header>
  );
}
