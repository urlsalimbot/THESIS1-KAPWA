import { useEffect, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  STATUS_VALUES,
  STATUS_COLORS,
  STATUS_COLOR_FALLBACK,
  STATUS_LABEL_KEYS,
} from './team-utils';
import type { TeamStatus, TeamStatusInput, TeamStaffAchievement, TeamVisibleTo } from '../../lib/team-api';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';

export interface TeamStatusBarProps {
  statuses: TeamStatus[];
  staff: TeamStaffAchievement[];
  myUserId: string;
  canEdit?: boolean; // coordinators read the board but cannot set their own status
  onSetStatus: (input: TeamStatusInput) => void | Promise<void>;
}

/**
 * Live whereabouts board: one chip per staff member (dot + name + status
 * label). The viewer's own chip carries a dropdown quick-set (the five block
 * statuses + offline) with an optional note field.
 */
export function TeamStatusBar({ statuses, staff, myUserId, canEdit = true, onSetStatus }: TeamStatusBarProps) {
  const { t } = useTranslation();
  const [note, setNote] = useState('');
  const [open, setOpen] = useState(false);
  // Visibility of the NEXT status write; syncs to the stored row each time
  // the dropdown opens (default team-wide).
  const [visibleTo, setVisibleTo] = useState<TeamVisibleTo>('team');

  const statusByUser = new Map(statuses.map(s => [s.userId, s]));

  const myStatus = statusByUser.get(myUserId);

  useEffect(() => {
    if (open) setVisibleTo(myStatus?.visibleTo ?? 'team');
  }, [open, myStatus?.visibleTo]);

  return (
    <div
      role="region"
      aria-label={t('team.statusBar.regionAria')}
      className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-background px-3 py-2"
    >
      {staff.map(member => {
        const status = statusByUser.get(member.userId);
        if (member.userId === myUserId && canEdit) {
          return (
            <DropdownMenu key={member.userId} open={open} onOpenChange={setOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={t('team.statusBar.setMyStatus')}
                  className="flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/5 px-2.5 py-1 text-xs font-medium hover:bg-primary/10"
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      status ? (STATUS_COLORS[status.status] ?? STATUS_COLOR_FALLBACK) : STATUS_COLOR_FALLBACK
                    }`}
                  />
                  <span className="font-semibold">{member.name}</span>
                  {status && (
                    <span className="text-muted-foreground">
                      {t(
                        STATUS_LABEL_KEYS[status.status] ?? status.status,
                        STATUS_LABEL_KEYS[status.status] ?? status.status,
                      )}
                    </span>
                  )}
                  <ChevronDown size={12} className="text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" sideOffset={6} className="w-64">
                <DropdownMenuLabel className="font-normal">
                  <Input
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder={t('team.statusBar.notePlaceholder')}
                    aria-label={t('team.statusBar.noteAria')}
                    className="h-8 text-xs"
                  />
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {/* Visibility toggle (amendment): the same vocabulary as the
                    block editor — team-wide default, or also visible to
                    coordinators. Applied to the NEXT status write. */}
                <DropdownMenuLabel className="flex items-center justify-between gap-2 font-normal">
                  <span className="text-xs text-muted-foreground">{t('team.blockEditor.visibilityLabel')}</span>
                  <Select value={visibleTo} onValueChange={v => setVisibleTo(v as TeamVisibleTo)}>
                    <SelectTrigger
                      id="status-visibility"
                      aria-label={t('team.statusBar.visibilityAria')}
                      className="h-8 w-44 text-xs"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="team">{t('team.blockEditor.visibilityTeam')}</SelectItem>
                      <SelectItem value="team_coordinators">{t('team.blockEditor.visibilityTeamCoordinators')}</SelectItem>
                    </SelectContent>
                  </Select>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {STATUS_VALUES.map(value => (
                  <DropdownMenuItem
                    key={value}
                    onClick={() => {
                      onSetStatus({
                        status: value,
                        note: note.trim() ? note.trim() : null,
                        visibleTo,
                      });
                      setNote('');
                    }}
                  >
                    <span
                      className={`mr-2 h-2 w-2 rounded-full ${
                        STATUS_COLORS[value] ?? STATUS_COLOR_FALLBACK
                      }`}
                    />
                    {t(
                      STATUS_LABEL_KEYS[value] ?? value,
                      STATUS_LABEL_KEYS[value] ?? value,
                    )}
                    {status?.status === value && <Check size={14} className="ml-auto text-primary" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        }
        return (
          <div
            key={member.userId}
            title={status?.note ?? undefined}
            className="flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs"
          >
            <span
              className={`h-2 w-2 rounded-full ${
                status ? (STATUS_COLORS[status.status] ?? STATUS_COLOR_FALLBACK) : STATUS_COLOR_FALLBACK
              }`}
            />
            <span className="font-medium">{member.name}</span>
            {status && (
              <span className="text-muted-foreground">
                {t(
                  STATUS_LABEL_KEYS[status.status] ?? status.status,
                  STATUS_LABEL_KEYS[status.status] ?? status.status,
                )}
              </span>
            )}
          </div>
        );
      })}
      {staff.length === 0 && <span className="text-xs text-muted-foreground">{t('team.statusBar.noStaffYet')}</span>}
    </div>
  );
}