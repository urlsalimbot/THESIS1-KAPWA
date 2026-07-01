import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const services = [
  { title: 'Social Welfare Counseling', description: 'Professional counseling and psychosocial support for individuals, families, and communities in need.' },
  { title: 'Livelihood Assistance', description: 'Skills training, livelihood programs, and financial assistance for sustainable community development.' },
  { title: 'Child and Youth Welfare', description: 'Protection and development programs for children and youth, including educational support and intervention services.' },
  { title: 'Senior Citizen Services', description: 'Comprehensive support for senior citizens including social pensions, health services, and community engagement.' },
  { title: 'Disaster Response', description: 'Emergency relief, rehabilitation, and recovery assistance for families affected by natural disasters and crises.' },
  { title: 'Family and Community Welfare', description: 'Family counseling, community organizing, and welfare programs to strengthen family units and communities.' },
];

interface ServicesGridProps {
  className?: string;
}

export function ServicesGrid({ className }: ServicesGridProps) {
  return (
    <section className={cn('py-16 md:py-24', className)}>
      <div className="container mx-auto px-4">
        <h2 className="text-2xl md:text-3xl font-semibold text-center mb-12">
          Our Services
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service) => (
            <Card key={service.title} className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-lg">{service.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                <CardDescription className="text-base leading-relaxed">
                  {service.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
