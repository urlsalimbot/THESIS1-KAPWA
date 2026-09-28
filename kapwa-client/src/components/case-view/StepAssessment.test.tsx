import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StepAssessment } from './StepAssessment';

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

function renderAssessment(caseData: Record<string, unknown>, assessment: Record<string, unknown> = {}) {
  return render(
    <StepAssessment
      caseId="c1"
      caseData={{ id: 'c1', status: 'enrolled', ...caseData }}
      assessment={{ problemsPresented: '', socialWorkerAssessment: '', clientCategory: '', frvaScore: null, swdiScore: null, ...assessment }}
      onAssessmentChange={() => {}}
      onSave={() => {}}
      saving={false}
      userRole="social_worker"
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
});