import { useTranslation } from 'react-i18next';

/** Small muted "You" pill marking the signed-in user's own roster row/card. */
export function YouBadge() {
  const { t } = useTranslation();
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground">
      {t('team.you')}
    </span>
  );
}