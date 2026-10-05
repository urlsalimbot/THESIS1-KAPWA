import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CaseRequirements } from './CaseRequirements';

const { mockPatch, mockDel, mockMutate, mockSWR } = vi.hoisted(() => ({
  mockPatch: vi.fn(),
  mockDel: vi.fn(),
  mockMutate: vi.fn(),
  mockSWR: vi.fn(),
}));

vi.mock('swr', () => ({
  default: (key: unknown) => mockSWR(key),
  useSWRConfig: () => ({ mutate: mockMutate }),
}));

vi.mock('@/lib/api', () => ({
  api: {
    patch: (...a: unknown[]) => mockPatch(...a),
    del: (...a: unknown[]) => mockDel(...a),
  },
  uploadWithProgress: vi.fn().mockResolvedValue({ id: 'new' }),
  downloadFilingDoc: vi.fn().mockResolvedValue(undefined),
  getFilingObjectUrl: vi.fn().mockResolvedValue('blob:mock'),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const PROGRAMS = [
  { id: 'p1', name: 'Cash Assistance', requiredDocumentDetails: [{ key: 'Valid ID', mandatory: true }] },
];
const INTERVENTIONS = [{ id: 'i1', programId: 'p1' }];
const DOCS = [
  {
    id: 'd1',
    originalName: 'valid-id.pdf',
    fileSize: 12288,
    mimeType: 'application/pdf',
    requirementKey: 'Valid ID',
    verifiedAt: null,
  },
];

function renderRequirements(
  docs: unknown[] = DOCS,
  checklist: Record<string, boolean> = {},
  overrides: { programs?: unknown[]; interventions?: unknown[]; extraProgramIds?: string[]; readOnly?: boolean; caseData?: { crisisMode?: boolean } } = {},
) {
  mockSWR.mockImplementation((key: unknown) => {
    if (Array.isArray(key) && key[0] === 'cases' && key[1] === 'intervention-documents') {
      return { data: [{ interventionType: 'medical_assistance', documentKey: 'medical_certificate' }] };
    }
    const root = Array.isArray(key) ? key[0] : key;
    if (root === 'cases') return { data: overrides.interventions ?? INTERVENTIONS };
    if (root === 'programs') return { data: overrides.programs ?? PROGRAMS };
    if (root === 'filing') return { data: docs };
    return { data: undefined };
  });
  return render(
    <CaseRequirements
      caseId="c1"
      caseData={{ requirementsChecklist: checklist, ...(overrides.caseData ?? {}) }}
      userRole="social_worker"
      extraProgramIds={overrides.extraProgramIds}
      readOnly={overrides.readOnly}
    />,
  );
}

describe('CaseRequirements — one row per uploaded document', () => {
  beforeEach(() => {
    mockPatch.mockReset().mockResolvedValue({});
    mockDel.mockReset().mockResolvedValue({});
    mockMutate.mockReset().mockResolvedValue(undefined);
  });

  it('shows each uploaded file once, with its size and its review status', () => {
    renderRequirements();
    expect(screen.getAllByText('valid-id.pdf')).toHaveLength(1);
    expect(screen.getByText('12 KB')).toBeTruthy();
    expect(screen.getByText('Pending review')).toBeTruthy();
  });

  it('keeps per-file actions behind a single menu instead of bare icon buttons', async () => {
    const user = userEvent.setup();
    renderRequirements();
    expect(screen.queryByLabelText('Download')).toBeNull();
    expect(screen.queryByLabelText('Remove')).toBeNull();

    await user.click(screen.getByLabelText('File actions'));
    expect(screen.getByText('Download')).toBeTruthy();
    expect(screen.getByText('Remove')).toBeTruthy();
  });

  it('confirms the review of a single document from inside its preview', async () => {
    // The control that records "I have read this" belongs in the preview, the
    // only place the document is on screen. On the row it sat one click away
    // from being fired without ever opening the file.
    const user = userEvent.setup();
    renderRequirements();

    expect(screen.queryByRole('button', { name: /Confirm review/ })).toBeNull();

    await user.click(screen.getByRole('button', { name: /Preview valid-id\.pdf/ }));
    await user.click(await screen.findByRole('button', { name: 'Confirm review' }));

    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/filing/d1/verify', { verified: true }));
  });

  it('shows a reviewed badge instead of pending once the worker confirms it', async () => {
    const user = userEvent.setup();
    renderRequirements([{ ...DOCS[0], verifiedAt: '2026-09-28T08:00:00.000Z' }]);
    expect(screen.getByText('Reviewed on-site')).toBeTruthy();
    expect(screen.queryByText('Pending review')).toBeNull();

    // The reversal lives in the same place as the confirmation.
    await user.click(screen.getByRole('button', { name: /Preview valid-id\.pdf/ }));
    expect(await screen.findByRole('button', { name: 'Undo' })).toBeTruthy();
  });

  it('does not turn the requirement heading into a click target', async () => {
    // The row used to be a button that flipped the requirement, so satisfying a
    // documentary need was a side effect of clicking a label. The only way to
    // record the decision now is the explicit control.
    const user = userEvent.setup();
    renderRequirements();

    await user.click(screen.getByText('Valid ID'));
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it('records a client who passed on-site with no copy through a named button', async () => {
    const user = userEvent.setup();
    renderRequirements();

    await user.click(screen.getByRole('button', { name: /Passed on-site, no copy/ }));
    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith('/cases/c1/requirements', {
        requirementsChecklist: { 'Valid ID': true },
      }),
    );
  });

  it('offers Undo instead of the on-site button once the requirement is met', async () => {
    renderRequirements(DOCS, { 'Valid ID': true });
    expect(screen.queryByRole('button', { name: /Passed on-site, no copy/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
  });
});

/**
 * A sealed step 1 must withhold every control the server will refuse. The seal
 * guards `case_requirements` and the requirement's documents, so the on-site
 * decision, the review confirmation and the upload all 409 once it is up. On a
 * sealed step the controls have to go with the writes — an offered control that
 * cannot work is worse than no control.
 */
describe('CaseRequirements — a sealed step withholds every control it will refuse', () => {
  beforeEach(() => {
    mockPatch.mockReset().mockResolvedValue({});
    mockDel.mockReset().mockResolvedValue({});
    mockMutate.mockReset().mockResolvedValue(undefined);
  });

  it('withholds the on-site decision, the review control and the upload', async () => {
    const user = userEvent.setup();
    renderRequirements(DOCS, {}, { readOnly: true });

    // The on-site decision button, in both of its labels.
    expect(screen.queryByRole('button', { name: /Passed on-site, no copy/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    // The upload dropzone.
    expect(screen.queryByText(/Click to browse or drop files/)).toBeNull();

    // Reading the document is still allowed; recording the review is not.
    await user.click(screen.getByRole('button', { name: /Preview valid-id\.pdf/ }));
    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Confirm review' })).toBeNull();
  });

  // The positive control: the same data, unsealed, still offers the controls, so
  // the absences above are the seal's doing and not the fixture's.
  it('offers them again when the step is not sealed', () => {
    renderRequirements(DOCS, {}, { readOnly: false });

    expect(screen.getByRole('button', { name: /Passed on-site, no copy/ })).toBeTruthy();
    expect(screen.getByText(/Click to browse or drop files/)).toBeTruthy();
  });
});

/**
 * The checklist is rendered inside the add-intervention card, so a worker who
 * has *picked* a program but not yet saved it still sees what that program will
 * demand of them. Nothing about an unsaved selection is persisted, so the step
 * has to hand the selection in — and these three cases are the three shapes
 * that can produce the list: nothing, the saved programs alone, the saved
 * programs plus the one in hand.
 */
describe('CaseRequirements — previewing a program that is not yet an intervention', () => {
  const MEDICAL = {
    id: 'med-1',
    name: 'Medical Assistance',
    requiredDocuments: ['Barangay Certificate of Indigency', 'Medical abstract'],
  };
  const saved = { id: 'i1', programId: 'p1' };

  beforeEach(() => {
    mockPatch.mockReset().mockResolvedValue({});
    mockDel.mockReset().mockResolvedValue({});
    mockMutate.mockReset().mockResolvedValue(undefined);
  });

  it('shows the selected program documents before the intervention is saved', () => {
    // Nothing saved, and the program list is the only place this program exists.
    renderRequirements([], {}, { programs: [MEDICAL], interventions: [], extraProgramIds: ['med-1'] });

    expect(screen.getByText('Barangay Certificate of Indigency')).toBeTruthy();
    expect(screen.getByText('Medical abstract')).toBeTruthy();
    // The count is the checklist's own arithmetic over the keys it rendered, so
    // it proves the list is the two documents above and nothing else.
    expect(screen.getByText('0/2 complete (includes the program you selected)')).toBeTruthy();
  });

  it('renders nothing for a selection that is still only in the form', () => {
    // The counterpart to the test above: without the selection there is no
    // requirement at all, so the row above is the selection's doing and not a
    // checklist that always renders these two names.
    renderRequirements([], {}, { programs: [MEDICAL], interventions: [] });

    expect(screen.queryByText('Barangay Certificate of Indigency')).toBeNull();
    expect(screen.queryByText('Medical abstract')).toBeNull();
    expect(screen.queryByText(/complete/)).toBeNull();
  });

  it('adds the selected program to the saved ones rather than replacing them', () => {
    renderRequirements([], {}, {
      programs: [PROGRAMS[0], MEDICAL],
      interventions: [saved],
      extraProgramIds: ['med-1'],
    });

    expect(screen.getByText('Valid ID')).toBeTruthy();
    expect(screen.getByText('Barangay Certificate of Indigency')).toBeTruthy();
    expect(screen.getByText('Medical abstract')).toBeTruthy();
    expect(screen.getByText('0/3 complete (includes the program you selected)')).toBeTruthy();
  });

  it('ignores an ad-hoc sentinel, which names no program', () => {
    // The step's form uses "adhoc:other" for a service that has no program
    // behind it, so there is nothing to preview and the checklist must not
    // invent a requirement for it.
    renderRequirements([], {}, {
      programs: [MEDICAL],
      interventions: [],
      extraProgramIds: ['adhoc:other'],
    });

    expect(screen.queryByText('Barangay Certificate of Indigency')).toBeNull();
  });

  it('does not claim to include a selection that names no known program', () => {
    // `previewing` used to test the selection's *presence* alone, so an id no
    // program resolves to still added "includes the program you selected" to a
    // count that included nothing from it. The saved program keeps the checklist
    // on screen, which is what makes the false clause observable.
    renderRequirements([], {}, {
      programs: [MEDICAL],
      interventions: [{ id: 'iv-1', programId: 'med-1' }],
      extraProgramIds: ['ghost-id'],
    });

    expect(screen.getByText('0/2 complete')).toBeTruthy();
    expect(screen.queryByText(/includes the program you selected/)).toBeNull();
  });

  // The two below are one property read from both sides: a program that is
  // *both* recorded and still selected contributes its documents once. A worker
  // re-picking the program already on the record is ordinary — the select does
  // not know what is saved — and a union that concatenated would show them a
  // doubled count (0/4) and two rows per document.
  it('counts a program once when it is both already recorded and just selected', () => {
    renderRequirements([], {}, {
      programs: [MEDICAL],
      interventions: [{ id: 'iv-1', programId: 'med-1' }],
      extraProgramIds: ['med-1'],
    });

    // getAllBy, not getBy: a duplicate row makes the query throw, which is the
    // failure this is looking for, so the count of matches is the assertion.
    expect(screen.getAllByText('Barangay Certificate of Indigency')).toHaveLength(1);
    expect(screen.getAllByText('Medical abstract')).toHaveLength(1);
    // The count is over the keys it rendered, so the doubled figure cannot hide
    // behind matching one of two nodes.
    expect(screen.getByText('0/2 complete')).toBeTruthy();
  });

  it('shares one row between two programs that ask for the same document', () => {
    // The other half of the union's job: a saved program and the selected one
    // can both demand "Valid ID", and the checklist is one list of needs rather
    // than one entry per program that happens to want it. Without the set over
    // the keys this reads 0/2 and renders the row twice.
    const ALSO_IDS = { id: 'p2', name: 'Cash Assistance', requiredDocuments: ['Valid ID'] };
    renderRequirements([], { 'Valid ID': true }, {
      programs: [PROGRAMS[0], ALSO_IDS],
      interventions: [saved],
      extraProgramIds: ['p2'],
    });

    expect(screen.getAllByText('Valid ID')).toHaveLength(1);
    // One key, and it is met, so the count is 1/1. Had the same document
    // arrived twice the keys would read [Valid ID, Valid ID] and this would be
    // 1/2 — the count is over the rendered list, so it cannot pass by matching
    // one node of two.
    expect(screen.getByText('1/1 complete (includes the program you selected)')).toBeTruthy();
  });

  it('leaves the count alone when the selected program is already recorded', () => {
    // The honesty wording is for a selection that is *not* on the record. Once
    // it is, "0/2 complete" is exactly right and the extra clause would be a
    // lie about a selection that no longer exists.
    renderRequirements([], {}, {
      programs: [MEDICAL],
      interventions: [{ id: 'iv-1', programId: 'med-1' }],
      extraProgramIds: ['med-1'],
    });

    expect(screen.queryByText(/includes the program you selected/)).toBeNull();
    expect(screen.getByText('0/2 complete')).toBeTruthy();
  });
});

describe('CaseRequirements — crisis-mode intervention documents', () => {
  beforeEach(() => {
    mockPatch.mockReset().mockResolvedValue({});
    mockDel.mockReset().mockResolvedValue({});
    mockMutate.mockReset().mockResolvedValue(undefined);
  });

  it('shows intervention-anchored documents for ad-hoc services in crisis mode', async () => {
    renderRequirements(DOCS, {}, {
      interventions: [{ id: 'i1', interventionType: 'medical_assistance' }],
      caseData: { crisisMode: true },
    });
    expect(await screen.findByText('medical_certificate')).toBeTruthy();
  });

  it('does not show intervention documents when crisis mode is off', async () => {
    renderRequirements(DOCS, {}, {
      interventions: [{ id: 'i1', interventionType: 'medical_assistance' }],
      caseData: { crisisMode: false },
    });
    await waitFor(() => expect(screen.queryByText('medical_certificate')).toBeNull());
  });

  it('still shows program documents for enrolled services in crisis mode', async () => {
    renderRequirements(DOCS, { 'Valid ID': true }, {
      interventions: [{ id: 'i1', programId: 'p1' }, { id: 'i2', interventionType: 'medical_assistance' }],
      caseData: { crisisMode: true },
    });
    expect(await screen.findByText('Valid ID')).toBeTruthy();
    expect(await screen.findByText('medical_certificate')).toBeTruthy();
  });
});
