import { useTranslation } from 'react-i18next';
import { categoryLabel } from '@/i18n/display';
import { ACCESS_CARD_CATEGORIES, type AccessCardCategory } from '@/lib/constants';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface Props {
  id: string;
  value: AccessCardCategory;
  onChange: (value: AccessCardCategory) => void;
  className?: string;
}

/**
 * The service-category dropdown for every form that writes to `access_card_services`.
 *
 * Rendered from `ACCESS_CARD_CATEGORIES` rather than a hand-written `<option>` list
 * on purpose. The hand-written lists had already drifted twice: the coordinator and
 * agency forms offered `distribution` and `other`, which the server's
 * `LogServiceSchema` rejects, so picking either 400'd and surfaced as a bare
 * "Failed to log activity"; the coordinator form was also missing `payout` and
 * `compliance`, leaving a barangay with no way to record a 4Ps event by hand.
 * Deriving the options makes an unsanctioned value impossible to offer.
 *
 * Labels come from the shared `category.*` i18n namespace, which already carries
 * all six values in both locales.
 */
export function AccessCardCategorySelect({ id, value, onChange, className }: Props) {
  const { t } = useTranslation();
  return (
    <Select value={value} onValueChange={(v) => onChange(v as AccessCardCategory)}>
      {/* id + htmlFor keep the surrounding label association; no aria-label,
          which would take precedence over it. */}
      <SelectTrigger id={id} className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ACCESS_CARD_CATEGORIES.map(category => (
          <SelectItem key={category} value={category}>
            {categoryLabel(t, category)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
