import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StepAssessment } from './StepAssessment';
import { formatDate } from '@/lib/format';

vi.mock('@/lib/api', () => ({
  api: { patch: vi.fn(), post: vi.fn(), del: vi.fn(), upload: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('swr', () => ({ useSWRConfig: () => ({ mutate: vi.fn() }) }));

type Seal = { stepKey: string; lockedByName?: string; lockedAt: string } | null;

function renderAssessment(
  caseData: Record<string, unknown>,
  assessment: Record<string, unknown> = {},
  opts: { readOnly?: boolean; lockReadOnly?: boolean; stepLock?: Seal } = {},
) {
  return render(
    <StepAssessment
      caseId="c1"
      caseData={{ id: 'c1', status: 'enrolled', ...caseData }}
      assessment={{
        problemsPresented: '', socialWorkerAssessment: '', clientCategory: '',
        ...assessment,
      }}
      onAssessmentChange={() => {}}
      onSave={() => {}}
      readOnly={opts.readOnly}
      lockReadOnly={opts.lockReadOnly}
      stepLock={opts.stepLock}
    />,
  );
}

function filledCaseData(over: Record<string, unknown> = {}) {
  return {
    problemsPresented: 'Poverty',
    socialWorkerAssessment: 'Needs financial aid',
    clientCategory: 'Child and Youth',
    caseCategory: 'Individual in Crisis Situation (AICS)',
    ...over,
  };
}

/** The narrative fields that complete the assessment. */
const doneAssessment = {
  problemsPresented: 'Poverty',
  socialWorkerAssessment: 'Needs financial aid',
  clientCategory: 'Child and Youth',
};

describe('StepAssessment — completion is the seal, not a button', () => {
  it('never renders a Complete Assessment control, even when the step is complete', () => {
    renderAssessment(filledCaseData(), doneAssessment);

    expect(screen.queryByRole('button', { name: /Complete Assessment/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Proceed to/i })).toBeNull();
  });

  it('has no Save button of its own — the seal bar below the card is the submit', () => {
    renderAssessment(filledCaseData(), doneAssessment);

    expect(screen.queryByRole('button', { name: /Save Assessment/ })).toBeNull();
    expect(screen.getByRole('button', { name: /^lock$/i })).toBeTruthy();
  });

  it('marks the assessment completed once the case is assessed', () => {
    renderAssessment(filledCaseData({ status: 'assessed' }), doneAssessment);

    expect(screen.getByText(/Assessment completed/)).toBeTruthy();
  });

  it('shows the IP badge only when the case carries the indigenous-person flag', () => {
    renderAssessment(filledCaseData({ isIndigenous: true }), doneAssessment);
    expect(screen.getByText('Indigenous Person (IP)')).toBeTruthy();
  });

  it('offers the grouped MSWDO case categories in step 1', async () => {
    const user = userEvent.setup();
    renderAssessment(filledCaseData());
    await user.click(screen.getByLabelText(/Case Category \*/i));
    expect(await screen.findByRole('option', { name: 'Children in Conflict with the Law (CICL)' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Emergency Shelter Assistance (ESA)' })).toBeTruthy();
    await user.keyboard('{Escape}');
  });
});

describe('StepAssessment — sealing step 1', () => {
  it('disables Lock while the assessment is not done', () => {
    renderAssessment({ problemsPresented: 'Poverty' });

    expect(screen.getByRole('button', { name: /^lock$/i })).toBeDisabled();
    expect(screen.getByText(/Complete this step before sealing it/)).toBeTruthy();
  });

  it('enables Lock once the narrative fields are complete', () => {
    // The bar reads the *draft*, which is what makes one press save and seal.
    renderAssessment(filledCaseData(), doneAssessment);

    expect(screen.getByRole('button', { name: /^lock$/i })).toBeEnabled();
    expect(screen.queryByText(/Complete this step before sealing it/)).toBeNull();
  });

  it('shows who sealed this step and offers the release', () => {
    const stepLock = { stepKey: 'assessment', lockedByName: 'Juan Dela Cruz', lockedAt: '2026-10-01T09:00:00Z' };
    renderAssessment({ problemsPresented: 'Poverty', clientCategory: 'Indigent' }, {}, { stepLock });

    expect(screen.getByText(`Locked by Juan Dela Cruz · ${formatDate(stepLock.lockedAt)}`)).toBeTruthy();
    expect(screen.getByRole('button', { name: /unlock/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^lock$/i })).toBeNull();
  });

  it('keeps a sealed step readable for a viewer, with the release withheld', () => {
    const stepLock = { stepKey: 'assessment', lockedByName: 'Juan Dela Cruz', lockedAt: '2026-10-01T09:00:00Z' };
    renderAssessment({ problemsPresented: 'Poverty', clientCategory: 'Indigent' }, {}, { readOnly: true, lockReadOnly: true, stepLock });

    expect(screen.getByText(`Locked by Juan Dela Cruz · ${formatDate(stepLock.lockedAt)}`)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /unlock/i })).toBeNull();
  });

  it('offers a viewer neither the seal nor the hint it cannot act on', () => {
    renderAssessment({ problemsPresented: 'Poverty' }, {}, { readOnly: true, lockReadOnly: true });

    expect(screen.queryByRole('button', { name: /^lock$/i })).toBeNull();
    expect(screen.queryByText(/Complete this step before sealing it/)).toBeNull();
  });
});

describe('StepAssessment — card layout', () => {
  const commonAncestor = (a: Element, b: Element) => {
    const ancestors = new Set<Element>();
    for (let node: Element | null = a; node; node = node.parentElement) ancestors.add(node);
    for (let node: Element | null = b; node; node = node.parentElement) {
      if (ancestors.has(node)) return node;
    }
    return null;
  };
  const childOf = (root: Element, el: Element) => {
    let node: Element | null = el;
    while (node && node.parentElement !== root) node = node.parentElement;
    return node;
  };

  it('keeps the remaining assessment fields inside the single card', () => {
    renderAssessment(filledCaseData(), doneAssessment);

    const cardTitle = screen.getByRole('heading', { name: 'Assessment & Diagnosis' });
    const lock = screen.getByRole('button', { name: /^lock$/i });
    const root = commonAncestor(cardTitle, lock);
    expect(root).not.toBeNull();
    const card = childOf(root as Element, cardTitle);
    expect(card).not.toBeNull();
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(1);
    expect(card?.contains(screen.getByLabelText('Family Dialogue Notes'))).toBe(true);
    expect(screen.queryByLabelText(/FRVA|SWDI/)).toBeNull();

    const category = screen.getByText('Client Category *');
    const problems = screen.getByText('Problem/s Presented *');
    expect(card?.contains(category)).toBe(true);
    expect(card?.contains(problems)).toBe(true);
    expect(category.compareDocumentPosition(problems) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('does not end the card on a rule', () => {
    renderAssessment(filledCaseData(), {}, { readOnly: true, lockReadOnly: true });

    const heading = screen.getByRole('heading', { name: 'Assessment & Diagnosis' });
    const content = heading.parentElement?.parentElement?.lastElementChild;
    expect(content?.lastElementChild?.textContent?.trim().length ?? 0).toBeGreaterThan(0);
  });
});
