import { useEffect, useRef } from 'react';
import { mutate } from 'swr';
import { connectNotificationSocket } from '../lib/notification-socket';
import { queryKeys } from '../lib/query-keys';
import type { TeamStatus } from '../lib/team-api';

/** Payload of the gateway's `team.status.updated` broadcast — mirrors
 *  NotificationsGateway.broadcastTeamStatus in kapwa-server. */
export interface TeamStatusEvent {
  userId: string;
  status: string;
  note?: string | null;
  updatedAt: string;
}

/**
 * Live whereabouts subscription.
 *
 * The server-side `team` room join happens on the SAME '/notifications'
 * namespace the notification socket connects to (kapwa-server's
 * NotificationsGateway.handleConnection joins every staff-role socket to the
 * 'team' room there), so this hook reuses connectNotificationSocket instead
 * of opening a second namespace — a socket on any other namespace would never
 * receive the broadcast.
 *
 * Subscribes ONCE per mount (the signed-in user is read through a ref so the
 * effect never re-subscribes). On each `team.status.updated` event it:
 *   1. replaces the updated user's row in queryKeys.team.statuses() (no
 *      revalidation — the broadcast IS the freshest server state), and
 *   2. revalidates queryKeys.team.status() when the event is about the
 *      signed-in user, so the "my status" read (putStatus round-trip) stays in
 *      sync with the live board.
 */
export function useTeamStatus(myUserId?: string): void {
  const myUserIdRef = useRef(myUserId);
  myUserIdRef.current = myUserId;

  useEffect(() => {
    const token = localStorage.getItem('kapwa_token');
    if (!token) return;

    const sock = connectNotificationSocket(token);
    const onStatusUpdated = (payload: TeamStatusEvent) => {
      // The gateway broadcast omits visibleTo, so the optimistic board row
      // defaults to team-wide; the board chips do not render visibility, and
      // coordinator filtering is server-side (a coordinator still sees the
      // row only if the server sent it to them at all).
      const row: TeamStatus = {
        userId: payload.userId,
        status: payload.status,
        note: payload.note ?? null,
        visibleTo: 'team',
        updatedAt: payload.updatedAt,
      };
      mutate(
        queryKeys.team.statuses(),
        (current: TeamStatus[] | undefined) =>
          [...(current ?? []).filter(s => s.userId !== row.userId), row],
        false,
      );
      if (myUserIdRef.current && row.userId === myUserIdRef.current) {
        mutate(queryKeys.team.status(), undefined, { revalidate: true });
      }
    };

    sock.on('team.status.updated', onStatusUpdated);
    return () => {
      sock.off('team.status.updated', onStatusUpdated);
    };
  }, []);
}