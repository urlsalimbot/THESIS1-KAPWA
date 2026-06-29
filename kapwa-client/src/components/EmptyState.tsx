import { Inbox, SearchX, WifiOff, ShieldOff, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

type EmptyVariant = 'no-data' | 'no-results' | 'offline' | 'no-access';

interface EmptyStateProps {
  variant: EmptyVariant;
  onAction?: () => void;
}

interface EmptyConfig {
  icon: LucideIcon;
  message: string;
  cta: string;
  hint?: string;
}

const CONFIG: Record<EmptyVariant, EmptyConfig> = {
  'no-data': {
    icon: Inbox,
    message: 'No data found',
    cta: 'Add first record',
  },
  'no-results': {
    icon: SearchX,
    message: 'No results match your search',
    cta: 'Clear filters',
  },
  'offline': {
    icon: WifiOff,
    message: 'You appear to be offline',
    cta: 'Retry',
    hint: 'Please check your connection and try again',
  },
  'no-access': {
    icon: ShieldOff,
    message: "You don't have access to this section",
    cta: 'Go to Dashboard',
  },
};

export function EmptyState({ variant, onAction }: EmptyStateProps) {
  const navigate = useNavigate();
  const config = CONFIG[variant];
  const Icon = config.icon;

  const handleAction = () => {
    if (variant === 'no-results' || variant === 'offline') {
      onAction?.();
    } else {
      // no-data navigates to /intake, no-access navigates to /dashboard
      navigate(variant === 'no-data' ? '/intake' : '/dashboard');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <Icon className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
      <p className="text-base font-medium text-foreground">{config.message}</p>
      {config.hint && (
        <p className="text-sm text-muted-foreground">{config.hint}</p>
      )}
      <Button variant="outline" onClick={handleAction}>
        {config.cta}
      </Button>
    </div>
  );
}
