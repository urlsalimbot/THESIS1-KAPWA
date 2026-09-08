import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Accessibility as AccessibilityIcon, ArrowLeft } from 'lucide-react';

export function AccessibilityPage() {
  const { t } = useTranslation();
  return (
    <div className="relative max-w-3xl mx-auto px-4 py-16">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-accent/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-accent/3 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/4 w-[400px] h-[400px] bg-muted/20 rounded-full blur-3xl opacity-40" />
      </div>
      <div className="relative">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors no-underline mb-6">
        <ArrowLeft size={16} /> {t('public.backToHome', 'Back to home')}
      </Link>
      <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-4 shadow-sm">
        <AccessibilityIcon size={28} className="text-accent" />
      </div>
      <p className="text-xs font-medium text-accent tracking-wide uppercase mb-2">{t('accessibility.eyebrow', 'Accessibility')}</p>
      <h1 className="font-heading text-4xl font-bold tracking-tight mb-6">{t('accessibility.title', 'Accessibility')}</h1>
      <div className="prose prose-slate max-w-none prose-headings:font-heading dark:prose-invert">
        <p>
          The MSWDO of Norzagaray is committed to making KAPWA usable by all residents, including persons with
          disabilities, older persons, and users of assistive technologies.
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
          We are continuously working to improve accessibility. Some documents and older features may not yet be fully
          accessible. If you encounter difficulty using any part of this site, please let us know.
        </p>
        <h2>Report a problem</h2>
        <p>
          Contact the MSWDO office through the <Link to="/contact" className="text-primary">contact page</Link> and
          describe the page and the difficulty you experienced. We will respond and work to resolve the issue.
        </p>
      </div>
      </div>
    </div>
  );
}
