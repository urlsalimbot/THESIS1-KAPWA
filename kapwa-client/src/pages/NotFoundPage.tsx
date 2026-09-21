import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Compass, Home, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageContainer } from '@/components/public/PageContainer';

/**
 * Branded 404 for the public site. Previously the wildcard route silently
 * redirected to `/`, which hid broken links instead of explaining them.
 */
export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <PageContainer className="py-20 sm:py-28">
      <div className="mx-auto max-w-xl text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 ring-1 ring-inset ring-accent/15">
          <Compass size={28} className="text-accent" aria-hidden="true" />
        </div>
        <p className="font-heading text-5xl font-bold tracking-tight text-accent/30">404</p>
        <h1 className="mt-3 font-heading text-3xl font-bold tracking-tight text-balance">
          {t('notFound.title', 'Page not found')}
        </h1>
        <p className="mt-4 leading-relaxed text-muted-foreground text-pretty">
          {t(
            'notFound.body',
            'The page you are looking for may have been moved, removed, or the link may be incorrect.'
          )}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90" asChild>
            <Link to="/">
              <Home size={16} aria-hidden="true" />
              {t('notFound.backHome', 'Back to home')}
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link to="/contact">
              <Mail size={16} aria-hidden="true" />
              {t('notFound.contact', 'Contact the office')}
            </Link>
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
