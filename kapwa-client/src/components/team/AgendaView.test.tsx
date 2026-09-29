import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AgendaView } from './AgendaView';
import { BLOCK_COLORS } from './team-utils';
import { formatDate } from '../../lib/format';
import type { TeamBlock, TeamEvent, TeamStaffAchievement } from '../../lib/team-api';

const STAFF: TeamStaffAchievement[] = [
  { userId: 'u1', name: 'Ana Admin', cases: 2, interventions: 1, referrals: 0, docs: 1, trackerDays: 2 },
  { userId: 'u2', name: 'Ben Social', cases: 0, interventions: 3, referrals: 1, docs: 0, trackerDays: 1 },
];

// Same September 2026 grid as MonthView: Mon Aug 31 – Sun Oct 11.
const FROM = new Date(2026, 8, 14);

const BLOCKS: TeamBlock[] = [
  {
    id: 'b1',
    userId: 'u1',
    blockDate: '2026-09-28',
    blockType: 'in_office',
    startTime: '09:00',
    endTime: '12:00',
    note: null,
    visibleTo: 'team' as const,
  },
  {
    id: 'b2',
    userId: 'u2',
    blockDate: '2026-09-28',
    blockType: 'home_visit',
    startTime: null,
    endTime: null,
    note: null,
    visibleTo: 'team' as const,
  },
  {
    id: 'b3',
    userId: 'u1',
    blockDate: '2026-10-02',
    blockType: 'field_day',
    startTime: null,
    endTime: null,
    note: null,
    visibleTo: 'team' as const,
  },
  // Outside the grid window (Mon Oct 12) — must be filtered out.
  {
    id: 'b4',
    userId: 'u1',
    blockDate: '2026-10-12',
    blockType: 'in_office',
    startTime: null,
    endTime: null,
    note: null,
    visibleTo: 'team' as const,
  },
];

// Weekly every Monday from Sep 21 → instances Sep 21/28 + Oct 5 in the window.
const WEEKLY: TeamEvent = {
  id: 'e1',
  title: 'Weekly Sync',
  startsAt: '2026-09-21T01:00:00.000Z',
  endsAt: '2026-09-21T02:00:00.000Z',
  visibleTo: 'staff',
  repeatRule: { freq: 'weekly' },
};

// One-shot: 09:00 Manila, Tue Sep 29.
const MEETING: TeamEvent = {
  id: 'e2',
  title: 'Quarterly Meeting',
  startsAt: '2026-09-29T01:00:00.000Z',
  endsAt: '2026-09-29T02:00:00.000Z',
  visibleTo: 'staff',
};

/** The <ul> of the day group whose header formats to `dayStr`. */
function dayList(dayStr: string): HTMLElement {
  const header = screen.getByText(formatDate(dayStr));
  const dayDiv = header.parentElement as HTMLElement; // header div → day div
  return dayDiv.querySelector('ul') as HTMLElement;
}

describe('AgendaView', () => {
  it('groups blocks and events by day and shows type labels', () => {
    render(<AgendaView blocks={BLOCKS} events={[WEEKLY, MEETING]} staff={STAFF} from={FROM} />);

    // Day headers exist for the days that have entries…
    expect(screen.getByText(formatDate('2026-09-28'))).toBeTruthy();
    expect(screen.getByText(formatDate('2026-09-29'))).toBeTruthy(); // Quarterly Meeting
    expect(screen.getByText(formatDate('2026-10-02'))).toBeTruthy();
    // …but the block outside the window does not leak into the agenda.
    expect(screen.queryByText(formatDate('2026-10-12'))).toBeNull();

    // Type label + time window on a timed block; All day on an untimed one.
    const day28 = dayList('2026-09-28');
    const texts = Array.from(day28.querySelectorAll('li')).map(li => li.textContent ?? '');
    expect(texts.some(t => t.includes('In office · 09:00–12:00'))).toBe(true);
    expect(texts.some(t => t.includes('Home visit · All day'))).toBe(true);
    expect(dayList('2026-10-02').textContent).toContain('Field day · All day');
  });

  it('expands weekly repeat events into one row per instance in the window', () => {
    render(<AgendaView blocks={[]} events={[WEEKLY]} staff={STAFF} from={FROM} />);

    // Sep 21, Sep 28, Oct 5 — three Mondays inside Mon Aug 31 – Sun Oct 11.
    expect(screen.getAllByText('Weekly Sync')).toHaveLength(3);
  });

  it('sorts ascending by day, all-day entries first within a day', () => {
    render(<AgendaView blocks={BLOCKS} events={[WEEKLY]} staff={STAFF} from={FROM} />);

    // Day headers must appear in calendar order.
    const headers = ['2026-09-21', '2026-09-28', '2026-10-02', '2026-10-05'].map(
      d => screen.getByText(formatDate(d)),
    );
    for (let i = 1; i < headers.length; i += 1) {
      expect(
        headers[i - 1].compareDocumentPosition(headers[i]) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }

    // Inside Sep 28: the all-day home visit sorts before every timed entry;
    // the block carries its staff name and the type-colored dot.
    const items = Array.from(dayList('2026-09-28').querySelectorAll('li'));
    expect(items[0].textContent).toContain('Ben Social');
    expect(items[0].textContent).toContain('Home visit · All day');
    const dot = items[0].querySelector('.rounded-full') as HTMLElement;
    expect(dot.className).toContain(BLOCK_COLORS.home_visit.split(' ')[0]);
  });

  it('shows an empty state when nothing is scheduled', () => {
    render(<AgendaView blocks={[]} events={[]} staff={STAFF} from={FROM} />);

    expect(screen.getByText('Nothing scheduled in this period.')).toBeTruthy();
  });
});