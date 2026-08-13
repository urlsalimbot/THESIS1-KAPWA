import React from 'react';
import { useTranslation } from 'react-i18next';

interface VictimNarrationFieldProps {
  value: string;
  onChange?: (val: string) => void;
  readOnly?: boolean;
  isEncrypted?: boolean;
}

export default function VictimNarrationField({ value, onChange, readOnly, isEncrypted }: VictimNarrationFieldProps) {
  const { t } = useTranslation();
  return (
    <div className="mb-4">
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {t('irf.victimNarration', 'Victim Narration')}
        {isEncrypted && <span className="ml-2 text-xs text-green-600">🔒 {t('irf.aesEncrypted', 'AES-256 Encrypted')}</span>}
      </label>
      <textarea
        className="w-full rounded border border-gray-300 p-2 text-sm"
        value={value}
        onChange={e => onChange?.(e.target.value)}
        disabled={readOnly}
        rows={6}
      />
    </div>
  );
}
