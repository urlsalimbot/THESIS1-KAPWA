import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StepProtectionOrder, StepSoloParent, StepDiscernment, StepAdoption } from './StepCategoryFields';

const { mockMutate } = vi.hoisted(() => ({ mockMutate: vi.fn() }));

vi.mock('@/lib/api', () => ({ api: { patch: vi.fn() } }));
vi.mock('swr', () => ({ useSWRConfig: () => ({ mutate: mockMutate }) }));

type Seal = { stepKey: string; lockedByName?: string; lockedAt: string } | null;

const RENDERS = [
  { name: 'Protection Order', Component: StepProtectionOrder, heading: /Protection Order/i },
  { name: 'Solo Parent ID', Component: StepSoloParent, heading: /Solo Parent ID/i },
  { name: 'Discernment Assessment', Component: StepDiscernment, heading: /Discernment Assessment/i },
  { name: 'Adoption & Foster Care', Component: StepAdoption, heading: /Adoption & Foster Care/i },
] as const;

/** The props every category step takes; `caseData` is `any` in the component. */
type StepProps = {
  caseId: string;
  caseData: any;
  readOnly?: boolean;
  lockReadOnly?: boolean;
  stepLock?: Seal;
};

function renderStep(Component: React.ComponentType<StepProps>, opts: Partial<StepProps> = {}) {
  return render(
    <Component caseId="c1" caseData={{ id: 'c1', status: 'enrolled' }} {...opts} />,
  );
}

/** The bordered box a card heading lives in, found by walking up to it. */
function theCard(heading: HTMLElement): HTMLElement {
  const card = heading.closest('section > div');
  if (!card) throw new Error('no card box around the heading');
  return card as HTMLElement;
}

describe('StepCategoryFields — the card titles itself', () => {
  beforeEach(() => {
    mockMutate.mockReset();
  });

  // The title used to sit in a box of its own above the card, naming a card it
  // was not in — while every other step on this page titles itself from inside.
  for (const { name, Component, heading } of RENDERS) {
    it(`titles the ${name} card from inside it`, () => {
      renderStep(Component as React.ComponentType<StepProps>);

      const h = screen.getByRole('heading', { name: heading });
      const card = theCard(h);
      expect(card.contains(h)).toBe(true);
      // The statutory hint belongs under that same title, not in a box above it.
      expect(card.textContent ?? '').toMatch(/Under R\.A\./);
      // One card only — the old layout rendered a title box and a form card.
      expect(document.querySelectorAll('section > div.rounded-lg')).toHaveLength(1);
    });

    it(`puts an icon on the ${name} title row`, () => {
      const { container } = renderStep(Component as React.ComponentType<StepProps>);

      const h = screen.getByRole('heading', { name: heading });
      const row = h.parentElement as HTMLElement;
      // The icon leads the row, the way the other steps' card titles do.
      const svg = row.querySelector('svg');
      expect(svg).not.toBeNull();
      expect(svg?.getAttribute('class')).toContain('text-primary');
      expect(container.querySelectorAll('svg').length).toBeGreaterThan(0);
    });
  }

  // The seal is a statement about the whole step, so it stands below the card
  // rather than as a row beside the Save button.
  it('stands the seal below the card, not inside it', () => {
    renderStep(StepProtectionOrder);

    const card = theCard(screen.getByRole('heading', { name: /Protection Order/i }));
    const lock = screen.getByRole('button', { name: /^lock$/i });
    expect(card.contains(lock)).toBe(false);
    expect(lock.closest('section')?.contains(lock)).toBe(true);
  });

  it('keeps Save inside the card and the seal outside it', () => {
    renderStep(StepProtectionOrder);

    const card = theCard(screen.getByRole('heading', { name: /Protection Order/i }));
    expect(card.contains(screen.getByRole('button', { name: 'Save' }))).toBe(true);
    expect(card.contains(screen.getByRole('button', { name: /^lock$/i }))).toBe(false);
  });

  // A viewer gets no Save row, so a rule above it would end the card on a line
  // ruling off nothing — the StepAssessment fix, applied to the same shape.
  it('ends a read-only card on its last field, not on a stray rule', () => {
    renderStep(StepProtectionOrder, { readOnly: true, lockReadOnly: true });

    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    const content = theCard(screen.getByRole('heading', { name: /Protection Order/i })).lastElementChild;
    // A separator renders no text; the form's own last field does. This passes on
    // the field and fails on a bare rule left ruling off nothing.
    expect(content?.lastElementChild?.textContent?.trim().length ?? 0).toBeGreaterThan(0);
  });

  // A disabled field with no account of why is the trust problem in miniature:
  // the worker cannot tell a seal from a permission. The card title says it is
  // locked, and the strip below still explains the seal and offers the release —
  // the release being the only way back to an editable step.
  it('says on the title row that the card is sealed, and offers the release below it', () => {
    renderStep(StepProtectionOrder, {
      readOnly: true,
      stepLock: { stepKey: 'protection_order', lockedByName: 'Ana Cruz', lockedAt: '2026-10-01T09:00:00Z' },
    });

    const row = screen.getByRole('heading', { name: /Protection Order/i }).parentElement as HTMLElement;
    // Two marks on the title row: the step's own icon, then the padlock that says
    // this card cannot be typed into.
    expect(row.querySelectorAll('svg').length).toBe(2);
    expect(screen.getByText(/This step is sealed\. Unlock it to make changes, then seal it again\./)).toBeTruthy();
    expect(screen.getByRole('button', { name: /^unlock$/i })).toBeTruthy();
  });
});