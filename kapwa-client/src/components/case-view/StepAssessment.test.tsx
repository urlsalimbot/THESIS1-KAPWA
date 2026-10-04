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

type Seal = { stepKey: string; lockedByName?: string; lockedAt: string } | null;

function renderAssessment(
  caseData: Record<string, unknown>,
  assessment: Record<string, unknown> = {},
  opts: { readOnly?: boolean; transitionReadOnly?: boolean; lockReadOnly?: boolean; stepLock?: Seal; userRole?: string } = {},
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
      transitionReadOnly={opts.transitionReadOnly}
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

  it('withholds Complete Assessment until a case category is chosen', () => {
    renderAssessment(filledCaseData({ frvaScore: 45, caseCategory: '' }), {
      problemsPresented: 'x', socialWorkerAssessment: 'y', clientCategory: 'z', frvaScore: 45,
    });
    expect(screen.queryByRole('button', { name: /Complete Assessment/ })).toBeNull();
  });

  it('offers the grouped MSWDO case categories in step 1', () => {
    renderAssessment(filledCaseData());
    expect(screen.getByLabelText(/Case Category \*/i)).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Children in Conflict with the Law (CICL)' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Emergency Shelter Assistance (ESA)' })).toBeTruthy();
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

  /**
   * The deepest element holding both, or null if they share none above the
   * component root.
   */
  function commonAncestor(a: Element, b: Element) {
    const ancestors = new Set<Element>();
    for (let node: Element | null = a; node; node = node.parentElement) ancestors.add(node);
    for (let node: Element | null = b; node; node = node.parentElement) {
      if (ancestors.has(node)) return node;
    }
    return null;
  }

  /** The ancestor of `el` whose parent is `root` — `el`'s own box inside it. */
  function childOf(root: Element, el: Element) {
    let node: Element | null = el;
    while (node && node.parentElement !== root) node = node.parentElement;
    return node;
  }

  // Step 1's record is one card: the DSWD tools are a named section inside it,
  // not a second card beside it. Asserted structurally — which box holds which
  // title — because the point is the nesting, not what the card is painted with.
  it('keeps the DSWD tools inside the assessment card rather than a card of their own', () => {
    renderAssessment(filledCaseData(), { problemsPresented: 'x', socialWorkerAssessment: 'y', clientCategory: 'z' });

    const cardTitle = screen.getByRole('heading', { name: 'Assessment & Diagnosis' });
    const toolsTitle = screen.getByRole('heading', { name: 'DSWD Assessment Tools' });
    const lock = screen.getByRole('button', { name: /^lock$/i });

    // The step's root is what the card and its seal strip share, so the box
    // between that root and the card's own title is the card itself. Both
    // titles and the Save button landing in it is what "one card" means: a
    // second card would leave the tools title outside the box the card's title
    // names, which is exactly the shape this replaced.
    const root = commonAncestor(cardTitle, lock);
    expect(root).not.toBeNull();
    const card = childOf(root as Element, cardTitle);
    expect(card).not.toBeNull();
    expect(card?.contains(toolsTitle)).toBe(true);
    expect(card?.contains(screen.getByRole('button', { name: 'Save Assessment' }))).toBe(true);
    // One title for the card, not one per group.
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(1);

    // Subordinate, not a peer: `h4` beneath the card's `h3`, so heading levels
    // still descend through the merged card.
    expect(cardTitle.tagName).toBe('H3');
    expect(toolsTitle.tagName).toBe('H4');

    // The category stands beside the narratives it files, ahead of them in the
    // document — the two-column form as it reads left to right.
    const category = screen.getByText('Client Category *');
    const problems = screen.getByText('Problem/s Presented *');
    expect(card?.contains(category)).toBe(true);
    expect(card?.contains(problems)).toBe(true);
    expect(category.compareDocumentPosition(problems) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  // The Save row is the only thing that carries the rule above it, so a viewer —
  // who gets no Save row — is the case where a separator left standing would
  // rule off nothing at the foot of the card.
  it('does not end the card on a rule when a viewer has no Save row', () => {
    renderAssessment(filledCaseData(), {}, { readOnly: true, lockReadOnly: true });

    const heading = screen.getByRole('heading', { name: 'Assessment & Diagnosis' });
    // h3 -> header row -> the card, whose last box is the content column.
    const content = heading.parentElement?.parentElement?.lastElementChild;

    // A separator renders no text; the form's own content does. This passes on
    // the form and fails on a bare rule, whichever rule it happens to be.
    expect(content?.lastElementChild?.textContent?.trim().length ?? 0).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Save Assessment' })).toBeNull();
  });
});

describe('StepAssessment — sealing step 1', () => {
  beforeEach(() => {
    mockIsOnline.mockReturnValue(true);
    mockPatch.mockResolvedValue({});
  });

  // The assessment seal. The done-predicate reads problemsPresented +
  // socialWorkerAssessment + clientCategory + caseCategory, so a case is done
  // at assessment only when all four are set.
  it('disables Lock while the assessment is not done', () => {
    renderAssessment({ problemsPresented: 'Poverty' });

    const lock = screen.getByRole('button', { name: /^lock$/i });
    expect(lock).toBeDisabled();
    // The reason, not just the disabled state.
    expect(screen.getByText(/Complete this step before sealing it/)).toBeTruthy();
  });

  it('enables Lock once the assessment is done', () => {
    renderAssessment({
      problemsPresented: 'Poverty',
      socialWorkerAssessment: 'Needs aid',
      clientCategory: 'Indigent',
      caseCategory: 'Individual in Crisis Situation (AICS)',
    });

    expect(screen.getByRole('button', { name: /^lock$/i })).toBeEnabled();
    expect(screen.queryByText(/Complete this step before sealing it/)).toBeNull();
  });

  // Finding: a sealed step was read-only *because* of the seal, and the seal was
  // folded into the one `readOnly` that also gated the transition — so sealing
  // step 1 hid "Complete Assessment" and the worker had to unlock, advance, and
  // re-seal. The seal guards the step's data; the hop it prepares for is not
  // data. `transitionReadOnly` is the base signal, without the seal.
  it('keeps Complete Assessment available while the step is sealed, but not its Save', () => {
    const stepLock = { stepKey: 'assessment', lockedByName: 'Juan Dela Cruz', lockedAt: '2026-10-01T09:00:00Z' };
    renderAssessment(
      filledCaseData({ frvaScore: 45 }),
      { problemsPresented: 'x', socialWorkerAssessment: 'y', clientCategory: 'z', frvaScore: 45 },
      { readOnly: true, transitionReadOnly: false, stepLock },
    );

    expect(screen.getByRole('button', { name: /Complete Assessment/ })).toBeEnabled();
    // The seal still freezes the data — no way to change the frozen fields.
    expect(screen.queryByRole('button', { name: 'Save Assessment' })).toBeNull();
  });

  it('withholds the transition when the base signal does, seal or not', () => {
    renderAssessment(
      filledCaseData({ frvaScore: 45 }),
      { problemsPresented: 'x', socialWorkerAssessment: 'y', clientCategory: 'z', frvaScore: 45 },
      { readOnly: true, transitionReadOnly: true },
    );

    expect(screen.queryByRole('button', { name: /Complete Assessment/ })).toBeNull();
  });

  it('shows who sealed this step and offers the release', () => {
    const stepLock = { stepKey: 'assessment', lockedByName: 'Juan Dela Cruz', lockedAt: '2026-10-01T09:00:00Z' };
    renderAssessment({ problemsPresented: 'Poverty', clientCategory: 'Indigent' }, {}, { stepLock });

    expect(screen.getByText(`Locked by Juan Dela Cruz · ${formatDate(stepLock.lockedAt)}`)).toBeTruthy();
    expect(screen.getByRole('button', { name: /unlock/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^lock$/i })).toBeNull();
  });

  it('offers a viewer neither the seal nor the hint it cannot act on', () => {
    renderAssessment({ problemsPresented: 'Poverty' }, {}, { readOnly: true, lockReadOnly: true });

    // A disabled Lock would still be a control this role was decided not to
    // have, and the hint asks for the action.
    expect(screen.queryByRole('button', { name: /^lock$/i })).toBeNull();
    expect(screen.queryByText(/Complete this step before sealing it/)).toBeNull();
  });

  it('leaves a sealed step readable for a viewer, with the release withheld', () => {
    const stepLock = { stepKey: 'assessment', lockedByName: 'Juan Dela Cruz', lockedAt: '2026-10-01T09:00:00Z' };
    renderAssessment({ problemsPresented: 'Poverty', clientCategory: 'Indigent' }, {}, { readOnly: true, lockReadOnly: true, stepLock });

    expect(screen.getByText(`Locked by Juan Dela Cruz · ${formatDate(stepLock.lockedAt)}`)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /unlock/i })).toBeNull();
  });
});
