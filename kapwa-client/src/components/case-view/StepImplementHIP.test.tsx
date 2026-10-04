import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import useSWR, { SWRConfig } from 'swr';
import { StepImplementHIP } from './StepImplementHIP';
import { formatDate } from '@/lib/format';

const { mockApiGet, mockApiPost, mockApiPatch, mockUpload } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
  mockApiPatch: vi.fn(),
  mockUpload: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    put: vi.fn(),
    patch: (...args: unknown[]) => mockApiPatch(...args),
    del: vi.fn(),
  },
  uploadWithProgress: (...args: unknown[]) => mockUpload(...args),
}));

const caseData = { status: 'assessed', requirementsChecklist: {} };

function renderHIP() {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0, provider: () => new Map() }}>
      <StepImplementHIP caseId="case-1" caseData={caseData} userRole="social_worker" />
    </SWRConfig>,
  );
}

function renderHIPReadOnly() {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0, provider: () => new Map() }}>
      <StepImplementHIP caseId="case-1" caseData={caseData} userRole="social_worker" readOnly />
    </SWRConfig>,
  );
}

describe('StepImplementHIP adhoc intervention', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockApiPatch.mockReset();
    mockUpload.mockReset();
    mockApiGet.mockResolvedValue([]);
    mockApiPost.mockResolvedValue({});
    mockApiPatch.mockResolvedValue({});
    mockUpload.mockResolvedValue({});
  });

  it('renders an uploader in step 2 even when no program requirements exist, posting with just caseId', async () => {
    renderHIP();

    // With zero programs the old requirements checklist (and its upload) never
    // rendered — the regression: Case Documents uploader must always appear.
    expect(await screen.findByText(/Case Documents/)).toBeTruthy();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    const file = new File(['x'], 'receipt.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(mockUpload).toHaveBeenCalledTimes(1));
    const [path, form] = mockUpload.mock.calls[0];
    expect(path).toBe('/filing/upload');
    expect((form as FormData).get('caseId')).toBe('case-1');
    expect((form as FormData).get('requirementKey')).toBeNull();
  });

  it('sends programId as null for an adhoc service (not the adhoc: sentinel)', async () => {
    renderHIP();

    // Open the New Intervention form
    fireEvent.click(screen.getByRole('button', { name: /Add Intervention/ }));

    // No programs available (empty), so the generic "Other service" entry is
    // the only choice — there is no hardcoded service list any more.
    const programSelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(programSelect, { target: { value: 'adhoc:other' } });

    // Adhoc selection reveals the required Service Name input
    const serviceNameInput = await screen.findByPlaceholderText(/Counseling Session/);
    fireEvent.change(serviceNameInput, { target: { value: 'Medical Assistance Subsidy' } });

    fireEvent.click(screen.getByRole('button', { name: /Save Intervention/ }));

    await waitFor(() => expect(mockApiPost).toHaveBeenCalledTimes(1));
    const [path, payload] = mockApiPost.mock.calls[0];
    expect(path).toBe('/cases/case-1/interventions');
    expect(payload.programId).toBeNull();
    expect(payload.serviceName).toBe('Medical Assistance Subsidy');
  });

  // The step 2/step 3 redundancy resolution: when the case has program
  // enrollments, the New Intervention dialog is scoped to them (the treatment
  // plan anchors the services — per DSWD/MSWDO practice) instead of re-listing
  // the whole program catalog, and the saved intervention carries the
  // enrollment it was delivered under.
  describe('enrolled-program scoping', () => {
    function renderWithEnrollment() {
      mockApiGet.mockImplementation(async (key: unknown) => {
        const k = JSON.stringify(key);
        if (k.includes('interventions')) return [];
        if (k.includes('enrollments')) {
          return [
            {
              id: 'enr-1', programId: 'p1',
              programName: 'Juvenile Diversion & Intervention Program (CICL)',
              services: ['crisis_counseling', 'community_service'],
            },
          ];
        }
        if (k.includes('programs')) {
          return [
            { id: 'p1', name: 'Juvenile Diversion & Intervention Program (CICL)' },
            { id: 'p2', name: 'AICS — Assistance to Individuals in Crisis Situation' },
          ];
        }
        return [];
      });
      return render(
        <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0, provider: () => new Map() }}>
          <StepImplementHIP caseId="case-1" caseData={{ status: 'enrolled', caseCategory: 'Children in Conflict with the Law (CICL)' }} userRole="social_worker" />
        </SWRConfig>,
      );
    }

    it('opens defaulted to the first enrollment and derives services from it', async () => {
      renderWithEnrollment();
      fireEvent.click(screen.getByRole('button', { name: /Add Intervention/ }));
      await screen.findByRole('dialog');

      // The program select carries the enrollment (not a catalog re-pick) and
      // defaults to the case's first enrollment.
      const programSelect = screen.getAllByRole('combobox')[0];
      expect(programSelect).toHaveValue('enr:enr-1');

      // The Service select is scoped to that enrollment's program services —
      // not the 22-code full catalog.
      const serviceSelect = screen.getAllByRole('combobox')[1] as HTMLSelectElement;
      expect([...serviceSelect.options].map(o => o.textContent)).toEqual(
        expect.arrayContaining(['Crisis Counseling', 'Community Service']),
      );
      expect([...serviceSelect.options].map(o => o.textContent))
        .not.toEqual(expect.arrayContaining(['Financial Grant']));
    });

    it('saves the intervention under the enrollment, with the enrollment program', async () => {
      renderWithEnrollment();
      fireEvent.click(screen.getByRole('button', { name: /Add Intervention/ }));
      await screen.findByRole('dialog');

      const serviceSelect = screen.getAllByRole('combobox')[1];
      fireEvent.change(serviceSelect, { target: { value: 'crisis_counseling' } });
      fireEvent.click(screen.getByRole('button', { name: /Save Intervention/ }));

      await waitFor(() => expect(mockApiPost).toHaveBeenCalledTimes(1));
      const [path, payload] = mockApiPost.mock.calls[0];
      expect(path).toBe('/cases/case-1/interventions');
      expect(payload.programEnrollmentId).toBe('enr-1');
      expect(payload.programId).toBe('p1');
      expect(payload.interventionType).toBe('crisis_counseling');
    });

    it('flags an unenrolled case instead of silently recording unattached services', async () => {
      mockApiGet.mockImplementation(async (key: unknown) => {
        const k = JSON.stringify(key);
        if (k.includes('interventions')) return [];
        if (k.includes('enrollments')) return [];
        if (k.includes('programs')) return [];
        return [];
      });
      render(
        <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0, provider: () => new Map() }}>
          <StepImplementHIP caseId="case-1" caseData={{ status: 'enrolled', enrollmentsNotNeeded: false }} userRole="social_worker" />
        </SWRConfig>,
      );
      fireEvent.click(screen.getByRole('button', { name: /Add Intervention/ }));
      await screen.findByRole('dialog');
      expect(screen.getByText(/no program enrollment yet/i)).toBeTruthy();
    });
  });

  it('still prompts to upload documents when the step is readOnly (interventions logged)', async () => {
    // Uploading must not be tied to step completion: once an intervention is
    // logged the step flips readOnly, but the worker still needs to attach
    // receipts/evidence. The pick-a-file prompt must remain visible.
    mockApiGet.mockImplementation(async (key: string) => {
      if (Array.isArray(key) && key.includes('interventions')) {
        return [{ id: 'iv-1', caseId: 'case-1', serviceName: 'Medical Assistance', amount: 500 }];
      }
      if (Array.isArray(key) && key.includes('programs')) return [];
      return [];
    });

    renderHIPReadOnly();

    expect(await screen.findByText(/Case Documents/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Click to browse or drop files/ })).toBeTruthy();
  });

  it('keeps the progress note visible even when the step is readOnly, and offers no second way to flag the case', async () => {
    // F10, preserved: once an intervention is logged, stepDone[1] flips true =>
    // StepImplementHIP becomes readOnly, and the worker must still be able to see
    // that this step is what the review gate asks for.
    //
    // The control that used to sit here ("Submit for Review →") is gone, and this
    // assertion is why: `CaseActionBar` is the one control for `assessed ->
    // in_review`, because it carries the all-locked gate and the confirm dialog.
    // A second button here would PATCH the same transition with none of that — an
    // ungated bypass around the rule, and the exact failure the feature exists to
    // remove.
    mockApiGet.mockImplementation(async (key: string) => {
      if (Array.isArray(key) && key.includes('interventions')) {
        return [
          { id: 'iv-1', caseId: 'case-1', serviceName: 'Medical Assistance', amount: 500 },
        ];
      }
      if (Array.isArray(key) && key.includes('programs')) return [];
      return [];
    });

    renderHIPReadOnly();

    // Interventions arrive asynchronously via SWR — await their render first.
    expect(await screen.findByText('Medical Assistance')).toBeTruthy();

    expect(screen.getByText(/Interventions recorded/i)).toBeTruthy();
    // The copy still points at the hand-off...
    expect(screen.getByText(/Submit for admin review/i)).toBeTruthy();
    // ...and nothing here can perform it.
    expect(screen.queryByRole('button', { name: /submit for review/i })).toBeNull();
    expect(
      screen.queryAllByRole('button').some((b) => /review/i.test(b.textContent ?? '')),
    ).toBe(false);
    expect(mockApiPatch).not.toHaveBeenCalled();
  });
});

