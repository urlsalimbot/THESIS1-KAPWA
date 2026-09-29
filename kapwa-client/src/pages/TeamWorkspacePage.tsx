import { useState, useMemo } from 'react';
import useSWR, { mutate } from 'swr';
import { ChevronLeft, ChevronRight, Plus, CalendarPlus, CalendarRange, CalendarClock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
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
  getIncomingInvites,
  sendInvite,
  acceptInvite,
  declineInvite,
} from '@/lib/team-api';
import type {
  TeamBlock,
  TeamBlockInput,
  TeamEvent,
  TeamEventInput,
  TeamSchedule,
  TeamStatus,
  TeamStatusInput,
  TeamInvite,
  TeamInviteInput,
  AchievementsRollup,
} from '@/lib/team-api';
import { weekStart, addDays, localIsoDay, withSelfPinned } from '@/components/team/team-utils';
import { WeekView } from '@/components/team/WeekView';
import { MonthView } from '@/components/team/MonthView';
import { AgendaView } from '@/components/team/AgendaView';
import { TeamStatusBar } from '@/components/team/TeamStatusBar';
import { StaffView } from '@/components/team/StaffView';
import { BlockEditorDialog } from '@/components/team/BlockEditorDialog';
import { EventEditorDialog } from '@/components/team/EventEditorDialog';
import { InviteDialog } from '@/components/team/InviteDialog';
import { IncomingInvitesPanel } from '@/components/team/IncomingInvitesPanel';
import { useTeamStatus } from '@/hooks/useTeamStatus';

type ViewMode = 'week' | 'month' | 'agenda' | 'staff';

const VIEWS: Array<{ id: ViewMode; labelKey: string }> = [
  { id: 'week', labelKey: 'team.workspace.viewWeek' },
  { id: 'month', labelKey: 'team.workspace.viewMonth' },
  { id: 'agenda', labelKey: 'team.workspace.viewAgenda' },
  { id: 'staff', labelKey: 'team.workspace.viewStaff' },
];

/** Task 10 shell: owns the week state, the SWR schedule/status fetches and
 *  the editor dialogs; hands presentational views the data. */
