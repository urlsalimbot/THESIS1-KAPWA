import { useState } from 'react';
import useSWR from 'swr';
import { History } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export type RemarkKind = 'import' | 'decision' | 'barangay_update' | 'manual';

export interface BeneficiaryRemark {
  id: string;
  kind: RemarkKind;
  remark: string;
  source?: string | null;
  authoredBy?: string | null;
  authorName?: string | null;
  createdAt: string;
}

interface RemarksResponse {
  data: BeneficiaryRemark[];
  total: number;
  page: number;
  limit: number;
}

const KIND_LABELS: Record<RemarkKind, string> = {
  import: 'Import',
  decision: 'Decision',
  barangay_update: 'Barangay update',
  manual: 'Remark',
};

const KIND_CLASSES: Record<RemarkKind, string> = {
  import: 'border-sky-200 bg-sky-50 text-sky-700',
  decision: 'border-amber-200 bg-amber-50 text-amber-800',
  barangay_update: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  manual: 'border-slate-200 bg-slate-100 text-slate-700',
};

const EMPTY: RemarksResponse = { data: [], total: 0, page: 1, limit: 50 };

/**
 * The beneficiary's remark history: import provenance, deduplication
 * decisions, barangay updates, and staff notes — newest first.
 */
export function RemarksHistoryCard({ beneficiaryId }: { beneficiaryId: string }) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const { data, isLoading, mutate } = useSWR<RemarksResponse>(
    ['beneficiaries', beneficiaryId, 'remarks'] as const,
    () => api.get<RemarksResponse>(`/beneficiaries/${beneficiaryId}/remarks?page=1&limit=50`),
  );
  const remarks = data?.data ?? [];

  async function addRemark() {
    const remark = draft.trim();
    if (!remark || busy) return;
    setBusy(true);
    try {
      const created = await api.post<BeneficiaryRemark>(`/beneficiaries/${beneficiaryId}/remarks`, {
        remark,
      });
      setDraft('');
      await mutate(
        { ...(data ?? EMPTY), data: [created, ...remarks] },
        { revalidate: false },
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add the remark');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg bg-card p-4 shadow-sm border border-border">
      <div className="flex items-center gap-2 text-primary mb-3">
        <History size={16} />
        <h3 className="text-xs font-semibold uppercase tracking-wider">Remarks History</h3>
      </div>
      <div className="space-y-3">
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            placeholder="Add a remark…"
            aria-label="New remark"
          />
          <Button size="sm" onClick={addRemark} disabled={draft.trim() === '' || busy}>
            {busy ? 'Saving…' : 'Add remark'}
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading remarks…</p>
        ) : remarks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No remarks yet.</p>
        ) : (
          <ul className="space-y-2 max-h-72 overflow-y-auto">
            {remarks.map((r) => (
              <li key={r.id} className="rounded border border-border p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline" className={KIND_CLASSES[r.kind]}>
                    {KIND_LABELS[r.kind]}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDateTime(r.createdAt)}
                  </span>
                </div>
                <p className="mt-1.5 text-sm">{r.remark}</p>
                <p className="text-xs text-muted-foreground">
                  {r.source ? `${r.source} · ` : ''}
                  {r.authorName ?? 'System'}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
