import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Heart, Briefcase, Baby, Users, Shield, Home } from 'lucide-react';

const services = [
  { title: 'Social Welfare Counseling', description: 'Professional counseling and psychosocial support for individuals, families, and communities in need.', icon: Heart },
  { title: 'Livelihood Assistance', description: 'Skills training, livelihood programs, and financial assistance for sustainable community development.', icon: Briefcase },
  { title: 'Child and Youth Welfare', description: 'Protection and development programs for children and youth, including educational support and intervention services.', icon: Baby },
  { title: 'Senior Citizen Services', description: 'Comprehensive support for senior citizens including social pensions, health services, and community engagement.', icon: Users },
  { title: 'Disaster Response', description: 'Emergency relief, rehabilitation, and recovery assistance for families affected by natural disasters and crises.', icon: Shield },
  { title: 'Family and Community Welfare', description: 'Family counseling, community organizing, and welfare programs to strengthen family units and communities.', icon: Home },
];

interface ServicesGridProps {
  className?: string;
}

export function ServicesGrid({ className }: ServicesGridProps) {
  return (
    <section className={cn('py-16 md:py-24', className)}>
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20 mb-4">
            <span className="text-xs font-medium text-accent tracking-wide">What We Offer</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold mb-4 tracking-tight text-balance">
            Our Services
          </h2>
          <p className="text-muted-foreground text-center max-w-2xl mx-auto text-pretty">
            Comprehensive social welfare programs designed to support every member of the Norzagaray community.
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
