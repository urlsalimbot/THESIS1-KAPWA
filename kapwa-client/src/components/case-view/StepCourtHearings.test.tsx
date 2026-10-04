import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SWRConfig } from 'swr';
import { StepCourtHearings } from './StepCourtHearings';

const { mockApiGet, mockApiPost, mockApiPatch, mockApiDel } = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
  mockApiPatch: vi.fn(),
  mockApiDel: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: {
    get: (...a: unknown[]) => mockApiGet(...a),
    post: (...a: unknown[]) => mockApiPost(...a),
    patch: (...a: unknown[]) => mockApiPatch(...a),
    del: (...a: unknown[]) => mockApiDel(...a),
  },
}));

const HEARING = {
  id: 'e1',
  caseId: 'c1',
  eventType: 'court_hearing',
  attended: true,
  title: 'Initial hearing',
  venue: 'RTC Bulacan',
  eventDate: '2026-10-20',
  startTime: '09:00',
  status: 'planned',
};

function renderStep(
  events: unknown[] = [],
  opts: { readOnly?: boolean; userRole?: string } = {},
) {
  mockApiGet.mockImplementation((key: unknown) => {
    const k = JSON.stringify(key);
    if (k.includes('events')) return Promise.resolve(events);
    return Promise.resolve(null);
  });
  return render(
    <SWRConfig value={{ fetcher: mockApiGet, provider: () => new Map(), dedupingInterval: 0 }}>
      <StepCourtHearings
        caseId="c1"
        caseData={{ id: 'c1', status: 'enrolled' }}
        userRole={opts.userRole ?? 'social_worker'}
        readOnly={opts.readOnly}
        stepLock={null}
      />
    </SWRConfig>,
  );
}

describe('StepCourtHearings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiPost.mockResolvedValue({});
    mockApiPatch.mockResolvedValue({});
    mockApiDel.mockResolvedValue({});
  });

  it('renders recorded hearings with date, venue and attending state', async () => {
    renderStep([HEARING]);
    expect(await screen.findByText('Initial hearing')).toBeTruthy();
    expect(screen.getByText(/RTC Bulacan/)).toBeTruthy();
    expect(screen.getByText(/Attending/)).toBeTruthy();
  });

  it('creates an attended hearing and posts it to the case events route', async () => {
    const user = userEvent.setup();
    renderStep([]);
    await user.click(await screen.findByRole('button', { name: /Add Hearing/ }));
    // A `type=date` input is set with fireEvent.change: typing into it clears
    // the value, which would make the form's own required-date guard no-op.
    fireEvent.change(await screen.findByLabelText(/Date/), { target: { value: '2026-11-02' } });
    await user.click(screen.getByRole('button', { name: /Save Hearing/ }));
    await waitFor(() => expect(mockApiPost).toHaveBeenCalledWith(
      '/cases/c1/events',
      expect.objectContaining({ eventType: 'court_hearing', eventDate: '2026-11-02' }),
    ));
  });

  it('marks a planned hearing done with a status patch', async () => {
    const user = userEvent.setup();
    renderStep([HEARING]);
    await user.click(await screen.findByRole('button', { name: /Mark Done/ }));
    await waitFor(() => expect(mockApiPatch).toHaveBeenCalledWith(
      '/cases/c1/events/e1', expect.objectContaining({ status: 'done' }),
    ));
  });

  it('hides the add form when read-only', async () => {
    renderStep([HEARING], { readOnly: true });
    await screen.findByText('Initial hearing');
    expect(screen.queryByRole('button', { name: /Add Hearing/ })).toBeNull();
  });
});