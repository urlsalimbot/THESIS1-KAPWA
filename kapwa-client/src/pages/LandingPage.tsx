import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { HandHeart, ArrowRight, CalendarClock, MapPin, Phone } from 'lucide-react';
import { ProgramsCarousel } from '@/components/public/ProgramsCarousel';
import { ContactInfo } from '@/components/ContactInfo';
import { LatestAnnouncements } from '@/components/announcements/LatestAnnouncements';
import { PageContainer } from '@/components/public/PageContainer';
import { useTranslation } from 'react-i18next';

export function LandingPage() {
  const { t } = useTranslation();
  const { hash } = useLocation();

  const { data: publicPrograms } = useSWR(
    queryKeys.programs.publicList(),
    (key) => api.get<unknown[]>(key),
  );

  // The footer links to `/#services`; honour the hash on client-side
  // navigation so those links actually land on the section.
  useEffect(() => {
    if (!hash) return;
    const target = document.getElementById(hash.slice(1));
    if (target) target.scrollIntoView({ block: 'start' });
  }, [hash]);

  const officeRows = [
    {
      icon: MapPin,
      text: t(
        'contact.mswdoAddress',
        'Municipal Social Welfare and Development Office, Norzagaray, Bulacan'
      ),
    },
    { icon: Phone, text: '(044) 123-4567' },
    {
      icon: CalendarClock,
      text: `${t('contact.officeHours', 'Office Hours')}: ${t(
        'contact.officeHoursValue',
        'Monday to Friday, 8:00 AM - 5:00 PM'
      )}`,
    },
  ];

  return (
    <div className="w-full">
      {/* 1. Hero — asymmetric: copy on the left, an office information panel
          on the right. The panel replaces the previous random stock photo,
          which was an external request, washed out by mix-blend-overlay, and
          useless offline. */}
      <section className="overflow-hidden pb-8 pt-12 sm:pb-10 sm:pt-16 lg:pb-12 lg:pt-20">
        <PageContainer>
          <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-10">
            <div className="lg:col-span-7">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 ring-1 ring-inset ring-accent/15">
                <HandHeart size={28} className="text-accent" aria-hidden="true" />
              </div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-accent">
                MSWDO Norzagaray
              </p>

              <h1 className="mb-6 text-balance font-heading text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
                Compassionate social welfare services for every resident
              </h1>

              <p className="mb-10 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
                Empowering communities through accessible, transparent, and efficient social
                assistance programs in Norzagaray, Bulacan.
              </p>

              <div className="flex flex-wrap gap-4">
                <Button
                  size="lg"
                  variant="brand"
                  className="h-12 px-8 text-base font-semibold"
                  onClick={() =>
                    document
                      .getElementById('services')
                      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }
                >
                  Access Services
                  <ArrowRight size={16} aria-hidden="true" />
                </Button>
                <Button variant="outline" size="lg" asChild className="h-12 px-8 text-base">
                  <Link to="/about">Learn More</Link>
                </Button>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="rounded-3xl border border-border/70 bg-card p-8 shadow-lg">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {t('public.contactUs', 'Contact Us')}
                </p>
                <p className="mt-2 font-heading text-2xl font-bold tracking-tight">
                  {t('landing.visitOffice', 'Visit or contact the office')}
                </p>
                <Separator className="my-6" />
                <ul className="space-y-4">
                  {officeRows.map((row) => {
                    const Icon = row.icon;
                    return (
                      <li key={row.text} className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10">
                          <Icon size={16} className="text-accent" aria-hidden="true" />
                        </span>
                        <span className="text-sm leading-relaxed text-muted-foreground">
                          {row.text}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <Separator className="my-6" />
                {/* Stat lives inside the panel: as a floating card it
                    overlapped the office-hours line at narrow widths. */}
                <div className="flex items-baseline justify-between gap-4">
                  <p className="text-sm text-muted-foreground">
                    {t('landing.activePrograms', 'Active Programs')}
                  </p>
                  <p className="font-heading text-3xl font-bold tabular-nums tracking-tight text-accent">
                    {publicPrograms ? publicPrograms.length : '—'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </PageContainer>
      </section>

      <LatestAnnouncements />

      {/* 2. Services — the active programs from the database, in a carousel.
          Full-bleed band, content inside the shared container. */}
      <section
        id="services"
        className="scroll-mt-20 border-y border-border/60 bg-muted/40 py-16 sm:py-20 lg:py-24"
      >
        <PageContainer>
          <ProgramsCarousel />
        </PageContainer>
      </section>

      {/* 3. About summary */}
      <section className="py-16 sm:py-20 lg:py-24">
        <PageContainer>
          <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-5">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1.5">
                <HandHeart size={14} className="text-accent" aria-hidden="true" />
                <span className="text-xs font-medium tracking-wide text-accent">
                  {t('public.about', 'About')}
                </span>
              </div>
              <h2 className="text-balance font-heading text-3xl font-semibold tracking-tight">
                About MSWDO Norzagaray
              </h2>
            </div>

            <div className="lg:col-span-7">
              <p className="max-w-2xl text-pretty leading-relaxed text-muted-foreground">
                The Municipal Social Welfare and Development Office (MSWDO) of Norzagaray, Bulacan
                is dedicated to providing comprehensive social welfare services to all residents.
                Our team of licensed social workers and dedicated staff work tirelessly to ensure
                that every individual and family in need receives the appropriate assistance,
                support, and care.
              </p>
              <Button variant="outline" className="mt-6" asChild>
                <Link to="/about">
                  Learn More
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>
        </PageContainer>
      </section>

      {/* 4. Contact */}
      <section className="border-t border-border/60 bg-muted/25 py-16 sm:py-20 lg:py-24">
        <PageContainer>
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-5">
              <h2 className="mb-4 text-balance font-heading text-3xl font-semibold tracking-tight">
                Get in Touch
              </h2>
              <p className="mb-6 max-w-md text-pretty leading-relaxed text-muted-foreground">
                Reach out to us in person, by phone, or through our online contact form. We are
                here to serve you.
              </p>
              <Button variant="brand" asChild className="self-start">
                <Link to="/contact">
                  Contact Us
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </Button>
            </div>

            <div className="lg:col-span-7">
              <ContactInfo />
            </div>
          </div>
        </PageContainer>
      </section>
    </div>
  );
}
