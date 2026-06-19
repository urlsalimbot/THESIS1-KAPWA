import { useState, useEffect } from 'react';
import { Shield, ShieldOff, AlertTriangle, X, Check, Loader2, History, Info } from 'lucide-react';
import { revokeConsent, getConsentLedger } from '../../lib/api';

interface ConsentLedgerEntry {
  id: string;
  status: string;
  grantedAt: string;
  revokedAt?: string;
  revokedReason?: string;
  purpose?: string;
}

interface ConsentManagerProps {
  beneficiaryId: string;
  currentConsentStatus: string;
  onConsentChange?: (newStatus: string) => void;
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
        <Check size={14} /> Active
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700">
      <ShieldOff size={14} /> Revoked
    </span>
  );
}

export function ConsentManager({ beneficiaryId, currentConsentStatus, onConsentChange }: ConsentManagerProps) {
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [revokeReason, setRevokeReason] = useState('');
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState(currentConsentStatus);
  const [ledger, setLedger] = useState<ConsentLedgerEntry[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(true);

  useEffect(() => {
    setLoadingLedger(true);
    getConsentLedger(beneficiaryId)
      .then((data: any) => setLedger(Array.isArray(data) ? data : []))
      .catch(() => setLedger([]))
      .finally(() => setLoadingLedger(false));
  }, [beneficiaryId]);

  const handleRevoke = async () => {
    setRevoking(true);
    setError(null);
    try {
      const result = await revokeConsent(beneficiaryId, revokeReason || undefined);
      setStatus('revoked');
      setShowRevokeDialog(false);
      setRevokeReason('');
      onConsentChange?.('revoked');
      // Refresh ledger
      const data = await getConsentLedger(beneficiaryId);
      setLedger(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('Failed to revoke consent. Please try again.');
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Current status */}
      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-3">
          {status === 'active' ? (
            <Shield className="h-8 w-8 text-green-500" />
          ) : (
            <ShieldOff className="h-8 w-8 text-red-500" />
          )}
          <div>
            <p className="text-sm font-medium text-gray-800">Consent Status</p>
            <StatusBadge status={status} />
          </div>
        </div>
        {status === 'active' && (
          <button
            onClick={() => setShowRevokeDialog(true)}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Revoke Consent
          </button>
        )}
        {status !== 'active' && (
          <div className="group relative">
            <button
              disabled
              className="cursor-not-allowed rounded-lg bg-gray-300 px-4 py-2 text-sm font-medium text-gray-500"
            >
              Reinstate Consent
            </button>
            <div className="absolute bottom-full right-0 mb-2 hidden w-48 rounded-lg bg-gray-800 p-2 text-xs text-white shadow-lg group-hover:block">
              <Info size={12} className="mr-1 inline" />
              Contact Admin to reinstate consent
            </div>
          </div>
        )}
      </div>

      {/* Revoke confirmation dialog */}
      {showRevokeDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle size={20} />
                <h3 className="text-lg font-semibold">Revoke Consent</h3>
              </div>
              <button
                onClick={() => setShowRevokeDialog(false)}
                className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <p className="mb-4 text-sm text-gray-600">
              Are you sure you want to revoke consent for this beneficiary? This will immediately
              mask all personal information (name, address, phone, date of birth, PhilSys number)
              in the system.
            </p>

            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Reason for revocation (optional)
              </label>
              <textarea
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="e.g., No longer receiving services, Withdrawn request..."
                className="w-full rounded-lg border border-gray-300 p-3 text-sm outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400"
                rows={3}
              />
            </div>

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowRevokeDialog(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRevoke}
                disabled={revoking}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {revoking && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm Revoke
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Consent history */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center gap-2 text-gray-700">
          <History size={16} />
          <h4 className="text-sm font-semibold">Consent History</h4>
        </div>
        {loadingLedger ? (
          <div className="flex items-center justify-center py-4 text-sm text-gray-400">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading history...
          </div>
        ) : ledger.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400">No consent history available</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs text-gray-500">
                  <th className="pb-2 pr-4 font-medium">Date</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium">Purpose</th>
                  <th className="pb-2 font-medium">Revoked Reason</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((entry) => (
                  <tr key={entry.id} className="border-b border-gray-100">
                    <td className="py-2 pr-4 text-gray-700">
                      {new Date(entry.grantedAt).toLocaleDateString()}
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          entry.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {entry.status}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-gray-600">{entry.purpose || '—'}</td>
                    <td className="py-2 text-gray-600">
                      {entry.revokedReason || (entry.status === 'revoked' ? 'No reason provided' : '—')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
