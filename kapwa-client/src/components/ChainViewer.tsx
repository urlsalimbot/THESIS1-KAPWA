import { useState, useEffect } from 'react';
import { Shield, CheckCircle, XCircle } from 'lucide-react';
import { api } from '../lib/api';

interface ChainEntry {
  id: string;
  hash: string;
  prevHash: string;
  loggedAt: string;
  interventionType: string;
  amount: number;
}

export function ChainViewer({ caseId }: { caseId: string }) {
  const [chain, setChain] = useState<ChainEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadChain();
  }, [caseId]);

  async function loadChain() {
    try {
      const data = await api.get<ChainEntry[]>(`/interventions/chain/${caseId}`);
      setChain(data as ChainEntry[]);
    } catch {
      setError('Failed to load hash chain');
    }
    setLoading(false);
  }

  function verifyIntegrity(): boolean {
    for (let i = 0; i < chain.length; i++) {
      if (i === 0 && chain[i].prevHash !== 'GENESIS') return false;
      if (i > 0 && chain[i].prevHash !== chain[i - 1].hash) return false;
    }
    return true;
  }

  if (loading) return <div className="p-4 text-center text-sm">Loading chain...</div>;
  if (error) return <div className="p-4 text-red-600 text-sm">{error}</div>;
  if (chain.length === 0) return <div className="p-4 text-gray-500 text-sm">No interventions recorded</div>;

  const isValid = verifyIntegrity();

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Shield size={16} className={isValid ? 'text-green-600' : 'text-red-600'} />
        <span className="font-semibold text-sm">Intervention Hash Chain</span>
        {isValid
          ? <CheckCircle size={16} className="text-green-600" />
          : <XCircle size={16} className="text-red-600" />
        }
        <span className={`text-xs ${isValid ? 'text-green-600' : 'text-red-600'}`}>
          {isValid ? 'Chain Integrity Verified' : 'Chain Integrity Failed'}
        </span>
      </div>
      <div className="space-y-2 text-xs font-mono">
        {chain.map((entry, idx) => (
          <div key={entry.id} className="border-l-2 border-gray-300 pl-3 py-1">
            <div className="text-gray-500">#{idx + 1} - {entry.interventionType} (₱{entry.amount})</div>
            <div className="text-gray-400">Hash: <span className="text-gray-700">{entry.hash.slice(0, 20)}...</span></div>
            <div className="text-gray-400">Prev: <span className="text-gray-700">{entry.prevHash.slice(0, 20)}...</span></div>
            <div className="text-gray-400">{new Date(entry.loggedAt).toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
