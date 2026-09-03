import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, ArrowLeft } from 'lucide-react';

export function PrivacyPolicyPage() {
  const { t } = useTranslation();
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors no-underline mb-6">
        <ArrowLeft size={16} /> {t('public.backToHome', 'Back to home')}
      </Link>
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20 mb-4">
        <ShieldCheck size={16} className="text-accent" />
        <span className="text-xs font-medium text-accent tracking-wide">{t('privacy.eyebrow', 'Privacy')}</span>
      </div>
      <h1 className="font-heading text-4xl font-bold tracking-tight mb-6">{t('privacy.title', 'Privacy Policy')}</h1>
      <div className="prose prose-slate max-w-none prose-headings:font-heading dark:prose-invert">
        <p>
          This Privacy Policy explains how the Municipal Social Welfare and Development Office (MSWDO) of Norzagaray,
          Bulacan collects, uses, and protects personal information through KAPWA, in accordance with the Data Privacy
          Act of 2012 (Republic Act No. 10173).
        </p>
        <h2>Information we collect</h2>
        <p>
          We collect only the information necessary to deliver social welfare services, including name, contact
          details, date of birth, and information relevant to your applications and cases. Registration is required to
          access personal services.
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
          Personal data is stored securely, access is restricted to authorized personnel on a need-to-know basis, and
          sensitive records such as case narrations are encrypted. We do not sell personal information.
        </p>
        <h2>Your rights</h2>
        <p>
          Under the Data Privacy Act, you have the right to be informed, to access, to correct, and to object to the
          processing of your personal information. You may also request the deletion or blocking of your data, subject
          to applicable law.
        </p>
        <h2>Contact</h2>
        <p>
          For privacy concerns or to exercise your rights, contact the MSWDO office through the{' '}
          <Link to="/contact" className="text-primary">contact page</Link> or at mswdo@norzagaray.gov.ph.
        </p>
      </div>
    </div>
  );
}