describe('StepImplementHIP — completing step 2', () => {
  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockApiPatch.mockReset();
    mockUpload.mockReset();
    mockApiGet.mockResolvedValue([]);
    mockApiPost.mockResolvedValue({});
    mockApiPatch.mockResolvedValue({});
    mockUpload.mockResolvedValue({});
  });

  function renderWith(caseDataOverride: Record<string, unknown>, interventions: unknown[] = []) {
    mockApiGet.mockImplementation(async (key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('interventions')) return interventions;
      if (k.includes('programs')) return [];
      return [];
    });
    return render(
      <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0, provider: () => new Map() }}>
        <StepImplementHIP caseId="case-1" caseData={caseDataOverride} userRole="social_worker" />
      </SWRConfig>,
    );
  }

  it('confirms an intervention in a modal rather than an inline form', async () => {
    renderWith(caseData);

    expect(screen.queryByText(/New Intervention/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Add Intervention/ }));

    // The form lives in a dialog with a real title, the way the referral step
    // already confirms an endorsement.
    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('heading', { name: /New Intervention/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Save Intervention/ })).toBeTruthy();
  });

  it('discards a half-typed intervention when the modal is cancelled', async () => {
    renderWith(caseData);

    fireEvent.click(screen.getByRole('button', { name: /Add Intervention/ }));
    fireEvent.change(await screen.findByLabelText(/Program \/ Service/), { target: { value: 'adhoc:other' } });
    const nameInput = screen.getByPlaceholderText(/Counseling Session/);
    fireEvent.change(nameInput, { target: { value: 'Half typed' } });

    fireEvent.click(screen.getByRole('button', { name: /Cancel/ }));
    fireEvent.click(screen.getByRole('button', { name: /Add Intervention/ }));

    // Reopening must not resurrect the abandoned draft.
    expect(await screen.findByLabelText(/Program \/ Service/)).toHaveValue('');
  });

  it('records "no interventions issued" through the decision endpoint', async () => {
    renderWith(caseData);

    fireEvent.click(screen.getByRole('button', { name: /No interventions issued/ }));

    await waitFor(() =>
      expect(mockApiPatch).toHaveBeenCalledWith('/cases/case-1/intervention-decision', { notNeeded: true }),
    );
  });

  it('hides Add Intervention once "no interventions issued" is decided', async () => {
    // Both channels open at once is what the activation gate rejects, so the
    // add affordance has to disappear with the decision, not sit beside it.
    renderWith({ ...caseData, interventionNotNeeded: true });

    expect(await screen.findByText(/Intervention not needed/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Add Intervention/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /No interventions issued/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Undo decision/ })).toBeTruthy();
  });

  it('withdraws the no-intervention option once a delivery is logged', async () => {
    renderWith(caseData, [{ id: 'iv-1', caseId: 'case-1', serviceName: 'Medical Assistance', amount: 500 }]);

    expect(await screen.findByRole('button', { name: /Add Intervention/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /No interventions issued/ })).toBeNull();
  });

  it('gives the issued intervention a heading and a prominent amount', async () => {
    // The delivered service is the substantive fact of the step; it must not
    // read as one more muted metadata row.
    renderWith(caseData, [{ id: 'iv-1', caseId: 'case-1', serviceName: 'Medical Assistance', amount: 5000, deliveryDate: '2026-01-15' }]);

    const heading = await screen.findByRole('heading', { name: 'Medical Assistance' });
    expect(heading.className).toContain('text-lg');
    expect(heading.className).toContain('font-semibold');

    const amount = screen.getByText('₱5,000');
    expect(amount.className).toContain('font-semibold');
    expect(amount.className).toContain('tabular-nums');
  });
});

