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
    // Step 2's bar weighs this checklist against the program its delivery names
    // (the bar derives it in-step), so a satisfied one is what makes that step
    // sealable here.
    requirementsChecklist: { 'Valid ID': true },
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
  opts = {},
}: {
  caseId: string;
  caseData: any;
  stepLocks?: StepLock[];
  /** Per-step `lockReadOnly`, as the case view computes it. */
  opts?: { lockReadOnly?: (step: number) => boolean };
}) {
  const lockFor = (i: number) => stepLocks.find((l) => l.stepIndex === i) ?? null;
  // The case view's two-flag wiring, reproduced here: a sealed step's own fields
  // go read-only, while `lockReadOnly` — which decides whether the seal is
  // offered at all — does not follow the seal. Without this the components would
  // each default both flags to their own `readOnly` (false), and a sealed step
  // would render its full editing UI, which is the defect under test rather than
  // the thing this file is about.
  //
  // `lockReadOnly` is a **parameter**, not the `false` this harness used to
  // hardcode. A constant cannot express "the page also withholds the Unlock here",
  // which is exactly the wiring that shipped a lockout on step 5 — the page-level
  // test in `CaseViewPage.test.tsx` catches it at the source, and the invariant
  // test below catches it in these components for *every* step, so neither file
  // has to know which step it was.
  const bodyReadOnly = (i: number) => lockFor(i) != null;
  const lockReadOnly = (i: number) => opts.lockReadOnly?.(i) ?? false;
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
        readOnly={bodyReadOnly(0)}
        lockReadOnly={lockReadOnly(0)}
        stepLock={lockFor(0)}
      />
      <StepImplementHIP
        key={stepLockKey(caseId, 1)}
        caseId={caseId}
        caseData={caseData}
        userRole="social_worker"
        readOnly={bodyReadOnly(1)}
        lockReadOnly={lockReadOnly(1)}
        stepLock={lockFor(1)}
      />
      <StepIntegratedDelivery
        key={stepLockKey(caseId, 2)}
        caseId={caseId}
        caseData={caseData}
        userRole="social_worker"
        readOnly={bodyReadOnly(2)}
        lockReadOnly={lockReadOnly(2)}
        stepLock={lockFor(2)}
      />
      <StepTransition key={stepLockKey(caseId, 3)} caseId={caseId} caseData={caseData} userRole="admin" readOnly={bodyReadOnly(3)} lockReadOnly={lockReadOnly(3)} stepLock={lockFor(3)} />
      <StepClosure key={stepLockKey(caseId, 4)} caseId={caseId} caseData={caseData} readOnly={bodyReadOnly(4)} lockReadOnly={lockReadOnly(4)} stepLock={lockFor(4)} />
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
      // Step 3's seal counts the referrals *this step* lists, from this step's
      // own SWR — the same list the referral letter writes into. Stubbed with a
      // row rather than left empty because `caseData.referrals` below no longer
      // completes that step: it is the transition plan's agency list, not the
      // inter-agency referral this step issues.
      if (k.includes('inter-agency-referrals')) {
        return [{ id: 'iar-1', toAgencyId: 'ag-rhu', reason: 'Medical coordination', status: 'referred' }];
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
    // handed a sibling's row. (It does not distinguish the key's step half from a
    // bare step index — see `stepLockKey`, which says which half is load-bearing.)
    LOCKERS.forEach((name) => {
      expect(screen.getByText(`Locked by ${name} · ${formatDate(AT)}`)).toBeTruthy();
    });
    expect(screen.getAllByText(/^Locked by /)).toHaveLength(5);
  });

  it('writes each seal to its own step of its own case', async () => {
    render(<Steps caseId="c1" caseData={completeCaseData()} />);

    // Step 2's seal weighs the interventions this step fetches, and step 3's weighs
    // the referrals this step fetches, so both lists have to have arrived before
    // "every bar is enabled" means anything.
    expect(await screen.findByRole('heading', { name: 'Medical Assistance' })).toBeTruthy();
    expect(await screen.findByRole('button', { name: /Endorsement Letter/i })).toBeTruthy();

    // Five bars, each enabled because its step is done — and each reachable.
    // These five paths are what make each bar its own step's bar; they say
    // nothing about the key, which no assertion here exercises.
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
});

/**
 * A sealed step's own fields are read-only, and the strip says why.
 *
 * This is the client half of the second defect: a worker sealed step 0 and could
 * then still edit it, and the seal stood on data that had since changed. The
 * server now refuses the write, and these assert the client stops offering it —
 * the control being hidden is not what enforces the rule, but a control that
 * cannot work should not be on screen.
 */
