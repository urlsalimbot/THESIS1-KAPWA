import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

export type KeepChoice = 'import_row' | 'existing_record' | 'other_import_row';
export type DedupRowStatus = 'pending' | 'no_match' | 'retained' | 'primary' | 'deprioritized';

export interface DedupRow {
  id: string;
  rowIndex: number;
  lastName?: string;
  firstName?: string;
  middleName?: string;
  dob?: string;
  barangay?: string;
  remarks?: string;
  status: DedupRowStatus;
}

interface CandidateCase {
  controlNo?: string;
  status?: string;
}

interface CandidateMember {
  personId: string;
  lastName?: string;
  firstName?: string;
  interventions: number;
  cases?: CandidateCase[];
}

/** A matcher-surfaced candidate, enriched by the API for these cards. */
export interface DedupCandidate {
  id: string;
  targetType: 'db_person' | 'import_row' | 'household';
  score: number | string;
  status: 'pending' | 'primary' | 'deprioritized';
  remark?: string | null;
  signals?: Record<string, unknown> & { householdServed?: boolean };
  person?: {
    id: string; lastName?: string; firstName?: string; middleName?: string; dob?: string; barangay?: string;
  } | null;
  interventions?: number;
  cases?: CandidateCase[];
  household?: {
    id: string;
    memberPersonIds: string[];
    members: CandidateMember[];
  } | null;
  pairedRow?: {
    id: string; rowIndex: number; lastName?: string; firstName?: string; dob?: string; barangay?: string;
  } | null;
}

interface RowDecisionCardProps {
  row: DedupRow;
  candidates: DedupCandidate[];
  loading?: boolean;
  /** Render without the card wrapper/header — for embedding inside a dialog. */
  embedded?: boolean;
  onDecide: (matchId: string, keep: KeepChoice, remark?: string) => void | Promise<void>;
  onRevert: (matchId: string) => void | Promise<void>;
}

function targetLabel(c: DedupCandidate): string {
  if (c.targetType === 'db_person') return 'Existing record in KAPWA';
  if (c.targetType === 'household') return 'Household record';
  return 'Duplicate row in this import';
}

function decisionTitle(keep: KeepChoice, c: DedupCandidate): string {
  if (keep === 'other_import_row') return `Keep import row ${c.pairedRow?.rowIndex ?? '?'} (B)`;
  if (keep === 'existing_record') {
    return c.targetType === 'household' ? 'Keep the household record' : 'Keep the existing record';
  }
  return c.targetType === 'import_row' ? 'Keep this row (A)' : 'Retain this row';
}

