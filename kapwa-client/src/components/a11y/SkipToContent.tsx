import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface SkipToContentProps {
  href?: string;
  children?: React.ReactNode;
}

export function SkipToContent({ href = '#main-content', children }: SkipToContentProps) {
  const { t } = useTranslation();
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
      {children || t('a11y.skipToContent', 'Skip to content')}
    </a>
  );
}
