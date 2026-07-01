import { describe, test, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { SkipToContent } from '@/components/a11y/SkipToContent';
import { AriaLiveRegion } from '@/components/a11y/AriaLiveRegion';
import { PageShell } from '@/components/PageShell';
import { EmptyState } from '@/components/EmptyState';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { BulkActionBar } from '@/components/bulk-actions/BulkActionBar';
import { MaskedField } from '@/components/pii/MaskedField';
import { SlaTimer } from '@/components/sla/SlaTimer';

const mockUseCacheStaleness = vi.hoisted(() => () => ({
  isStale: false,
  ageDisplay: '',
}));
vi.mock('@/hooks/use-cache-staleness', () => ({
  useCacheStaleness: mockUseCacheStaleness,
}));

const mockUseAuth = vi.hoisted(() => () => ({
  user: { id: '1', email: 'mayor@test.com', fullName: 'Mayor', role: 'mayor' },
  token: null,
  loading: false,
}));
vi.mock('@/lib/auth-context', () => ({
  useAuth: mockUseAuth,
}));

const mockMaskValue = vi.hoisted(() => (_field: string, _value: string) => '********');
vi.mock('@/lib/pii-utils', () => ({
  MASK_DISPLAY: { name: '********', phone: '***-***-****', address: '*******', dob: '**/**/****', philsys: '****-***-****' },
  maskValue: mockMaskValue,
  WORKER_ROLES: ['admin', 'worker', 'supervisor'],
}));

const mockUsePiiMasking = vi.hoisted(() => () => ({
  shouldMask: true,
  getDisplayValue: () => '********',
  revealField: async () => {},
}));
vi.mock('@/hooks/usePiiMasking', () => ({
  usePiiMasking: mockUsePiiMasking,
}));

const mockUseSlaTimer = vi.hoisted(() => () => ({
  elapsedDisplay: '5h',
  status: 'compliant' as const,
  fractionUsed: 0.5,
}));
vi.mock('@/hooks/useSlaTimer', () => ({
  useSlaTimer: mockUseSlaTimer,
}));

vi.mock('@/lib/sla-utils', () => ({
  getThresholdColor: (s: string) => s === 'compliant' ? 'text-green-500' : 'text-amber-500',
  getThresholdBgColor: (s: string) => s === 'compliant' ? 'bg-green-500/10' : 'bg-amber-500/10',
}));

function ThrowingChild() {
  throw new Error('Test error');
}

describe('a11y component tests', () => {
  test('SkipToContent has no a11y violations', async () => {
    const { container } = render(<SkipToContent />);
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });

  test('AriaLiveRegion has no a11y violations', async () => {
    const { container } = render(<AriaLiveRegion message="Test message" />);
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });

  test('PageShell has no a11y violations', async () => {
    const { container } = render(
      <MemoryRouter>
        <PageShell title="Test Page" description="Test description">
          <p>Content</p>
        </PageShell>
      </MemoryRouter>
    );
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });

  test('EmptyState no-data variant has no a11y violations', async () => {
    const { container } = render(
      <MemoryRouter>
        <EmptyState variant="no-data" />
      </MemoryRouter>
    );
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });

  test('ErrorBoundary error state has no a11y violations', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = render(
      <MemoryRouter>
        <ErrorBoundary>
          <ThrowingChild />
        </ErrorBoundary>
      </MemoryRouter>
    );
    spy.mockRestore();
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });

  test('MaskedField has no a11y violations', async () => {
    const { container } = render(
      <MaskedField
        label="Name"
        value="Juan Dela Cruz"
        type="name"
        consentStatus="active"
        beneficiaryId="b1"
      />
    );
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });

  test('SlaTimer has no a11y violations', async () => {
    const { container } = render(
      <SlaTimer
        stageStartedAt="2026-07-01T10:00:00Z"
        slaHours={24}
      />
    );
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });

  test('BulkActionBar has no a11y violations', async () => {
    const { container } = render(
      <BulkActionBar
        selectedCount={2}
        selectedIds={['1', '2']}
        onApprove={() => {}}
        onReassign={() => {}}
        onExport={() => {}}
        onClearSelection={() => {}}
      />
    );
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });

  test('BulkActionBar hidden when count is 0', () => {
    const { container } = render(
      <BulkActionBar
        selectedCount={0}
        selectedIds={[]}
        onApprove={() => {}}
        onReassign={() => {}}
        onExport={() => {}}
        onClearSelection={() => {}}
      />
    );
    expect(container.innerHTML).toBe('');
  });
});
