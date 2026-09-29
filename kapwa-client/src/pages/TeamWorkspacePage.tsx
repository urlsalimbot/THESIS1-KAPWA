import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { ChevronLeft, ChevronRight, Plus, CalendarPlus, CalendarRange } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { queryKeys } from '@/lib/query-keys';
import { formatDate } from '@/lib/format';
import {
  createBlock,
  updateBlock,
  deleteBlock,
  createEvent,
  updateEvent,
  deleteEvent,
  putStatus,
  getSchedule,
} from '@/lib/team-api';
import type {
  TeamBlock,
  TeamBlockInput,
  TeamEvent,
  TeamEventInput,
  TeamSchedule,
  TeamStatus,
  TeamStatusInput,
  AchievementsRollup,
} from '@/lib/team-api';
import { weekStart, addDays, localIsoDay } from '@/components/team/team-utils';
import { WeekView } from '@/components/team/WeekView';
import { MonthView } from '@/components/team/MonthView';
import { AgendaView } from '@/components/team/AgendaView';
import { TeamStatusBar } from '@/components/team/TeamStatusBar';
import { StaffView } from '@/components/team/StaffView';
import { BlockEditorDialog } from '@/components/team/BlockEditorDialog';
import { EventEditorDialog } from '@/components/team/EventEditorDialog';

type ViewMode = 'week' | 'month' | 'agenda' | 'staff';

const VIEWS: Array<{ id: ViewMode; label: string }> = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'agenda', label: 'Agenda' },
  { id: 'staff', label: 'Staff' },
];

/** Task 10 shell: owns the week state, the SWR schedule/status fetches and
 *  the editor dialogs; hands presentational views the data. */
