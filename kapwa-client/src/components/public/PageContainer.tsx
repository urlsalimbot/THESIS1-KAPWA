import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageContainerProps {
  className?: string;
  children: ReactNode;
}

/**
 * The single horizontal rhythm for the public site: header, footer, and every
 * public page body share this width so their left/right edges line up on wide
 * screens. Previously the header/footer were full-bleed while page bodies used
 * max-w-7xl / max-w-5xl / .container, so nothing aligned.
 */
export function PageContainer({ className, children }: PageContainerProps) {
  return (
    <div className={cn('mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8', className)}>
      {children}
    </div>
  );
}
