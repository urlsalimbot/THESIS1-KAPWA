import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface TeamSectionProps {
  className?: string;
}

export function TeamSection({ className }: TeamSectionProps) {
  const { t } = useTranslation();
  const teamMembers = [
    { position: t('team.mswdo', 'Municipal Social Welfare & Development Officer'), initials: 'PO', name: t('team.positionHolder', 'Position Holder') },
    { position: t('team.seniorSocialWorker', 'Senior Social Worker'), initials: 'SS', name: t('team.seniorSocialWorker', 'Senior Social Worker') },
    { position: t('team.socialWelfareOfficer', 'Social Welfare Officer'), initials: 'SW', name: t('team.socialWelfareOfficer', 'Social Welfare Officer') },
    { position: t('team.administrativeOfficer', 'Administrative Officer'), initials: 'AO', name: t('team.administrativeOfficer', 'Administrative Officer') },
    { position: t('team.projectDevelopmentOfficer', 'Project Development Officer'), initials: 'PD', name: t('team.projectDevelopmentOfficer', 'Project Development Officer') },
    { position: t('team.communityAffairsOfficer', 'Community Affairs Officer'), initials: 'CA', name: t('team.communityAffairsOfficer', 'Community Affairs Officer') },
  ];

  return (
    <section className={cn('py-16 md:py-24', className)}>
      <div className="container mx-auto px-4">
        <h2 className="text-2xl md:text-3xl font-semibold text-center mb-4">
          {t('team.title', 'Our Team')}
        </h2>
        <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-12">
          {t('team.subtitle', 'Dedicated public servants committed to delivering social welfare services to the community of Norzagaray, Bulacan.')}
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
