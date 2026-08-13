import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Heart, Briefcase, Baby, Users, Shield, Home } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ServicesGridProps {
  className?: string;
}

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
    <section className={cn('py-16 md:py-24', className)}>
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20 mb-4">
            <span className="text-xs font-medium text-accent tracking-wide">{t('services.whatWeOffer', 'What We Offer')}</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold mb-4 tracking-tight text-balance">
            {t('services.title', 'Our Services')}
          </h2>
          <p className="text-muted-foreground text-center max-w-2xl mx-auto text-pretty">
            {t('services.subtitle', 'Comprehensive social welfare programs designed to support every member of the Norzagaray community.')}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service) => {
            const Icon = service.icon;
            return (
              <Card key={service.title} className="flex flex-col group hover:shadow-lg transition-all duration-200 hover:-translate-y-1">
                <CardHeader>
                  <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-3 group-hover:bg-accent/20 transition-colors duration-200">
                    <Icon size={24} className="text-accent" />
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
    </section>
  );
}
