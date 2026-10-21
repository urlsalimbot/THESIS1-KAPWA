import { useState } from 'react';
import i18n from '@/i18n';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/format';

const t = i18n.t.bind(i18n);

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
  /**
   * Traffic-light code from the server — `recent_intervention`/`household_recent`
   * (red), `passed_30d` (yellow), `no_intervention`/`new_client` (green),
   * `intra_list` (phase-1 duplicate). Rows from before the code existed carry
   * none; the card renders them in the neutral style.
   */
  eligibilityCode?: string | null;
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
  lastDeliveryDate?: string | null;
  cases?: CandidateCase[];
}

export interface CandidateRemark {
  kind: 'import' | 'decision' | 'barangay_update' | 'manual';
  remark: string;
  source?: string | null;
  authorName?: string | null;
  createdAt: string;
}

/**
 * The one decision for a candidate, per phase:
 *
 * Phase 1 (`import_row`): which row of the pair wins — `keep_row` (this row) or
 * `keep_other_row` (the paired import row, reason required).
 *
 * Phase 2 (`db_person`/`household`): is it the same person?
 *   - `new_client`       → NO — different person; the row imports as a new client
 *   - `keep_here`        → YES — the existing record is updated, the row keeps
 *                          its position in the priority list
 *   - `deprioritize`     → YES — record updated, row moves to the bottom of the
 *                          priority list (reason required)
 */
export type MatchDecision =
  | { kind: 'keep_row' }
  | { kind: 'keep_other_row'; remark: string }
  | { kind: 'new_client'; remark?: string }
  | { kind: 'keep_here' }
  | { kind: 'deprioritize'; remark: string };

/** A matcher-surfaced candidate — evidence for the match decision. */
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
  /** The person's most recent service date, for the "passes the 30-day gate" line. */
  lastDeliveryDate?: string | null;
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
  /**
   * The match decision (see `MatchDecision`): which row wins in phase 1, and
   * the same-person / position tree in phase 2. Deprioritizing keeps demand a
   * reason — the server rejects an empty one.
   */
  onDecide?: (matchId: string, decision: MatchDecision) => void | Promise<void>;
  /** Undo a decided match (same person / duplicate / new client). */
  onRevert?: (matchId: string) => void | Promise<void>;
  /** Undo the row's waive/confirm decision on a disqualified row. */
  onRevertEligibility?: () => void | Promise<void>;
  busy?: boolean;
}

function targetLabel(c: DedupCandidate): string {
  if (c.targetType === 'db_person') return t('dedup.targetDb', 'Existing record in KAPWA');
  if (c.targetType === 'household') return t('dedup.targetHousehold', 'Household record');
  return t('dedup.targetIntra', 'Duplicate row in this import');
}

/**
 * The traffic-light frame and copy for one eligibility code. Missing codes
 * (rows imported before the code existed) render neutral, and the existing
 * disqualification panel carries the decision either way.
 */
function codeMeta(code: string | null | undefined): { frame: string; dot: string; text: string; label: string } | null {
  switch (code) {
    case 'recent_intervention':
      return { frame: 'border-destructive/30 bg-destructive/10', dot: 'bg-destructive', text: 'text-destructive-foreground', label: t('dedup.codeRecent', 'Served within the last 30 days') };
    case 'household_recent':
      return { frame: 'border-destructive/30 bg-destructive/10', dot: 'bg-destructive', text: 'text-destructive-foreground', label: t('dedup.codeHousehold', 'Household member served within the last 30 days') };
    case 'intra_list':
      return { frame: 'border-warning/35 bg-alert-error-bg', dot: 'bg-warning', text: 'text-warning-foreground', label: t('dedup.codeIntra', 'Duplicate in this list — keep exactly one') };
    case 'passed_30d':
      return { frame: 'border-warning/35 bg-alert-error-bg', dot: 'bg-warning', text: 'text-warning-foreground', label: t('dedup.codePassed', 'Served earlier — passes the 30-day gate') };
    case 'no_intervention':
      return { frame: 'border-success/35 bg-alert-success-bg', dot: 'bg-success', text: 'text-success-foreground', label: t('dedup.codeNoIntervention', 'Matched — no prior intervention') };
    case 'new_client':
      return { frame: 'border-success/35 bg-alert-success-bg', dot: 'bg-success', text: 'text-success-foreground', label: t('dedup.codeNewClient', 'No match — new client') };
    default:
      return null;
  }
}

