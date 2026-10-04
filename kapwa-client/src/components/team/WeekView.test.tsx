import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { WeekView } from './WeekView';
import { BLOCK_COLORS, BLOCK_COLOR_FALLBACK, addDays, localIsoDay, weekStart, withSelfPinned } from './team-utils';
import { formatDate } from '../../lib/format';
import type { TeamBlock, TeamEvent, TeamStaffAchievement } from '../../lib/team-api';

const STAFF: TeamStaffAchievement[] = [
  { userId: 'u1', name: 'Ana Admin', cases: 2, interventions: 1, referrals: 0, docs: 1, trackerDays: 2 },
  { userId: 'u2', name: 'Ben Social', cases: 0, interventions: 3, referrals: 1, docs: 0, trackerDays: 1 },
];

const MANY_STAFF: TeamStaffAchievement[] = [
  ...STAFF,
  { userId: 'u3', name: 'Carla Worker', cases: 0, interventions: 0, referrals: 0, docs: 0, trackerDays: 0 },
];

// Fixed fixture week: Mon Sep 28 – Sun Oct 4 2026 (local).
const FROM = new Date(2026, 8, 28);

const FULL_DAY_BLOCK: TeamBlock = {
  id: 'b1',
  userId: 'u1',
  blockDate: '2026-09-28',
  blockType: 'home_visit',
  startTime: null,
  endTime: null,
  note: null,
  visibleTo: 'team',
};

const TIMED_BLOCK: TeamBlock = {
  id: 'b2',
  userId: 'u1',
  blockDate: '2026-09-28',
  blockType: 'in_office',
  startTime: '09:00',
  endTime: '12:00',
  note: 'Intake',
  visibleTo: 'team',
};

// Spans Mon Sep 28 – Wed Sep 30 2026 → one slice per covered day.
const MULTI_DAY_BLOCK: TeamBlock = {
  id: 'b4',
  userId: 'u1',
  blockDate: '2026-09-28',
  endDate: '2026-09-30',
  blockType: 'home_visit',
  startTime: null,
  endTime: null,
  note: null,
  visibleTo: 'team',
};

// UTC instants — the strip groups by the Asia/Manila calendar day.
const MEETING: TeamEvent = {
  id: 'e1',
  title: 'Team Meeting',
  startsAt: '2026-09-29T01:00:00.000Z', // 09:00 Manila Tue Sep 29
  endsAt: '2026-09-29T02:00:00.000Z',
  visibleTo: 'staff',
};

// Spans Manila days Sep 28, 29, 30 → continuation chips on 29 + 30.
const OUTREACH: TeamEvent = {
  id: 'e2',
  title: 'Outreach Drive',
  startsAt: '2026-09-28T00:00:00.000Z',
  endsAt: '2026-09-30T00:00:00.000Z',
  visibleTo: 'staff',
};

function renderWeek(
  overrides: Partial<React.ComponentProps<typeof WeekView>> = {},
): {
  onSlotClick: ReturnType<typeof vi.fn>;
  onBlockClick: ReturnType<typeof vi.fn>;
  onEventClick: ReturnType<typeof vi.fn>;
} {
  const onSlotClick = vi.fn();
  const onBlockClick = vi.fn();
  const onEventClick = vi.fn();
  render(
    <WeekView
      blocks={[]}
      events={[]}
      from={FROM}
      staff={STAFF}
      onSlotClick={onSlotClick}
      onBlockClick={onBlockClick}
      onEventClick={onEventClick}
      {...overrides}
    />,
  );
  return { onSlotClick, onBlockClick, onEventClick };
}

