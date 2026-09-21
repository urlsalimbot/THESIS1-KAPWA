import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Accessibility as AccessibilityIcon, ArrowLeft } from 'lucide-react';
import { PageContainer } from '@/components/public/PageContainer';
import { PageHero } from '@/components/public/PageHero';

export function AccessibilityPage() {
  const { t } = useTranslation();
  return (
    <div className="w-full py-12 sm:py-16 lg:py-20">
      <PageContainer>
        <div className="mx-auto max-w-3xl">
          <Link
            to="/"
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground no-underline transition-colors hover:text-foreground"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            {t('public.backToHome', 'Back to home')}
          </Link>

          <PageHero
            icon={AccessibilityIcon}
            eyebrow={t('accessibility.eyebrow', 'Accessibility')}
            title={t('accessibility.title', 'Accessibility')}
          />

          <div className="prose prose-stone max-w-none prose-headings:font-heading prose-p:leading-relaxed prose-li:leading-relaxed dark:prose-invert">
            <p>
              The MSWDO of Norzagaray is committed to making KAPWA usable by all residents,
              including persons with disabilities, older persons, and users of assistive
              technologies.
            </p>
            <h2>What we do</h2>
            <ul>
              <li>Design pages to be readable and navigable by keyboard.</li>
              <li>Provide meaningful text alternatives for meaningful images.</li>
              <li>Maintain sufficient color contrast for text and interface elements.</li>
              <li>Support common screen readers and browser magnification.</li>
              <li>Avoid content that flashes at rates that can trigger seizures.</li>
            </ul>
            <h2>In progress</h2>
            <p>
              We are continuously working to improve accessibility. Some documents and older
              features may not yet be fully accessible. If you encounter difficulty using any part
              of this site, please let us know.
            </p>
            <h2>Report a problem</h2>
            <p>
              Contact the MSWDO office through the{' '}
              <Link to="/contact" className="text-primary">
                contact page
              </Link>{' '}
              and describe the page and the difficulty you experienced. We will respond and work to
              resolve the issue.
            </p>
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
