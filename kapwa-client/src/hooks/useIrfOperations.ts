import { useState } from 'react';
import { api, exportIrfPdf } from '../lib/api';
import { toast } from 'sonner';

function composeLegalBasis(basis: string, ref: string): string {
  return basis + (ref ? ` — Ref: ${ref}` : '');
}

export function useIrfOperations(id: string | undefined) {
  const [decryptedNarration, setDecryptedNarration] = useState<string | null>(null);
  const [legalBasis, setLegalBasis] = useState('');
  const [legalBasisRef, setLegalBasisRef] = useState('');
  const [showDecryptForm, setShowDecryptForm] = useState(false);
  const [namesRedacted, setNamesRedacted] = useState(false);
  const [unmaskedData, setUnmaskedData] = useState<{ itemA?: any; itemB?: any } | null>(null);
  const [exportLegalBasis, setExportLegalBasis] = useState('');
  const [exportLegalBasisRef, setExportLegalBasisRef] = useState('');
  const [exportPassword, setExportPassword] = useState('');

  async function handleDecrypt() {
    const basis = composeLegalBasis(legalBasis, legalBasisRef);
    if (!id || !legalBasis) return;
    try {
      const result = await api.post<{ narration: string }>(`/irf/${id}/decrypt`, { legalBasis: basis });
      setDecryptedNarration(result.narration);
      setShowDecryptForm(false);
    } catch { toast.error('Decryption failed — verify legal basis'); }
  }

  async function handleUnmaskNames() {
    if (!id || !legalBasis) return;
    const basis = composeLegalBasis(legalBasis, legalBasisRef);
    try {
      const data = await api.get<{ itemAPersonReported?: any; itemBPersonReported?: any }>(`/irf/${id}/unmask-names?legalBasis=${encodeURIComponent(basis)}`);
      setUnmaskedData({ itemA: data.itemAPersonReported, itemB: data.itemBPersonReported });
    } catch { toast.error('Unlock failed — verify legal basis'); }
  }

  async function handleExportPdf() {
    const basis = composeLegalBasis(exportLegalBasis, exportLegalBasisRef);
    if (!id || !exportLegalBasis) return;
    try {
      await exportIrfPdf(id, basis, exportPassword || 'default');
    } catch { toast.error('PDF export failed'); }
  }

  async function handleExportJson() {
    const basis = composeLegalBasis(exportLegalBasis, exportLegalBasisRef);
    if (!id || !exportLegalBasis) return;
    try {
      const data = await api.get<any>(`/irf/${id}/export-json?legalBasis=${encodeURIComponent(basis)}`);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = `IRF-${id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('JSON export failed'); }
  }

  async function handleDisposition(action: () => Promise<any>, reload: () => void) {
    try {
      await action();
      reload();
    } catch { toast.error('Transition failed — ensure you have the correct role'); }
  }

  function checkRedacted(obj: any) {
    if (!obj || typeof obj !== 'object') return false;
    return Object.values(obj).some(v => String(v ?? '') === '[REDACTED]');
  }

  return {
    decryptedNarration, setDecryptedNarration,
    legalBasis, setLegalBasis, legalBasisRef, setLegalBasisRef,
    showDecryptForm, setShowDecryptForm,
    namesRedacted, setNamesRedacted,
    unmaskedData, setUnmaskedData,
    exportLegalBasis, setExportLegalBasis, exportLegalBasisRef, setExportLegalBasisRef,
    exportPassword, setExportPassword,
    handleDecrypt, handleUnmaskNames, handleExportPdf, handleExportJson,
    handleDisposition, checkRedacted,
  };
}
