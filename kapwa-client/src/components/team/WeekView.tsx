import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  addDays,
  localIsoDay,
  manilaDay,
  expandRepeat,
  toDate,
  DAY_MS,
  BLOCK_COLORS,
  BLOCK_COLOR_FALLBACK,
  BLOCK_TYPE_LABEL_KEYS,
  WEEKDAY_LABEL_KEYS,
} from './team-utils';
import { useMediaQuery } from '@/hooks/use-media-query';
import { formatDate } from '../../lib/format';
import { YouBadge } from './YouBadge';
import type { TeamBlock, TeamEvent, TeamStaffAchievement } from '../../lib/team-api';

export interface WeekViewProps {
  blocks: TeamBlock[];
  events: TeamEvent[];
  from: Date; // Monday of the displayed week (local)
  staff: TeamStaffAchievement[];
  /** Signed-in user's id — their row is pinned first and carries the You badge. */
  myUserId?: string;
  /** Read-only mode (coordinators): disables slot/block click affordances. */
  readOnly?: boolean;
  onSlotClick: (staffId: string, date: string) => void;
  onBlockClick: (block: TeamBlock) => void;
  /** Click-to-edit: event chips become buttons calling back with the event. */
  onEventClick?: (event: TeamEvent) => void;
}

function minutesOfDay(t: string | null | undefined): number | null {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

/** Position a block bar in its day cell: absolute by start/end, else full-height. */
function blockBarStyle(block: TeamBlock): React.CSSProperties {
  const start = minutesOfDay(block.startTime);
  const end = minutesOfDay(block.endTime);
  if (start === null || end === null || end <= start) {
    return { top: 0, height: '100%' };
  }
  return {
    top: `${(start / 1440) * 100}%`,
    height: `${((end - start) / 1440) * 100}%`,
  };
}

const GRID_COLS = 'grid-cols-[7rem_repeat(7,minmax(5rem,1fr))]';

interface DayEventChip {
  event: TeamEvent;
  /** True when this chip sits on a day after the event's start day, or the
   *  event occurrence itself started before the displayed window. */
  continuation: boolean;
}

/**
 * Calendar days between `first` and `last` (inclusive, YYYY-MM-DD, Manila).
 * Bounds are clamped before this is called, so the loop always terminates.
 */
function coverDays(first: string, last: string): string[] {
  const days: string[] = [];
  const cursor = new Date(toDate(first).getTime());
  for (let i = 0; i < 400; i += 1) {
    const day = manilaDay(cursor);
    days.push(day);
    if (day >= last) break;
    cursor.setTime(cursor.getTime() + DAY_MS);
  }
  return days;
}

interface MobileAgendaProps {
  blocks: TeamBlock[];
  events: TeamEvent[];
  staff: TeamStaffAchievement[];
  myUserId?: string;
  readOnly: boolean;
  onBlockClick: (block: TeamBlock) => void;
  onEventClick?: (event: TeamEvent) => void;
}

/**
 * Mobile week view: a single-day-per-staff agenda. One day at a time (default
 * today, stepper to move), stacked staff sections listing that day's blocks
 * and office events — the desktop 7-day grid's mobile replacement per the
 * design doc's "single-day staff agenda".
 */
function MobileDayAgenda({
  blocks,
  events,
  staff,
  myUserId,
  readOnly,
  onBlockClick,
  onEventClick,
}: MobileAgendaProps) {
  const { t } = useTranslation();
  const [day, setDay] = useState<Date>(() => new Date());
  const dayStr = localIsoDay(day);

  const dayEvents = useMemo(() => {
    const chips: DayEventChip[] = [];
    for (const event of events) {
      for (const instance of expandRepeat(event, dayStr, dayStr)) {
        const startDay = manilaDay(instance.startsAt);
        const endDay = manilaDay(instance.endsAt);
        if (startDay <= dayStr && dayStr <= endDay) {
          chips.push({ event, continuation: instance.continues || dayStr !== startDay });
        }
      }
    }
    return chips;
  }, [events, dayStr]);

  const blocksByStaff = useMemo(() => {
    const map = new Map<string, TeamBlock[]>();
    for (const block of blocks) {
      if (block.blockDate !== dayStr) continue;
      const list = map.get(block.userId);
      if (list) list.push(block);
      else map.set(block.userId, [block]);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.startTime ?? '99:99').localeCompare(b.startTime ?? '99:99'));
    }
    return map;
  }, [blocks, dayStr]);

  return (
    <div className="rounded-lg border bg-background">
      {/* Day stepper */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <button
          type="button"
          aria-label={t('team.week.previousDay')}
          onClick={() => setDay(d => addDays(d, -1))}
          className="rounded border p-1 hover:bg-muted"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="flex-1 text-center text-sm font-semibold" data-testid="mobile-day-label">
          {formatDate(dayStr)}
        </span>
        <button
          type="button"
          aria-label={t('team.week.nextDay')}
          onClick={() => setDay(d => addDays(d, 1))}
          className="rounded border p-1 hover:bg-muted"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Office events of the day */}
      <div className="border-b bg-primary/5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {t('team.week.events')}
      </div>
      <div className="space-y-1 px-3 py-2">
        {dayEvents.length === 0 && (
          <p className="py-1 text-xs text-muted-foreground">{t('team.week.noEvents')}</p>
        )}
        {dayEvents.map(item => (
          <button
            key={item.event.id}
            type="button"
            disabled={readOnly}
            onClick={() => onEventClick?.(item.event)}
            title={
              item.continuation
                ? t('team.week.startedEarlierTitle', '{{title}} (started earlier)', {
                    title: item.event.title,
                  })
                : item.event.title
            }
            className={`w-full truncate rounded border px-1.5 py-0.5 text-left text-xs font-medium ${
              item.continuation
                ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                : 'border-indigo-400 bg-indigo-100/70 text-indigo-900'
            }`}
          >
            {item.continuation ? `↳ ${item.event.title}` : item.event.title}
          </button>
        ))}
      </div>

      {/* Staff sections: name header + that day's blocks */}
      {staff.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">{t('team.week.noStaff')}</p>
      )}
      {staff.map(member => (
        <section key={member.userId} className="border-t px-3 py-2">
          <h3
            className="flex items-center gap-1 truncate text-xs font-semibold text-muted-foreground"
            title={member.name}
          >
            <span className="truncate">{member.name}</span>
            {member.userId === myUserId && <YouBadge />}
          </h3>
          <ul className="mt-1 space-y-1">
            {(blocksByStaff.get(member.userId) ?? []).length === 0 && (
              <li className="py-0.5 text-xs text-muted-foreground">{t('team.week.noBlocks')}</li>
            )}
            {(blocksByStaff.get(member.userId) ?? []).map(block => {
              const typeKey = BLOCK_TYPE_LABEL_KEYS[block.blockType] ?? block.blockType;
              const label = t(typeKey, typeKey);
              return (
                <li key={block.id}>
                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={() => onBlockClick(block)}
                    aria-label={t('team.week.blockAria', {
                      name: member.name,
                      type: label,
                      date: dayStr,
                    })}
                    title={
                      block.note ??
                      (block.startTime && block.endTime
                        ? `${block.startTime}–${block.endTime}`
                        : t('team.week.allDay'))
                    }
                    className={`flex w-full items-center gap-2 rounded-sm border-l-2 px-1.5 py-1 text-left text-xs font-medium ${BLOCK_COLORS[block.blockType] ?? BLOCK_COLOR_FALLBACK}`}
                  >
                    <span className="min-w-0 flex-1 truncate">{label}</span>
                    <span className="shrink-0 text-[10px] opacity-80">
                      {block.startTime && block.endTime
                        ? `${block.startTime}–${block.endTime}`
                        : t('team.week.allDay')}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/**
 * Week resource grid: staff = rows down the left, 7 day columns, each day a
 * 24-hour CSS grid cell with blocks absolutely positioned inside it. Office
 * events land on an all-day strip above the grid (repeat rules expanded).
 * Under the mobile breakpoint this collapses to {@link MobileDayAgenda}.
 */
export function WeekView({
  blocks,
  events,
  from,
  staff,
  myUserId,
  readOnly = false,
  onSlotClick,
  onBlockClick,
  onEventClick,
}: WeekViewProps) {
  const { t } = useTranslation();
  // "Under md" per the brief: Tailwind's `md:` breakpoint is 768px, so the
  // mobile branch is max-width: 767px — the same query BottomNav.tsx uses.
  // setup's jsdom matchMedia stub reports no match → desktop branch in tests;
  // the mobile test flips the max-width query to matches:true.
  const isMobile = useMediaQuery('(max-width: 767px)');

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(from, i)), [from]);
  const dayStrs = useMemo(() => days.map(localIsoDay), [days]);

  const blocksByStaffDay = useMemo(() => {
    const map = new Map<string, TeamBlock[]>();
    for (const block of blocks) {
      const key = `${block.userId}|${block.blockDate}`;
      const list = map.get(key);
      if (list) list.push(block);
      else map.set(key, [block]);
    }
    return map;
  }, [blocks]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, DayEventChip[]>();
    const dayFrom = dayStrs[0];
    const dayTo = dayStrs[6];
    for (const event of events) {
      for (const instance of expandRepeat(event, dayFrom, dayTo)) {
        const startDay = manilaDay(instance.startsAt);
        const endDay = manilaDay(instance.endsAt);
        // Clamp coverage to the strip window; an event that started before
        // the week reads as a continuation from its first in-window day.
        const first = startDay < dayFrom ? dayFrom : startDay;
        const last = endDay < first ? first : endDay > dayTo ? dayTo : endDay;
        for (const day of coverDays(first, last)) {
          const chip: DayEventChip = {
            event,
            continuation: instance.continues || day !== startDay,
          };
          const list = map.get(day);
          if (list) {
            if (!list.some(existing => existing.event.id === event.id)) list.push(chip);
          } else {
            map.set(day, [chip]);
          }
        }
      }
    }
    return map;
  }, [events, dayStrs]);

  if (isMobile) {
    return (
      <MobileDayAgenda
        blocks={blocks}
        events={events}
        staff={staff}
        myUserId={myUserId}
        readOnly={readOnly}
        onBlockClick={onBlockClick}
        onEventClick={onEventClick}
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-background">
      <div className="min-w-[42rem]">
        {/* Day header row */}
        <div className={`grid ${GRID_COLS} border-b bg-muted/30`}>
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
            {t('team.week.staff')}
          </div>
          {days.map((day, i) => (
            <div
              key={day.toISOString()}
              className={`border-l px-2 py-1.5 text-center ${i === 0 ? 'border-l-0' : ''}`}
            >
              <p className="text-xs font-semibold text-muted-foreground">
                {t(WEEKDAY_LABEL_KEYS[i])}
              </p>
              <p className="text-sm font-bold">{day.getDate()}</p>
            </div>
          ))}
        </div>

        {/* All-day office events strip */}
        <div className={`grid ${GRID_COLS} border-b bg-primary/5`}>
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t('team.week.events')}
          </div>
          {dayStrs.map((day, i) => (
            <div
              key={day}
              data-testid={`week-events-strip-${day}`}
              className={`space-y-1 border-l px-1 py-1 ${i === 0 ? 'border-l-0' : ''}`}
            >
              {(eventsByDay.get(day) ?? []).map(item => (
                <button
                  key={item.event.id}
                  type="button"
                  disabled={readOnly}
                  onClick={() => onEventClick?.(item.event)}
                  title={
                    item.continuation
                      ? t('team.week.startedEarlierTitle', '{{title}} (started earlier)', {
                          title: item.event.title,
                        })
                      : item.event.title
                  }
                  className={`w-full truncate rounded border px-1 py-0.5 text-left text-[10px] font-medium ${
                    item.continuation
                      ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                      : 'border-indigo-400 bg-indigo-100/70 text-indigo-900'
                  }`}
                >
                  {item.continuation ? `↳ ${item.event.title}` : item.event.title}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Staff rows × day cells */}
        {staff.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">{t('team.week.noStaff')}</p>
        )}
        {staff.map(member => (
          <div key={member.userId} className={`grid ${GRID_COLS} border-b last:border-b-0`}>
            <div
              className="flex items-center gap-1 px-2 py-3 text-xs font-medium"
              title={member.name}
            >
              <span className="truncate">{member.name}</span>
              {member.userId === myUserId && <YouBadge />}
            </div>
            {dayStrs.map((day, i) => {
              const dayBlocks = blocksByStaffDay.get(`${member.userId}|${day}`) ?? [];
              return (
                <div
                  key={day}
                  className={`relative min-h-[16rem] ${i === 0 ? 'border-l-0' : 'border-l'}`}
                  style={{ display: 'grid', gridTemplateRows: 'repeat(24, minmax(1.05rem, 1fr))' }}
                >
                  {dayBlocks.map(block => (
                    <button
                      key={block.id}
                      type="button"
                      disabled={readOnly}
                      onClick={() => onBlockClick(block)}
                      aria-label={t('team.week.blockAria', {
                        name: member.name,
                        type: t(
                          BLOCK_TYPE_LABEL_KEYS[block.blockType] ?? block.blockType,
                          BLOCK_TYPE_LABEL_KEYS[block.blockType] ?? block.blockType,
                        ),
                        date: day,
                      })}
                      title={
                        block.note ??
                        (block.startTime && block.endTime
                          ? `${block.startTime}–${block.endTime}`
                          : t('team.week.allDay'))
                      }
                      className={`absolute inset-x-0.5 z-10 truncate rounded-sm border-l-2 px-1 text-left text-[10px] font-medium ${
                        BLOCK_COLORS[block.blockType] ?? BLOCK_COLOR_FALLBACK
                      }`}
                      style={blockBarStyle(block)}
                    >
                      {t(
                        BLOCK_TYPE_LABEL_KEYS[block.blockType] ?? block.blockType,
                        BLOCK_TYPE_LABEL_KEYS[block.blockType] ?? block.blockType,
                      )}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={readOnly}
                    aria-label={t('team.week.newBlockAria', { name: member.name, date: day })}
                    onClick={() => onSlotClick(member.userId, day)}
                    className="absolute inset-0"
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}