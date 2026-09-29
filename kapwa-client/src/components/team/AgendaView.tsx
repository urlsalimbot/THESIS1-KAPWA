import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  addDays,
  localIsoDay,
  manilaDay,
  blockDayRange,
  expandRepeat,
  staffInitials,
  BLOCK_COLORS,
  BLOCK_COLOR_FALLBACK,
  BLOCK_TYPE_LABEL_KEYS,
  WEEKDAY_LABEL_KEYS,
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

/** WEEKDAY_LABEL_KEYS index (Monday-first) for a YYYY-MM-DD calendar day. */
function weekdayKey(day: string): (typeof WEEKDAY_LABEL_KEYS)[number] {
  const [y, m, d] = day.split('-').map(Number);
  return WEEKDAY_LABEL_KEYS[(new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7];
}

interface AgendaRow {
  /** Stable key — sequence number across the window (blocks + events merged). */
  seq: number;
  date: string; // YYYY-MM-DD
  time: string; // sort key ('00:00' for all-day)
  kind: 'block' | 'event';
  block?: TeamBlock;
  event?: TeamEvent;
  /** Blocks: resolved staff name; events: the event title. */
  title: string;
  /** Blocks: localized type label; events: empty. */
  typeLabel: string;
  /** Blocks: `startTime–endTime` or localized "All day"; events: empty. */
  timeLabel: string;
  /** Blocks: the staff avatar initials (from the resolved name). */
  initials: string;
  note?: string | null;
  /** Events: "9:00 AM – 10:00 AM · location" detail. */
  detail?: string;
  colorClass: string;
  /** 0-based position of this day inside a multi-day block's range. */
  dayIndex: number;
  /** Total covered days of a multi-day block (1 for single-day). */
  dayCount: number;
}

/**
 * Chronological list of blocks + events covering the 6-week month grid that
 * MonthView renders (Monday-first, anchored on the month containing `from`).
 * Repeating weekly events are expanded so every instance in the window gets
 * its own row. Groups by day, ascending, all-day entries first.
 *
 * De-bused layout for scannability: one compact line per entry (time column,
 * staff initials avatar, name, type dot + label, note) with no per-row
 * borders — only the day header's bottom border. A multi-day block renders
 * its full row on the first covered day and dimmed "↳ Type · Day n/total"
 * continuation rows on the days after; events get an indigo left strip
 * instead of the dot.
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
    let seq = 0;
    for (const block of blocks) {
      // Data arrives window-scoped from the page; keep the filter defensive
      // so the view never leaks entries outside its own range.
      const days = blockDayRange(block);
      for (let i = 0; i < days.length; i += 1) {
        const day = days[i];
        if (day < window.from || day > window.to) continue;
        const typeKey = BLOCK_TYPE_LABEL_KEYS[block.blockType] ?? block.blockType;
        const typeLabel = t(typeKey, typeKey);
        const name = nameByUserId.get(block.userId) ?? t('team.week.staff');
        out.push({
          seq: seq++,
          date: day,
          time: block.startTime ?? '00:00',
          kind: 'block',
          block,
          title: name,
          typeLabel,
          timeLabel:
            block.startTime && block.endTime
              ? `${block.startTime}–${block.endTime}`
              : t('team.week.allDay'),
          initials: staffInitials(name),
          note: block.note,
          colorClass: BLOCK_COLORS[block.blockType] ?? BLOCK_COLOR_FALLBACK,
          dayIndex: i,
          dayCount: days.length,
        });
      }
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
        // Both the rendered time and the 24h sort key must be pinned to
        // Asia/Manila: `manilaDay` files the row under the office's calendar
        // day, so an unpinned (host-local) clock would label and order the row
        // by a different day than the one it is displayed under.
        const time = start.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
          timeZone: 'Asia/Manila',
        });
        const rawDay = manilaDay(start);
        out.push({
          seq: seq++,
          date: rawDay < window.from ? window.from : rawDay,
          time: start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Manila' }),
          kind: 'event',
          event,
          title: event.title,
          typeLabel: '',
          timeLabel: '',
          initials: '',
          detail: `${time} – ${end.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: 'Asia/Manila',
          })}${event.location ? ` · ${event.location}` : ''}`,
          colorClass: 'bg-indigo-200/70 border-indigo-500 text-indigo-900',
          dayIndex: 0,
          dayCount: 1,
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
            {`${t(weekdayKey(day))}, ${formatDate(day)} · ${t('team.agenda.entryCount', {
              count: dayRows.length,
            })}`}
          </div>
          <ul>
            {dayRows.map(row =>
              row.kind === 'event' ? (
                <li
                  key={`${row.date}-${row.seq}`}
                  className="flex items-center gap-2 border-l-2 border-indigo-500 py-1.5 pl-2 pr-3"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{row.title}</span>
                  <span className="truncate text-xs text-muted-foreground">{row.detail}</span>
                </li>
              ) : row.dayIndex > 0 ? (
                // Multi-day continuation: dimmed compact row, no avatar/time/note.
                <li
                  key={`${row.date}-${row.seq}`}
                  className="px-3 py-1.5 text-xs text-muted-foreground/70"
                >
                  {`↳ ${row.typeLabel} · ${t('team.multidayDay', { n: row.dayIndex + 1 })}/${row.dayCount}`}
                </li>
              ) : (
                <li key={`${row.date}-${row.seq}`} className="flex items-center gap-2 px-3 py-1.5">
                  <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    {row.timeLabel}
                  </span>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium text-muted-foreground">
                    {row.initials}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{row.title}</span>
                  <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        row.colorClass.split(' ')[0] ?? 'bg-muted'
                      }`}
                    />
                    {row.typeLabel}
                  </span>
                  {row.note ? (
                    <span className="max-w-[40%] truncate text-xs text-muted-foreground">{row.note}</span>
                  ) : null}
                </li>
              ),
            )}
          </ul>
        </div>
      ))}
    </div>
  );
}