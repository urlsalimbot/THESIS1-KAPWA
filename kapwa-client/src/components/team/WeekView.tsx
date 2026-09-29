import { useMemo } from 'react';
import {
  addDays,
  localIsoDay,
  manilaDay,
  expandRepeat,
  BLOCK_COLORS,
  BLOCK_COLOR_FALLBACK,
  BLOCK_TYPE_LABELS,
} from './team-utils';
import type { TeamBlock, TeamEvent, TeamStaffAchievement } from '../../lib/team-api';

export interface WeekViewProps {
  blocks: TeamBlock[];
  events: TeamEvent[];
  from: Date; // Monday of the displayed week (local)
  staff: TeamStaffAchievement[];
  /** Read-only mode (coordinators): disables slot/block click affordances. */
  readOnly?: boolean;
  onSlotClick: (staffId: string, date: string) => void;
  onBlockClick: (block: TeamBlock) => void;
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

/**
 * Week resource grid: staff = rows down the left, 7 day columns, each day a
 * 24-hour CSS grid cell with blocks absolutely positioned inside it. Office
 * events land on an all-day strip above the grid (repeat rules expanded).
 */
export function WeekView({
  blocks,
  events,
  from,
  staff,
  readOnly = false,
  onSlotClick,
  onBlockClick,
}: WeekViewProps) {
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(from, i)), [from]);
  const dayStrs = days.map(localIsoDay);

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
    const map = new Map<string, TeamEvent[]>();
    for (const event of events) {
      for (const instance of expandRepeat(event, dayStrs[0], dayStrs[6])) {
        const day = manilaDay(instance.startsAt);
        const list = map.get(day);
        if (list) {
          if (!list.some(existing => existing.id === event.id)) list.push(event);
        } else {
          map.set(day, [event]);
        }
      }
    }
    return map;
  }, [events, dayStrs]);

  return (
    <div className="overflow-x-auto rounded-lg border bg-background">
      <div className="min-w-[42rem]">
        {/* Day header row */}
        <div className={`grid ${GRID_COLS} border-b bg-muted/30`}>
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Staff</div>
          {days.map((day, i) => (
            <div
              key={day.toISOString()}
              className={`border-l px-2 py-1.5 text-center ${i === 0 ? 'border-l-0' : ''}`}
            >
              <p className="text-xs font-semibold text-muted-foreground">
                {day.toLocaleDateString('en-US', { weekday: 'short' })}
              </p>
              <p className="text-sm font-bold">{day.getDate()}</p>
            </div>
          ))}
        </div>

        {/* All-day office events strip */}
        <div className={`grid ${GRID_COLS} border-b bg-primary/5`}>
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Events
          </div>
          {dayStrs.map((day, i) => (
            <div
              key={day}
              className={`space-y-1 border-l px-1 py-1 ${i === 0 ? 'border-l-0' : ''}`}
            >
              {(eventsByDay.get(day) ?? []).map(event => (
                <div
                  key={event.id}
                  title={event.title}
                  className="truncate rounded border border-indigo-400 bg-indigo-100/70 px-1 py-0.5 text-[10px] font-medium text-indigo-900"
                >
                  {event.title}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Staff rows × day cells */}
        {staff.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">No staff to show.</p>
        )}
        {staff.map(member => (
          <div key={member.userId} className={`grid ${GRID_COLS} border-b last:border-b-0`}>
            <div
              className="truncate px-2 py-3 text-xs font-medium"
              title={member.name}
            >
              {member.name}
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
                      aria-label={`${member.name} — ${BLOCK_TYPE_LABELS[block.blockType] ?? block.blockType} on ${day}`}
                      title={
                        block.note ??
                        (block.startTime && block.endTime
                          ? `${block.startTime}–${block.endTime}`
                          : 'All day')
                      }
                      className={`absolute inset-x-0.5 z-10 truncate rounded-sm border-l-2 px-1 text-left text-[10px] font-medium ${
                        BLOCK_COLORS[block.blockType] ?? BLOCK_COLOR_FALLBACK
                      }`}
                      style={blockBarStyle(block)}
                    >
                      {BLOCK_TYPE_LABELS[block.blockType] ?? block.blockType}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={readOnly}
                    aria-label={`New block for ${member.name} on ${day}`}
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