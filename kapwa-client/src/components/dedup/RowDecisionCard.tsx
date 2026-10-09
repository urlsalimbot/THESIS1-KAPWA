import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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
  /** Serving outcome under the eligibility rules; absent on legacy rows. */
  eligibility?: 'allowed' | 'disqualified';
  eligibilityReason?: string;
  eligibilityDecision?: 'waive' | 'confirm';
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

export interface CandidateRemark {
  kind: 'import' | 'decision' | 'barangay_update' | 'manual';
  remark: string;
  source?: string | null;
  authorName?: string | null;
  createdAt: string;
}

/** A matcher-surfaced candidate — evidence for the eligibility review. */
export interface DedupCandidate {
  id: string;
  targetType: 'db_person' | 'import_row' | 'household';
  score: number | string;
  status: 'pending' | 'primary' | 'deprioritized';
  remark?: string | null;
  signals?: Record<string, unknown> & { householdServed?: boolean };
  /** Recent remark history of the existing record (db_person targets only). */
  remarks?: CandidateRemark[];
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
  /** Operator review of a disqualified row: waive (serve anyway) or confirm. */
  onEligibility?: (decision: 'waive' | 'confirm') => void | Promise<void>;
  /** Decide ONE match of a disqualified row (aggregate action decides all). */
  onMatchEligibility?: (matchId: string, decision: 'waive' | 'confirm') => void | Promise<void>;
  busy?: boolean;
}

function targetLabel(c: DedupCandidate): string {
  if (c.targetType === 'db_person') return 'Existing record in KAPWA';
  if (c.targetType === 'household') return 'Household record';
  return 'Duplicate row in this import';
}

/**
 * One import row's review surface under the eligibility rules: candidates are
 * evidence (person/household/import-row identity with their signals), and the
 * row-level interaction is the DISQUALIFICATION review — a disqualified row
 * stays in the list as deprioritized until the operator waives or confirms it
 * (finalize is blocked until then).
 */
export function RowDecisionCard({
  row,
  candidates,
  loading = false,
  embedded = false,
  onEligibility,
  onMatchEligibility,
  busy = false,
}: RowDecisionCardProps) {
  const disqualifiedUndecided = row.eligibility === 'disqualified' && !row.eligibilityDecision;

  const content = (
    <div className="space-y-4">
      {row.eligibility === 'disqualified' && (
        <div
          className={`space-y-2 rounded-md border p-3 ${
            disqualifiedUndecided
              ? 'border-amber-200 bg-amber-50 text-amber-900'
              : 'border-border bg-muted/40 text-muted-foreground'
          }`}
        >
          <div className="flex items-start gap-2 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-medium">
                {row.eligibilityDecision === 'confirm'
                  ? 'Disqualified — confirmed, not served this batch'
                  : row.eligibilityDecision === 'waive'
                    ? 'Disqualified — waived, served after review'
                    : 'Disqualified — review needed'}
              </div>
              {row.eligibilityReason && (
                <p className="mt-0.5 text-xs opacity-90">{row.eligibilityReason}</p>
              )}
            </div>
          </div>
          {disqualifiedUndecided && onEligibility && (
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={() => onEligibility('waive')} disabled={busy}>
                Waive — serve anyway
              </Button>
              <Button size="sm" variant="default" onClick={() => onEligibility('confirm')} disabled={busy}>
                Confirm disqualified
              </Button>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading candidates…</p>
      ) : candidates.length === 0 ? (
        <p className="text-sm text-muted-foreground">No candidate matches for this row.</p>
      ) : (
        candidates.map((c) => (
          <div key={c.id} className="space-y-2 rounded-md border p-3" data-testid={`candidate-${c.id}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{targetLabel(c)}</span>
              <span className="text-xs text-muted-foreground">
                {Math.round(Number(c.score) * 100)}% match
              </span>
            </div>
            <CandidateBody candidate={c} />
            <div className="flex items-center justify-between gap-2">
              <Badge variant="secondary">
                {c.status === 'pending'
                  ? 'Review needed'
                  : c.status === 'deprioritized'
                    ? 'Deprioritized'
                    : 'Matched'}
              </Badge>
              {c.status === 'pending' && onMatchEligibility && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onMatchEligibility(c.id, 'waive')}
                    disabled={busy}
                  >
                    Waive
                  </Button>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => onMatchEligibility(c.id, 'confirm')}
                    disabled={busy}
                  >
                    Confirm
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );

  if (embedded) return content;
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
      <CardContent>{content}</CardContent>
    </Card>
  );
}

const REMARK_KIND_LABELS: Record<CandidateRemark['kind'], string> = {
  import: 'Import',
  decision: 'Decision',
  barangay_update: 'Barangay update',
  manual: 'Remark',
};

function RecentRemarks({ remarks }: { remarks: CandidateRemark[] }) {
  return (
    <div className="space-y-1 border-t border-border pt-2">
      <div className="text-xs font-medium text-muted-foreground">Recent remarks</div>
      <ul className="space-y-1">
        {remarks.map((r, i) => (
          <li key={i} className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{REMARK_KIND_LABELS[r.kind]}</span>
            {' — '}
            {r.remark}
            {(r.source || r.authorName) && (
              <span className="block text-[10px]">
                {[r.source, r.authorName].filter(Boolean).join(' · ')}
              </span>
            )}
          </li>
        ))}
      </ul>
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
        {c.remarks && c.remarks.length > 0 && <RecentRemarks remarks={c.remarks} />}
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