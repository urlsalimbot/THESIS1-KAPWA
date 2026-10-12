import React from 'react';
import { useTranslation } from 'react-i18next';
import { Textarea } from '@/components/ui/textarea';

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
      <label className="mb-1 block text-sm font-medium text-muted-foreground">
        {t('irf.victimNarration', 'Victim Narration')}
        {isEncrypted && <span className="ml-2 text-xs text-success">🔒 {t('irf.aesEncrypted', 'AES-256 Encrypted')}</span>}
      </label>
      <Textarea
        className="w-full rounded border border-border p-2 text-sm"
        value={value}
        onChange={e => onChange?.(e.target.value)}
        disabled={readOnly}
        rows={6}
      />
    </div>
  );
}
