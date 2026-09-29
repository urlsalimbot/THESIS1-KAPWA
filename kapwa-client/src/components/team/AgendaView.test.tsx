import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import i18n from '@/i18n';
import { AgendaView } from './AgendaView';
import { BLOCK_COLORS, WEEKDAY_LABEL_KEYS } from './team-utils';
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
  location: 'Session Hall',
};

const WEEKDAY_INDEX = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
};

/**
 * Exact day-header text the component renders for `day` + `count` entries.
 * Pluralized: a single entry reads "1 entry", not "1 entries".
 */
function headerText(day: string, count: number): string {
  const label = count === 1 ? `${count} entry` : `${count} entries`;
  return `${i18n.t(WEEKDAY_LABEL_KEYS[WEEKDAY_INDEX(day)])}, ${formatDate(day)} · ${label}`;
}

/** The <ul> of the day group whose header renders `day` with `count` entries. */
function dayList(day: string, count: number): HTMLElement {
  const header = screen.getByText(headerText(day, count));
  const dayDiv = header.parentElement as HTMLElement; // header div → day div
  return dayDiv.querySelector('ul') as HTMLElement;
}

describe('AgendaView', () => {
  it('renders a day header with weekday, formatted date and the entry count', () => {
    render(<AgendaView blocks={BLOCKS} events={[WEEKLY, MEETING]} staff={STAFF} from={FROM} />);

    // Sep 28: two blocks + the weekly sync → 3 entries; header is exact.
    expect(screen.getByText(headerText('2026-09-28', 3))).toBeTruthy();
    // Single-entry days carry the count too, pluralized as "1 entry".
    expect(screen.getByText(headerText('2026-09-29', 1))).toBeTruthy();
    expect(screen.getByText(headerText('2026-10-02', 1))).toBeTruthy();
    expect(screen.queryByText(/· 1 entries/)).toBeNull();
    // The out-of-window block does not leak a day group.
    expect(screen.queryByText(headerText('2026-10-12', 1))).toBeNull();
  });

  it('shows the time column: timed ranges and All day, plus the type label and initials', () => {
    render(<AgendaView blocks={BLOCKS} events={[]} staff={STAFF} from={FROM} />);

    const day28 = dayList('2026-09-28', 2);
    const texts = Array.from(day28.querySelectorAll('li')).map(li => li.textContent ?? '');
    expect(texts[0]).toContain('All day');
    expect(texts[0]).toContain('Ben Social');
    expect(texts[0]).toContain('BS'); // initials avatar
    expect(texts[0]).toContain('Home visit');
    expect(texts[1]).toContain('09:00–12:00');
    expect(texts[1]).toContain('Ana Admin');
    expect(texts[1]).toContain('AA'); // initials avatar
    expect(texts[1]).toContain('In office');
  });

  it('renders the block note when present and omits the column otherwise', () => {
    const noted: TeamBlock = {
      ...BLOCKS[1],
      id: 'b9',
      blockDate: '2026-10-01',
      note: 'FDS at Bgy. Bigte',
    };
    render(<AgendaView blocks={[noted, BLOCKS[0]]} events={[]} staff={STAFF} from={FROM} />);

    const dayOct1 = dayList('2026-10-01', 1);
    expect(dayOct1.textContent).toContain('FDS at Bgy. Bigte');
    // The note-less day's rows carry no note text.
    expect(dayList('2026-09-28', 1).textContent).not.toContain('FDS at Bgy. Bigte');
  });

  it('renders multi-day spans as one full row + dimmed Day n/total continuation rows', () => {
    const multiDay: TeamBlock = {
      id: 'b5',
      userId: 'u2',
      blockDate: '2026-09-28',
      endDate: '2026-09-30',
      blockType: 'in_office',
      startTime: '09:00',
      endTime: '12:00',
      note: null,
      visibleTo: 'team' as const,
    };
    // Spans outside the window (Oct 12–13) — must be filtered out entirely.
    const outside: TeamBlock = {
      id: 'b6',
      userId: 'u1',
      blockDate: '2026-10-12',
      endDate: '2026-10-13',
      blockType: 'field_day',
      startTime: null,
      endTime: null,
      note: null,
      visibleTo: 'team' as const,
    };
    render(<AgendaView blocks={[multiDay, outside]} events={[]} staff={STAFF} from={FROM} />);

    // First covered day: the full compact row (time, initials, name, type).
    const day28 = dayList('2026-09-28', 1);
    expect(day28.textContent).toContain('09:00–12:00');
    expect(day28.textContent).toContain('Ben Social');
    expect(day28.textContent).toContain('In office');

    // Later covered days: dimmed continuation rows with the day counter.
    const day29Row = dayList('2026-09-29', 1).querySelector('li') as HTMLElement;
    expect(day29Row.textContent).toBe('↳ In office · Day 2/3');
    expect(day29Row.className).toContain('text-muted-foreground');
    const day30Row = dayList('2026-09-30', 1).querySelector('li') as HTMLElement;
    expect(day30Row.textContent).toBe('↳ In office · Day 3/3');

    // The range fully outside the window leaks nothing.
    expect(screen.queryByText(headerText('2026-10-12', 1))).toBeNull();
    expect(screen.queryByText(headerText('2026-10-13', 1))).toBeNull();
  });

  it('styles event rows with the indigo strip instead of a dot', () => {
    render(<AgendaView blocks={[]} events={[MEETING]} staff={STAFF} from={FROM} />);

    const row = dayList('2026-09-29', 1).querySelector('li') as HTMLElement;
    expect(row.className).toContain('border-indigo-500');
    expect(row.className).toContain('border-l-2');
    // Title + time range + location all survive on the row.
    expect(row.textContent).toContain('Quarterly Meeting');
    expect(row.textContent).toContain('Session Hall');
    expect(row.textContent).toMatch(/9:00 AM – 10:00 AM/);
  });

  it('adds no per-row borders to block rows (only the day header carries one)', () => {
    render(<AgendaView blocks={BLOCKS} events={[MEETING]} staff={STAFF} from={FROM} />);

    const day28Rows = dayList('2026-09-28', 2).querySelectorAll('li');
    for (const row of day28Rows) {
      expect(row.className).not.toMatch(/border/);
    }
    // Continuation rows are border-free too.
    expect(dayList('2026-10-02', 1).querySelector('li')?.className).not.toMatch(/border/);
  });

  it('expands weekly repeat events into one row per instance in the window', () => {
    render(<AgendaView blocks={[]} events={[WEEKLY]} staff={STAFF} from={FROM} />);

    // Sep 21, Sep 28, Oct 5 — three Mondays inside Mon Aug 31 – Sun Oct 11.
    expect(screen.getAllByText('Weekly Sync')).toHaveLength(3);
  });

  it('sorts ascending by day, all-day entries first within a day', () => {
    render(<AgendaView blocks={BLOCKS} events={[WEEKLY]} staff={STAFF} from={FROM} />);

    // Day headers must appear in calendar order.
    const counts: Record<string, number> = {
      '2026-09-21': 1,
      '2026-09-28': 3,
      '2026-10-02': 1,
      '2026-10-05': 1,
    };
    const headers = ['2026-09-21', '2026-09-28', '2026-10-02', '2026-10-05'].map(d =>
      screen.getByText(headerText(d, counts[d])),
    );
    for (let i = 1; i < headers.length; i += 1) {
      expect(
        headers[i - 1].compareDocumentPosition(headers[i]) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }

    // Inside Sep 28: the all-day home visit sorts before every timed entry
    // and keeps the small type-colored dot.
    const items = Array.from(dayList('2026-09-28', 3).querySelectorAll('li'));
    expect(items[0].textContent).toContain('Ben Social');
    expect(items[0].textContent).toContain('All day');
    const dot = items[0].querySelector('.rounded-full') as HTMLElement;
    expect(dot.className).toContain(BLOCK_COLORS.home_visit.split(' ')[0]);
  });

  it('falls back to the generic staff label when the roster lacks the block owner', () => {
    const orphan: TeamBlock = {
      id: 'b7',
      userId: 'zzz',
      blockDate: '2026-10-01',
      blockType: 'remote',
      startTime: null,
      endTime: null,
      note: null,
      visibleTo: 'team' as const,
    };
    render(<AgendaView blocks={[orphan]} events={[]} staff={STAFF} from={FROM} />);

    const row = dayList('2026-10-01', 1).querySelector('li') as HTMLElement;
    expect(row.textContent).toContain(i18n.t('team.week.staff'));
    expect(row.textContent).toContain('Remote');
    expect(row.textContent).toContain('All day');
  });

  it('shows an empty state when nothing is scheduled', () => {
    render(<AgendaView blocks={[]} events={[]} staff={STAFF} from={FROM} />);

    expect(screen.getByText('Nothing scheduled in this period.')).toBeTruthy();
  });
});