import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SWRConfig, mutate } from 'swr';
import { RemarksHistoryCard } from './RemarksHistoryCard';

const { mockApiGet, mockApiPost } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
}));

vi.mock('../../lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
  },
}));

function renderWithSWR(ui: React.ReactNode) {
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, dedupingInterval: 0 }}>{ui}</SWRConfig>,
  );
}

const REMARKS = {
  data: [
    {
      id: 'r1', kind: 'decision', remark: 'Same person as NORZ-2026-0001.',
      source: 'Batch 1.xlsx', authorName: 'Juan Dela Cruz', createdAt: '2026-10-01T02:30:00Z',
    },
    {
      id: 'r2', kind: 'manual', remark: 'Client called to reschedule.',
      authorName: null, createdAt: '2026-10-02T02:30:00Z',
    },
  ],
  total: 2, page: 1, limit: 50,
};

describe('RemarksHistoryCard', () => {
  beforeEach(async () => {
    mockApiGet.mockReset();
    mockApiPost.mockReset();
    mockApiGet.mockResolvedValue(REMARKS);
    await mutate(() => true, undefined, { revalidate: false });
  });

  it('renders the remark timeline with kind badges, source, author and date', async () => {
    renderWithSWR(<RemarksHistoryCard beneficiaryId="ben-1" />);
    expect(await screen.findByText('Decision')).toBeTruthy();
    expect(screen.getByText('Remark')).toBeTruthy();
    expect(screen.getByText('Same person as NORZ-2026-0001.')).toBeTruthy();
    expect(screen.getByText(/Batch 1\.xlsx · Juan Dela Cruz/)).toBeTruthy();
    expect(screen.getByText(/Oct 1, 2026/)).toBeTruthy();
    expect(screen.getByText('System')).toBeTruthy();
  });

  it('disables saving an empty remark and prepends the posted one', async () => {
    mockApiPost.mockResolvedValue({
      id: 'r3', kind: 'manual', remark: 'Follow-up scheduled.',
      authorName: 'Juan Dela Cruz', createdAt: '2026-10-03T02:30:00Z',
    });
    renderWithSWR(<RemarksHistoryCard beneficiaryId="ben-1" />);

    const save = screen.getByRole('button', { name: /add remark/i }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);

    await userEvent.type(screen.getByLabelText(/new remark/i), 'Follow-up scheduled.');
    expect(save.disabled).toBe(false);
    await userEvent.click(save);

    expect(mockApiPost).toHaveBeenCalledWith('/beneficiaries/ben-1/remarks', {
      remark: 'Follow-up scheduled.',
    });
    expect(await screen.findByText('Follow-up scheduled.')).toBeTruthy();
    const items = screen.getAllByRole('listitem');
    expect(items[0].textContent).toContain('Follow-up scheduled.');
  });
});
