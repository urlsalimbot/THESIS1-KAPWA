import { cn } from '@/lib/utils';

interface SkipToContentProps {
  href?: string;
  children?: React.ReactNode;
}

export function SkipToContent({ href = '#main-content', children }: SkipToContentProps) {
  return (
    <a
      href={href}
      className={cn(
        'sr-only focus:not-sr-only',
        'focus:absolute focus:top-4 focus:left-4 focus:z-[100]',
        'focus:px-4 focus:py-2',
        'focus:bg-accent focus:text-accent-foreground',
        'focus:rounded-md focus:outline-none focus:ring-2 focus:ring-ring',
      )}
    >
      {children || 'Skip to content'}
    </a>
  );
}
