import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SWRConfig } from 'swr';
import { StepEnrollments } from './StepEnrollments';

const { mockApiGet, mockApiPost, mockApiPatch, mockApiDel, mockMutate } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
  mockApiPatch: vi.fn(),
  mockApiDel: vi.fn(),
  mockMutate: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: {
    get: (...a: unknown[]) => mockApiGet(...a),
    post: (...a: unknown[]) => mockApiPost(...a),
    patch: (...a: unknown[]) => mockApiPatch(...a),
    del: (...a: unknown[]) => mockApiDel(...a),
  },
}));

type Seal = { stepKey: string; lockedByName?: string; lockedAt: string } | null;

const ENROLLMENT = {
  id: 'e1',
  caseId: 'c1',
  programId: 'p1',
  programName: 'Family Assistance Program',
  programType: 'cash',
  services: ['Monthly cash grant'],
  enrolledAt: '2026-09-01',
  status: 'active',
  createdAt: '2026-09-01T00:00:00Z',
};

function renderStep(
  enrollments: unknown[] = [],
  opts: { caseData?: Record<string, unknown>; readOnly?: boolean; lockReadOnly?: boolean; stepLock?: Seal; userRole?: string } = {},
) {
  mockApiGet.mockImplementation((key: unknown) => {
    const k = JSON.stringify(key);
    if (k.includes('enrollments')) return Promise.resolve(enrollments);
    if (k.includes('programs')) return Promise.resolve([{ id: 'p1', name: 'Family Assistance Program' }]);
    return Promise.resolve(null);
  });
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, provider: () => new Map(), dedupingInterval: 0 }}>
      <StepEnrollments
        caseId="c1"
        caseData={{ id: 'c1', status: 'enrolled', ...(opts.caseData ?? {}) }}
        userRole={opts.userRole ?? 'social_worker'}
        readOnly={opts.readOnly}
        lockReadOnly={opts.lockReadOnly}
        stepLock={opts.stepLock}
      />
    </SWRConfig>,
  );
}

/** The bordered box a card heading lives in, found by walking up to it. */
function theCard(heading: HTMLElement): HTMLElement {
  const card = heading.closest('section > div');
  if (!card) throw new Error('no card box around the heading');
  return card as HTMLElement;
}

describe('StepEnrollments — one self-titled card', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockApiPatch.mockReset();
    mockApiDel.mockReset();
    mockMutate.mockReset();
    mockApiPost.mockResolvedValue({});
    mockApiPatch.mockResolvedValue({});
    mockApiDel.mockResolvedValue({});
  });

  // The title and the hint used to sit in a box of their own above the list card,
  // naming a card they were not in — while every other step on this page titles
  // itself from inside its card.
  it('titles the card from inside it', async () => {
    renderStep([ENROLLMENT]);

    const h = await screen.findByRole('heading', { name: 'Program Enrollments' });
    const card = theCard(h);
    expect(card.contains(h)).toBe(true);
    // The hint belongs under that same title, not in a box above it.
    expect(card.textContent ?? '').toMatch(/agreed after assessment/i);
    expect(document.querySelectorAll('section > div.rounded-lg')).toHaveLength(1);
  });

  it('puts the icon and the step-completing actions on the title row', async () => {
    renderStep();

    // The header row holds the title cluster on the left and the actions on the
    // right, both above the rule and the list.
    const header = ((await screen.findByRole('heading', { name: 'Program Enrollments' })).parentElement as HTMLElement)
      .parentElement as HTMLElement;
    const svg = header.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('class')).toContain('text-primary');

    // Both ways to complete this step stand beside the title they belong to:
    // enroll in a program, or record that none is needed.
    const enroll = await screen.findByRole('button', { name: /Enroll in a program/i });
    const noneNeeded = screen.getByRole('button', { name: /no enrollment needed/i });
    expect(header.contains(enroll)).toBe(true);
    expect(header.contains(noneNeeded)).toBe(true);
  });

  // The seal is a statement about the whole step, so it stands below the card
  // rather than as a row inside it.
  it('stands the seal below the card, not inside it', () => {
    renderStep([ENROLLMENT]);

    const card = theCard(screen.getByRole('heading', { name: 'Program Enrollments' }));
    const lock = screen.getByRole('button', { name: /^lock$/i });
    expect(card.contains(lock)).toBe(false);
    expect(lock.closest('section')?.contains(lock)).toBe(true);
  });

  it('says an empty step plainly instead of showing a blank list', async () => {
    renderStep([]);

    expect(await screen.findByText('No programs enrolled yet.')).toBeTruthy();
  });

  it('lists each enrollment under the card title', async () => {
    renderStep([ENROLLMENT]);

    const card = theCard(screen.getByRole('heading', { name: 'Program Enrollments' }));
    expect(await screen.findByText('Family Assistance Program')).toBeTruthy();
    expect(card.textContent ?? '').toMatch(/Enrolled 2026-09-01/);
  });

  // The add form is a mode, not a second card: it opens under the list inside the
  // same card, so the step still reads as one thing.
  it('opens the enrollment form inside the card, not below it', async () => {
    const user = userEvent.setup();
    renderStep([]);

    await user.click(await screen.findByRole('button', { name: /Enroll in a program/i }));

    const program = await screen.findByText('Program *');
    expect(theCard(screen.getByRole('heading', { name: 'Program Enrollments' })).contains(program)).toBe(true);
  });

  it('offers the undo of the "no enrollment needed" decision instead of the form', async () => {
    renderStep([], { caseData: { enrollmentsNotNeeded: true } });

    expect(await screen.findByText(/No program enrollment needed/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Enroll in a program/i })).toBeNull();
    expect(screen.getByRole('button', { name: /Cancel the "no enrollment needed" decision/i })).toBeTruthy();
  });

  it('keeps the recorded decision readable without the empty state', async () => {
    renderStep([], { caseData: { enrollmentsNotNeeded: true } });

    await screen.findByText(/No program enrollment needed/i);
    expect(screen.queryByText('No programs enrolled yet.')).toBeNull();
  });

  it('records the enrollment through the API', async () => {
    const user = userEvent.setup();
    renderStep([]);

    await user.click(await screen.findByRole('button', { name: /Enroll in a program/i }));
    await user.click(await screen.findByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Family Assistance Program' }));
    await user.click(screen.getAllByRole('button', { name: 'Save' })[0]);

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/cases/c1/enrollments', expect.objectContaining({ programId: 'p1' }));
    });
  });

  // A viewer gets neither action, so the title row must not hold empty buttons.
  it('shows a read-only card with no actions and no form', async () => {
    renderStep([ENROLLMENT], { readOnly: true, lockReadOnly: true, userRole: 'viewer' });

    const h = await screen.findByRole('heading', { name: 'Program Enrollments' });
    await screen.findByText('Family Assistance Program');
    const cluster = h.parentElement as HTMLElement;
    expect(cluster.parentElement?.querySelector('button')).toBeNull();
    // The padlock beside the title says why the fields are inert.
    expect(cluster.querySelectorAll('svg').length).toBe(2);
  });
});
