import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface TeamSectionProps {
  className?: string;
}

/**
 * Team content only — the page owns the surrounding <section> and container,
 * so section padding is applied once instead of twice.
 */
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
    <div className={cn(className)}>
      <h2 className="mb-4 text-center font-heading text-2xl font-semibold tracking-tight md:text-3xl">
        {t('team.title', 'Our Team')}
      </h2>
      <p className="mx-auto mb-12 max-w-2xl text-center text-pretty text-muted-foreground">
        {t(
          'team.subtitle',
          'Dedicated public servants committed to delivering social welfare services to the community of Norzagaray, Bulacan.'
        )}
      </p>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {teamMembers.map((member) => (
          <div
            key={member.position}
            className="flex flex-col items-center p-6 text-center"
          >
            <Avatar className="mb-4 h-16 w-16">
              <AvatarFallback className="text-lg font-medium">{member.initials}</AvatarFallback>
            </Avatar>
            <h3 className="mb-1 font-medium text-base">{member.name}</h3>
            <p className="text-sm text-muted-foreground">{member.position}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
