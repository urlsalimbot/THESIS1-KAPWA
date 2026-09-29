import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  addDays,
  localIsoDay,
  manilaDay,
  blockDayRange,
  expandRepeat,
  BLOCK_TYPES,
  BLOCK_COLORS,
  BLOCK_COLOR_FALLBACK,
  BLOCK_TYPE_LABEL_KEYS,
  WEEKDAY_LABEL_KEYS,
} from './team-utils';
import type { TeamBlock, TeamEvent } from '../../lib/team-api';

export interface MonthViewProps {
  events: TeamEvent[];
  blocks: TeamBlock[];
  from: Date; // anchor: any date in the month to display
  /** Signed-in user can create/edit blocks (admin + social_worker). */
  canEdit?: boolean;
  /** Signed-in user's id — only their own block dots become clickable. */
  myUserId?: string;
  /** Place a new block on a day (in-month cells + the "+" chip). */
  onPlaceBlock?: (dateStr: string) => void;
  /** Click-to-edit an own block dot. */
  onBlockClick?: (block: TeamBlock) => void;
}

const GRID_COLS = 'grid-cols-[repeat(7,minmax(6rem,1fr))]';

/** Monday on or before `date` — the Monday-first grid's first column. */
function mondayOnOrBefore(date: Date): Date {
  return addDays(date, -((date.getDay() + 6) % 7));
}

/**
 * Month grid: 6 weeks × 7 days, Monday-first, anchored on the month
 * containing `from`. Each cell shows event chips and per-staff block dots
 * keyed by `BLOCK_COLORS[type]`; cells outside the current month are muted
 * and today is ring-outlined. Legend below maps type → dot color.
 *
 * Placement (editors only): in-month cells are clickable and carry a "+"
 * chip (visible on hover/keyboard focus) that calls `onPlaceBlock`; a staff
 * member's OWN block dots become edit buttons (`onBlockClick`), while other
 * staff dots stay inert. Out-of-month cells stay inert — no placement
 * affordance, so muted cells cannot be clicked by accident.
 */
