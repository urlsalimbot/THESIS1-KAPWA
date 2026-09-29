import {
  Avatar,
  AvatarFallback,
} from '@/components/ui/avatar';
import { STATUS_COLORS, STATUS_COLOR_FALLBACK, STATUS_LABELS } from './team-utils';
import type { TeamStatus, TeamStaffAchievement } from '../../lib/team-api';

export interface StaffViewProps {
  staff: TeamStaffAchievement[];
  statuses: TeamStatus[];
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * Per-staff cards: avatar, name, live status chip + note. The achievements
 * panel per staff lands in Task 14 — this is the roster scaffold.
 */
export function StaffView({ staff, statuses }: StaffViewProps) {
  const statusByUser = new Map(statuses.map(s => [s.userId, s]));

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {staff.length === 0 && (
        <p className="col-span-full py-8 text-center text-sm text-muted-foreground">No staff to show.</p>
      )}
      {staff.map(member => {
        const status = statusByUser.get(member.userId);
        return (
          <div key={member.userId} className="flex items-center gap-3 rounded-lg border bg-background p-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="text-xs font-medium bg-muted text-foreground">
                {initials(member.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{member.name}</p>
              {status ? (
                <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      STATUS_COLORS[status.status] ?? STATUS_COLOR_FALLBACK
                    }`}
                  />
                  <span className="truncate">
                    {STATUS_LABELS[status.status] ?? status.status}
                    {status.note ? ` — ${status.note}` : ''}
                  </span>
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">No status set</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}