describe('WeekView', () => {
  it('renders a synced court-hearing block with its label and case note', () => {
    renderWeek({
      blocks: [{
        id: 'b1', userId: 'u1', blockDate: localIsoDay(FROM), blockType: 'court_hearing',
        startTime: null, endTime: null, visibleTo: 'team', source: 'case_event', sourceRef: 'e1',
        note: 'Case MSWD-2026-0012 — Hearing (RTC Bulacan)',
      }],
    });
    const chip = screen.getByRole('button', { name: /Court Hearing/ });
    expect(chip).toBeTruthy();
    // The case note rides in the tooltip (the chip shows the type label).
    expect(chip.getAttribute('title')).toContain('MSWD-2026-0012');
  });

  it('renders one row per staff member and Monday-first day columns', () => {
    renderWeek();

    for (const member of STAFF) {
      expect(screen.getByText(member.name)).toBeTruthy();
    }

    const headerRow = screen.getByText('Staff').parentElement as HTMLElement;
    // Weekday label and day number sit in sibling <p> tags — textContent
    // concatenates without whitespace ("Mon" + "28" → "Mon28").
    const headerText = headerRow.textContent?.replace(/\s+/g, ' ') ?? '';
    expect(headerText).toContain('Mon28');
    expect(headerText).toContain('Sun4');
    const dayCells =
      headerText.match(/Mon\d+|Tue\d+|Wed\d+|Thu\d+|Fri\d+|Sat\d+|Sun\d+/g) ?? [];
    expect(dayCells).toHaveLength(7);
  });

  it('pins the signed-in user row first and shows the You badge on that row only', () => {
    // Roster with many members, self (Ben) in the MIDDLE of the API order —
    // the page-level pinning moves Ben up; Ana + Carla keep their order.
    const staff = withSelfPinned(MANY_STAFF, 'u2', 'Ben Social');
    renderWeek({ staff, myUserId: 'u2' });

    const labels = screen.getAllByText(/Ana Admin|Ben Social|Carla Worker/);
    expect(labels).toHaveLength(3);
    expect(labels[0]).toHaveTextContent('Ben Social');
    expect(labels[1]).toHaveTextContent('Ana Admin');
    expect(labels[2]).toHaveTextContent('Carla Worker');

    // Badge: exactly one, on the self row only.
    expect(screen.getAllByText('You')).toHaveLength(1);
    const selfLabel = labels[0].closest('div') as HTMLElement;
    expect(within(selfLabel).getByText('You')).toBeTruthy();
    expect(within(labels[1].closest('div') as HTMLElement).queryByText('You')).toBeNull();
    expect(within(labels[2].closest('div') as HTMLElement).queryByText('You')).toBeNull();
  });

  it('does not show the You badge when no signed-in user is supplied', () => {
    renderWeek({ staff: withSelfPinned(MANY_STAFF, 'u2', 'Ben Social') });
    expect(screen.queryByText('You')).toBeNull();
  });

  it('renders a block bar with the type color class (and the fallback for unknown types)', () => {
    const odd = { ...FULL_DAY_BLOCK, id: 'b3', blockType: 'weekend_errand' };
    renderWeek({ blocks: [FULL_DAY_BLOCK, odd] });

    const bar = screen.getByRole('button', {
      name: 'Ana Admin — Home visit on 2026-09-28',
    });
    expect(bar.className).toContain(BLOCK_COLORS.home_visit);

    const fallbackBar = screen.getByRole('button', {
      name: 'Ana Admin — weekend_errand on 2026-09-28',
    });
    expect(fallbackBar.className).toContain(BLOCK_COLOR_FALLBACK);
  });

  it('positions bars by start/end time when both present, full-height otherwise', () => {
    renderWeek({ blocks: [FULL_DAY_BLOCK, TIMED_BLOCK] });

    const timed = screen.getByRole('button', { name: 'Ana Admin — In office on 2026-09-28' });
    expect(timed.style.top).toBe('37.5%'); // 09:00 = 540/1440
    expect(timed.style.height).toBe('12.5%'); // 09:00–12:00 = 180/1440

    const full = screen.getByRole('button', { name: 'Ana Admin — Home visit on 2026-09-28' });
    expect(full.style.top).toBe('0px');
    expect(full.style.height).toBe('100%');
  });

  it('calls onSlotClick(staffId, date) when an empty slot is clicked', () => {
    const { onSlotClick } = renderWeek();

    fireEvent.click(
      screen.getByRole('button', { name: 'New block for Ben Social on 2026-09-29' }),
    );

    expect(onSlotClick).toHaveBeenCalledTimes(1);
    expect(onSlotClick).toHaveBeenCalledWith('u2', '2026-09-29');
  });

  it('calls onBlockClick(block) when a block bar is clicked', () => {
    const { onBlockClick } = renderWeek({ blocks: [TIMED_BLOCK] });

    fireEvent.click(
      screen.getByRole('button', { name: 'Ana Admin — In office on 2026-09-28' }),
    );

    expect(onBlockClick).toHaveBeenCalledTimes(1);
    expect(onBlockClick).toHaveBeenCalledWith(TIMED_BLOCK);
  });

  it('renders a multi-day block as one slice per covered day with flush continuation edges', () => {
    renderWeek({ blocks: [MULTI_DAY_BLOCK] });

    // One slice in each of the three consecutive covered cells…
    const first = screen.getByRole('button', { name: 'Ana Admin — Home visit on 2026-09-28' });
    const middle = screen.getByRole('button', { name: 'Ana Admin — Home visit on 2026-09-29' });
    const last = screen.getByRole('button', { name: 'Ana Admin — Home visit on 2026-09-30' });

    // …with the continuity edges: first keeps left rounding + border, the
    // middle is flush/flat (continuation class), the last right-rounded.
    expect(first.className).toContain('rounded-l-sm');
    expect(first.className).toContain('border-l-2');
    expect(middle.className).toContain('block-slice-continuation');
    expect(middle.className).not.toContain('rounded-l-sm');
    expect(middle.className).not.toContain('border-l-2');
    expect(last.className).toContain('rounded-r-sm');
    expect(last.className).not.toContain('border-l-2');

    // Every slice keeps the block's type color.
    expect(first.className).toContain(BLOCK_COLORS.home_visit);
    expect(middle.className).toContain(BLOCK_COLORS.home_visit);
    expect(last.className).toContain(BLOCK_COLORS.home_visit);

    // No slice outside the range (Thu Oct 1 has none).
    expect(
      screen.queryByRole('button', { name: 'Ana Admin — Home visit on 2026-10-01' }),
    ).toBeNull();
  });

  it('clicking any slice opens the same logical block', () => {
    const { onBlockClick } = renderWeek({ blocks: [MULTI_DAY_BLOCK] });

    fireEvent.click(
      screen.getByRole('button', { name: 'Ana Admin — Home visit on 2026-09-29' }),
    );

    expect(onBlockClick).toHaveBeenCalledTimes(1);
    expect(onBlockClick).toHaveBeenCalledWith(MULTI_DAY_BLOCK);
  });

  it('a same-day block still renders exactly one full-rounded slice', () => {
    renderWeek({ blocks: [FULL_DAY_BLOCK] });

    const bar = screen.getByRole('button', { name: 'Ana Admin — Home visit on 2026-09-28' });
    expect(bar.className).toContain('rounded-sm');
    expect(bar.className).toContain('border-l-2');
    expect(bar.className).not.toContain('block-slice-continuation');
    expect(
      screen.queryByRole('button', { name: 'Ana Admin — Home visit on 2026-09-29' }),
    ).toBeNull();
  });

  it('shows events on the all-day strip and a continuation chip for multi-day events', () => {
    renderWeek({ events: [MEETING, OUTREACH] });

    // One-shot event: a single chip on its Manila day.
    expect(screen.getByText('Team Meeting')).toBeTruthy();

    // Multi-day event: a start-day chip plus a continuation chip per later day.
    expect(screen.getByText('Outreach Drive')).toBeTruthy();
    expect(screen.getAllByText(/^↳ Outreach Drive$/)).toHaveLength(2);
  });

  it('readOnly disables both the slot and block affordances', () => {
    const { onSlotClick, onBlockClick } = renderWeek({
      blocks: [FULL_DAY_BLOCK],
      readOnly: true,
    });

    const slot = screen.getByRole('button', { name: 'New block for Ben Social on 2026-09-29' });
    const bar = screen.getByRole('button', { name: 'Ana Admin — Home visit on 2026-09-28' });
    expect(slot).toBeDisabled();
    expect(bar).toBeDisabled();

    fireEvent.click(slot);
    fireEvent.click(bar);
    expect(onSlotClick).not.toHaveBeenCalled();
    expect(onBlockClick).not.toHaveBeenCalled();
  });

  it('calls onEventClick(event) when an event chip is clicked (click-to-edit)', () => {
    const { onEventClick } = renderWeek({ events: [MEETING] });

    fireEvent.click(screen.getByRole('button', { name: 'Team Meeting' }));

    expect(onEventClick).toHaveBeenCalledTimes(1);
    expect(onEventClick).toHaveBeenCalledWith(MEETING);
  });

  it('readOnly disables the event chips too, so coordinators cannot open the editor', () => {
    const { onEventClick } = renderWeek({ events: [MEETING], readOnly: true });

    const chip = screen.getByRole('button', { name: 'Team Meeting' });
    expect(chip).toBeDisabled();
    fireEvent.click(chip);
    expect(onEventClick).not.toHaveBeenCalled();
  });

  it('shows a continuation chip on Monday for an event that started before the week and spans into it (spec edge #3)', () => {
    // One-shot Mon–Fri start/end spanning the boundary: starts Mon Sep 21
    // 09:00 Manila, ends Fri Oct 9 17:00 Manila. The window Oct 5–11 sits
    // inside its span, so every in-window day is a continuation chip.
    const spanning: TeamEvent = {
      id: 'e3',
      title: 'All Hands',
      startsAt: '2026-09-21T01:00:00.000Z',
      endsAt: '2026-10-09T09:00:00.000Z',
      visibleTo: 'staff',
    };
    renderWeek({ events: [spanning], from: new Date(2026, 9, 5) });

    // Monday's strip cell carries the continuation chip…
    const monday = screen.getByTestId('week-events-strip-2026-10-05');
    expect(within(monday).getByText(/^↳ All Hands$/)).toBeTruthy();
    expect(within(monday).getByTitle('All Hands (started earlier)')).toBeTruthy();

    // …and the chip spans the covered days (Mon–Fri), not the weekend.
    expect(within(screen.getByTestId('week-events-strip-2026-10-09')).getByText(/^↳ All Hands$/)).toBeTruthy();
    expect(screen.getByTestId('week-events-strip-2026-10-10').textContent).toBe('');
    expect(screen.getByTestId('week-events-strip-2026-10-11').textContent).toBe('');
  });
});

