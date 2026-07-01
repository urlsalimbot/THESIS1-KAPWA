import { useState, useEffect, useCallback } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePiiMasking } from '@/hooks/usePiiMasking';
import type { MaskableField } from '@/lib/pii-utils';
import { maskValue } from '@/lib/pii-utils';

interface MaskedFieldProps {
  label: string;
  value: string;
  type: MaskableField;
  consentStatus?: 'active' | 'revoked' | 'expired' | 'unknown';
  beneficiaryId: string;
}

export function MaskedField({
  label,
  value,
  type,
  consentStatus = 'unknown',
  beneficiaryId,
}: MaskedFieldProps) {
  const { shouldMask, getDisplayValue, revealField } = usePiiMasking({ consentStatus });
  const [revealed, setRevealed] = useState(false);
  const [revealing, setRevealing] = useState(false);

  useEffect(() => {
    if (!revealed) return;
    const timer = setTimeout(() => setRevealed(false), 30_000);
    return () => clearTimeout(timer);
  }, [revealed]);

  const handleReveal = useCallback(async () => {
    if (revealed) {
      setRevealed(false);
      return;
    }
    const reason = window.prompt(`Reason for viewing ${label}:`);
    if (!reason || !reason.trim()) return;
    setRevealing(true);
    try {
      await revealField(beneficiaryId, type, reason.trim());
      setRevealed(true);
    } catch {
      // Silently handle — audit log best-effort
    } finally {
      setRevealing(false);
    }
  }, [revealed, label, beneficiaryId, type, revealField]);

  const displayValue = !shouldMask && revealed ? value : getDisplayValue(type, value);
  const isCurrentlyMasked = !(!shouldMask && revealed);

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-muted-foreground">{label}:</span>
      <span
        className="text-sm font-mono tabular-nums"
        aria-label={`${label}: ${isCurrentlyMasked ? 'masked' : value}`}
        aria-hidden={isCurrentlyMasked ? true : undefined}
      >
        {displayValue === maskValue(type, value) ? maskValue(type, value) : displayValue}
      </span>
      {shouldMask && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleReveal}
          disabled={revealing}
          aria-label={revealed ? `Hide ${label}` : `Reveal ${label}`}
        >
          {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </Button>
      )}
    </div>
  );
}
