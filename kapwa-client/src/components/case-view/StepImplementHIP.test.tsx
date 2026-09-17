import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { StepImplementHIP } from './StepImplementHIP';

const { mockApiGet, mockApiPost, mockUpload } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
  mockUpload: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    put: vi.fn(),
    patch: vi.fn(),
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
    mockUpload.mockReset();
    mockApiGet.mockResolvedValue([]);
    mockApiPost.mockResolvedValue({});
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

    // No programs available (empty), so the adhoc "Other Services" options render
    const programSelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(programSelect, { target: { value: 'adhoc:Medical Assistance' } });

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
});
