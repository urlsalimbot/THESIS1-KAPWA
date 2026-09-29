import { useEffect, useRef } from 'react';
import { mutate } from 'swr';
import { connectNotificationSocket } from '../lib/notification-socket';
import { queryKeys } from '../lib/query-keys';
import type { TeamStatus, TeamVisibleTo } from '../lib/team-api';

/** Payload of the gateway's `team.status.updated` broadcast — mirrors
 *  NotificationsGateway.broadcastTeamStatus in kapwa-server. `visibleTo` and
 *  `barangay` are sent by the server so coordinator viewers can scope their
 *  live board to toggled rows from their own barangay. */
export interface TeamStatusEvent {
  userId: string;
  status: string;
  note?: string | null;
  updatedAt: string;
  visibleTo?: TeamVisibleTo;
  barangay?: string | null;
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
export function useTeamStatus(
  myUserId?: string,
  viewerRole?: string,
  viewerBarangay?: string | null,
): void {
  const myUserIdRef = useRef(myUserId);
  myUserIdRef.current = myUserId;
  // Viewer scope travels in refs like myUserId so the effect still subscribes
  // exactly once; the merge filter reads the freshest role/barangay.
  const viewerRoleRef = useRef(viewerRole);
  viewerRoleRef.current = viewerRole;
  const viewerBarangayRef = useRef(viewerBarangay);
  viewerBarangayRef.current = viewerBarangay;

  useEffect(() => {
    const token = localStorage.getItem('kapwa_token');
    if (!token) return;

    const sock = connectNotificationSocket(token);
    const onStatusUpdated = (payload: TeamStatusEvent) => {
      // Coordinator live board (amendment fix): mirror the server's
      // listStatuses filter — only rows the owner toggled to
      // `team_coordinators` and, when the coordinator has an assigned
      // barangay, only rows from their own barangay. A coordinator with no
      // assigned barangay keeps every toggled row (the server never sends
      // them an unfiltered board; don't drop toggled rows either).
      const isCoordinator = viewerRoleRef.current === 'coordinator';
      if (
        isCoordinator &&
        (payload.visibleTo !== 'team_coordinators' ||
          (viewerBarangayRef.current != null && payload.barangay !== viewerBarangayRef.current))
      ) {
        return; // not meant for this viewer — leave the board untouched
      }
      const row: TeamStatus = {
        userId: payload.userId,
        status: payload.status,
        note: payload.note ?? null,
        visibleTo: payload.visibleTo ?? 'team',
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