describe('StepImplementHIP — sealing step 2', () => {
  type Seal = { stepKey: string; lockedByName?: string; lockedAt: string } | null;

  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockApiPatch.mockReset();
    mockUpload.mockReset();
    mockApiPost.mockResolvedValue({});
    mockApiPatch.mockResolvedValue({});
    mockUpload.mockResolvedValue({});
  });

  function renderSeal(opts: {
    caseData?: Record<string, unknown>;
    interventions?: unknown[];
    programs?: unknown[];
    readOnly?: boolean;
    lockReadOnly?: boolean;
    stepLock?: Seal;
  } = {}) {
    mockApiGet.mockImplementation(async (key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('interventions')) return opts.interventions ?? [];
      if (k.includes('programs')) return opts.programs ?? [];
      return [];
    });
    return render(
      <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0, provider: () => new Map() }}>
        <StepImplementHIP
          caseId="case-1"
          caseData={opts.caseData ?? caseData}
          userRole="social_worker"
          readOnly={opts.readOnly}
          lockReadOnly={opts.lockReadOnly}
          stepLock={opts.stepLock}
        />
      </SWRConfig>,
    );
  }

  const delivered = [{ id: 'iv-1', caseId: 'case-1', programId: 'p1', serviceName: 'Medical Assistance', amount: 5000 }];
  // A program behind the delivery, requiring one document. `requirementsMet` is
  // now derived *in* this step from these two lists plus the checklist, so the
  // only way to make it answer either way is through its own inputs.
  const programNeedingId = [{ id: 'p1', name: 'Medical Assistance', requiredDocumentDetails: [{ key: 'Valid ID' }] }];

  it('disables Lock while no intervention is recorded', async () => {
    renderSeal();

    // The intervention list has to have loaded before "no intervention" means
    // anything, or the assertion would hold for the wrong reason.
    expect(await screen.findByText(/No interventions recorded yet/i)).toBeTruthy();
    const lock = screen.getByRole('button', { name: /^lock$/i });
    expect(lock).toBeDisabled();
    expect(screen.getByText(/Complete this step before sealing it/)).toBeTruthy();
  });

  it('enables Lock once a delivery is recorded', async () => {
    renderSeal({ interventions: delivered });

    expect(await screen.findByRole('heading', { name: 'Medical Assistance' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^lock$/i })).toBeEnabled();
  });

  // The two below are one rule read in both directions, so they are stated as a
  // pair: the step derives `requirementsMet` from the two lists it already
  // fetches and the case checklist, by calling the shared
  // `interventionRequirementsMet`. Same delivery, same program, and only the
  // checklist differs. A bar that stopped weighing this — no `opts`, or the wrong
  // helper, or a constant — answers the same way on both and fails one of them.
  it('holds the seal while a linked program document is unmet', async () => {
    renderSeal({ interventions: delivered, programs: programNeedingId });

    expect(await screen.findByRole('heading', { name: 'Medical Assistance' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^lock$/i })).toBeDisabled();
    expect(screen.getByText(/Complete this step before sealing it/)).toBeTruthy();
  });

  it('offers the seal once that same document is confirmed', async () => {
    renderSeal({
      interventions: delivered,
      programs: programNeedingId,
      caseData: { ...caseData, requirementsChecklist: { 'Valid ID': true } },
    });

    expect(await screen.findByRole('heading', { name: 'Medical Assistance' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^lock$/i })).toBeEnabled();
  });

  it('shows who sealed this step and offers the release', () => {
    const stepLock = { stepKey: 'interventions', lockedByName: 'Lorna Santos', lockedAt: '2026-10-01T09:00:00Z' };
    renderSeal({ interventions: delivered, stepLock });

    expect(screen.getByText(`Locked by Lorna Santos · ${formatDate(stepLock.lockedAt)}`)).toBeTruthy();
    expect(screen.getByRole('button', { name: /unlock/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^lock$/i })).toBeNull();
  });

  it('offers a viewer neither the seal nor the hint it cannot act on', async () => {
    renderSeal({ readOnly: true, lockReadOnly: true });

    expect(await screen.findByText(/No interventions recorded yet/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^lock$/i })).toBeNull();
    expect(screen.queryByText(/Complete this step before sealing it/)).toBeNull();
  });

  it('leaves a sealed step readable for a viewer, with the release withheld', () => {
    const stepLock = { stepKey: 'interventions', lockedByName: 'Lorna Santos', lockedAt: '2026-10-01T09:00:00Z' };
    renderSeal({ interventions: delivered, readOnly: true, lockReadOnly: true, stepLock });

    expect(screen.getByText(`Locked by Lorna Santos · ${formatDate(stepLock.lockedAt)}`)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /unlock/i })).toBeNull();
  });
});

