import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RequirementFileUpload, type FilingDoc } from './RequirementFileUpload';
import { api } from '@/lib/api';

const { mockUpload, mockDel } = vi.hoisted(() => ({
  mockUpload: vi.fn(),
  mockDel: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: { del: (...a: unknown[]) => mockDel(...a) },
  uploadWithProgress: (...args: unknown[]) => mockUpload(...args),
  downloadFilingDoc: vi.fn().mockResolvedValue(undefined),
  getFilingObjectUrl: vi.fn().mockResolvedValue('blob:mock'),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const docs: FilingDoc[] = [
  { id: 'd1', originalName: 'scan.png', fileSize: 2048, mimeType: 'image/png' },
  { id: 'd2', originalName: 'report.pdf', fileSize: 102400, mimeType: 'application/pdf' },
];

function renderUpload() {
  const onChanged = vi.fn();
  const utils = render(
    <RequirementFileUpload caseId="c1" requirementKey="req1" docs={docs} onChanged={onChanged} />,
  );
  return { ...utils, onChanged };
}

describe('RequirementFileUpload', () => {
  beforeEach(() => {
    mockUpload.mockReset();
    mockDel.mockReset();
    mockUpload.mockResolvedValue({ id: 'new' });
    mockDel.mockResolvedValue({});
  });

  it('renders existing docs with names and size', () => {
    renderUpload();
    expect(screen.getByText('scan.png')).toBeTruthy();
    expect(screen.getByText('report.pdf')).toBeTruthy();
    expect(screen.getByText('2 KB')).toBeTruthy();
    expect(screen.getByText('100 KB')).toBeTruthy();
  });

  it('uploads a file with the correct form data', async () => {
    const { onChanged } = renderUpload();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'receipt.pdf', { type: 'application/pdf' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    fireEvent.change(input);

    expect(mockUpload).toHaveBeenCalledTimes(1);
    const [path, form, onProgress] = mockUpload.mock.calls[0];
    expect(path).toBe('/filing/upload');
    expect(form.get('caseId')).toBe('c1');
    expect(form.get('requirementKey')).toBe('req1');
    expect(form.get('file') instanceof File).toBe(true);
    expect(typeof onProgress).toBe('function');
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('rejects an oversized file and does not upload', async () => {
    const { onChanged } = renderUpload();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const big = new File([new Uint8Array(11 * 1024 * 1024)], 'big.pdf', { type: 'application/pdf' });
    Object.defineProperty(input, 'files', { value: [big], configurable: true });
    fireEvent.change(input);

    expect(mockUpload).not.toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('confirming remove deletes the document', async () => {
    const { onChanged } = renderUpload();
    fireEvent.click(screen.getAllByLabelText('Remove')[0]);
    fireEvent.click(await screen.findByText('Remove'));
    expect(mockDel).toHaveBeenCalledWith(['filing', 'd1']);
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });
});