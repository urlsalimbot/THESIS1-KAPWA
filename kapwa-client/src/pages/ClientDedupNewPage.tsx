import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileSpreadsheet, Plus, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import i18n from '@/i18n';
import { api } from '../lib/api';
import { INTERVENTION_TYPES } from '../lib/constants';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const t = i18n.t.bind(i18n);

const BASELINE_FIELDS = [
  { key: 'lastName', label: 'Last Name column' },
  { key: 'firstName', label: 'First Name column' },
  { key: 'middleName', label: 'Middle Name column' },
  { key: 'birthDate', label: 'Birthday column' },
  { key: 'barangay', label: 'Barangay column' },
  { key: 'remarks', label: 'Remarks column' },
] as const;

type BaselineKey = (typeof BASELINE_FIELDS)[number]['key'];
type ExtraKind = 'text' | 'date' | 'number';
type ExtraIdentifier = 'phone' | 'email' | 'philsys';

interface ExtraField {
  name: string;
  kind: ExtraKind;
  identifier?: ExtraIdentifier;
  sourceColumn: string;
}

const OTHER_TYPE = '__other__';

function typeLabel(code: string): string {
  return code.replace(/_/g, ' ').replace(/^./, (c: string) => c.toUpperCase());
}

function emptyDraft() {
  return {
    source: '',
    // The intervention this list serves: an INTERVENTION_TYPES code, or a
    // custom label when 'Others' is chosen.
    interventionType: '',
    interventionTypeCustom: '',
    baseline: {
      lastName: 'Last Name',
      firstName: 'First Name',
      middleName: 'Middle Name',
      birthDate: 'Birthday',
      barangay: 'Barangay',
      remarks: 'Remarks',
    } as Record<BaselineKey, string>,
    extras: [] as ExtraField[],
  };
}

export default function ClientDedupNewPage() {
  const navigate = useNavigate();
  return (
    <DefineUploadView
      onBack={() => navigate('/client-dedup')}
      onUploaded={(operationId) => navigate(`/client-dedup/${operationId}`)}
    />
  );
}