/**
 * The step's record is one card: it titles itself inside the box, each delivery
 * carries the documents its program demands, and the seal stands below it. These
 * assert the shape structurally — which elements share a box, and where the box
 * begins — rather than by class name, because the point is the nesting, not what
 * the card is painted with.
 */
describe('StepImplementHIP — the merged intervention card', () => {
  const MEDICAL = {
    id: 'med-1',
    name: 'Medical Assistance',
    requiredDocuments: ['Barangay Certificate of Indigency', 'Medical abstract'],
  };

  beforeEach(() => {
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockApiPatch.mockReset();
    mockUpload.mockReset();
    mockApiGet.mockResolvedValue([]);
    mockApiPost.mockResolvedValue({});
    mockApiPatch.mockResolvedValue({});
    mockUpload.mockResolvedValue({});
  });

  function renderCard(opts: { interventions?: unknown[]; programs?: unknown[] } = {}) {
    mockApiGet.mockImplementation(async (key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('interventions')) return opts.interventions ?? [];
      if (k.includes('programs')) return opts.programs ?? [];
      return [];
    });
    return render(
      <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0, provider: () => new Map() }}>
        <StepImplementHIP caseId="case-1" caseData={caseData} userRole="social_worker" />
      </SWRConfig>,
    );
  }

  /**
   * The card that holds this step's record: the direct child of its section
   * that contains `heading`.
   *
   * A heading sitting loose *above* the card resolves to the section itself,
   * because the section contains it too — so comparing this against the section
   * is what distinguishes a card that titles itself from one that is labelled
   * from outside.
   */
  function theCard(heading: HTMLElement) {
    const section = heading.closest('section');
    if (!section) return null;
    return [...section.children].find((el) => el.contains(heading)) ?? null;
  }

  /**
   * The deepest element that holds both, or null if they share none.
   *
   * Two elements that meet *at* the card share only the card — "both somewhere
   * in this box". Two that meet deeper share a box inside it, which is the
   * difference between a checklist in the card's header and a checklist in the
   * entry that names the program demanding it.
   */
  function commonAncestor(a: HTMLElement, b: HTMLElement) {
    const ancestors = new Set<Element>();
    for (let node: Element | null = a; node; node = node.parentElement) ancestors.add(node);
    for (let node: Element | null = b; node; node = node.parentElement) {
      if (ancestors.has(node)) return node;
    }
    return null;
  }

  it('heads the add-intervention card "Intervention to be issued" at the level its sibling cards use', async () => {
    const { container } = renderCard();

    // Every step titles its cards at one level, so heading-by-heading
    // navigation does not jump. Compared against this step's own second card
    // rather than pinned to a literal, because the bug is one card differing
    // from the others — a sibling drifting is the same defect either way.
    const heading = screen.getByRole('heading', { name: 'Intervention to be issued' });
    const caseDocs = await screen.findByRole('heading', { name: 'Case Documents' });
    expect(heading.tagName).toBe(caseDocs.tagName);
    expect(heading.tagName).toBe('H3');

    // The card titles itself: the heading sits inside the box it names, ahead
    // of the actions that row carries — not loose above the card, labelling a
    // box it was not in.
    const add = screen.getByRole('button', { name: /Add Intervention/ });
    expect(heading.compareDocumentPosition(add) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.firstElementChild).toContainElement(heading);

    const card = theCard(heading);
    expect(card).not.toBeNull();
    expect(card).not.toBe(heading.closest('section'));
    expect(card?.contains(add)).toBe(true);
  });

  it('lists a saved program\'s required documents inside that program\'s intervention card', async () => {
    renderCard({
      interventions: [{ id: 'iv-1', caseId: 'case-1', programId: 'med-1', serviceName: 'Medical Assistance' }],
      programs: [MEDICAL],
    });

    // The checklist has to have arrived before the walk below means anything,
    // or it would pass with nothing to find.
    expect(await screen.findByText('Barangay Certificate of Indigency')).toBeTruthy();
    expect(screen.getByText('Medical abstract')).toBeTruthy();

    const checklist = screen.getByRole('heading', { name: 'Requirements' });
    const intervention = screen.getByRole('heading', { name: 'Medical Assistance' });
    const card = theCard(intervention);
    expect(card).not.toBeNull();

    // The checklist meets its program's name in a box of their own — the entry
    // — rather than at the card itself, which is where a checklist sitting in
    // the card's header would put them: both are then merely "somewhere in the
    // same box", meeting at the card instead of inside it.
    expect(commonAncestor(intervention, checklist)).toBeTruthy();
    expect(commonAncestor(intervention, checklist)).not.toBe(card);

    // Once, and beside the entry: a saved program's documents belong to the
    // card that records the delivery. The card's own header holds only a
    // selection still being made, which is the next assertion's case.
    expect(screen.getAllByRole('heading', { name: 'Requirements' })).toHaveLength(1);
    expect(intervention.compareDocumentPosition(checklist) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('names the documents the selected program will require, before it is saved', async () => {
    renderCard({ programs: [MEDICAL] });

    fireEvent.click(screen.getByRole('button', { name: /Add Intervention/ }));
    fireEvent.change(await screen.findByLabelText(/Program \/ Service/), { target: { value: 'med-1' } });

    // The dialog's overlay hides the card behind it, so the select says what
    // the choice obliges the worker to — while it can still change their mind.
    expect(screen.getByText('Requires: Barangay Certificate of Indigency, Medical abstract')).toBeTruthy();
    // The card's checklist is handed the same selection, so the two readings
    // of "what this program needs" come from one id rather than two rules.
    expect(screen.getByText('Barangay Certificate of Indigency')).toBeTruthy();
    expect(screen.getByText('0/2 complete (includes the program you selected)')).toBeTruthy();
    // A preview is not a record: nothing has been asked of the server.
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it('keeps the seal below that card, reachable and disabled, with no checklist', async () => {
    renderCard({ programs: [MEDICAL] });

    // The empty state is real, not hypothetical: with nothing saved and nothing
    // selected the checklist renders nothing at all, so the card above the seal
    // is what the step shows when no delivery has been logged.
    expect(await screen.findByText(/No interventions recorded yet/i)).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Requirements' })).toBeNull();

    const heading = screen.getByRole('heading', { name: 'Intervention to be issued' });
    const card = theCard(heading);
    const lock = screen.getByRole('button', { name: /^lock$/i });
    expect(card).not.toBeNull();

    // The seal is a statement about the whole step, so it stands below the card
    // rather than as a row of it — still on this step, still beside the record
    // it attests to, and still rendered when the checklist above renders nothing.
    expect(card?.contains(lock)).toBe(false);
    expect(heading.closest('section')?.contains(lock)).toBe(true);
    expect(card?.contains(screen.getByText(/No interventions recorded yet/i))).toBe(true);

    expect(lock).toBeDisabled();
    expect(screen.getByText(/Complete this step before sealing it/)).toBeTruthy();
  });

  // Generated documents have one home — the case view's sidebar. This step used
  // to open with its own copy, so a worker on step 2 saw the same two links above
  // the card and again down the right-hand column.
  it('opens with no generated-documents card of its own', () => {
    render(
      <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0, provider: () => new Map() }}>
        <StepImplementHIP
          caseId="case-1"
          caseData={{ ...caseData, certificateUrl: '/filing/FILE-COE-1/download', pettyCashVoucherUrl: '/filing/FILE-PCV-2/download' }}
          userRole="social_worker"
        />
      </SWRConfig>,
    );

    expect(screen.queryByRole('heading', { name: 'Generated Documents' })).toBeNull();
    expect(screen.queryByRole('button', { name: /View Certificate of Eligibility/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /View Petty Cash Voucher/i })).toBeNull();
  });
});
