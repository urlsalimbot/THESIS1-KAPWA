import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import useSWR, { SWRConfig, mutate } from 'swr';
import { useTeamStatus } from './useTeamStatus';
import { queryKeys } from '../lib/query-keys';
import type { TeamStatus } from '../lib/team-api';

// Fake socket: capture every registered handler keyed by event name so tests
// can drive the gateway broadcast, exactly like NotificationsPage.test mocks
// connectNotificationSocket.
const { listeners, connectMock } = vi.hoisted(() => {
  const listeners = new Map<string, (payload: unknown) => void>();
  return {
    listeners,
    connectMock: vi.fn(() => ({
      on: (event: string, cb: (payload: unknown) => void) => {
        listeners.set(event, cb);
      },
      off: vi.fn(),
    })),
  };
});

vi.mock('../lib/notification-socket', () => ({
  connectNotificationSocket: connectMock,
  disconnectNotificationSocket: vi.fn(),
}));

const STATUS_KEY = '["team","status"]';
let ownStatusFetches = 0;

// NOTE: the wrapper deliberately does NOT set a custom `provider` — the hook's
// `mutate` comes from the top-level 'swr' module and writes the DEFAULT cache,
// so the probe's useSWR must read that same cache (a `provider: () => new
// Map()` would split them and broadcasts would never arrive).
const fetcher = vi.fn((key: unknown) => {
  if (JSON.stringify(key) === STATUS_KEY) {
    ownStatusFetches += 1;
    return { userId: 'me', status: 'in_office', note: null, updatedAt: '2026-09-28T01:00:00.000Z' };
  }
  return [] as TeamStatus[];
});

function wrapper({ children }: { children: React.ReactNode }) {
  return <SWRConfig value={{ fetcher, dedupingInterval: 0 }}>{children}</SWRConfig>;
}

function emit(payload: {
  userId: string;
  status: string;
  note?: string | null;
  updatedAt: string;
  visibleTo?: string;
  barangay?: string | null;
}) {
  act(() => {
    listeners.get('team.status.updated')?.(payload);
  });
}

