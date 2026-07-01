import { useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import type { MaskableField } from '@/lib/pii-utils';
import { maskValue, WORKER_ROLES } from '@/lib/pii-utils';

type ConsentStatus = 'active' | 'revoked' | 'expired' | 'unknown';

interface UsePiiMaskingOptions {
  consentStatus?: ConsentStatus;
}

export function usePiiMasking({ consentStatus = 'unknown' }: UsePiiMaskingOptions = {}) {
  const { user } = useAuth();
  const autoMaskTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const userRole = user?.role?.toLowerCase() || '';

  const shouldMask =
    consentStatus === 'revoked' ||
    consentStatus === 'expired' ||
    !WORKER_ROLES.includes(userRole);

  const getDisplayValue = useCallback(
    (field: MaskableField, value: string): string => {
      if (shouldMask) return maskValue(field, value);
      return value;
    },
    [shouldMask],
  );

  const revealField = useCallback(
    async (beneficiaryId: string, field: MaskableField, reason: string): Promise<void> => {
      const timerKey = `${beneficiaryId}:${field}`;
      const existing = autoMaskTimers.current.get(timerKey);
      if (existing) clearTimeout(existing);

      await fetch(`/api/beneficiaries/${beneficiaryId}/audit/unmask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field, reason }),
      });

      autoMaskTimers.current.set(
        timerKey,
        setTimeout(() => {
          autoMaskTimers.current.delete(timerKey);
        }, 30_000),
      );
    },
    [],
  );

  return { shouldMask, getDisplayValue, revealField } as const;
}
