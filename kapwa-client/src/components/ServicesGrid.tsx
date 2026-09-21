import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Heart, Briefcase, Baby, Users, Shield, Home } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ServicesGridProps {
  className?: string;
}

/**
 * Services content only — the page owns the surrounding <section> and
 * container. It used to render its own `py-16 md:py-24` wrapper, which
 * doubled the landing page's section padding.
 */
export function ServicesGrid({ className }: ServicesGridProps) {
  const { t } = useTranslation();
  const services = [
    { title: t('services.counseling', 'Social Welfare Counseling'), description: t('services.counselingDesc', 'Professional counseling and psychosocial support for individuals, families, and communities in need.'), icon: Heart },
    { title: t('services.livelihood', 'Livelihood Assistance'), description: t('services.livelihoodDesc', 'Skills training, livelihood programs, and financial assistance for sustainable community development.'), icon: Briefcase },
    { title: t('services.childYouth', 'Child and Youth Welfare'), description: t('services.childYouthDesc', 'Protection and development programs for children and youth, including educational support and intervention services.'), icon: Baby },
    { title: t('services.seniorCitizen', 'Senior Citizen Services'), description: t('services.seniorCitizenDesc', 'Comprehensive support for senior citizens including social pensions, health services, and community engagement.'), icon: Users },
    { title: t('services.disaster', 'Disaster Response'), description: t('services.disasterDesc', 'Emergency relief, rehabilitation, and recovery assistance for families affected by natural disasters and crises.'), icon: Shield },
    { title: t('services.familyCommunity', 'Family and Community Welfare'), description: t('services.familyCommunityDesc', 'Family counseling, community organizing, and welfare programs to strengthen family units and communities.'), icon: Home },
  ];

  return (
    <div className={cn(className)}>
      <div className="mb-12 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1.5">
          <span className="text-xs font-medium tracking-wide text-accent">
            {t('services.whatWeOffer', 'What We Offer')}
          </span>
        </div>
        <h2 className="mb-4 text-balance font-heading text-3xl font-semibold tracking-tight md:text-4xl">
          {t('services.title', 'Our Services')}
        </h2>
        <p className="mx-auto max-w-2xl text-pretty text-muted-foreground">
          {t(
            'services.subtitle',
            'Comprehensive social welfare programs designed to support every member of the Norzagaray community.'
          )}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((service) => {
          const Icon = service.icon;
          return (
            <Card
              key={service.title}
              className="group flex flex-col border-border/60 hover:-translate-y-1 hover:border-accent/30"
            >
              <CardHeader>
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 transition-colors duration-200 group-hover:bg-accent/20">
                  <Icon size={24} className="text-accent" aria-hidden="true" />
                </div>
                <CardTitle className="text-lg tracking-tight">{service.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                <CardDescription className="text-base leading-relaxed text-pretty">
                  {service.description}
                </CardDescription>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