export function MonthView({
  events,
  blocks,
  from,
  canEdit = false,
  myUserId = '',
  onPlaceBlock,
  onBlockClick,
}: MonthViewProps) {
  const { t } = useTranslation();
  const monthStart = useMemo(() => new Date(from.getFullYear(), from.getMonth(), 1), [from]);
  const gridStart = useMemo(() => mondayOnOrBefore(monthStart), [monthStart]);
  const cells = useMemo(() => Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)), [gridStart]);

  const dayStrs = cells.map(localIsoDay);
  const firstStr = dayStrs[0];
  const lastStr = dayStrs[dayStrs.length - 1];
  const todayStr = localIsoDay(new Date());

  const blocksByDay = useMemo(() => {
    const map = new Map<string, TeamBlock[]>();
    for (const block of blocks) {
      // Multi-day blocks dot every covered day of the range.
      for (const day of blockDayRange(block)) {
        const list = map.get(day);
        if (list) list.push(block);
        else map.set(day, [block]);
      }
    }
    return map;
  }, [blocks]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, TeamEvent[]>();
    for (const event of events) {
      for (const instance of expandRepeat(event, firstStr, lastStr)) {
        // Chips sit on the occurrence's start day; an occurrence that began
        // before the grid clamps to the grid's first cell (spec edge #3).
        const startDay = manilaDay(instance.startsAt);
        const day = startDay < firstStr ? firstStr : startDay;
        const list = map.get(day);
        if (list) {
          if (!list.some(existing => existing.id === event.id)) list.push(event);
        } else {
          map.set(day, [event]);
        }
      }
    }
    return map;
  }, [events, firstStr, lastStr]);

  const monthLabel = monthStart.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="rounded-lg border bg-background">
      <div className="border-b px-3 py-2 text-sm font-bold">{monthLabel}</div>
      <div className={`grid ${GRID_COLS} border-b bg-muted/30`}>
        {WEEKDAY_LABEL_KEYS.map(day => (
          <div key={day} className="px-2 py-1.5 text-center text-xs font-semibold text-muted-foreground">
            {t(day)}
          </div>
        ))}
      </div>

      <div className={`grid ${GRID_COLS}`}>
        {cells.map((date, i) => {
          const dayStr = dayStrs[i];
          const cellBlocks = blocksByDay.get(dayStr) ?? [];
          const cellEvents = eventsByDay.get(dayStr) ?? [];
          const inMonth = date.getMonth() === monthStart.getMonth();
          const isToday = dayStr === todayStr;
          const placeable = canEdit && inMonth;
          const placeAria = t('team.month.placeBlockAria', { date: dayStr });
          return (
            <div
              key={dayStr}
              onClick={
                placeable && onPlaceBlock
                  ? () => onPlaceBlock(dayStr)
                  : undefined
              }
              className={`min-h-[5.5rem] border-b border-r border-l-0 border-t-0 p-1.5 ${
                i % 7 === 0 ? 'border-l-0' : 'border-l'
              } ${inMonth ? '' : 'bg-muted/20'} ${
                isToday ? 'ring-1 ring-inset ring-primary' : ''
              } ${placeable ? 'group relative cursor-pointer' : ''}`}
            >
              {placeable && (
                <button
                  type="button"
                  aria-label={placeAria}
                  onClick={e => {
                    e.stopPropagation();
                    onPlaceBlock?.(dayStr);
                  }}
                  className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-sm bg-muted text-[11px] font-bold leading-none text-muted-foreground opacity-0 transition-opacity hover:bg-muted-foreground/20 focus-visible:opacity-100 group-hover:opacity-100"
                >
                  +
                </button>
              )}
              <p className={`text-xs font-semibold ${inMonth ? 'text-foreground' : 'text-muted-foreground'}`}>
                {date.getDate()}
              </p>
              <div className="mt-0.5 space-y-0.5">
                {cellEvents.slice(0, 2).map(event => (
                  <div
                    key={event.id}
                    title={event.title}
                    // Chips are read-only here; without this the click bubbles
                    // to the placeable cell body and opens the New Block dialog.
                    onClick={e => e.stopPropagation()}
                    className="truncate rounded-sm border border-indigo-400 bg-indigo-100/70 px-1 text-[9px] font-medium text-indigo-900"
                  >
                    {event.title}
                  </div>
                ))}
                {cellBlocks.length > 0 && (
                  <div className="flex flex-wrap gap-0.5 pt-0.5">
                    {cellBlocks.slice(0, 5).map(block => {
                      const typeKey = BLOCK_TYPE_LABEL_KEYS[block.blockType] ?? block.blockType;
                      const typeLabel = t(typeKey, typeKey);
                      const dotClass = `h-2 w-2 rounded-full ${
                        BLOCK_COLORS[block.blockType]?.split(' ')[0] ?? BLOCK_COLOR_FALLBACK.split(' ')[0]
                      }`;
                      const own = canEdit && block.userId === myUserId;
                      return own ? (
                        // The 8px dot alone is far below the 24px minimum
                        // target, so the button is a 32px grid box (-m-2 keeps
                        // the flow position identical) wrapping the real dot.
                        <button
                          key={block.id}
                          type="button"
                          aria-label={t('team.month.editBlockAria', { type: typeLabel, date: dayStr })}
                          title={typeLabel}
                          onClick={e => {
                            e.stopPropagation();
                            onBlockClick?.(block);
                          }}
                          className="relative grid h-8 w-8 -m-2 cursor-pointer place-items-center"
                        >
                          <span className={dotClass} />
                        </button>
                      ) : (
                        <span
                          key={block.id}
                          title={typeLabel}
                          // Colleague dots are inert: swallow the click so it
                          // cannot bubble to the placeable cell body.
                          onClick={e => e.stopPropagation()}
                          className={dotClass}
                        />
                      );
                    })}
                    {cellBlocks.length > 5 && (
                      <span className="text-[9px] text-muted-foreground">+{cellBlocks.length - 5}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend: block type → dot color */}
      <div className="flex flex-wrap items-center gap-3 border-t px-3 py-2">
        {BLOCK_TYPES.map(type => {
            const typeKey = BLOCK_TYPE_LABEL_KEYS[type];
            return (
              <span key={type} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span
                  className={`h-2 w-2 rounded-full ${
                    BLOCK_COLORS[type]?.split(' ')[0] ?? BLOCK_COLOR_FALLBACK.split(' ')[0]
                  }`}
                />
                {t(typeKey, typeKey)}
              </span>
            );
          })}
      </div>
    </div>
  );
}