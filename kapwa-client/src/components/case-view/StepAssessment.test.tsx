import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StepAssessment } from './StepAssessment';
import { formatDate } from '@/lib/format';

const { mockPatch, mockIsOnline, mockMutate } = vi.hoisted(() => ({
  mockPatch: vi.fn(),
  mockIsOnline: vi.fn(),
  mockMutate: vi.fn(),
}));

vi.mock('@/lib/api', () => ({ api: { patch: (...a: unknown[]) => mockPatch(...a) } }));
vi.mock('@/lib/sync', () => ({ isOnline: (...a: unknown[]) => mockIsOnline(...a) }));
vi.mock('@/lib/offline-queue', () => ({ queueFsmTransition: vi.fn() }));
vi.mock('swr', () => ({ useSWRConfig: () => ({ mutate: mockMutate }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

type Seal = { stepIndex: number; lockedByName?: string; lockedAt: string } | null;

function renderAssessment(
  caseData: Record<string, unknown>,
  assessment: Record<string, unknown> = {},
  opts: { readOnly?: boolean; stepLock?: Seal; userRole?: string } = {},
) {
  return render(
    <StepAssessment
      caseId="c1"
      caseData={{ id: 'c1', status: 'enrolled', ...caseData }}
      assessment={{ problemsPresented: '', socialWorkerAssessment: '', clientCategory: '', frvaScore: null, swdiScore: null, ...assessment }}
      onAssessmentChange={() => {}}
      onSave={() => {}}
      saving={false}
      userRole={opts.userRole ?? 'social_worker'}
      readOnly={opts.readOnly}
      stepLock={opts.stepLock}
    />,
  );
}

function filledCaseData(over: Record<string, unknown> = {}) {
  return {
    problemsPresented: 'Poverty',
    socialWorkerAssessment: 'Needs financial aid',
    clientCategory: 'Child and Youth',
    ...over,
  };
}

describe('StepAssessment — step completion gate and save flow', () => {
  beforeEach(() => {
    mockIsOnline.mockReturnValue(true);
    mockPatch.mockResolvedValue({});
  });

  it('shows one Save button for the whole step, not a second one in the tools card', () => {
    renderAssessment(filledCaseData(), { problemsPresented: 'x', socialWorkerAssessment: 'y', clientCategory: 'z' });
    expect(screen.getAllByRole('button', { name: 'Save Assessment' }).length).toBe(1);
    expect(screen.queryByRole('button', { name: 'Save Assessment Tools' })).toBeNull();
  });

  it('does not offer Complete Assessment until an FRVA/SWDI score is recorded', () => {
    renderAssessment(filledCaseData(), {
      problemsPresented: 'x', socialWorkerAssessment: 'y', clientCategory: 'z',
    });
    expect(screen.queryByRole('button', { name: /Complete Assessment/ })).toBeNull();
  });

  it('explains what is missing instead of hiding silently', () => {
    renderAssessment(filledCaseData(), {
      problemsPresented: 'x', socialWorkerAssessment: 'y', clientCategory: 'z',
    });
    expect(screen.getByText(/Add an FRVA or SWDI score/)).toBeTruthy();
  });

  it('offers Complete Assessment once the narrative fields and a score exist', () => {
    renderAssessment(filledCaseData({ frvaScore: 45 }), {
      problemsPresented: 'x', socialWorkerAssessment: 'y', clientCategory: 'z', frvaScore: 45,
    });
    expect(screen.getByRole('button', { name: /Complete Assessment/ })).toBeTruthy();
    expect(screen.queryByText(/Add an FRVA or SWDI score/)).toBeNull();
  });

  // The positive half of `CaseActionBar`'s `ownedByStepCard` suppression, and it
  // has to live *here*. The bar renders nothing for `enrolled`, so this card is
  // the only control for `enrolled -> assessed`; if it stopped rendering, the
  // bar's own "renders nothing at enrolled" assertion would keep passing — a bar
  // that renders nothing at all satisfies it — and the worker would be left with
  // no control and no explanation. Asserted for every role `CASE_FSM_ROLES`
  // admits from `enrolled`, which is the whole set the bar suppresses for.
  it.each(['social_worker', 'admin'])(
    'is the only control for enrolled -> assessed, and offers it to a %s who can take it',
    (userRole) => {
      renderAssessment(
        filledCaseData({ frvaScore: 45 }),
        { problemsPresented: 'x', socialWorkerAssessment: 'y', clientCategory: 'z', frvaScore: 45 },
        { userRole },
      );
      expect(screen.getByRole('button', { name: /Complete Assessment/ })).toBeEnabled();
    },
  );
});

describe('StepAssessment — sealing step 1', () => {
  beforeEach(() => {
    mockIsOnline.mockReturnValue(true);
    mockPatch.mockResolvedValue({});
  });

  // Step 1's seal, all four states. `stepperStepDone(0, …)` reads
  // problemsPresented + clientCategory, so this case is done at step 1 and
  // nowhere else.
  it('disables Lock while the assessment is not done', () => {
    renderAssessment({ problemsPresented: 'Poverty' });

    const lock = screen.getByRole('button', { name: /^lock$/i });
    expect(lock).toBeDisabled();
    // The reason, not just the disabled state.
    expect(screen.getByText(/Complete this step before sealing it/)).toBeTruthy();
  });

  it('enables Lock once the assessment is done', () => {
    renderAssessment({ problemsPresented: 'Poverty', clientCategory: 'Indigent' });

    expect(screen.getByRole('button', { name: /^lock$/i })).toBeEnabled();
    expect(screen.queryByText(/Complete this step before sealing it/)).toBeNull();
  });

  it('shows who sealed this step and offers the release', () => {
    const stepLock = { stepIndex: 0, lockedByName: 'Juan Dela Cruz', lockedAt: '2026-10-01T09:00:00Z' };
    renderAssessment({ problemsPresented: 'Poverty', clientCategory: 'Indigent' }, {}, { stepLock });

    expect(screen.getByText(`Locked by Juan Dela Cruz · ${formatDate(stepLock.lockedAt)}`)).toBeTruthy();
    expect(screen.getByRole('button', { name: /unlock/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^lock$/i })).toBeNull();
  });

  it('offers a viewer neither the seal nor the hint it cannot act on', () => {
    renderAssessment({ problemsPresented: 'Poverty' }, {}, { readOnly: true });

    // A disabled Lock would still be a control this role was decided not to
    // have, and the hint asks for the action.
    expect(screen.queryByRole('button', { name: /^lock$/i })).toBeNull();
    expect(screen.queryByText(/Complete this step before sealing it/)).toBeNull();
  });

  it('leaves a sealed step readable for a viewer, with the release withheld', () => {
    const stepLock = { stepIndex: 0, lockedByName: 'Juan Dela Cruz', lockedAt: '2026-10-01T09:00:00Z' };
    renderAssessment({ problemsPresented: 'Poverty', clientCategory: 'Indigent' }, {}, { readOnly: true, stepLock });

    expect(screen.getByText(`Locked by Juan Dela Cruz · ${formatDate(stepLock.lockedAt)}`)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /unlock/i })).toBeNull();
  });
});