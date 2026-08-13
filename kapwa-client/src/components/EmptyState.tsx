import { Inbox, SearchX, WifiOff, ShieldOff, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

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

export function EmptyState({ variant, onAction }: EmptyStateProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const config: Record<EmptyVariant, EmptyConfig> = {
    'no-data': {
      icon: Inbox,
      message: t('error.emptyNoData', 'No data found'),
      cta: t('error.emptyAddFirst', 'Add first record'),
    },
    'no-results': {
      icon: SearchX,
      message: t('error.emptyNoResults', 'No results match your search'),
      cta: t('error.emptyClearFilters', 'Clear filters'),
    },
    'offline': {
      icon: WifiOff,
      message: t('error.emptyOffline', 'You appear to be offline'),
      cta: t('error.retry', 'Retry'),
      hint: t('error.emptyOfflineHint', 'Please check your connection and try again'),
    },
    'no-access': {
      icon: ShieldOff,
      message: t('error.emptyNoAccess', "You don't have access to this section"),
      cta: t('error.goToDashboard', 'Go to Dashboard'),
    },
  };
  const activeConfig = config[variant];
  const Icon = activeConfig.icon;

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
      <Icon size={48} className="text-muted-foreground" aria-hidden="true" />
      <p className="text-base font-medium text-foreground">{activeConfig.message}</p>
      {activeConfig.hint && (
        <p className="text-sm text-muted-foreground">{activeConfig.hint}</p>
      )}
      <Button variant="outline" onClick={handleAction}>
        {activeConfig.cta}
      </Button>
    </div>
  );
}
