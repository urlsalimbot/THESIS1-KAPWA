import { useNavigate } from 'react-router-dom';
import { FilePlus, CheckSquare, UserPlus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/lib/auth-context';
import { useTranslation } from 'react-i18next';

const WORKER_ROLES = ['admin', 'social_worker'];
const COORDINATOR_ROLES = ['admin', 'social_worker', 'coordinator'];

interface ActionDef {
  icon: typeof FilePlus;
  title: string;
  description: string;
  path: string;
  roles: string[];
}

export function QuickActionPanel() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role || '';

  const ACTIONS: ActionDef[] = [
    {
      icon: FilePlus,
      title: t('dashboard.newIntake', 'New Intake'),
      description: t('dashboard.newIntakeDesc', 'Create a new case intake record'),
      path: '/intake',
      roles: COORDINATOR_ROLES,
    },
    {
      icon: CheckSquare,
      title: t('dashboard.approvalsQueue', 'Approvals Queue'),
      description: t('dashboard.approvalsQueueDesc', 'Review and approve pending cases'),
      path: '/approvals',
      roles: WORKER_ROLES,
    },
    {
      icon: UserPlus,
      title: t('dashboard.newBeneficiary', 'New Beneficiary'),
      description: t('dashboard.newBeneficiaryDesc', 'Register a new beneficiary'),
      path: '/beneficiaries',
      roles: WORKER_ROLES,
    },
  ];

  const visible = ACTIONS.filter(a => a.roles.includes(role));
  if (visible.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      {visible.map(action => {
        const Icon = action.icon;
        return (
          <Card
            key={action.path}
            className="cursor-pointer transition-colors hover:bg-muted/50"
            onClick={() => navigate(action.path)}
          >
            <CardContent className="p-4 flex flex-col items-center text-center gap-2">
              <div className="rounded-full bg-primary/10 p-3">
                <Icon size={24} className="text-primary" />
              </div>
              <p className="font-semibold text-sm">{action.title}</p>
              <p className="text-xs text-muted-foreground">{action.description}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
