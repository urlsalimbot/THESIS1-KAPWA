import React, { useState } from 'react';
import { api } from '../../lib/api';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { humanizeError } from '../../lib/errors';

interface NameMaskToggleProps {
  irfId: string;
  legalBasis: string;
  onUnlock: (data: any) => void;
}

export default function NameMaskToggle({ irfId, legalBasis: initialLegalBasis, onUnlock }: NameMaskToggleProps) {
  const { t } = useTranslation();
  const [unlocked, setUnlocked] = useState(false);
  const [legalBasis, setLegalBasis] = useState(initialLegalBasis || '');
  const [loading, setLoading] = useState(false);

  async function handleUnlock() {
    if (!legalBasis) {
      toast.error(t('irf.legalBasisRequired', 'Legal basis required'), {
        description: t('irf.legalBasisRequiredDesc', 'Enter the legal basis and reference before unlocking names.'),
      });
      return;
    }
    setLoading(true);
    try {
      const data = await api.get(`/irf/${irfId}/unmask-names?legalBasis=${encodeURIComponent(legalBasis)}`);
      setUnlocked(true);
      onUnlock(data);
    } catch (e) {
      toast.error(t('irf.unlockFailed', 'Could not unlock names'), { description: t('irf.verifyLegalBasis', 'Check the legal basis and reference, then try again.') });
    }
    setLoading(false);
  }

  if (unlocked) return null; // parent handles display after unlock

  return (
    <div className="flex items-center gap-2 mt-2">
      <input className="rounded border border-gray-300 p-2 text-sm w-48"
        placeholder={t('irf.legalBasisPlaceholder', 'Legal basis code')}
        value={legalBasis}
        onChange={e => setLegalBasis(e.target.value)}
        aria-label={t('irf.legalBasisPlaceholder', 'Legal basis code')} />
      <button onClick={handleUnlock} disabled={!legalBasis || loading}
        className="text-xs text-primary hover:underline">
        {loading ? t('irf.unlocking', 'Unlocking...') : t('irf.unlockNames', 'Unlock Names')}
      </button>
    </div>
  );
}