/** Card chrome when standalone, plain spacing when embedded in a dialog. */
function Wrap({ embedded, row, children }: { embedded: boolean; row: DedupRow; children: React.ReactNode }) {
  if (embedded) return <div className="space-y-4">{children}</div>;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Row {row.rowIndex} — {row.lastName ?? ''}, {row.firstName ?? ''} {row.middleName ?? ''}
        </CardTitle>
        <CardDescription>
          {[row.dob ?? '—', row.barangay ?? '—'].join(' · ')}
          {row.remarks ? ` — ${row.remarks}` : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

/**
 * One import row's decision surface: every candidate with its evidence, a
 * dialog for the retain/deprioritize choice (with the mandatory remark for
 * deprioritizing), and revert for already-decided candidates.
 */
export function RowDecisionCard({ row, candidates, loading = false, onDecide, onRevert, embedded = false }: RowDecisionCardProps) {
  const [pending, setPending] = useState<{ matchId: string; keep: KeepChoice } | null>(null);
  const [remark, setRemark] = useState('');
  const [busy, setBusy] = useState(false);

  const needsRemark = pending !== null && pending.keep !== 'import_row';
  const canSave = pending !== null && (!needsRemark || remark.trim() !== '');
  const selected = pending ? candidates.find((c) => c.id === pending.matchId) ?? null : null;

  async function save() {
    if (!pending || !canSave) return;
    setBusy(true);
    try {
      await onDecide(pending.matchId, pending.keep, remark.trim() || undefined);
      setPending(null);
      setRemark('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Wrap embedded={embedded} row={row}>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading candidates…</p>
      ) : candidates.length === 0 ? (
        <p className="text-sm text-muted-foreground">No candidate matches for this row.</p>
      ) : (
        candidates.map((c) => (
          <CandidateCard
            key={c.id}
            candidate={c}
            onSelect={(keep) => {
              setPending({ matchId: c.id, keep });
              setRemark('');
            }}
            onRevert={onRevert}
          />
        ))
      )}

        <Dialog
          open={pending !== null}
          onOpenChange={(open) => {
            if (!open) {
              setPending(null);
              setRemark('');
            }
          }}
        >
          {pending && selected && (
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{decisionTitle(pending.keep, selected)}</DialogTitle>
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{targetLabel(selected)}</span>
                  <span>{Math.round(Number(selected.score) * 100)}% match</span>
                </div>
                <DialogDescription>
                  {pending.keep === 'import_row'
                    ? 'This row stays in the list and is saved as its own client record.'
                    : 'This import row is pushed below as a duplicate of the kept record — a remark is required.'}
                </DialogDescription>
              </DialogHeader>
              <CandidateBody candidate={selected} />
              <div className="space-y-2">
                <Textarea
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder={needsRemark ? 'Why is this a duplicate? (required)' : 'Note (optional)'}
                  rows={3}
                />
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" size="sm">
                    Cancel
                  </Button>
                </DialogClose>
                <Button size="sm" onClick={save} disabled={!canSave || busy}>
                  Save decision
                </Button>
              </DialogFooter>
            </DialogContent>
          )}
        </Dialog>
    </Wrap>
  );
}

function CandidateCard({
  candidate: c,
  onSelect,
  onRevert,
}: {
  candidate: DedupCandidate;
  onSelect: (keep: KeepChoice) => void;
  onRevert: (matchId: string) => void | Promise<void>;
}) {
  return (
    <div className="space-y-2 rounded-md border p-3" data-testid={`candidate-${c.id}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{targetLabel(c)}</span>
        <span className="text-xs text-muted-foreground">{Math.round(Number(c.score) * 100)}% match</span>
      </div>
      <CandidateBody candidate={c} />
      {c.status === 'pending' ? (
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" variant="outline" onClick={() => onSelect('import_row')}>
            {c.targetType === 'import_row' ? 'Keep this row (A)' : 'Retain this row (new client)'}
          </Button>
          {c.targetType === 'import_row' && (
            <Button size="sm" variant="outline" onClick={() => onSelect('other_import_row')}>
              Keep import row {c.pairedRow?.rowIndex ?? '?'} (B)
            </Button>
          )}
          {c.targetType === 'db_person' && (
            <Button size="sm" variant="outline" onClick={() => onSelect('existing_record')}>
              Keep existing record
            </Button>
          )}
          {c.targetType === 'household' && (
            <Button size="sm" variant="outline" onClick={() => onSelect('existing_record')}>
              Keep household record
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-1 pt-1">
          <Badge variant={c.status === 'primary' ? 'default' : 'secondary'}>
            {c.status === 'primary' ? 'Kept' : 'Deprioritized'}
          </Badge>
          {c.remark && <p className="text-xs text-muted-foreground">{c.remark}</p>}
          <div>
            <Button size="sm" variant="link" className="px-0" onClick={() => onRevert(c.id)}>
              Revert decision
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function CaseLines({ cases }: { cases: CandidateCase[] }) {
  if (cases.length === 0) return <div className="text-muted-foreground">No cases on record</div>;
  return (
    <ul className="space-y-0.5">
      {cases.map((c, i) => (
        <li key={i} className="text-muted-foreground">
          {c.controlNo ?? '—'} {c.status ? `(${c.status})` : ''}
        </li>
      ))}
    </ul>
  );
}

function CandidateBody({ candidate: c }: { candidate: DedupCandidate }) {
  if (c.targetType === 'db_person' && c.person) {
    return (
      <div className="space-y-1 text-sm">
        <div className="text-muted-foreground">
          {c.person.dob ?? '—'} · {c.person.barangay ?? '—'}
        </div>
        <CaseLines cases={c.cases ?? []} />
        <div>
          {c.interventions ?? 0} intervention{(c.interventions ?? 0) === 1 ? '' : 's'}
        </div>
      </div>
    );
  }
  if (c.targetType === 'household' && c.household) {
    return (
      <div className="space-y-1 text-sm">
        {c.signals?.householdServed && (
          <Badge variant="secondary" className="gap-1">
            <AlertTriangle className="h-3 w-3" /> Household already served
          </Badge>
        )}
        <ul className="space-y-1">
          {c.household.members.map((m) => (
            <li key={m.personId} className="text-muted-foreground">
              <span className="text-foreground">
                {m.lastName ?? ''}, {m.firstName ?? ''}
              </span>
              {' — '}
              {m.interventions} intervention{m.interventions === 1 ? '' : 's'}
              {m.cases && m.cases.length > 0 && (
                <span> · {m.cases.map((cc) => cc.controlNo).filter(Boolean).join(', ')}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (c.targetType === 'import_row' && c.pairedRow) {
    return (
      <div className="space-y-1 text-sm">
        <div className="text-muted-foreground">
          Import row {c.pairedRow.rowIndex}: {c.pairedRow.lastName ?? ''}, {c.pairedRow.firstName ?? ''}
        </div>
        <div className="text-xs text-muted-foreground">
          {c.pairedRow.dob ?? '—'} · {c.pairedRow.barangay ?? '—'}
        </div>
        <p className="text-xs text-muted-foreground">Same import list — exactly one of the pair is kept.</p>
      </div>
    );
  }
  return null;
}