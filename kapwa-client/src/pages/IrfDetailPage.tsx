import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getIrfCase, referToPnp, referToWcpd, dismissIrf, closeIrf, decryptNarration } from '../lib/api';
import NameMaskToggle from '../components/irf/NameMaskToggle';
import VictimNarrationField from '../components/irf/VictimNarrationField';

const DISPOSITION_STATES = ['Under Investigation', 'Referred to PNP', 'Referred to WCPD', 'Dismissed', 'Closed'];

export function IrfDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [irf, setIrf] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [decryptedNarration, setDecryptedNarration] = useState<string | null>(null);
  const [legalBasis, setLegalBasis] = useState('');
  const [showDecryptForm, setShowDecryptForm] = useState(false);
  const [unmaskedItemB, setUnmaskedItemB] = useState<any>(null);

  useEffect(() => {
    if (id) load();
  }, [id]);

  async function load() {
    if (!id) return;
    try {
      const data = await getIrfCase(id);
      setIrf(data);
    } catch (e) {
      console.error('Failed to load IRF:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleDisposition(action: () => Promise<any>) {
    try {
      await action();
      await load();
    } catch (e) {
      alert('Transition failed — ensure you have the correct role');
    }
  }

  async function handleDecrypt() {
    if (!id || !legalBasis) return;
    try {
      const result = await decryptNarration(id, legalBasis);
      setDecryptedNarration(result.narration);
      setShowDecryptForm(false);
    } catch (e) {
      alert('Decryption failed — verify legal basis code');
    }
  }

  function handleUnmaskNames(data: any) {
    setUnmaskedItemB(data.itemBPersonReported);
  }

  if (loading) return <div className="p-6 text-gray-400">Loading IRF details...</div>;
  if (!irf) return <div className="p-6 text-red-500">IRF case not found</div>;

  const dispositionIndex = DISPOSITION_STATES.indexOf(irf.caseDisposition);
  const currentState = irf.caseDisposition;

  return (
    <div className="p-6">
      {/* Header with back button */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="text-sm text-gray-600 hover:text-gray-900">← IRF List</button>
        <h1 className="text-2xl font-bold">IRF: {irf.blotterEntryNumber}</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Item A — Reporting Person */}
        <div className="card p-4">
          <h3 className="font-semibold mb-2">Item A — Reporting Person</h3>
          {irf.itemAReportingPerson ? (
            <pre className="text-sm">{JSON.stringify(irf.itemAReportingPerson, null, 2)}</pre>
          ) : <p className="text-sm text-gray-400">No data</p>}
        </div>

        {/* Item B — Person Reported (with NameMaskToggle) */}
        <div className="card p-4">
          <h3 className="font-semibold mb-2">Item B — Person Reported</h3>
          {unmaskedItemB ? (
            <pre className="text-sm">{JSON.stringify(unmaskedItemB, null, 2)}</pre>
          ) : irf.itemBPersonReported ? (
            <div>
              <p className="text-sm text-gray-500">Surname: [REDACTED]</p>
              <p className="text-sm text-gray-500">First Name: [REDACTED]</p>
              <NameMaskToggle
                irfId={id!}
                legalBasis={legalBasis}
                onUnlock={handleUnmaskNames}
              />
            </div>
          ) : <p className="text-sm text-gray-400">No data</p>}
        </div>
      </div>

      {/* Disposition FSM Timeline */}
      <div className="card p-4 mt-6">
        <h3 className="font-semibold mb-4">Case Disposition</h3>
        <div className="flex items-center gap-2 mb-4 overflow-x-auto">
          {DISPOSITION_STATES.map((state, i) => {
            const isPast = i <= dispositionIndex;
            const isCurrent = state === currentState;
            return (
              <div key={state} className="flex items-center">
                <span className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                  isCurrent ? 'bg-blue-100 text-blue-800 ring-2 ring-blue-400'
                  : isPast ? 'bg-green-50 text-green-700'
                  : 'bg-gray-100 text-gray-400'
                }`}>{state}</span>
                {i < DISPOSITION_STATES.length - 1 && (
                  <div className={`w-4 h-0.5 mx-1 ${isPast ? 'bg-green-400' : 'bg-gray-200'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Action buttons based on current state */}
        {currentState === 'Under Investigation' && (
          <div className="flex gap-2">
            <button onClick={() => handleDisposition(() => referToPnp(id!))}
              className="rounded bg-[#2E5C8A] px-4 py-2 text-sm text-white hover:bg-[#1e3d5e]">Refer to PNP</button>
            <button onClick={() => handleDisposition(() => referToWcpd(id!))}
              className="rounded bg-[#2E5C8A] px-4 py-2 text-sm text-white hover:bg-[#1e3d5e]">Refer to WCPD</button>
            <button onClick={() => {
              const reason = prompt('Dismissal reason:');
              if (reason) handleDisposition(() => dismissIrf(id!, reason));
            }} className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Dismiss</button>
          </div>
        )}
        {(currentState === 'Referred to PNP' || currentState === 'Referred to WCPD' || currentState === 'Dismissed') && (
          <button onClick={() => handleDisposition(() => closeIrf(id!))}
            className="rounded bg-[#2E5C8A] px-4 py-2 text-sm text-white hover:bg-[#1e3d5e]">Close Case</button>
        )}
      </div>

      {/* Narration Section */}
      <div className="card p-4 mt-6">
        <h3 className="font-semibold mb-2">Victim Narration</h3>
        {decryptedNarration ? (
          <VictimNarrationField value={decryptedNarration} readOnly isEncrypted={false} />
        ) : irf.encryptedNarration ? (
          <div>
            <p className="text-sm text-green-600 mb-2">🔒 AES-256 Encrypted</p>
            {showDecryptForm ? (
              <div className="flex items-center gap-2">
                <input className="rounded border border-gray-300 p-2 text-sm w-48"
                  placeholder="Legal basis code" value={legalBasis}
                  onChange={e => setLegalBasis(e.target.value)} aria-label="Legal Basis Code" />
                <button onClick={handleDecrypt} disabled={!legalBasis}
                  className="rounded bg-[#2E5C8A] px-4 py-2 text-sm text-white hover:bg-[#1e3d5e] disabled:opacity-40">Decrypt</button>
                <button onClick={() => setShowDecryptForm(false)}
                  className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              </div>
            ) : (
              <button onClick={() => setShowDecryptForm(true)} className="text-sm text-[#2E5C8A] hover:underline">
                Decrypt Narration
              </button>
            )}
          </div>
        ) : <p className="text-sm text-gray-400">No narration recorded</p>}
      </div>

      {/* Metadata */}
      <div className="card p-4 mt-6">
        <h3 className="font-semibold mb-2">Case Info</h3>
        <p className="text-sm">Blotter: {irf.blotterEntryNumber}</p>
        <p className="text-sm">Category: {irf.caseCategory}</p>
        <p className="text-sm">Reported: {irf.datetimeReported ? new Date(irf.datetimeReported).toLocaleDateString() : '—'}</p>
        <p className="text-sm">Incident: {irf.datetimeIncident ? new Date(irf.datetimeIncident).toLocaleDateString() : '—'}</p>
        {irf.dismissalReason && <p className="text-sm">Dismissal Reason: {irf.dismissalReason}</p>}
      </div>
    </div>
  );
}
