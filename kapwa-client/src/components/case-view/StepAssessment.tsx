import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { CLIENT_CATEGORIES_V2 } from '@/lib/constants';

interface StepAssessmentProps {
  caseData: any;
  assessment: any;
  onAssessmentChange: (updater: (prev: any) => any) => void;
  onSave: () => void;
  saving: boolean;
}

export function StepAssessment({
  caseData, assessment, onAssessmentChange, onSave, saving,
}: StepAssessmentProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card">
        <div className="px-4 py-3">
          <h3 className="text-sm font-semibold">Assessment & Diagnosis</h3>
        </div>
        <Separator />
        <div className="px-4 py-3 space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Problem/s Presented *</label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
              value={assessment.problemsPresented}
              onChange={e => onAssessmentChange(a => ({ ...a, problemsPresented: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Social Worker's Assessment *</label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
              value={assessment.socialWorkerAssessment}
              onChange={e => onAssessmentChange(a => ({ ...a, socialWorkerAssessment: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Client Category *</label>
            <div className="mt-1 space-y-1">
              {CLIENT_CATEGORIES_V2.map(cat => (
                <label key={cat} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="clientCategory" value={cat}
                    checked={assessment.clientCategory === cat}
                    onChange={e => onAssessmentChange(a => ({ ...a, clientCategory: e.target.value }))}
                    className="text-primary" />
                  {cat}
                </label>
              ))}
            </div>
          </div>
          <Button onClick={onSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Assessment'}
          </Button>
        </div>
      </div>

      {/* DSWD Assessment Tools */}
      <div className="rounded-lg border bg-card">
        <div className="px-4 py-3">
          <h3 className="text-sm font-semibold">DSWD Assessment Tools</h3>
        </div>
        <Separator />
        <div className="px-4 py-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">FRVA Score (0-100)</label>
              <input
                type="number"
                min="0"
                max="100"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={assessment.frvaScore || ''}
                onChange={e => onAssessmentChange(a => ({ ...a, frvaScore: e.target.value ? Number(e.target.value) : null }))}
                placeholder="Family Risk & Vulnerability Assessment"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">SWDI Score (0-100)</label>
              <input
                type="number"
                min="0"
                max="100"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={assessment.swdiScore || ''}
                onChange={e => onAssessmentChange(a => ({ ...a, swdiScore: e.target.value ? Number(e.target.value) : null }))}
                placeholder="Social Welfare Development Index"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Family Dialogue Notes</label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
              value={assessment.familyDialogueNotes || ''}
              onChange={e => onAssessmentChange(a => ({ ...a, familyDialogueNotes: e.target.value }))}
              placeholder="Notes from family dialogue session..."
            />
          </div>
          <Button onClick={onSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Assessment Tools'}
          </Button>
        </div>
      </div>
    </div>
  );
}
