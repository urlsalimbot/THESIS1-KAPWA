import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, ArrowLeft } from 'lucide-react';
import { PageContainer } from '@/components/public/PageContainer';
import { PageHero } from '@/components/public/PageHero';

export function PrivacyPolicyPage() {
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
            icon={ShieldCheck}
            eyebrow={t('privacy.eyebrow', 'Privacy')}
            title={t('privacy.title', 'Privacy Policy')}
          />

          <div className="prose prose-stone max-w-none prose-headings:font-heading prose-p:leading-relaxed prose-li:leading-relaxed dark:prose-invert">
            <p>
              This Privacy Policy explains how the Municipal Social Welfare and Development Office
              (MSWDO) of Norzagaray, Bulacan collects, uses, and protects personal information
              through KAPWA, in accordance with the Data Privacy Act of 2012 (Republic Act No.
              10173).
            </p>
            <h2>Information we collect</h2>
            <p>
              We collect only the information necessary to deliver social welfare services,
              including name, contact details, date of birth, and information relevant to your
              applications and cases. Registration is required to access personal services.
            </p>
            <h2>How we use information</h2>
            <ul>
              <li>To process applications for assistance programs and services.</li>
              <li>To manage and document cases handled by our social workers.</li>
              <li>To comply with legal, regulatory, and audit obligations.</li>
              <li>To send you important notices about your applications.</li>
            </ul>
            <h2>Protection of information</h2>
            <p>
              Personal data is stored securely, access is restricted to authorized personnel on a
              need-to-know basis, and sensitive records such as case narrations are encrypted. We do
              not sell personal information.
            </p>
            <h2>Your rights</h2>
            <p>
              Under the Data Privacy Act, you have the right to be informed, to access, to correct,
              and to object to the processing of your personal information. You may also request the
              deletion or blocking of your data, subject to applicable law.
            </p>
            <h2>Contact</h2>
            <p>
              For privacy concerns or to exercise your rights, contact the MSWDO office through the{' '}
              <Link to="/contact" className="text-primary">
                contact page
              </Link>{' '}
              or at mswdo@norzagaray.gov.ph.
            </p>
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
