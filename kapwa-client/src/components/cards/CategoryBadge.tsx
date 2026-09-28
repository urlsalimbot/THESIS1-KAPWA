import { useTranslation } from 'react-i18next';
import { badgeVariants } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { categoryLabel } from '@/i18n/display';
import type { AccessCardCategory } from '@/lib/constants';

// One look per category in the shared vocabulary. Typed against the union, not
// `Record<string, …>`, so adding a category to ACCESS_CARD_CATEGORIES fails the
// build until it is given a variant here instead of silently taking a default.
const CATEGORY_VARIANTS: Record<AccessCardCategory, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  case_service: 'default',
  referral: 'secondary',
  community_service: 'outline',
  seminar: 'secondary',
  payout: 'default',
  compliance: 'outline',
};

// Rows written before the vocabulary was closed can carry a category this map
// has never heard of. They still get a badge.
const FALLBACK_VARIANT = 'outline';

/**
 * A service row's category, as words.
 *
 * Three pages used to answer "what is this category called" three ways, and two
 * of them printed the stored token, so the same row read `community_service` to
 * a coordinator and "Community Service" to the resident. The label comes from
 * `categoryLabel`, which is the translation-aware path.
 *
 * Deliberately a `<span>` and not the shared `<Badge>`: that renders a `<div>`,
 * and this sits inside a `<p>` in the service history. A `<div>` inside a `<p>`
 * is not valid HTML — the parser is entitled to re-parent it, and React says so
 * in the console.
 */
export function CategoryBadge({ category, className }: { category?: string; className?: string }) {
  const { t } = useTranslation();

  return (
    <span
      className={cn(
        badgeVariants({
          variant: CATEGORY_VARIANTS[category as AccessCardCategory] ?? FALLBACK_VARIANT,
        }),
        'text-[10px]',
        className,
      )}
    >
      {category ? categoryLabel(t, category) : t('accessCard.unknown', 'Unknown')}
    </span>
  );
}
