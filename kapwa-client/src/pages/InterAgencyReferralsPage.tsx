import { useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { api } from '../lib/api';
import { queryKeys } from '../lib/query-keys';
import { useAuth } from '../lib/auth-context';
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch';
import { PageShell } from '@/components/PageShell';
import { CardGridSkeleton } from '@/components/skeletons/CardGridSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/EmptyState';
import { Send } from 'lucide-react';

export interface Agency {
  id: string;
  code: string;
  name: string;
  type?: string;
}

export type ReferralStatus = 'referred' | 'received' | 'actioned' | 'closed' | 'declined';

export interface InterAgencyReferral {
  id: string;
  personId: string;
  caseId?: string;
  fromAgencyId: string;
  toAgencyId: string;
  status: ReferralStatus;
  reason: string;
  notes?: string;
  legalBasisCode: string;
  outcome?: string;
  declinedReason?: string;
  fromAgency?: Agency;
  toAgency?: Agency;
  person?: { id: string; surname: string; firstName: string };
  createdAt: string;
}

const STATUS_LABELS: Record<ReferralStatus, string> = {
  referred: 'Referred',
  received: 'Received',
  actioned: 'Actioned',
  closed: 'Closed',
  declined: 'Declined',
};

const LEGAL_BASIS_OPTIONS = ['public_authority_sec13', 'consent_verified', 'emergency_situation'];

function StatusTimeline({ status }: { status: ReferralStatus }) {
  const steps: ReferralStatus[] = ['referred', 'received', 'actioned', 'closed'];
  const activeIndex = status === 'declined' ? -1 : steps.indexOf(status);
  return (
    <div className="flex items-center gap-1" aria-label="status-timeline">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-1">
          <span
            className={`h-2 w-2 rounded-full ${i <= activeIndex ? 'bg-primary' : 'bg-muted'}`}
          />
          {i < steps.length - 1 && (
            <span className={`h-px w-4 ${i < activeIndex ? 'bg-primary' : 'bg-muted'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function ReferralCard({
  referral,
  myAgencyId,
  onTransition,
  disabled,
}: {
  referral: InterAgencyReferral;
  myAgencyId?: string;
  onTransition: (id: string, action: string, body?: Record<string, string>) => Promise<void>;
  disabled?: boolean;
}) {
  const [outcome, setOutcome] = useState('');
  const isReceiver = referral.toAgencyId === myAgencyId;
  const canReceive = isReceiver && referral.status === 'referred';
  const canAction = isReceiver && referral.status === 'received';
  const canClose = isReceiver && referral.status === 'actioned';
  const canDecline = isReceiver && referral.status === 'referred';
  const personName = referral.person
    ? `${referral.person.firstName} ${referral.person.surname}`.trim()
    : 'Person';

  return (
    <div className="rounded-lg bg-card p-4 shadow-sm border border-border space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold truncate">{personName}</p>
          <p className="text-xs text-muted-foreground truncate">
            {referral.fromAgency?.name || referral.fromAgencyId} →{' '}
            {referral.toAgency?.name || referral.toAgencyId}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {referral.status !== 'declined' && <StatusTimeline status={referral.status} />}
          <Badge variant={referral.status === 'declined' ? 'destructive' : 'default'}>
            {STATUS_LABELS[referral.status]}
          </Badge>
        </div>
      </div>
      <p className="text-sm">{referral.reason}</p>
      <p className="text-xs text-muted-foreground">
        Basis: {referral.legalBasisCode} · {new Date(referral.createdAt).toLocaleDateString()}
      </p>
      {referral.notes && <p className="text-xs text-muted-foreground">Notes: {referral.notes}</p>}
      {referral.outcome && <p className="text-xs text-muted-foreground">Outcome: {referral.outcome}</p>}
      {referral.declinedReason && (
        <p className="text-xs text-destructive">Declined: {referral.declinedReason}</p>
      )}
      {canReceive && (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => onTransition(referral.id, 'receive')} disabled={disabled}>
            Receive
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() =>
              onTransition(referral.id, 'decline', {
                declinedReason: 'Unable to accommodate',
              })
            }
            disabled={disabled}
          >
            Decline
          </Button>
        </div>
      )}
      {canAction && (
        <Button size="sm" onClick={() => onTransition(referral.id, 'action')} disabled={disabled}>
          Mark Actioned
        </Button>
      )}
      {canClose && (
        <div className="flex gap-2 items-end">
          <input
            value={outcome}
            onChange={e => setOutcome(e.target.value)}
            placeholder="Outcome"
            className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          />
          <Button
            size="sm"
            onClick={() => onTransition(referral.id, 'close', { outcome })}
            disabled={disabled || !outcome.trim()}
          >
            Close
          </Button>
        </div>
      )}
    </div>
  );
}

function CreateReferralForm({
  agencies,
  onCreated,
}: {
  agencies: Agency[];
  onCreated: () => void;
}) {
  const [toAgencyId, setToAgencyId] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [legalBasisCode, setLegalBasisCode] = useState(LEGAL_BASIS_OPTIONS[0]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<{ beneficiaryId: string; label: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { results, loading } = useDebouncedSearch(query, 300, 8);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !toAgencyId || !reason.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await api.post('/inter-agency-referrals', {
        beneficiaryId: selected.beneficiaryId,
        toAgencyId,
        reason,
        notes: notes || undefined,
        legalBasisCode,
      });
      setSelected(null);
      setQuery('');
      setReason('');
      setNotes('');
      setToAgencyId('');
      onCreated();
    } catch (err: any) {
      setError(err?.message || 'Failed to create referral');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg bg-card p-4 shadow-sm border border-border space-y-3"
    >
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Send size={16} className="text-primary" /> Create Referral
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium" htmlFor="iar-to-agency">
            To Agency *
          </label>
          <select
            id="iar-to-agency"
            value={toAgencyId}
            onChange={e => setToAgencyId(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            required
          >
            <option value="">Select agency...</option>
            {agencies.map(a => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium" htmlFor="iar-legal-basis">
            Legal Basis *
          </label>
          <select
            id="iar-legal-basis"
            value={legalBasisCode}
            onChange={e => setLegalBasisCode(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          >
            {LEGAL_BASIS_OPTIONS.map(o => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium">Beneficiary *</label>
        {selected ? (
          <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
            <span>{selected.label}</span>
            <button type="button" onClick={() => setSelected(null)} className="text-xs text-muted-foreground">
              Clear
            </button>
          </div>
        ) : (
          <>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search beneficiary by name..."
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            />
            {loading && <p className="text-xs text-muted-foreground">Searching...</p>}
            {results.length > 0 && (
              <ul className="rounded-md border divide-y max-h-40 overflow-y-auto">
                {results.map(r => (
                  <li key={r.id}>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                      onClick={() => {
                        setSelected({ beneficiaryId: r.id, label: r.fullName });
                        setQuery('');
                      }}
                    >
                      {r.fullName} <span className="text-xs text-muted-foreground">{r.barangay}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium" htmlFor="iar-reason">
          Reason *
        </label>
        <textarea
          id="iar-reason"
          value={reason}
          onChange={e => setReason(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          rows={2}
          required
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium" htmlFor="iar-notes">
          Notes
        </label>
        <textarea
          id="iar-notes"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          rows={2}
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button
        type="submit"
        size="sm"
        disabled={submitting || !selected || !toAgencyId || !reason.trim()}
      >
        {submitting ? 'Saving...' : 'Create Referral'}
      </Button>
    </form>
  );
}

export function InterAgencyReferralsPage() {
  const { user } = useAuth();
  const { mutate } = useSWRConfig();
  const [filter, setFilter] = useState<'all' | 'received' | 'sent'>('all');
  const [transitioning, setTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState('');

  const { data: referrals, isLoading } = useSWR<InterAgencyReferral[]>(
    queryKeys.interAgencyReferrals.inbox(),
  );
  const { data: agencies } = useSWR<Agency[]>(queryKeys.agencies.list());

  const myAgencyId = user?.agencyId;

  const visible = (referrals || []).filter(r => {
    if (filter === 'all') return true;
    if (filter === 'received') return r.toAgencyId === myAgencyId;
    return r.fromAgencyId === myAgencyId;
  });

  async function transition(id: string, action: string, body?: Record<string, string>) {
    setTransitioning(true);
    setTransitionError('');
    try {
      await api.patch(`/inter-agency-referrals/${id}/${action}`, body);
      await mutate(queryKeys.interAgencyReferrals.inbox());
    } catch (err: any) {
      setTransitionError(err?.message || 'Failed to update referral');
    } finally {
      setTransitioning(false);
    }
  }

  if (isLoading) {
    return (
      <PageShell title="Inter-Agency Referrals" description="Track referrals between agencies">
        <CardGridSkeleton />
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Inter-Agency Referrals"
      description="Track referrals between agencies"
    >
      <CreateReferralForm
        agencies={agencies || []}
        onCreated={() => mutate(queryKeys.interAgencyReferrals.inbox())}
      />

      <div className="mt-4 mb-2 flex gap-1">
        {(['all', 'received', 'sent'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            {f === 'all' ? 'All' : f === 'received' ? 'Received' : 'Sent'}
          </button>
        ))}
      </div>

      {transitionError && <p className="text-xs text-destructive mb-2">{transitionError}</p>}

      {visible.length === 0 ? (
        <EmptyState variant="no-data" />
      ) : (
        <div className="space-y-3">
          {visible.map(r => (
            <ReferralCard key={r.id} referral={r} myAgencyId={myAgencyId} onTransition={transition} disabled={transitioning} />
          ))}
        </div>
      )}
    </PageShell>
  );
}
