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

function renderRequirements(docs: unknown[] = DOCS) {
  mockSWR.mockImplementation((key: unknown) => {
    const root = Array.isArray(key) ? key[0] : key;
    if (root === 'cases') return { data: INTERVENTIONS };
    if (root === 'programs') return { data: PROGRAMS };
    if (root === 'filing') return { data: docs };
    return { data: undefined };
  });
  return render(
    <CaseRequirements caseId="c1" caseData={{ requirementsChecklist: {} }} userRole="social_worker" />,
  );
}

describe('CaseRequirements — one row per uploaded document', () => {
  beforeEach(() => {
    mockPatch.mockReset().mockResolvedValue({});
    mockDel.mockReset().mockResolvedValue({});
    mockMutate.mockReset().mockResolvedValue(undefined);
  });

  it('shows each uploaded file once, with its size and its on-site status', () => {
    renderRequirements();
    expect(screen.getAllByText('valid-id.pdf')).toHaveLength(1);
    expect(screen.getByText('12 KB')).toBeTruthy();
    expect(screen.getByText('Pending on-site')).toBeTruthy();
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

  it('verifies an upload on-site straight from the file row', async () => {
    const user = userEvent.setup();
    renderRequirements();
    await user.click(screen.getByText('Verify on-site'));
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/filing/d1/verify', { verified: true }));
  });

  it('shows a verified badge instead of pending once the worker confirms it', () => {
    renderRequirements([{ ...DOCS[0], verifiedAt: '2026-09-28T08:00:00.000Z' }]);
    expect(screen.getByText('Verified on-site')).toBeTruthy();
    expect(screen.queryByText('Pending on-site')).toBeNull();
    expect(screen.getByText('Undo')).toBeTruthy();
  });
});
