import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const mockUseAuth = vi.hoisted(() => vi.fn(() => ({
  user: { id: '1', email: 'worker@test.com', fullName: 'Worker', role: 'worker' },
  token: 'mock-token',
  loading: false,
})));
vi.mock('@/lib/auth-context', () => ({
  useAuth: mockUseAuth,
}));

vi.mock('@/lib/pii-utils', () => ({
  MASK_DISPLAY: { name: '********', phone: '***-***-****', address: '*******', dob: '**/**/****', philsys: '****-***-****' },
  maskValue: (_field: string, _value: string) => '********',
  WORKER_ROLES: ['admin', 'worker', 'supervisor'],
}));

import { usePiiMasking } from '@/hooks/usePiiMasking';

describe('usePiiMasking', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('shouldMask is true when consent is revoked', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', email: 'worker@test.com', fullName: 'Worker', role: 'worker' },
      token: 'mock-token',
      loading: false,
    });
    const { result } = renderHook(() => usePiiMasking({ consentStatus: 'revoked' }));
    expect(result.current.shouldMask).toBe(true);
  });

  test('shouldMask is true for non-worker role (mayor)', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', email: 'mayor@test.com', fullName: 'Mayor', role: 'mayor' },
      token: null,
      loading: false,
    });
    const { result } = renderHook(() => usePiiMasking({ consentStatus: 'active' }));
    expect(result.current.shouldMask).toBe(true);
  });

  test('shouldMask is false for worker with active consent', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', email: 'worker@test.com', fullName: 'Worker', role: 'worker' },
      token: 'mock-token',
      loading: false,
    });
    const { result } = renderHook(() => usePiiMasking({ consentStatus: 'active' }));
    expect(result.current.shouldMask).toBe(false);
  });

  test('getDisplayValue returns masked string when shouldMask is true', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', email: 'mayor@test.com', fullName: 'Mayor', role: 'mayor' },
      token: null,
      loading: false,
    });
    const { result } = renderHook(() => usePiiMasking({ consentStatus: 'active' }));
    expect(result.current.getDisplayValue('name', 'Juan Dela Cruz')).toBe('********');
  });

  test('getDisplayValue returns realValue when revealed', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', email: 'worker@test.com', fullName: 'Worker', role: 'worker' },
      token: 'mock-token',
      loading: false,
    });
    const { result } = renderHook(() => usePiiMasking({ consentStatus: 'active' }));
    expect(result.current.getDisplayValue('name', 'Juan Dela Cruz')).toBe('Juan Dela Cruz');
  });

  test('revealField posts audit log and sets auto-mask timer', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', email: 'worker@test.com', fullName: 'Worker', role: 'worker' },
      token: 'mock-token',
      loading: false,
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));
    const { result } = renderHook(() => usePiiMasking({ consentStatus: 'active' }));

    await result.current.revealField('b1', 'name', 'testing');

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/beneficiaries/b1/audit/unmask',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ field: 'name', reason: 'testing' }),
      })
    );
    fetchSpy.mockRestore();
  });
});