/** The per-signal "what matched" tokens every candidate exposes. */
function SignalChips({ signals }: { signals?: Record<string, unknown> }) {
  if (!signals) return null;
  const s = signals;
  const chips = [
    { on: !!s.dobMatch || !!s.birthdayMatch, label: t('dedup.sigBirthday', 'Birthday') },
    { on: !!s.surnamePhoneticMatch, label: t('dedup.sigSurname', 'Surname') },
    { on: !!s.middleNameMatch, label: t('dedup.sigMiddle', 'Middle name') },
    { on: !!s.barangayMatch, label: t('dedup.sigBarangay', 'Barangay') },
    { on: !!s.phoneMatch, label: t('dedup.sigPhone', 'Phone') },
    { on: !!s.philsysMatch, label: t('dedup.sigPhilSys', 'PhilSys') },
  ];
  return (
    <div className="flex flex-wrap gap-1">
      {chips.map((chip) => (
        <Badge
          key={chip.label}
          variant={chip.on ? 'default' : 'muted'}
          className={chip.on ? 'bg-alert-success-bg text-success-foreground' : undefined}
        >
          {chip.on ? '✓' : '✗'} {chip.label}
        </Badge>
      ))}
    </div>
  );
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
  onDecide,
  onRevert,
  onRevertEligibility,
  busy = false,
}: RowDecisionCardProps) {
  const disqualifiedUndecided = row.eligibility === 'disqualified' && !row.eligibilityDecision;
  const red = row.eligibilityCode === 'recent_intervention' || row.eligibilityCode === 'household_recent';

  const content = (
    <div className="space-y-4">
      {row.eligibility === 'disqualified' && (
        <div
          className={`space-y-2 rounded-md border p-3 ${
            disqualifiedUndecided
              ? red
                ? 'border-destructive/30 bg-destructive/10 text-destructive-foreground'
                : 'border-warning/35 bg-alert-error-bg text-warning-foreground'
              : 'border-border bg-muted/40 text-muted-foreground'
          }`}
        >
          <div className="flex items-start gap-2 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-medium">
                {row.eligibilityDecision === 'confirm'
                  ? t('dedup.disqConfirmed', 'Disqualified — confirmed, not served this batch')
                  : row.eligibilityDecision === 'waive'
                    ? t('dedup.disqWaived', 'Disqualified — waived, served after review')
                    : 'Disqualified — review needed'}
              </div>
              {row.eligibilityReason && (
                <p className="mt-0.5 text-xs opacity-90">{row.eligibilityReason}</p>
              )}
            </div>
          </div>
          {row.eligibilityDecision && onRevertEligibility && (
            <div className="pt-1">
              <Button size="sm" variant="outline" onClick={() => onRevertEligibility()} disabled={busy}>
                <RotateCcw size={13} className="mr-1" /> {t('dedup.undoEligibility', 'Undo decision')}
              </Button>
            </div>
          )}
          {disqualifiedUndecided && onEligibility && (
            <div className="flex gap-2 pt-1">
              {/* A duplicate of another row in the same list is decided by the
                  pair buttons, never waived: serving both is what creates the
                  duplicate. */}
              {row.eligibilityCode !== 'intra_list' && (
                <Button size="sm" variant="outline" onClick={() => onEligibility('waive')} disabled={busy}>{t('dedup.waive', 'Waive — serve anyway')}</Button>
              )}
              <Button size="sm" variant="default" onClick={() => onEligibility('confirm')} disabled={busy}>{t('dedup.confirm', 'Confirm disqualified')}</Button>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">{t('dedup.loading', 'Loading candidates…')}</p>
      ) : candidates.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('dedup.noCandidates', 'No candidate matches for this row.')}</p>
      ) : (
        candidates.map((c) => {
          const light = codeMeta(row.eligibilityCode);
          // Phase 1: decide which row of the pair wins. Phase 2: the
          // same-person tree — it replaces the old keep and waive/confirm
          // controls, so a red (recently served) card resolves its eligibility
          // through keep/deprioritize/new-client instead.
          const phase1 = c.status === 'pending' && onDecide != null && c.targetType === 'import_row';
          const phase2 = c.status === 'pending' && onDecide != null && (c.targetType === 'db_person' || c.targetType === 'household');
          // Match-level waive/confirm survives only on phase-1 duplicates and
          // legacy rows without a code; phase-2 rows decide via the tree.
          const legacyMatchReview =
            c.status === 'pending' && onMatchEligibility != null && (row.eligibilityCode === 'intra_list' || !row.eligibilityCode);
          return (
            <div
              key={c.id}
              className={`space-y-2 rounded-md border p-3 ${light?.frame ?? ''}`}
              data-testid={`candidate-${c.id}`}
            >
              {light && (
                <div className={`flex items-center gap-1.5 text-xs font-medium ${light.text}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${light.dot}`} aria-hidden="true" />
                  {light.label}
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{targetLabel(c)}</span>
                <span className="text-xs text-muted-foreground">
                  {Math.round(Number(c.score) * 100)}% match
                </span>
              </div>
              <CandidateBody candidate={c} row={row} />
              <div className="flex items-center justify-between gap-2">
                <Badge variant="secondary">
                  {c.status === 'pending'
                    ? t('dedup.badgeReview', 'Review needed')
                    : c.status === 'deprioritized'
                      ? t('dedup.badgeDeprioritized', 'Deprioritized')
                      : t('dedup.badgeMatched', 'Matched')}
                </Badge>
                {legacyMatchReview && (
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
                {c.status !== 'pending' && onRevert && !row.eligibilityDecision && (
                  <Button size="sm" variant="ghost" onClick={() => onRevert(c.id)} disabled={busy}>
                    <RotateCcw size={13} className="mr-1" /> {t('dedup.revertDecision', 'Revert decision')}
                  </Button>
                )}
              </div>
              {phase1 && <Phase1Keep candidate={c} onDecide={onDecide} busy={busy} />}
              {phase2 && <Phase2Tree candidate={c} onDecide={onDecide} busy={busy} />}
            </div>
          );
        })
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
          {[formatDate(row.dob), row.barangay ?? '—'].join(' · ')}
          {row.remarks ? ` — ${row.remarks}` : ''}
        </CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}

const REMARK_KIND_LABELS: Record<CandidateRemark['kind'], string> = {
  import: t('dedup.kindImport', 'Import'),
  decision: t('dedup.kindDecision', 'Decision'),
  barangay_update: t('dedup.kindBarangay', 'Barangay update'),
  manual: t('dedup.kindRemark', 'Remark'),
};

function RecentRemarks({ remarks }: { remarks: CandidateRemark[] }) {
  return (
    <div className="space-y-1 border-t border-border pt-2">
      <div className="text-xs font-medium text-muted-foreground">{t('dedup.recentRemarks', 'Recent remarks')}</div>
      <ul className="space-y-1">
        {remarks.map((r, i) => (
          <li key={i} className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{REMARK_KIND_LABELS[r.kind]}</span>
            {' — '}
            {r.remark}
            {(r.source || r.authorName) && (
              <span className="block text-xs">
                {[r.source, r.authorName].filter(Boolean).join(' · ')}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Phase 1: which row of the pair wins. "Keep this row" needs no reason; "keep
 * the other row" names the loser and demands one (the server rejects an empty
 * deprioritizing remark).
 */
function Phase1Keep({
  candidate: c,
  onDecide,
  busy,
}: {
  candidate: DedupCandidate;
  onDecide: NonNullable<RowDecisionCardProps['onDecide']>;
  busy: boolean;
}) {
  const [remark, setRemark] = useState('');
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2">
      <Button size="sm" variant="default" disabled={busy} onClick={() => onDecide(c.id, { kind: 'keep_row' })}>{t('dedup.keepThisRow', 'Keep this row')}</Button>
      <Button
        size="sm"
        variant="outline"
        disabled={busy || remark.trim() === ''}
        title={remark.trim() === '' ? 'Name a reason before setting this row aside' : undefined}
        onClick={() => onDecide(c.id, { kind: 'keep_other_row', remark: remark.trim() })}
      >
        Keep row {c.pairedRow?.rowIndex ?? ''} instead
      </Button>
      <Input
        className="h-7 w-64 text-xs"
        placeholder={`Reason — why row ${c.pairedRow?.rowIndex ?? ''} wins`}
        aria-label={t('dedup.deprioritizeReasonAria', 'Deprioritize reason')}
        value={remark}
        onChange={(e) => setRemark(e.target.value)}
      />
    </div>
  );
}

/**
 * Phase 2: the same-person tree. First "is this the same person?"; a NO
 * imports the row as a new client (the claim is severed); a YES then asks
 * where the row sits — same position, or the bottom of the priority list
 * (reason required, matching the server rule).
 */
function Phase2Tree({
  candidate: c,
  onDecide,
  busy,
}: {
  candidate: DedupCandidate;
  onDecide: NonNullable<RowDecisionCardProps['onDecide']>;
  busy: boolean;
}) {
  const [ask, setAsk] = useState<'ask' | 'yes'>('ask');
  const [remark, setRemark] = useState('');
  if (ask === 'ask') {
    return (
      <div className="space-y-1.5 border-t border-border pt-2">
        <div className="text-xs font-medium text-muted-foreground">{t('dedup.samePersonQ', 'Is this the same person?')}</div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="default" disabled={busy} onClick={() => setAsk('yes')}>{t('dedup.samePersonYes', 'Yes — update the record')}</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => onDecide(c.id, { kind: 'new_client' })}>{t('dedup.samePersonNo', 'No — import as new client')}</Button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-1.5 border-t border-border pt-2">
      <div className="text-xs font-medium text-muted-foreground">{t('dedup.samePersonWhere', 'Same person — where does the row sit in the priority list?')}</div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={() => onDecide(c.id, { kind: 'keep_here' })}>{t('dedup.keepHere', 'Keep — position unchanged')}</Button>
        <Button
          size="sm"
          variant="default"
          disabled={busy || remark.trim() === ''}
          title={remark.trim() === '' ? 'Name a reason before moving the row down' : undefined}
          onClick={() => onDecide(c.id, { kind: 'deprioritize', remark: remark.trim() })}
        >{t('dedup.deprioritize', 'Deprioritize — move to bottom')}</Button>
        <Input
          className="h-7 w-64 text-xs"
          placeholder={t('dedup.deprioritizePlaceholder', 'Reason — why this row sits at the bottom')}
          aria-label={t('dedup.deprioritizeReasonAria', 'Deprioritize reason')}
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
        />
      </div>
    </div>
  );
}

function CaseLines({ cases }: { cases: CandidateCase[] }) {
  if (cases.length === 0) return <div className="text-muted-foreground">{t('dedup.noCases', 'No cases on record')}</div>;
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

function CandidateBody({ candidate: c, row }: { candidate: DedupCandidate; row: DedupRow }) {
  if (c.targetType === 'db_person' && c.person) {
    return (
      <div className="space-y-1 text-sm">
        <div className="text-muted-foreground">
          {formatDate(c.person.dob)} · {c.person.barangay ?? '—'}
        </div>
        <CaseLines cases={c.cases ?? []} />
        <div>
          {c.interventions ?? 0} intervention{(c.interventions ?? 0) === 1 ? '' : 's'}
          {c.lastDeliveryDate
            ? ` · last served ${formatDate(c.lastDeliveryDate)}`
            : (c.interventions ?? 0) > 0
              ? ' · last served date unknown'
              : ''}
        </div>
        <SignalChips signals={c.signals} />
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
              {m.lastDeliveryDate ? ` · last ${formatDate(m.lastDeliveryDate)}` : ''}
              {m.cases && m.cases.length > 0 && (
                <span> · {m.cases.map((cc) => cc.controlNo).filter(Boolean).join(', ')}</span>
              )}
            </li>
          ))}
        </ul>
        <SignalChips signals={c.signals} />
      </div>
    );
  }
  if (c.targetType === 'import_row' && c.pairedRow) {
    const s = c.signals ?? {};
    const namesClose = Boolean(s.surnamePhoneticMatch) || (Number(s.simSurname) ?? 0) >= 0.75;
    const sameBirthday = Boolean(s.dobMatch ?? s.birthdayMatch);
    // The classic list-adjacent duplicate: everything about the identity agrees
    // except the barangay, which is exactly the field a re-encoded list drifts on.
    const differsOnlyBarangay = namesClose && sameBirthday && s.barangayMatch === false;
    return (
      <div className="space-y-1 text-sm">
        <div className="text-muted-foreground">
          Import row {c.pairedRow.rowIndex}: {c.pairedRow.lastName ?? ''}, {c.pairedRow.firstName ?? ''}
        </div>
        <div className="text-xs text-muted-foreground">
          {c.pairedRow.dob ?? '—'} · {c.pairedRow.barangay ?? '—'}
        </div>
        {differsOnlyBarangay && (
          <p className="rounded-md border border-warning/35 bg-alert-error-bg px-2 py-1 text-xs text-warning-foreground">
            Names and birthday match across the two rows; the barangay differs (
            {c.pairedRow.barangay ?? '—'} vs {row.barangay ?? '—'}). Keep exactly one.
          </p>
        )}
        <SignalChips signals={c.signals} />
        <p className="text-xs text-muted-foreground">{t('dedup.pairHint', 'Same import list — exactly one of the pair is kept.')}</p>
      </div>
    );
  }
  return null;
}