export function TeamWorkspacePage() {
  const { user } = useAuth();
  const [view, setView] = useState<ViewMode>('week');
  const [from, setFrom] = useState<Date>(() => weekStart(new Date()));
  const [draftSlot, setDraftSlot] = useState<{ staffId: string; date: string } | null>(null);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [activeBlock, setActiveBlock] = useState<TeamBlock | null>(null);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [activeEvent, setActiveEvent] = useState<TeamEvent | null>(null);

  const fromStr = localIsoDay(from);
  const toStr = localIsoDay(addDays(from, 6));

  // Schedule = client-side merge (GET /team/blocks + GET /team/events) — see
  // team-api.getSchedule's note; queryKeys.team.schedule maps to the same key.
  // The explicit fetcher is REQUIRED: the global fetcher (api.get) would hit
  // GET /team/schedule, which does not exist server-side (404 → empty views).
  const { data: schedule } = useSWR<TeamSchedule>(queryKeys.team.schedule(fromStr, toStr), () =>
    getSchedule(fromStr, toStr),
  );
  const { data: statuses } = useSWR<TeamStatus[]>(queryKeys.team.statuses());
  // Staff roster: achievements.perStaff is the only team-scoped staff list —
  // it zero-fills every admin + social_worker (verified: no /team/staff
  // endpoint exists, and the client has no users-list fetcher; queryKeys.users
  // is unused). Documented in the Task 10 report.
  const { data: achievements } = useSWR<AchievementsRollup>(
    queryKeys.team.achievements(fromStr, toStr),
  );

  const staff = achievements?.perStaff ?? [];
  const myUserId = user?.id ?? '';
  const canEdit = user?.role !== 'coordinator';

  const weekLabel = `${formatDate(fromStr)} – ${formatDate(toStr)}`;

  const handleSetStatus = async (input: TeamStatusInput) => {
    await putStatus(input);
    await Promise.all([
      mutate(queryKeys.team.status()),
      mutate(queryKeys.team.statuses()),
    ]);
  };

  const revalidateWeek = async () => {
    await Promise.all([
      mutate(queryKeys.team.schedule(fromStr, toStr)),
      mutate(queryKeys.team.blocks(fromStr, toStr)),
    ]);
  };

  const handleSaveBlock = async (input: TeamBlockInput) => {
    if (activeBlock) await updateBlock(activeBlock.id, input);
    else await createBlock(input);
    setBlockDialogOpen(false);
    setActiveBlock(null);
    setDraftSlot(null);
    await revalidateWeek();
  };

  const handleDeleteBlock = async (id: string) => {
    await deleteBlock(id);
    setBlockDialogOpen(false);
    setActiveBlock(null);
    await revalidateWeek();
  };

  const handleSaveEvent = async (input: TeamEventInput) => {
    if (activeEvent) await updateEvent(activeEvent.id, input);
    else await createEvent(input);
    setEventDialogOpen(false);
    setActiveEvent(null);
    await Promise.all([mutate(queryKeys.team.events(fromStr, toStr)), revalidateWeek()]);
  };

  const handleDeleteEvent = async (id: string) => {
    await deleteEvent(id);
    setEventDialogOpen(false);
    setActiveEvent(null);
    await Promise.all([mutate(queryKeys.team.events(fromStr, toStr)), revalidateWeek()]);
  };

  const openNewBlock = () => {
    setActiveBlock(null);
    setBlockDialogOpen(true);
  };

  const handleSlotClick = (staffId: string, date: string) => {
    if (!canEdit) return; // coordinators are read-only (server also 403s)
    setDraftSlot({ staffId, date });
    openNewBlock();
  };

  const handleBlockClick = (block: TeamBlock) => {
    if (!canEdit) return; // coordinators are read-only (server also 403s)
    setActiveBlock(block);
    setBlockDialogOpen(true);
  };

  const openNewEvent = () => {
    setActiveEvent(null);
    setEventDialogOpen(true);
  };

  return (
    <PageShell
      title="Team Workspace"
      description="Shared schedule, office events and live whereabouts"
      actions={
        <div className="flex items-center gap-1 rounded-lg border bg-background p-0.5" role="group" aria-label="View switcher">
          {VIEWS.map(item => (
            <Button
              key={item.id}
              size="sm"
              variant={view === item.id ? 'default' : 'ghost'}
              aria-pressed={view === item.id}
              onClick={() => setView(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {/* Toolbar: week paging + Today + New entries */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" aria-label="Previous week" onClick={() => setFrom(addDays(from, -7))}>
              <ChevronLeft size={16} />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setFrom(weekStart(new Date()))}>
              Today
            </Button>
            <Button variant="outline" size="icon" aria-label="Next week" onClick={() => setFrom(addDays(from, 7))}>
              <ChevronRight size={16} />
            </Button>
          </div>
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            <CalendarRange size={14} className="text-muted-foreground" />
            {weekLabel}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={openNewEvent}
              disabled={!canEdit}
              aria-label="New event"
            >
              <CalendarPlus size={14} className="mr-1" /> Event
            </Button>
            <Button size="sm" onClick={openNewBlock} disabled={!draftSlot || !canEdit} aria-label="New block">
              <Plus size={14} className="mr-1" /> New
            </Button>
          </div>
        </div>

        <TeamStatusBar
          statuses={statuses ?? []}
          staff={staff}
          myUserId={myUserId}
          canEdit={canEdit}
          onSetStatus={handleSetStatus}
        />

        {view === 'week' && (
          <WeekView
            blocks={schedule?.blocks ?? []}
            events={schedule?.events ?? []}
            from={from}
            staff={staff}
            readOnly={!canEdit}
            onSlotClick={handleSlotClick}
            onBlockClick={handleBlockClick}
          />
        )}
        {view === 'month' && (
          <MonthView blocks={schedule?.blocks ?? []} events={schedule?.events ?? []} from={from} />
        )}
        {view === 'agenda' && (
          <AgendaView blocks={schedule?.blocks ?? []} events={schedule?.events ?? []} staff={staff} />
        )}
        {view === 'staff' && <StaffView staff={staff} statuses={statuses ?? []} />}

        <BlockEditorDialog
          open={blockDialogOpen}
          onOpenChange={setBlockDialogOpen}
          staff={staff}
          staffId={draftSlot?.staffId ?? (canEdit ? myUserId : null)}
          date={draftSlot?.date ?? (canEdit ? fromStr : null)}
          block={activeBlock}
          readOnly={!canEdit}
          onSave={handleSaveBlock}
          onDelete={handleDeleteBlock}
        />
        <EventEditorDialog
          open={eventDialogOpen}
          onOpenChange={setEventDialogOpen}
          event={activeEvent}
          onSave={handleSaveEvent}
          onDelete={handleDeleteEvent}
        />
      </div>
    </PageShell>
  );
}