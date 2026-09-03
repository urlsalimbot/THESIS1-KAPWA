import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FileText, ArrowLeft } from 'lucide-react';

export function TermsPage() {
  const { t } = useTranslation();
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors no-underline mb-6">
        <ArrowLeft size={16} /> {t('public.backToHome', 'Back to home')}
      </Link>
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20 mb-4">
        <FileText size={16} className="text-accent" />
        <span className="text-xs font-medium text-accent tracking-wide">{t('terms.eyebrow', 'Legal')}</span>
      </div>
      <h1 className="font-heading text-4xl font-bold tracking-tight mb-6">{t('terms.title', 'Terms of Use')}</h1>
      <div className="prose prose-slate max-w-none prose-headings:font-heading dark:prose-invert">
        <p>
          Welcome to KAPWA, the social welfare portal of the Municipal Social Welfare and Development Office (MSWDO) of
          Norzagaray, Bulacan. By accessing or using this website you agree to the following terms of use.
        </p>
        <h2>Use of the Service</h2>
        <p>
          This website provides information about MSWDO programs and services, public announcements, and access to
          client services for registered users. You agree to use the site lawfully and not to attempt to disrupt,
          overload, or gain unauthorized access to any part of the system.
        </p>
        <h2>Accounts</h2>
        <p>
          Some services require an account. You are responsible for keeping your credentials confidential and for all
          activity under your account. If you believe your account has been compromised, contact the MSWDO office
          immediately.
        </p>
        <h2>Information Provided</h2>
        <p>
          Content on this site is provided for general information and is subject to change without notice. While we
          aim to keep information accurate and up to date, we make no warranties about the completeness, reliability,
          or suitability of the information for any purpose.
        </p>
        <h2>Limitation of Liability</h2>
        <p>
          To the extent permitted by law, the MSWDO of Norzagaray shall not be liable for any loss or damage arising
          from your use of, or inability to use, this website.
        </p>
        <h2>Changes to These Terms</h2>
        <p>
          We may update these terms from time to time. Continued use of the website after changes are posted
          constitutes acceptance of the revised terms.
        </p>
        <p>
          Questions about these terms may be directed to the MSWDO office via the{' '}
          <Link to="/contact" className="text-primary">contact page</Link>.
        </p>
      </div>
    </div>
  );
}