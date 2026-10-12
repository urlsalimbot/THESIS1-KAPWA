import { useTranslation } from 'react-i18next';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { INTERVENTION_TYPES, INTERVENTION_FORM_FORMATS } from '@/lib/constants';

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
            <select
              aria-label={t('programs.interventionAria', 'Intervention {{n}}', { n: i + 1 })}
              value={row.interventionType}
              onChange={(e) => setRow(i, { interventionType: e.target.value })}
              className="h-8 min-w-[220px] flex-1 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">{t('programs.selectIntervention', 'Select intervention...')}</option>
              {INTERVENTION_TYPES.map((code) => (
                <option key={code} value={code}>{t(`interventionType.${code}`, code)}</option>
              ))}
            </select>
            <select
              aria-label={t('programs.formFormatAria', 'Required form for {{n}}', { n: i + 1 })}
              value={row.requiredForm ?? ''}
              onChange={(e) => setRow(i, { requiredForm: e.target.value || null })}
              className="h-8 min-w-[200px] flex-1 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">{t('programs.noFormFormat', 'No form requirement')}</option>
              {INTERVENTION_FORM_FORMATS.map((f) => (
                <option key={f.key} value={f.key}>{t(`interventionForms.${f.key}`, f.fallback)}</option>
              ))}
            </select>
            {value.length > 1 && (
              <button
                type="button"
                onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                aria-label={t('programs.removeIntervention', 'Remove intervention {{n}}', { n: i + 1 })}
                className="shrink-0 text-muted-foreground hover:text-destructive"
              >
                <X size={16} />
              </button>
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