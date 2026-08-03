import { useState } from 'react';
import { api } from '../../lib/api';
import { useDebouncedSearch, SearchResult } from '@/hooks/useDebouncedSearch';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';
import { Agency, LEGAL_BASIS_OPTIONS } from './referral-utils';

export function CreateReferralForm({
  agencies,
  onCreated,
  searchFetcher,
}: {
  agencies: Agency[];
  onCreated: () => void;
  searchFetcher?: (q: string) => Promise<SearchResult[]>;
}) {
  const [toAgencyId, setToAgencyId] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [legalBasisCode, setLegalBasisCode] = useState(LEGAL_BASIS_OPTIONS[0]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<{ beneficiaryId: string; label: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { results, loading } = useDebouncedSearch(query, 300, 8, searchFetcher);

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
