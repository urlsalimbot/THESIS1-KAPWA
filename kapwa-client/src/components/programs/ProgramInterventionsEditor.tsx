import { useTranslation } from 'react-i18next';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { INTERVENTION_TYPE_GROUPS, INTERVENTION_FORM_FORMATS } from '@/lib/constants';

export interface InterventionRowInput {
  interventionType: string;
  requiredForm?: string | null;
}

/**
 * The Program → Interventions matrix editor: which intervention types the
 * program renders, and — for the ones that oblige it — the specific form
 * format that must be accomplished. Kept as a controlled list so Create and
 * Detail can share the exact same UX.
 */
export function ProgramInterventionsEditor({
  value,
  onChange,
}: {
  value: InterventionRowInput[];
  onChange: (next: InterventionRowInput[]) => void;
}) {
  const { t } = useTranslation();

  function setRow(i: number, patch: Partial<InterventionRowInput>) {
    onChange(value.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }

  return (
    <div className="space-y-2">
      <div className="space-y-2">
        {value.map((row, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <Select
              value={row.interventionType}
              onValueChange={(v) => setRow(i, { interventionType: v })}
            >
              <SelectTrigger
                aria-label={t('programs.interventionAria', 'Intervention {{n}}', { n: i + 1 })}
                className="h-9 min-w-[220px] flex-1 text-sm"
              >
                <SelectValue placeholder={t('programs.selectIntervention', 'Select intervention...')} />
              </SelectTrigger>
              <SelectContent className="max-h-72 overflow-y-auto">
                {/* Grouped like the dedup picker: SelectLabel stands in for the
                    optgroup element Radix does not have. */}
                {INTERVENTION_TYPE_GROUPS.map((group) => (
                  <SelectGroup key={group.key}>
                    <SelectLabel>{t(group.key, group.fallback)}</SelectLabel>
                    {group.codes.map((code) => (
                      <SelectItem key={code} value={code}>{t(`interventionType.${code}`, code)}</SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={row.requiredForm ?? ''}
              onValueChange={(v) => setRow(i, { requiredForm: v || null })}
            >
              <SelectTrigger
                aria-label={t('programs.formFormatAria', 'Required form for {{n}}', { n: i + 1 })}
                className="h-9 min-w-[200px] flex-1 text-sm"
              >
                <SelectValue placeholder={t('programs.noFormFormat', 'No form requirement')} />
              </SelectTrigger>
              <SelectContent>
                {INTERVENTION_FORM_FORMATS.map((f) => (
                  <SelectItem key={f.key} value={f.key}>{t(`interventionForms.${f.key}`, f.fallback)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {value.length > 1 && (
              <Button variant="ghost"
                type="button"
                onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                aria-label={t('programs.removeIntervention', 'Remove intervention {{n}}', { n: i + 1 })}
                className="shrink-0 text-muted-foreground hover:text-destructive"
              >
                <X size={16} />
              </Button>
            )}
          </div>
        ))}
      </div>
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...value, { interventionType: '', requiredForm: null }])}
        >
          <Plus size={14} className="mr-1.5" /> {t('programs.addIntervention', 'Add Intervention')}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {t('programs.interventionsHint', 'The intervention types this program renders. An intervention with a form format obliges the worker to accomplish that form.')}
      </p>
    </div>
  );
}

/** Accept a raw program payload (interventions/interventionForms) into editor rows. */
export function programInterventionRows(
  program?: { interventions?: string[]; interventionForms?: Record<string, string> },
): InterventionRowInput[] {
  if (!program) return [];
  const forms = program.interventionForms || {};
  return (program.interventions || []).map((code) => ({ interventionType: code, requiredForm: forms[code] ?? null }));
}