function DefineUploadView({
  onBack,
  onUploaded,
}: {
  onBack: () => void;
  onUploaded: (operationId: string) => void;
}) {
  const [draft, setDraft] = useState(emptyDraft);
  const [file, setFile] = useState<File | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const setBaseline = (key: BaselineKey, value: string) =>
    setDraft((d) => ({ ...d, baseline: { ...d.baseline, [key]: value } }));

  const setExtra = (index: number, patch: Partial<ExtraField>) =>
    setDraft((d) => ({
      ...d,
      extras: d.extras.map((e, i) => (i === index ? { ...e, ...patch } : e)),
    }));

  const effectiveInterventionType =
    draft.interventionType === OTHER_TYPE ? draft.interventionTypeCustom.trim() : draft.interventionType;

  async function handleCreateAndUpload() {
    if (draft.source.trim() === '') {
      toast.error(t('dedup.nameListHint', 'Name this list — e.g. the file name or the batch it came from.'));
      return;
    }
    if (effectiveInterventionType === '') {
      toast.error(t('dedup.pickType', 'Pick the intervention type this list serves.'));
      return;
    }
    if (!file) {
      toast.error(t('dedup.pickFile', 'Choose the client list file to upload.'));
      return;
    }
    setBusy(true);
    try {
      let operationId = createdId;
      if (!operationId) {
        const created = await api.post<{ id: string }>('/client-dedup/operations', {
          source: draft.source.trim(),
          interventionType: effectiveInterventionType,
          columnMap: {
            baseline: draft.baseline,
            extras: draft.extras.map((e) => ({
              name: e.name.trim(),
              kind: e.kind,
              ...(e.identifier ? { identifier: e.identifier } : {}),
              sourceColumn: e.sourceColumn.trim(),
            })),
          },
        });
        operationId = created.id;
        setCreatedId(operationId);
      }
      const formData = new FormData();
      formData.append('file', file);
      await api.upload(`/client-dedup/operations/${operationId}/upload`, formData);
      toast.success(t('dedup.uploaded', 'Client list uploaded — review the candidate matches.'));
      onUploaded(operationId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('dedup.uploadFailed', 'Upload failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell
      title={t('dedup.newOperation', 'New deduplication')}
      description="An import run is a batch serving: it declares the intervention type, then matches clients against prior servings."
      backTo={{ label: t('dedup.operations', 'Operations'), onClick: onBack }}
    >
      <Card>
        {/* Tinted section bar, copied from IntakePage's card headers. */}
        <div className="border-b bg-muted/30 px-4 py-2.5 flex items-center gap-2">
          <FileSpreadsheet size={16} className="text-muted-foreground" aria-hidden="true" />
          <h2 className="text-sm font-semibold">{t('dedup.defineTitle', 'Define the client list')}</h2>
        </div>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            {t(
              'dedup.defineDesc',
              'Match each declared row to the column that carries it in the file. The six baseline rows are required; declare any extra field your list includes.',
            )}
          </p>
          <div className="space-y-2">
            <Label htmlFor="dedup-source">{t('dedup.listName', 'List name')}</Label>
            <Input
              id="dedup-source"
              value={draft.source}
              onChange={(e) => setDraft((d) => ({ ...d, source: e.target.value }))}
              placeholder="e.g. Batch 2 — Poblacion, October"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dedup-type">{t('dedup.interventionType', 'Intervention type')}</Label>
            <Select
              value={draft.interventionType}
              onValueChange={(value) =>
                setDraft((d) => ({ ...d, interventionType: value, interventionTypeCustom: '' }))
              }
            >
              <SelectTrigger id="dedup-type" aria-label={t('dedup.interventionType', 'Intervention type')}>
                <SelectValue placeholder="Pick the intervention this list serves" />
              </SelectTrigger>
              <SelectContent className="max-h-72 overflow-y-auto">
                {INTERVENTION_TYPES.map((code) => (
                  <SelectItem key={code} value={code}>
                    {typeLabel(code)}
                  </SelectItem>
                ))}
                <SelectItem value={OTHER_TYPE}>{t('dedup.others', 'Others…')}</SelectItem>
              </SelectContent>
            </Select>
            {draft.interventionType === OTHER_TYPE && (
              <Input
                value={draft.interventionTypeCustom}
                onChange={(e) => setDraft((d) => ({ ...d, interventionTypeCustom: e.target.value }))}
                placeholder="e.g. Gift cards for senior citizens"
                aria-label="Other intervention type"
              />
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BASELINE_FIELDS.map((field) => (
              <div className="space-y-2" key={field.key}>
                <Label htmlFor={`dedup-col-${field.key}`}>{field.label}</Label>
                <Input
                  id={`dedup-col-${field.key}`}
                  value={draft.baseline[field.key]}
                  onChange={(e) => setBaseline(field.key, e.target.value)}
                />
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{t('dedup.extraFields', 'Extra fields')}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    extras: [...d.extras, { name: '', kind: 'text', sourceColumn: '' }],
                  }))
                }
              >
                <Plus className="mr-2 h-4 w-4" />{t('dedup.declareExtra', 'Declare extra field')}</Button>
            </div>
            {draft.extras.map((extra, index) => (
              <div className="grid gap-3 sm:grid-cols-4" key={index}>
                <Input
                  placeholder={t('dedup.fieldName', 'Field name')}
                  value={extra.name}
                  onChange={(e) => setExtra(index, { name: e.target.value })}
                />
                <Select
                  value={extra.kind}
                  onValueChange={(value) => setExtra(index, { kind: value as ExtraKind })}
                >
                  <SelectTrigger aria-label="Field kind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">{t('dedup.kindText', 'Text')}</SelectItem>
                    <SelectItem value="date">{t('dedup.kindDate', 'Date')}</SelectItem>
                    <SelectItem value="number">{t('dedup.kindNumber', 'Number')}</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={extra.identifier ?? 'none'}
                  onValueChange={(value) =>
                    setExtra(index, {
                      identifier: value === 'none' ? undefined : (value as ExtraIdentifier),
                    })
                  }
                >
                  <SelectTrigger aria-label="Field meaning">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('dedup.kindPlain', 'Plain field')}</SelectItem>
                    <SelectItem value="phone">{t('dedup.kindPhone', 'Phone number')}</SelectItem>
                    <SelectItem value="email">{t('dedup.kindEmail', 'Email address')}</SelectItem>
                    <SelectItem value="philsys">{t('dedup.kindPhilSys', 'PhilSys number')}</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Input
                    placeholder={t('dedup.sourceColumn', 'Source column')}
                    value={extra.sourceColumn}
                    onChange={(e) => setExtra(index, { sourceColumn: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('dedup.removeExtra', 'Remove extra field')}
                    onClick={() =>
                      setDraft((d) => ({ ...d, extras: d.extras.filter((_, i) => i !== index) }))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="dedup-file">{t('dedup.fileLabel', 'Client list file')}</Label>
            <Input
              id="dedup-file"
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted-foreground">{t('dedup.fileHint', 'Excel or CSV. Rows missing Last Name, First Name, or Birthday are rejected.')}</p>
          </div>

          <Button onClick={handleCreateAndUpload} disabled={busy}>
            <Upload className="mr-2 h-4 w-4" />
            {busy ? t('dedup.uploading', 'Uploading…') : createdId ? t('dedup.retryUpload', 'Retry upload') : t('dedup.createUpload', 'Create & upload')}
          </Button>
        </CardContent>
      </Card>
    </PageShell>
  );
}