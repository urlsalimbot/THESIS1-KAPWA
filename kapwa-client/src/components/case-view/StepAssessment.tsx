import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { CLIENT_CATEGORIES_V2 } from '@/lib/constants';

interface StepAssessmentProps {
  caseData: any;
  assessment: any;
  editingAssessment: boolean;
  onEditToggle: () => void;
  onAssessmentChange: (updater: (prev: any) => any) => void;
  onSave: () => void;
  saving: boolean;
}

export function StepAssessment({
  caseData, assessment, editingAssessment, onEditToggle, onAssessmentChange, onSave, saving,
}: StepAssessmentProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card">
        <div className="px-4 py-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Assessment & Diagnosis</h3>
          <Button variant="outline" size="sm" onClick={onEditToggle}>
            {editingAssessment ? 'Cancel' : caseData?.problemsPresented ? 'Edit' : 'Add Assessment'}
          </Button>
        </div>
        <Separator />
        <div className="px-4 py-3 space-y-3">
          {editingAssessment ? (
            <>
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
            </>
          ) : (
            <>
              <div className="text-sm">
                <span className="text-muted-foreground">Problem/s Presented</span>
                <p className="font-medium">{caseData?.problemsPresented || '—'}</p>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Social Worker's Assessment</span>
                <p className="font-medium">{caseData?.socialWorkerAssessment || '—'}</p>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Client Category</span>
                <p className="font-medium">{caseData?.clientCategory || '—'}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