// --- Mobile: single-day-per-staff agenda ---

/** Toggle the setup's matchMedia stub so `(max-width: 767px)` reports the
 *  wanted answer (tests/setup.ts default is no-match → desktop grid). */
function installMatchMedia(mobile: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === '(max-width: 767px)' ? mobile : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

describe('WeekView breakpoint boundary', () => {
  it('renders the desktop 7-day grid at/above md (768px — 767px query no-match)', () => {
    // Explicit no-match for `(max-width: 767px)`, i.e. a viewport ≥ 768px.
    installMatchMedia(false);

    renderWeek({ events: [MEETING] });

    expect(screen.getByTestId('week-events-strip-2026-09-29')).toBeTruthy();
    expect(screen.queryByTestId('mobile-day-label')).toBeNull();
  });

  it('renders the single-day mobile agenda under md (767px query matches)', () => {
    installMatchMedia(true);

    renderWeek();

    expect(screen.getByTestId('mobile-day-label')).toBeTruthy();
    expect(screen.queryByTestId(/^week-events-strip-/)).toBeNull();
  });
});

describe('WeekView mobile agenda', () => {
  // Fixed "today" (Mon Sep 28 2026, 08:00 local) so the agenda fixtures never
  // depend on the wall clock — a midnight-crossing run cannot flake.
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 28, 8, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a single-day staff agenda with a day stepper at narrow widths', () => {
    installMatchMedia(true);
    const today = new Date();
    const tomorrow = addDays(today, 1);
    const todayStr = localIsoDay(today);
    const tomorrowStr = localIsoDay(tomorrow);

    const todayBlock: TeamBlock = {
      id: 'm1',
      userId: 'u1',
      blockDate: todayStr,
      blockType: 'home_visit',
      startTime: '09:00',
      endTime: '12:00',
      note: null,
      visibleTo: 'team',
    };
    const tomorrowBlock: TeamBlock = {
      id: 'm2',
      userId: 'u2',
      blockDate: tomorrowStr,
      blockType: 'in_office',
      startTime: null,
      endTime: null,
      note: null,
      visibleTo: 'team',
    };

    render(
      <WeekView
        blocks={[todayBlock, tomorrowBlock]}
        events={[]}
        from={weekStart(today)}
        staff={STAFF}
        onSlotClick={vi.fn()}
        onBlockClick={vi.fn()}
      />,
    );

    // Day label defaults to today; the day's blocks appear under staff headers.
    expect(screen.getByTestId('mobile-day-label').textContent).toContain(
      formatDate(todayStr),
    );
    expect(screen.getByRole('heading', { name: 'Ana Admin' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Ben Social' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ana Admin — Home visit on ' + todayStr })).toBeTruthy();
    // Tomorrow's block is not on today's agenda.
    expect(screen.queryByRole('button', { name: /Ben Social —/ })).toBeNull();

    // Stepping to the next day swaps the agenda to that day's blocks.
    fireEvent.click(screen.getByRole('button', { name: 'Next day' }));
    expect(screen.getByRole('button', { name: 'Ben Social — In office on ' + tomorrowStr })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Ana Admin —/ })).toBeNull();
  });

  it('pins the self staff section first and badges it on mobile', () => {
    installMatchMedia(true);
    render(
      <WeekView
        blocks={[]}
        events={[]}
        from={FROM}
        staff={withSelfPinned(MANY_STAFF, 'u2', 'Ben Social')}
        myUserId="u2"
        onSlotClick={vi.fn()}
        onBlockClick={vi.fn()}
      />,
    );

    // Sections follow the pinned roster: Ben (self) first, then the stable
    // API order for everyone else.
    const headings = screen.getAllByRole('heading');
    expect(headings).toHaveLength(3);
    expect(headings[0]).toHaveTextContent('Ben Social');
    expect(within(headings[0]).getByText('You')).toBeTruthy();
    expect(headings[1]).toHaveTextContent('Ana Admin');
    expect(within(headings[1]).queryByText('You')).toBeNull();
    expect(headings[2]).toHaveTextContent('Carla Worker');
    expect(within(headings[2]).queryByText('You')).toBeNull();
  });

  it('lists a multi-day block on every day of its range with a day counter', () => {
    installMatchMedia(true);
    const today = new Date(); // fixed by fake timers (Mon Sep 28 2026)
    const tomorrow = addDays(today, 1);
    const todayStr = localIsoDay(today);
    const tomorrowStr = localIsoDay(tomorrow);

    const multiDay: TeamBlock = {
      id: 'm3',
      userId: 'u1',
      blockDate: todayStr,
      endDate: tomorrowStr,
      blockType: 'home_visit',
      startTime: null,
      endTime: null,
      note: null,
      visibleTo: 'team',
    };

    render(
      <WeekView
        blocks={[multiDay]}
        events={[]}
        from={weekStart(today)}
        staff={STAFF}
        onSlotClick={vi.fn()}
        onBlockClick={vi.fn()}
      />,
    );

    // Today's row carries "Day 1/2"; the day after shows the same block as
    // "Day 2/2" — one row per covered day.
    const todayRow = screen.getByRole('button', {
      name: 'Ana Admin — Home visit on ' + todayStr,
    });
    expect(todayRow.textContent).toContain('Day 1/2');

    fireEvent.click(screen.getByRole('button', { name: 'Next day' }));
    const tomorrowRow = screen.getByRole('button', {
      name: 'Ana Admin — Home visit on ' + tomorrowStr,
    });
    expect(tomorrowRow.textContent).toContain('Day 2/2');
  });

  it('hides the desktop 7-day grid on mobile (no day columns, no slot affordances)', () => {
    installMatchMedia(true);
    render(
      <WeekView
        blocks={[]}
        events={[]}
        from={FROM}
        staff={STAFF}
        onSlotClick={vi.fn()}
        onBlockClick={vi.fn()}
      />,
    );

    expect(screen.queryByTestId(/^week-events-strip-/)).toBeNull();
    expect(screen.queryByRole('button', { name: /New block for/ })).toBeNull();
  });
});