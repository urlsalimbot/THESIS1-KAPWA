import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  addDays,
  localIsoDay,
  manilaDay,
  expandRepeat,
  BLOCK_COLORS,
  BLOCK_COLOR_FALLBACK,
  BLOCK_TYPE_LABEL_KEYS,
} from './team-utils';
import type { TeamBlock, TeamEvent, TeamStaffAchievement } from '../../lib/team-api';
import { formatDate } from '../../lib/format';

export interface AgendaViewProps {
  blocks: TeamBlock[];
  events: TeamEvent[];
  staff: TeamStaffAchievement[];
  from: Date; // anchor: the month whose 6-week window this agenda covers
}

/** Monday on or before `date` — same Monday-first window as MonthView. */
function mondayOnOrBefore(date: Date): Date {
  return addDays(date, -((date.getDay() + 6) % 7));
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
 * Chronological list of blocks + events covering the 6-week month grid that
 * MonthView renders (Monday-first, anchored on the month containing `from`).
 * Repeating weekly events are expanded so every instance in the window gets
 * its own row. Groups by day, ascending, all-day entries first.
 */
export function AgendaView({ blocks, events, staff, from }: AgendaViewProps) {
  const { t } = useTranslation();
  const nameByUserId = useMemo(
    () => new Map(staff.map(member => [member.userId, member.name])),
    [staff],
  );

  const window = useMemo(() => {
    const monthStart = new Date(from.getFullYear(), from.getMonth(), 1);
    const gridStart = mondayOnOrBefore(monthStart);
    return {
      from: localIsoDay(gridStart),
      to: localIsoDay(addDays(gridStart, 41)),
    };
  }, [from]);

  const rows: AgendaRow[] = useMemo(() => {
    const out: AgendaRow[] = [];
    for (const block of blocks) {
      // Data arrives window-scoped from the page; keep the filter defensive
      // so the view never leaks entries outside its own range.
      if (block.blockDate < window.from || block.blockDate > window.to) continue;
      const typeKey = BLOCK_TYPE_LABEL_KEYS[block.blockType] ?? block.blockType;
      const typeLabel = t(typeKey, typeKey);
      out.push({
        date: block.blockDate,
        time: block.startTime ?? '00:00',
        kind: 'block',
        title: nameByUserId.get(block.userId) ?? t('team.week.staff'),
        detail:
          block.startTime && block.endTime
            ? t('team.agenda.blockDetailTimed', {
                type: typeLabel,
                start: block.startTime,
                end: block.endTime,
              })
            : t('team.agenda.blockDetailAllDay', { type: typeLabel }),
        colorClass: BLOCK_COLORS[block.blockType] ?? BLOCK_COLOR_FALLBACK,
      });
    }
    for (const event of events) {
      // One row per repeat instance within the window (one-shot events yield
      // their single base occurrence when it falls inside; an occurrence that
      // started before the window but spans into it is clamped to the first
      // in-window day — spec edge #3).
      for (const instance of expandRepeat(event, window.from, window.to)) {
        const start = instance.startsAt;
        const end = instance.endsAt;
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
        const time = start.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
        const rawDay = manilaDay(start);
        out.push({
          date: rawDay < window.from ? window.from : rawDay,
          time: start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
          kind: 'event',
          title: event.title,
          detail: `${time} – ${end.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          })}${event.location ? ` · ${event.location}` : ''}`,
          colorClass: 'bg-indigo-200/70 border-indigo-500 text-indigo-900',
        });
      }
    }
    out.sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)));
    return out;
  }, [blocks, events, nameByUserId, window, t]);

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
        <p className="py-10 text-center text-sm text-muted-foreground">
          {t('team.agenda.nothingScheduled')}
        </p>
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