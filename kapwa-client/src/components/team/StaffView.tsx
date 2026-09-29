import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { useTranslation } from 'react-i18next';
import {
  Avatar,
  AvatarFallback,
} from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { weekStart, addDays, localIsoDay } from './team-utils';
import { STATUS_COLORS, STATUS_COLOR_FALLBACK, STATUS_LABEL_KEYS } from './team-utils';
import i18n from '../../i18n';
import { queryKeys } from '../../lib/query-keys';
import { getAchievements } from '../../lib/team-api';
import type { TeamStatus, TeamStaffAchievement, AchievementsRollup } from '../../lib/team-api';
import { YouBadge } from './YouBadge';

export interface StaffViewProps {
  /** Roster — achievements.perStaff (the only team-scoped staff list), joined
   *  with `statuses` by userId. */
  staff: TeamStaffAchievement[];
  statuses: TeamStatus[];
  /** Signed-in user's id — their card carries the You badge. */
  myUserId?: string;
}

const RANGE_OPTIONS = [
  { value: 'week', labelKey: 'team.staff.rangeWeek' },
  { value: 'month', labelKey: 'team.staff.rangeMonth' },
] as const;
type RangeValue = (typeof RANGE_OPTIONS)[number]['value'];

const STAT_DEFS = [
  { key: 'cases', labelKey: 'team.staff.statCases' },
  { key: 'interventions', labelKey: 'team.staff.statInterventions' },
  { key: 'referrals', labelKey: 'team.staff.statReferrals' },
  { key: 'docs', labelKey: 'team.staff.statDocs' },
  { key: 'trackerDays', labelKey: 'team.staff.statTrackerDays' },
] as const;

function rangeBounds(range: RangeValue): { from: string; to: string } {
  const now = new Date();
  if (range === 'month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: localIsoDay(from), to: localIsoDay(to) };
  }
  const start = weekStart(now);
  return { from: localIsoDay(start), to: localIsoDay(addDays(start, 6)) };
}

function typeKey(stat: (typeof STAT_DEFS)[number]): keyof Pick<TeamStaffAchievement, 'cases' | 'interventions' | 'referrals' | 'docs' | 'trackerDays'> {
  return stat.key;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * "Updated Mon, Sep 28, 9:00 AM" — Asia/Manila wall time of the status write.
 * Pinned to the office's zone (not the viewer's): an unpinned clock renders
 * the previous calendar day to anyone west of UTC, which is wrong for a
 * single-office roster.
 */
export function formatUpdatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const stamp = d.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Manila',
  });
  return i18n.t('team.staff.updatedAt', 'Updated {{stamp}}', { stamp });
}

/**
 * Staff roster + per-staff achievements.
 *
 * Cards: avatar initials, name, live status chip + note and when the status
 * was last updated (statuses joined by userId). Clicking a card selects the
 * member; the achievements panel below fetches GET /team/achievements for the
 * picked range (default: the current week; week/month select) and shows the
 * five counters — the endpoint returns a per-range rollup for ALL staff, so
 * the SWR key is scoped by range + selected staff and the row is picked from
 * perStaff client-side.
 *
 * Read-only by construction: the view has no status setter — coordinators and
 * staff see the same cards/panel (the page gates status writes elsewhere).
 */
export function StaffView({ staff, statuses, myUserId }: StaffViewProps) {
  const { t } = useTranslation();
  const [range, setRange] = useState<RangeValue>('week');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const { from, to } = rangeBounds(range);
  const selectedId = selectedUserId ?? staff[0]?.userId ?? null;
  // Range + staff scoped key: switching range OR staff re-fetches the rollup.
  const swrKey = useMemo(
    () => [...queryKeys.team.achievements(from, to), selectedId ?? 'none'] as const,
    [from, to, selectedId],
  );
  const { data: rollup } = useSWR<AchievementsRollup>(swrKey, () => getAchievements(from, to));
  const selected = rollup?.perStaff.find(m => m.userId === selectedId) ?? null;

  const statusByUser = useMemo(
    () => new Map(statuses.map(s => [s.userId, s])),
    [statuses],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label={t('team.staff.rosterAria')}>
        {staff.length === 0 && (
          <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
            {t('team.staff.noStaff')}
          </p>
        )}
        {staff.map(member => {
          const status = statusByUser.get(member.userId);
          const isSelected = member.userId === selectedId;
          return (
            <button
              key={member.userId}
              type="button"
              onClick={() => setSelectedUserId(member.userId)}
              aria-pressed={isSelected}
              aria-label={t('team.staff.viewAchievementsAria', { name: member.name })}
              className={`flex items-center gap-3 rounded-lg border bg-background p-3 text-left transition-colors ${
                isSelected ? 'border-primary/60 ring-1 ring-primary/30' : 'hover:border-primary/40'
              }`}
            >
              <Avatar className="h-9 w-9">
                <AvatarFallback className="text-xs font-medium bg-muted text-foreground">
                  {initials(member.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 truncate text-sm font-semibold">
                  <span className="truncate">{member.name}</span>
                  {member.userId === myUserId && <YouBadge />}
                </p>
                {status ? (
                  <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        STATUS_COLORS[status.status] ?? STATUS_COLOR_FALLBACK
                      }`}
                    />
                    <span className="truncate">
                      {t(
                      STATUS_LABEL_KEYS[status.status] ?? status.status,
                      STATUS_LABEL_KEYS[status.status] ?? status.status,
                    )}
                    {status.note ? ` — ${status.note}` : ''}
                    </span>
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">{t('team.staff.noStatus')}</p>
                )}
                {status?.updatedAt && (
                  <p className="truncate text-[10px] text-muted-foreground/70">
                    {formatUpdatedAt(status.updatedAt)}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div
        role="region"
        aria-label={selected ? t('team.staff.achievementsRegionFor', { name: selected.name }) : t('team.staff.achievementsRegionAria')}
        className="rounded-lg border bg-background p-4"
      >
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold">
            {selected ? t('team.staff.achievementsFor', { name: selected.name }) : t('team.staff.achievementsTitle')}
          </h3>
          <div className="ml-auto w-40">
            <Select value={range} onValueChange={(v: RangeValue) => setRange(v)}>
              <SelectTrigger aria-label={t('team.staff.rangeLabelAria')} className="h-8 w-full text-xs">
                <SelectValue placeholder={t('team.staff.rangePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {RANGE_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selected ? (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {STAT_DEFS.map(def => (
              <div key={def.key} className="rounded-md border bg-card p-2 text-center">
                <p className="text-lg font-bold" data-testid={`stat-${def.key}`}>
                  {selected[typeKey(def)]}
                </p>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {t(def.labelKey)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {staff.length === 0
              ? t('team.staff.selectPrompt')
              : t('team.staff.noData')}
          </p>
        )}
      </div>
    </div>
  );
}