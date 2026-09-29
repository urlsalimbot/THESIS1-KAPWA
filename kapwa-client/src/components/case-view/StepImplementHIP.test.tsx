import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import useSWR, { SWRConfig } from 'swr';
import { StepImplementHIP } from './StepImplementHIP';

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

  it('keeps the Submit-for-Review affordance visible even when the step is readOnly (interventions already logged)', async () => {
    // F10: once an intervention is logged, stepDone[1] flips true => StepImplementHIP
    // becomes readOnly. The assessed->in_review submit affordance must still render,
    // otherwise the worker is locked out of FSM progression after logging a delivery.
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
    expect(screen.getByRole('button', { name: /Submit for Review/i })).toBeTruthy();
  });

  it('revalidates the case detail (and not just interventions) after submit-for-review', async () => {
    // Regression: the panel's bound mutate only targets its own interventions
    // key — the old code passed the detail key to it, which SWR treats as the
    // *data* argument, so the page's header status badge stayed "Assessed"
    // until a full reload. The probe below stands in for CaseViewPage's detail
    // subscription (revalidation only fires when a hook listens on the key).
    mockApiGet.mockImplementation(async (key: unknown) => {
      const k = JSON.stringify(key);
      if (k.includes('interventions')) {
        return [{ id: 'iv-1', caseId: 'case-1', serviceName: 'Medical Assistance', amount: 500 }];
      }
      if (k.includes('programs')) return [];
      return [];
    });

    function DetailProbe() {
      useSWR(['cases', 'case-1']);
      return null;
    }

    render(
      <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0, provider: () => new Map() }}>
        <StepImplementHIP caseId="case-1" caseData={caseData} userRole="social_worker" readOnly />
        <DetailProbe />
      </SWRConfig>,
    );
    expect(await screen.findByText(/Interventions recorded/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Submit for Review/i }));

    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith('/cases/case-1/status', { status: 'in_review' }));
    // The case detail key — the one the CaseViewPage header badge reads —
    // must be re-fetched after the transition (initial probe fetch + the
    // post-submit revalidation).
    await waitFor(() => {
      const detailFetches = mockApiGet.mock.calls.filter((c) => JSON.stringify(c[0]) === JSON.stringify(['cases', 'case-1']));
      expect(detailFetches.length).toBeGreaterThanOrEqual(2);
    });
  });
});