describe('a sealed step is not editable', () => {
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
      if (k.includes('inter-agency-referrals')) {
        return [{ id: 'iar-1', toAgencyId: 'ag-rhu', reason: 'Medical coordination', status: 'referred' }];
      }
      return [];
    });
    mockApiPost.mockImplementation((path: string) => {
      const stepIndex = Number(/\/steps\/(\d+)\/lock/.exec(path)?.[1]);
      return Promise.resolve({ stepIndex, lockedByName: 'Seal Writer', lockedAt: AT });
    });
  });

  it.each([
    ['step 0', 0, /Save Assessment/i],
    ['step 1', 1, /Add Intervention/i],
  ] as const)('withholds %s\'s own editing control while it is sealed', async (_name, stepIndex, control) => {
    const sealed = [{ stepIndex, lockedByName: 'Ana Cruz', lockedAt: AT }];
    render(<Steps caseId="c1" caseData={completeCaseData()} stepLocks={sealed} />);

    // The list that feeds step 1's done-predicate has to arrive first, or the
    // absence below would be the wrong reason.
    expect(await screen.findByRole('heading', { name: 'Medical Assistance' })).toBeTruthy();

    expect(screen.queryByRole('button', { name: control })).toBeNull();
    // The seal's own strip is still there: a sealed step stays readable, and the
    // strip is what names who sealed it and offers the release.
    expect(screen.getByText(`Locked by Ana Cruz · ${formatDate(AT)}`)).toBeTruthy();
  });

  // Step 3 needs its own case, because on the case above its Add Referral button
  // is already absent for an unrelated reason — a referral is on record, and the
  // step deliberately withdraws both header actions once one exists (a second
  // referral would orphan the first). Asserting its absence there would pass
  // whatever `readOnly` said. With no referral, the two decision controls are the
  // only thing standing between the worker and a sealed step they cannot change.
  it('withholds step 2\'s own decision controls while it is sealed', async () => {
    mockApiGet.mockImplementation(async (key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('inter-agency-referrals')) return [];
      if (k.includes('agencies')) return [{ id: 'ag-rhu', code: 'RHU', name: 'RHU' }];
      return [];
    });
    // Unsealed first, as the positive control: both decision controls have to be
    // on screen for the same case data, or the assertions after the rerender
    // would pass for the wrong reason. (They are absent for an unrelated reason
    // once a referral exists — the step withdraws both, so a referral is not in
    // this fixture.)
    const { rerender } = render(<Steps caseId="c1" caseData={completeCaseData()} />);
    expect(await screen.findByRole('button', { name: /Add Referral/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /No Referrals issued/i })).toBeTruthy();

    rerender(
      <Steps caseId="c1" caseData={completeCaseData()} stepLocks={[{ stepIndex: 2, lockedByName: 'Ana Cruz', lockedAt: AT }]} />,
    );

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Add Referral/i })).toBeNull(),
    );
    expect(screen.queryByRole('button', { name: /No Referrals issued/i })).toBeNull();
    // The seal's strip stays: a sealed step is readable, and this is where the
    // release lives.
    expect(screen.getByText(`Locked by Ana Cruz · ${formatDate(AT)}`)).toBeTruthy();
  });

  it('says on the strip that releasing the seal is how to change the step', async () => {
    render(<Steps caseId="c1" caseData={completeCaseData()} stepLocks={[{ stepIndex: 0, lockedByName: 'Ana Cruz', lockedAt: AT }]} />);

    // Without this line the fields are disabled and the worker has no account of
    // why, or of how to get them back.
    expect(await screen.findByText(/This step is sealed\. Unlock it to make changes, then seal it again\./)).toBeTruthy();
  });

  it('leaves the other steps editable — a seal is per step', async () => {
    render(<Steps caseId="c1" caseData={completeCaseData()} stepLocks={[{ stepIndex: 0, lockedByName: 'Ana Cruz', lockedAt: AT }]} />);

    expect(await screen.findByRole('heading', { name: 'Medical Assistance' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Add Intervention/i })).toBeTruthy();
  });

  /**
   * The invariant, for all five steps, as an invariant.
   *
   * The lockout this pins was a page-wiring bug on step 5 alone, which no
   * per-step assertion elsewhere would have generalised. Stated once over every
   * step so a repeat lands here whatever step it lands on: **a sealed step whose
   * `lockReadOnly` is false must offer its Unlock**, however read-only its body
   * is. The strip's own copy depends on it ("Unlock it to make changes"), so a
   * strip that withholds the button is a lockout whose only exit is a raw
   * `DELETE /cases/:id/steps/N/lock`.
   */
  it.each([0, 1, 2, 3, 4])('step %i keeps its Unlock while its body is sealed', async (step) => {
    render(
      <Steps
        caseId="c1"
        caseData={completeCaseData()}
        stepLocks={[{ stepIndex: step, lockedByName: 'Ana Cruz', lockedAt: AT }]}
      />,
    );

    expect(await screen.findByRole('heading', { name: 'Medical Assistance' })).toBeTruthy();
    expect(screen.getByText(`Locked by Ana Cruz · ${formatDate(AT)}`)).toBeTruthy();
    expect(screen.getByRole('button', { name: /^unlock$/i })).toBeTruthy();
  });

  // And the converse, so the parameter is doing work: the caller decides, and a
  // `lockReadOnly` that is true withholds the release.
  it('withholds the Unlock when the caller withholds the seal control', async () => {
    render(
      <Steps
        caseId="c1"
        caseData={completeCaseData()}
        stepLocks={[{ stepIndex: 4, lockedByName: 'Ana Cruz', lockedAt: AT }]}
        opts={{ lockReadOnly: () => true }}
      />,
    );

    expect(await screen.findByText(`Locked by Ana Cruz · ${formatDate(AT)}`)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^unlock$/i })).toBeNull();
  });
});

describe('a bar reused across cases', () => {
  // `StepLockBar` keeps the outcome of its own write in local state that
  // carries neither a step index nor a case id, so a mount reused across two
  // cases renders the previous case's seal. The key is the only thing that
  // prevents it — so this fails if the case drops out of `stepLockKey`.
  it('drops its record of its own write when the case changes, because the key names the case', async () => {
    const { rerender } = render(<Steps caseId="case-a" caseData={completeCaseData({ id: 'case-a' })} />);

    fireEvent.click(screen.getAllByRole('button', { name: /^lock$/i })[0]);
    expect(await screen.findByText(`Locked by Seal Writer · ${formatDate(AT)}`)).toBeTruthy();

    // Same steps, next case: nothing is sealed there.
    rerender(<Steps caseId="case-b" caseData={completeCaseData({ id: 'case-b' })} />);

    await waitFor(() => expect(screen.queryByText(/^Locked by /)).toBeNull());
    expect(screen.getAllByRole('button', { name: /^lock$/i })).toHaveLength(5);
  });
});
