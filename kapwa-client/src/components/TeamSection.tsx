import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

const teamMembers = [
  { position: 'Municipal Social Welfare & Development Officer', initials: 'PO', name: 'Position Holder' },
  { position: 'Senior Social Worker', initials: 'SS', name: 'Senior Social Worker' },
  { position: 'Social Welfare Officer', initials: 'SW', name: 'Social Welfare Officer' },
  { position: 'Administrative Officer', initials: 'AO', name: 'Administrative Officer' },
  { position: 'Project Development Officer', initials: 'PD', name: 'Project Development Officer' },
  { position: 'Community Affairs Officer', initials: 'CA', name: 'Community Affairs Officer' },
];

interface TeamSectionProps {
  className?: string;
}

export function TeamSection({ className }: TeamSectionProps) {
  return (
    <section className={cn('py-16 md:py-24', className)}>
      <div className="container mx-auto px-4">
        <h2 className="text-2xl md:text-3xl font-semibold text-center mb-4">
          Our Team
        </h2>
        <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-12">
          Dedicated public servants committed to delivering social welfare services to the community of Norzagaray, Bulacan.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {teamMembers.map((member) => (
            <div key={member.position} className="flex flex-col items-center text-center p-6">
              <Avatar className="w-16 h-16 mb-4">
                <AvatarFallback className="text-lg font-medium">{member.initials}</AvatarFallback>
              </Avatar>
              <h3 className="font-medium text-base mb-1">{member.name}</h3>
              <p className="text-sm text-muted-foreground">{member.position}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
