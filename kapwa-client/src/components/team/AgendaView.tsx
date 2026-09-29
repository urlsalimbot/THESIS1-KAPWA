import { useMemo } from 'react';
import {
  manilaDay,
  BLOCK_COLORS,
  BLOCK_COLOR_FALLBACK,
  BLOCK_TYPE_LABELS,
} from './team-utils';
import type { TeamBlock, TeamEvent, TeamStaffAchievement } from '../../lib/team-api';
import { formatDate } from '../../lib/format';

export interface AgendaViewProps {
  blocks: TeamBlock[];
  events: TeamEvent[];
  staff: TeamStaffAchievement[];
}

interface AgendaRow {
  date: string; // YYYY-MM-DD
  time: string; // sort key ('00:00' for all-day)
  kind: 'block' | 'event';
  title: string;
  detail: string;
  colorClass: string;
}

/**
 * Chronological list of blocks + events, grouped by day, ascending.
 * NOTE: without a from/to range prop the events here are their base
 * occurrences only (no repeat expansion) — Task 12 adds real range +
 * expansion when the view gets its own date state.
 */
export function AgendaView({ blocks, events, staff }: AgendaViewProps) {
  const nameByUserId = useMemo(
    () => new Map(staff.map(member => [member.userId, member.name])),
    [staff],
  );

  const rows: AgendaRow[] = useMemo(() => {
    const out: AgendaRow[] = [];
    for (const block of blocks) {
      out.push({
        date: block.blockDate,
        time: block.startTime ?? '00:00',
        kind: 'block',
        title: `${nameByUserId.get(block.userId) ?? 'Staff'}`,
        detail:
          block.startTime && block.endTime
            ? `${BLOCK_TYPE_LABELS[block.blockType] ?? block.blockType} · ${block.startTime}–${block.endTime}`
            : `${BLOCK_TYPE_LABELS[block.blockType] ?? block.blockType} · All day`,
        colorClass: BLOCK_COLORS[block.blockType] ?? BLOCK_COLOR_FALLBACK,
      });
    }
    for (const event of events) {
      const start = new Date(event.startsAt);
      const end = new Date(event.endsAt);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
      const time = start.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
      out.push({
        date: manilaDay(start),
        time: start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
        kind: 'event',
        title: event.title,
        detail: `${time} – ${end.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        })}${event.location ? ` · ${event.location}` : ''}`,
        colorClass: 'border-indigo-400 bg-indigo-100/70 text-indigo-900',
      });
    }
    out.sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)));
    return out;
  }, [blocks, events, nameByUserId]);

  const byDay = useMemo(() => {
    const map = new Map<string, AgendaRow[]>();
    for (const row of rows) {
      const list = map.get(row.date);
      if (list) list.push(row);
      else map.set(row.date, [row]);
    }
    return map;
  }, [rows]);

  return (
    <div className="rounded-lg border bg-background">
      {rows.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">Nothing scheduled this week.</p>
      )}
      {Array.from(byDay.entries()).map(([day, dayRows]) => (
        <div key={day} className="border-b last:border-b-0">
          <div className="border-b bg-muted/30 px-3 py-1.5 text-xs font-bold text-muted-foreground">
            {formatDate(day)}
          </div>
          <ul>
            {dayRows.map((row, i) => (
              <li key={`${row.date}-${row.time}-${i}`} className="flex items-center gap-3 border-b px-3 py-2 last:border-b-0">
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                    row.colorClass.split(' ')[0] ?? 'bg-muted'
                  }`}
                />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{row.title}</span>
                <span className="truncate text-xs text-muted-foreground">{row.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}