describe('useTeamStatus', () => {
  beforeEach(async () => {
    listeners.clear();
    connectMock.mockClear();
    fetcher.mockClear();
    ownStatusFetches = 0;
    localStorage.setItem('kapwa_token', 'test-token');
    // Default-cache hygiene: drop any rows a previous test in this file wrote.
    await mutate(() => true, undefined, { revalidate: false });
  });

  it('updates the statuses cache with the broadcast row (replacing the user’s previous entry)', async () => {
    const { result } = renderHook(
      () => {
        useTeamStatus('me');
        return useSWR<TeamStatus[]>(queryKeys.team.statuses());
      },
      { wrapper },
    );
    // Settle the mount fetch so it cannot clobber the broadcast write.
    await waitFor(() => expect(result.current.data).toEqual([]));

    emit({
      userId: 'u1',
      status: 'field_day',
      note: 'Bgy. Bigte FDS',
      updatedAt: '2026-09-28T02:00:00.000Z',
    });
    expect(result.current.data).toEqual([
      {
        userId: 'u1',
        status: 'field_day',
        note: 'Bgy. Bigte FDS',
        visibleTo: 'team', // broadcast omits visibility → default team-wide
        updatedAt: '2026-09-28T02:00:00.000Z',
      },
    ]);

    // A second broadcast for the same user replaces, never duplicates.
    emit({ userId: 'u1', status: 'in_office', note: null, updatedAt: '2026-09-28T03:00:00.000Z' });
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0]).toEqual({
      userId: 'u1',
      status: 'in_office',
      note: null,
      visibleTo: 'team',
      updatedAt: '2026-09-28T03:00:00.000Z',
    });
  });

  it('keeps unrelated users’ rows when merging a broadcast', async () => {
    const { result } = renderHook(
      () => {
        useTeamStatus('me');
        return useSWR<TeamStatus[]>(queryKeys.team.statuses());
      },
      { wrapper },
    );
    await waitFor(() => expect(result.current.data).toEqual([]));

    emit({ userId: 'u1', status: 'remote', note: null, updatedAt: '2026-09-28T01:00:00.000Z' });
    emit({ userId: 'u2', status: 'on_leave', note: null, updatedAt: '2026-09-28T04:00:00.000Z' });

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.map(s => s.userId).sort()).toEqual(['u1', 'u2']);
  });

  it('coordinator drops team-only rows and out-of-barangay rows; keeps toggled + in-barangay', async () => {
    const { result } = renderHook(
      () => {
        useTeamStatus('me', 'coordinator', 'Bigte');
        return useSWR<TeamStatus[]>(queryKeys.team.statuses());
      },
      { wrapper },
    );
    await waitFor(() => expect(result.current.data).toEqual([]));

    // Team-only row (not toggled to coordinators) → dropped.
    emit({ userId: 'u1', status: 'in_office', visibleTo: 'team', barangay: 'Bigte', updatedAt: '2026-09-28T01:00:00.000Z' });
    // Toggled row but from another barangay → dropped.
    emit({ userId: 'u2', status: 'home_visit', visibleTo: 'team_coordinators', barangay: 'Kalayaan', updatedAt: '2026-09-28T02:00:00.000Z' });
    expect(result.current.data).toEqual([]);

    // Toggled + in-barangay → merged.
    emit({ userId: 'u3', status: 'remote', note: 'FDS Bigte', visibleTo: 'team_coordinators', barangay: 'Bigte', updatedAt: '2026-09-28T03:00:00.000Z' });
    expect(result.current.data).toEqual([
      {
        userId: 'u3',
        status: 'remote',
        note: 'FDS Bigte',
        visibleTo: 'team_coordinators',
        updatedAt: '2026-09-28T03:00:00.000Z',
      },
    ]);
  });

  it('coordinator without an assigned barangay keeps every toggled row', async () => {
    const { result } = renderHook(
      () => {
        useTeamStatus('me', 'coordinator', null);
        return useSWR<TeamStatus[]>(queryKeys.team.statuses());
      },
      { wrapper },
    );
    await waitFor(() => expect(result.current.data).toEqual([]));

    // Toggled rows merge regardless of the owner's barangay; team-only still dropped.
    emit({ userId: 'u1', status: 'field_day', visibleTo: 'team', barangay: 'Bigte', updatedAt: '2026-09-28T01:00:00.000Z' });
    emit({ userId: 'u2', status: 'on_leave', visibleTo: 'team_coordinators', barangay: 'Kalayaan', updatedAt: '2026-09-28T02:00:00.000Z' });

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0]).toEqual(
      expect.objectContaining({ userId: 'u2', visibleTo: 'team_coordinators' }),
    );
  });

  it('non-coordinator viewers merge rows regardless of visibility or barangay', async () => {
    const { result } = renderHook(
      () => {
        useTeamStatus('me', 'social_worker', undefined);
        return useSWR<TeamStatus[]>(queryKeys.team.statuses());
      },
      { wrapper },
    );
    await waitFor(() => expect(result.current.data).toEqual([]));

    emit({ userId: 'u1', status: 'in_office', visibleTo: 'team_coordinators', barangay: 'Bigte', updatedAt: '2026-09-28T01:00:00.000Z' });
    expect(result.current.data).toEqual([
      {
        userId: 'u1',
        status: 'in_office',
        note: null,
        visibleTo: 'team_coordinators',
        updatedAt: '2026-09-28T01:00:00.000Z',
      },
    ]);
  });

  it('revalidates own status only when the event targets the signed-in user', async () => {
    // A mounted (non-fetching) subscriber for the own-status key gives the
    // hook's `mutate(key, undefined, { revalidate: true })` a config context
    // so the revalidation actually runs the wrapper fetcher.
    const { result } = renderHook(
      () => {
        useTeamStatus('u1');
        return useSWR<TeamStatus | null>(queryKeys.team.status(), { revalidateOnMount: false });
      },
      { wrapper },
    );

    // Someone else updates → own status untouched, cache stays empty.
    emit({ userId: 'u2', status: 'remote', note: null, updatedAt: '2026-09-28T01:00:00.000Z' });
    await new Promise(r => setTimeout(r, 20));
    expect(ownStatusFetches).toBe(0);
    expect(result.current.data).toBeUndefined();

    // The signed-in user updates → own status revalidated through the fetcher
    // (the GET /team/status mock returns its own row, proving the round-trip).
    emit({ userId: 'u1', status: 'home_visit', note: null, updatedAt: '2026-09-28T02:00:00.000Z' });
    await waitFor(() => expect(ownStatusFetches).toBe(1));
    await waitFor(() => expect(result.current.data?.status).toBe('in_office'));
  });

  it('subscribes exactly once to team.status.updated, even across re-renders', () => {
    const { rerender } = renderHook(({ me }: { me?: string }) => useTeamStatus(me), {
      wrapper,
      initialProps: { me: 'u1' },
    });

    emit({ userId: 'u1', status: 'in_office', note: null, updatedAt: '2026-09-28T01:00:00.000Z' });

    // A different myUserId on the next render must not re-subscribe.
    rerender({ me: 'u2' });
    emit({ userId: 'u1', status: 'offline', note: null, updatedAt: '2026-09-28T02:00:00.000Z' });

    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(listeners.size).toBe(1);
    expect(listeners.has('team.status.updated')).toBe(true);
  });

  it('does not connect when no token is stored', () => {
    localStorage.removeItem('kapwa_token');
    renderHook(() => useTeamStatus('me'), { wrapper });
    expect(connectMock).not.toHaveBeenCalled();
  });
});