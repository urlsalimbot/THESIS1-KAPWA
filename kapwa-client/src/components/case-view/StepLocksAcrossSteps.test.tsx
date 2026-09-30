import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { Toaster } from 'sonner';
import { StepAssessment } from './StepAssessment';
import { StepImplementHIP } from './StepImplementHIP';
import { StepIntegratedDelivery } from './StepIntegratedDelivery';
import { StepTransition } from './StepTransition';
import { StepClosure } from './StepClosure';
import { stepLockKey, type StepLock } from './StepLockBar';
import { formatDate } from '@/lib/format';

const { mockApiGet, mockApiPost } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    put: vi.fn(),
    patch: vi.fn(),
    del: vi.fn(),
  },
  downloadCsrPdf: vi.fn(),
  downloadFilingDoc: vi.fn(),
  filingDocIdFromUrl: () => null,
  downloadEndorsementLetter: vi.fn(),
  downloadEndorsementLetterById: vi.fn(),
  uploadWithProgress: vi.fn(),
}));

const AT = '2026-10-01T09:00:00Z';
const SIGNATURE = 'data:image/png;base64,iVBORw0KGgo=';

/** Every step's own data, so all five bars are offered a seal. */
function completeCaseData(over: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    status: 'transitioning',
    problemsPresented: 'Poverty',
    clientCategory: 'Indigent',
    socialWorkerAssessment: 'Needs financial aid',
    frvaScore: 65,
    referrals: [{ agencyName: 'RHU', status: 'referred' }],
    selfRelianceLevel: 3,
    sustainabilityPlan: 'sari-sari store',
    clientSignature: SIGNATURE,
    closureOutcome: 'graduated',
    ...over,
  };
}

/**
 * The case view's five steps, built the way it builds them: one array, each
 * mount keyed by its case and step index, each handed its own seal row. Kept
 * here rather than asserted only through the page so the mounting itself is
 * under test — a bar that was handed the wrong `stepIndex`, `caseId` or
 * `locked` row would still render one plausible strip.
 */
function Steps({
  caseId,
  caseData,
  stepLocks = [],
  requirementsMet = true,
}: {
  caseId: string;
  caseData: any;
  stepLocks?: StepLock[];
  requirementsMet?: boolean;
}) {
  const lockFor = (i: number) => stepLocks.find((l) => l.stepIndex === i) ?? null;
  return (
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0, provider: () => new Map() }}>
      <Toaster />
      <StepAssessment
        key={stepLockKey(caseId, 0)}
        caseId={caseId}
        caseData={caseData}
        assessment={{ problemsPresented: '', socialWorkerAssessment: '', clientCategory: '', frvaScore: null, swdiScore: null }}
        onAssessmentChange={() => {}}
        onSave={() => {}}
        saving={false}
        userRole="social_worker"
        stepLock={lockFor(0)}
      />
      <StepImplementHIP
        key={stepLockKey(caseId, 1)}
        caseId={caseId}
        caseData={caseData}
        userRole="social_worker"
        requirementsMet={requirementsMet}
        stepLock={lockFor(1)}
      />
      <StepIntegratedDelivery
        key={stepLockKey(caseId, 2)}
        caseId={caseId}
        caseData={caseData}
        userRole="social_worker"
        stepLock={lockFor(2)}
      />
      <StepTransition key={stepLockKey(caseId, 3)} caseId={caseId} caseData={caseData} userRole="admin" stepLock={lockFor(3)} />
      <StepClosure key={stepLockKey(caseId, 4)} caseId={caseId} caseData={caseData} stepLock={lockFor(4)} />
    </SWRConfig>
  );
}

const LOCKERS = ['Ana Cruz', 'Ben Dela Cruz', 'Cara Lim', 'Dan Ortiz', 'Elena Reyes'];
const stepLocks: StepLock[] = LOCKERS.map((lockedByName, stepIndex) => ({ stepIndex, lockedByName, lockedAt: AT }));

describe('the five step seals', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockApiGet.mockImplementation(async (key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('interventions')) {
        return [{ id: 'iv-1', caseId: 'c1', programId: 'p1', serviceName: 'Medical Assistance', amount: 5000 }];
      }
      if (k.includes('programs')) {
        return [{ id: 'p1', name: 'Medical Assistance', requiredDocuments: ['Valid ID'] }];
      }
      return [];
    });
    // The POST answers with the row it wrote, so each bar's own outcome is
    // rendered from the response rather than from a shared fixture.
    mockApiPost.mockImplementation((path: string) => {
      const stepIndex = Number(/\/steps\/(\d+)\/lock/.exec(path)?.[1]);
      return Promise.resolve({ stepIndex, lockedByName: 'Seal Writer', lockedAt: AT });
    });
  });

  it('gives every step a seal, and each one names its own locker', () => {
    render(<Steps caseId="c1" caseData={completeCaseData()} stepLocks={stepLocks} />);

    // All five strips, and one strip per locker: the shape that catches a bar
    // handed a sibling's row, or two bars sharing one instance.
    LOCKERS.forEach((name) => {
      expect(screen.getByText(`Locked by ${name} · ${formatDate(AT)}`)).toBeTruthy();
    });
    expect(screen.getAllByText(/^Locked by /)).toHaveLength(5);
  });

  it('writes each seal to its own step of its own case', async () => {
    render(<Steps caseId="c1" caseData={completeCaseData()} />);

    // Step 2's seal weighs the interventions this step fetches, so the list has
    // to have arrived before "every bar is enabled" means anything.
    expect(await screen.findByRole('heading', { name: 'Medical Assistance' })).toBeTruthy();

    // Five bars, each enabled because its step is done — and each reachable.
    const locks = screen.getAllByRole('button', { name: /^lock$/i });
    expect(locks).toHaveLength(5);
    for (const lock of locks) expect(lock).toBeEnabled();

    for (let i = 0; i < 5; i += 1) fireEvent.click(locks[i]);

    // One write per bar, to the step that bar was mounted for. A bar reused
    // across steps, or handed another step's index, lands on the wrong path.
    await waitFor(() => expect(mockApiPost).toHaveBeenCalledTimes(5));
    for (let i = 0; i < 5; i += 1) {
      expect(mockApiPost).toHaveBeenCalledWith(`/cases/c1/steps/${i}/lock`);
    }
  });

  it('drops a bar\'s record of its own write when the case changes, because the key names the case', async () => {
    // `StepLockBar` keeps the outcome of its own write in local state that
    // carries neither a step index nor a case id, so a mount reused across two
    // cases renders the previous case's seal. The key is the only thing that
    // prevents it — so this fails if the case drops out of `stepLockKey`.
    const { rerender } = render(<Steps caseId="case-a" caseData={completeCaseData({ id: 'case-a' })} />);

    fireEvent.click(screen.getAllByRole('button', { name: /^lock$/i })[0]);
    expect(await screen.findByText(`Locked by Seal Writer · ${formatDate(AT)}`)).toBeTruthy();

    // Same steps, next case: nothing is sealed there.
    rerender(<Steps caseId="case-b" caseData={completeCaseData({ id: 'case-b' })} />);

    await waitFor(() => expect(screen.queryByText(/^Locked by /)).toBeNull());
    expect(screen.getAllByRole('button', { name: /^lock$/i })).toHaveLength(5);
  });
});
