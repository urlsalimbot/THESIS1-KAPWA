import { useNavigate } from 'react-router-dom';
import { FilePlus, CheckSquare, UserPlus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/lib/auth-context';

const WORKER_ROLES = ['admin', 'social_worker'];
const COORDINATOR_ROLES = ['admin', 'social_worker', 'coordinator'];

interface ActionDef {
  icon: typeof FilePlus;
  title: string;
  description: string;
  path: string;
  roles: string[];
}

const ACTIONS: ActionDef[] = [
  {
    icon: FilePlus,
    title: 'New Intake',
    description: 'Create a new case intake record',
    path: '/intake',
    roles: COORDINATOR_ROLES,
  },
  {
    icon: CheckSquare,
    title: 'Approvals Queue',
    description: 'Review and approve pending cases',
    path: '/approvals',
    roles: WORKER_ROLES,
  },
  {
    icon: UserPlus,
    title: 'New Beneficiary',
    description: 'Register a new beneficiary',
    path: '/beneficiaries',
    roles: WORKER_ROLES,
  },
];

export function QuickActionPanel() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role || '';

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
