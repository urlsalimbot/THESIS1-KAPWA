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

function renderRequirements(docs: unknown[] = DOCS, checklist: Record<string, boolean> = {}) {
  mockSWR.mockImplementation((key: unknown) => {
    const root = Array.isArray(key) ? key[0] : key;
    if (root === 'cases') return { data: INTERVENTIONS };
    if (root === 'programs') return { data: PROGRAMS };
    if (root === 'filing') return { data: docs };
    return { data: undefined };
  });
  return render(
    <CaseRequirements caseId="c1" caseData={{ requirementsChecklist: checklist }} userRole="social_worker" />,
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
