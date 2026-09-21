import { Link } from 'react-router-dom';
import { Separator } from '@/components/ui/separator';
import { HandHeart, MapPin, Phone, Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PageContainer } from './public/PageContainer';

export function PublicFooter() {
  const { t } = useTranslation();
  const quickLinks = [
    { to: '/', label: t('public.home', 'Home') },
    { to: '/about', label: t('public.about', 'About') },
    { to: '/#services', label: t('public.services', 'Services') },
    { to: '/contact', label: t('public.contact', 'Contact') },
  ];

  const contactDetails = [
    {
      icon: MapPin,
      text: t(
        'public.mswdoAddress',
        'Municipal Social Welfare and Development Office, Norzagaray, Bulacan'
      ),
    },
    { icon: Phone, text: '(044) 123-4567', href: 'tel:+63441234567' },
    { icon: Mail, text: 'mswdo@norzagaray.gov.ph', href: 'mailto:mswdo@norzagaray.gov.ph' },
  ];

  return (
    <footer className="mt-auto border-t border-border bg-card">
      <PageContainer className="py-12 sm:py-14">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[1.6fr_1fr_1.6fr]">
          {/* Column 1: Brand */}
          <div>
            <Link to="/" className="group mb-3 inline-flex items-center gap-2 no-underline">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 transition-shadow duration-200 group-hover:shadow-md">
                <HandHeart size={16} className="text-accent" aria-hidden="true" />
              </div>
              <span className="font-heading text-xl font-bold tracking-tight text-foreground">
                KAPWA
              </span>
            </Link>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground text-pretty">
              {t(
                'public.footerTagline',
                'MSWDO Norzagaray — Empowering communities through compassionate social welfare services.'
              )}
            </p>
          </div>

          {/* Column 2: Quick Links */}
          <div>
            <h2 className="mb-4 font-heading text-sm font-semibold tracking-wide text-foreground">
              {t('public.quickLinks', 'Quick Links')}
            </h2>
            <ul className="space-y-3">
              {quickLinks.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Contact */}
          <div>
            <h2 className="mb-4 font-heading text-sm font-semibold tracking-wide text-foreground">
              {t('public.contactUs', 'Contact Us')}
            </h2>
            <ul className="space-y-3">
              {contactDetails.map((detail) => {
                const Icon = detail.icon;
                return (
                  <li key={detail.text} className="flex items-start gap-3">
                    <Icon
                      size={18}
                      className="mt-0.5 shrink-0 text-accent"
                      aria-hidden="true"
                    />
                    {detail.href ? (
                      <a
                        href={detail.href}
                        className="text-sm text-muted-foreground no-underline transition-colors hover:text-foreground"
                      >
                        {detail.text}
                      </a>
                    ) : (
                      <span className="text-sm text-muted-foreground">{detail.text}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()}{' '}
            {t('public.copyright', 'MSWDO Norzagaray. All rights reserved.')}
          </p>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            <Link
              to="/privacy-policy"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {t('public.privacyPolicy', 'Privacy Policy')}
            </Link>
            <Link
              to="/accessibility"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {t('public.accessibility', 'Accessibility')}
            </Link>
            <Link
              to="/terms"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {t('public.terms', 'Terms of Use')}
            </Link>
          </div>
        </div>
      </PageContainer>
    </footer>
  );
}