export function TeamWorkspacePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [view, setView] = useState<ViewMode>('week');
  const [from, setFrom] = useState<Date>(() => weekStart(new Date()));
  const [draftSlot, setDraftSlot] = useState<{ staffId: string; date: string } | null>(null);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [activeBlock, setActiveBlock] = useState<TeamBlock | null>(null);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [activeEvent, setActiveEvent] = useState<TeamEvent | null>(null);
  // Schedule-suggestion state (amendment): the dialog prefills from a clicked
  // colleague slot; the header Suggest button opens it blank.
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [invitePrefill, setInvitePrefill] = useState<{ staffId: string; date: string } | null>(null);

  const fromStr = localIsoDay(from);
  const toStr = localIsoDay(addDays(from, 6));

  // Month + agenda render the 6-week, Monday-first grid of the month
  // containing `from`, so those views fetch that whole window (week view
  // keeps its own week window). The SWR key, mutation keys and the view
  // props all follow whichever window the active view needs.
  const monthStart = new Date(from.getFullYear(), from.getMonth(), 1);
  const gridStart = weekStart(monthStart); // Monday on/before the 1st
  const viewFromStr = view === 'week' ? fromStr : localIsoDay(gridStart);
  const viewToStr = view === 'week' ? toStr : localIsoDay(addDays(gridStart, 41));

  // Schedule = client-side merge (GET /team/blocks + GET /team/events) — see
  // team-api.getSchedule's note; queryKeys.team.schedule maps to the same key.
  // The explicit fetcher is REQUIRED: the global fetcher (api.get) would hit
  // GET /team/schedule, which does not exist server-side (404 → empty views).
  const { data: schedule } = useSWR<TeamSchedule>(queryKeys.team.schedule(viewFromStr, viewToStr), () =>
    getSchedule(viewFromStr, viewToStr),
  );
  const { data: statuses } = useSWR<TeamStatus[]>(queryKeys.team.statuses());
  // Incoming schedule invites — admin + social_worker only. Coordinators are
  // read-only (server 403s the invites routes), so the key is null for them
  // and no request leaves the page.
  const { data: incomingInvites } = useSWR<TeamInvite[]>(
    user?.role !== 'coordinator' ? queryKeys.team.invites.incoming() : null,
    getIncomingInvites,
  );
  // Staff roster: achievements.perStaff is the only team-scoped staff list —
  // it zero-fills every admin + social_worker (verified: no /team/staff
  // endpoint exists, and the client has no users-list fetcher; queryKeys.users
  // is unused). Documented in the Task 10 report.
  const { data: achievements } = useSWR<AchievementsRollup>(
    queryKeys.team.achievements(fromStr, toStr),
  );

  const myUserId = user?.id ?? '';
  const canEdit = user?.role !== 'coordinator';
  // Own row pinned FIRST for every view that renders staff order (week grid +
  // mobile agenda staff sections, staff cards, status bar chips, the editor
  // staff selects). Stable: everyone else keeps the API order. Viewers who are
  // not in perStaff (coordinators — the server zero-fills admin +
  // social_worker only) get a synthesized zero-filled self row appended.
  const staff = useMemo(
    () => withSelfPinned(achievements?.perStaff ?? [], myUserId, user?.fullName ?? ''),
    [achievements, myUserId, user],
  );

  const weekLabel = `${formatDate(fromStr)} – ${formatDate(toStr)}`;

  const handleSetStatus = async (input: TeamStatusInput) => {
    await putStatus(input);
    await Promise.all([
      mutate(queryKeys.team.status()),
      mutate(queryKeys.team.statuses()),
    ]);
  };

  const revalidateView = async () => {
    await Promise.all([
      mutate(queryKeys.team.schedule(viewFromStr, viewToStr)),
      mutate(queryKeys.team.blocks(viewFromStr, viewToStr)),
    ]);
  };

  const handleSaveBlock = async (input: TeamBlockInput) => {
    if (activeBlock) await updateBlock(activeBlock.id, input);
    else await createBlock(input);
    setBlockDialogOpen(false);
    setActiveBlock(null);
    setDraftSlot(null);
    await revalidateView();
  };

  const handleDeleteBlock = async (id: string) => {
    await deleteBlock(id);
    setBlockDialogOpen(false);
    setActiveBlock(null);
    await revalidateView();
  };

  const handleSaveEvent = async (input: TeamEventInput) => {
    if (activeEvent) await updateEvent(activeEvent.id, input);
    else await createEvent(input);
    setEventDialogOpen(false);
    setActiveEvent(null);
    await Promise.all([mutate(queryKeys.team.events(viewFromStr, viewToStr)), revalidateView()]);
  };

  const handleDeleteEvent = async (id: string) => {
    await deleteEvent(id);
    setEventDialogOpen(false);
    setActiveEvent(null);
    await Promise.all([mutate(queryKeys.team.events(viewFromStr, viewToStr)), revalidateView()]);
  };

  const openNewBlock = () => {
    setActiveBlock(null);
    setBlockDialogOpen(true);
  };

  const handleSlotClick = (staffId: string, date: string) => {
    if (!canEdit) return; // coordinators are read-only (server also 403s)
    // Owner rule (amendment): only the block's own staff member may create or
    // edit it. Clicking YOUR empty slot opens the block editor; clicking a
    // colleague's slot opens the "Suggest a schedule" invite dialog instead
    // (the colleague decides whether to accept).
    if (staffId === myUserId) {
      setDraftSlot({ staffId, date });
      openNewBlock();
    } else {
      setInvitePrefill({ staffId, date });
      setInviteDialogOpen(true);
    }
  };

  const handleSendInvite = async (input: TeamInviteInput) => {
    await sendInvite(input);
    setInviteDialogOpen(false);
    setInvitePrefill(null);
    await Promise.all([
      mutate(queryKeys.team.invites.incoming()),
      mutate(queryKeys.team.invites.outgoing()),
    ]);
    toast.success(t('team.invite.sent'));
  };

  const handleAcceptInvite = async (id: string) => {
    // Accepting materializes the suggested block AS the invitee (owner =
    // me) with team visibility — the returned TeamBlock is the created row.
    await acceptInvite(id);
    await Promise.all([
      mutate(queryKeys.team.invites.incoming()),
      mutate(queryKeys.team.invites.outgoing()),
      revalidateView(),
    ]);
    toast.success(t('team.invite.accepted'));
  };

  const handleDeclineInvite = async (id: string) => {
    await declineInvite(id);
    await Promise.all([
      mutate(queryKeys.team.invites.incoming()),
      mutate(queryKeys.team.invites.outgoing()),
    ]);
    toast.success(t('team.invite.declined'));
  };

  const handleBlockClick = (block: TeamBlock) => {
    if (!canEdit) return; // coordinators are read-only (server also 403s)
    // Owner-only (fix): editing someone else's block would open an editor
    // with Save/Delete the server would reject anyway — only the block's own
    // staff member may edit it (no admin exception). Colleague-block clicks
    // are a no-op.
    if (block.userId !== myUserId) return;
    setActiveBlock(block);
    setBlockDialogOpen(true);
  };

  const openNewEvent = () => {
    setActiveEvent(null);
    setEventDialogOpen(true);
  };

  const openEditEvent = (event: TeamEvent) => {
    if (!canEdit) return; // coordinators are read-only (server also 403s)
    setActiveEvent(event);
    setEventDialogOpen(true);
  };

  // Live whereabouts: subscribe once to the gateway's team.status.updated
  // broadcast (same /notifications namespace the notification socket uses).
  // The viewer's role + barangay scope the live board for coordinators.
  useTeamStatus(myUserId, user?.role, user?.assignedBarangay);

  return (
    <PageShell
      title={t('team.workspace.title')}
      description={t('team.workspace.description')}
      actions={
        <div className="flex items-center gap-1 rounded-lg border bg-background p-0.5" role="group" aria-label={t('team.workspace.viewSwitcher')}>
          {VIEWS.map(item => (
            <Button
              key={item.id}
              size="sm"
              variant={view === item.id ? 'default' : 'ghost'}
              aria-pressed={view === item.id}
              onClick={() => setView(item.id)}
            >
              {t(item.labelKey, item.labelKey)}
            </Button>
          ))}
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {/* Toolbar: week paging + Today + New entries */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" aria-label={t('team.workspace.previousWeek')} onClick={() => setFrom(addDays(from, -7))}>
              <ChevronLeft size={16} />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setFrom(weekStart(new Date()))}>
              {t('team.workspace.today')}
            </Button>
            <Button variant="outline" size="icon" aria-label={t('team.workspace.nextWeek')} onClick={() => setFrom(addDays(from, 7))}>
              <ChevronRight size={16} />
            </Button>
          </div>
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            <CalendarRange size={14} className="text-muted-foreground" />
            {weekLabel}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {canEdit && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setInvitePrefill(null);
                    setInviteDialogOpen(true);
                  }}
                  aria-label={t('team.invite.suggestAria')}
                >
                  <CalendarClock size={14} className="mr-1" /> {t('team.invite.suggestButton')}
                </Button>
                <IncomingInvitesPanel
                  invites={incomingInvites ?? []}
                  onAccept={handleAcceptInvite}
                  onDecline={handleDeclineInvite}
                />
              </>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={openNewEvent}
              disabled={!canEdit}
              aria-label={t('team.workspace.newEvent')}
            >
              <CalendarPlus size={14} className="mr-1" /> {t('team.workspace.event')}
            </Button>
            <Button size="sm" onClick={openNewBlock} disabled={!draftSlot || !canEdit} aria-label={t('team.workspace.newBlock')}>
              <Plus size={14} className="mr-1" /> {t('team.workspace.new')}
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
            myUserId={myUserId}
            readOnly={!canEdit}
            onSlotClick={handleSlotClick}
            onBlockClick={handleBlockClick}
            onEventClick={openEditEvent}
          />
        )}
        {view === 'month' && (
          <MonthView blocks={schedule?.blocks ?? []} events={schedule?.events ?? []} from={from} />
        )}
        {view === 'agenda' && (
          <AgendaView
            blocks={schedule?.blocks ?? []}
            events={schedule?.events ?? []}
            staff={staff}
            from={from}
          />
        )}
        {view === 'staff' && <StaffView staff={staff} statuses={statuses ?? []} myUserId={myUserId} />}

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
          readOnly={!canEdit}
          onSave={handleSaveEvent}
          onDelete={handleDeleteEvent}
        />
        <InviteDialog
          open={inviteDialogOpen}
          onOpenChange={setInviteDialogOpen}
          staff={staff}
          myUserId={myUserId}
          staffId={invitePrefill?.staffId ?? null}
          date={invitePrefill?.date ?? null}
          onSend={handleSendInvite}
        />
      </div>
    </PageShell>
  );
}