import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MonthView } from './MonthView';
import {
  BLOCK_COLORS,
  BLOCK_COLOR_FALLBACK,
  BLOCK_TYPES,
  BLOCK_TYPE_LABELS,
} from './team-utils';
import type { TeamBlock, TeamEvent } from '../../lib/team-api';

// September 2026: the 1st is a Tuesday, so the Monday-first grid runs
// Mon Aug 31 – Sun Oct 11 2026.
const FROM = new Date(2026, 8, 14);

const BLOCKS: TeamBlock[] = [
  {
    id: 'b1',
    userId: 'u1',
    blockDate: '2026-09-28',
    blockType: 'home_visit',
    startTime: null,
    endTime: null,
    note: null,
  },
  {
    id: 'b2',
    userId: 'u2',
    blockDate: '2026-09-28',
    blockType: 'on_leave',
    startTime: null,
    endTime: null,
    note: null,
  },
  {
    id: 'b3',
    userId: 'u1',
    blockDate: '2026-10-05',
    blockType: 'field_day',
    startTime: null,
    endTime: null,
    note: null,
  },
];

// 09:00 Manila, Tue Sep 29 2026 — one-shot.
const MEETING: TeamEvent = {
  id: 'e1',
  title: 'Team Meeting',
  startsAt: '2026-09-29T01:00:00.000Z',
  endsAt: '2026-09-29T02:00:00.000Z',
  visibleTo: 'staff',
};

// Weekly every Monday from Sep 7 → instances Sep 7/14/21/28 + Oct 5 inside
// the grid (Oct 12 falls past the window's Sunday Oct 11).
const WEEKLY: TeamEvent = {
  id: 'e2',
  title: 'Weekly Check-in',
  startsAt: '2026-09-07T01:00:00.000Z',
  endsAt: '2026-09-07T02:00:00.000Z',
  visibleTo: 'staff',
  repeatRule: { freq: 'weekly' },
};

function renderMonth(overrides: Partial<React.ComponentProps<typeof MonthView>> = {}) {
  return render(
    <MonthView blocks={[]} events={[]} from={FROM} {...overrides} />,
  );
}

describe('MonthView', () => {
  it('renders the month label and a 6-week, Monday-first grid', () => {
    renderMonth();

    expect(screen.getByText('September 2026')).toBeTruthy();

    // Header row concatenates the seven weekday labels Mon…Sun, in order.
    const headerRow = screen.getByText('Mon').parentElement as HTMLElement;
    expect(headerRow.textContent?.replace(/\s+/g, '')).toBe('MonTueWedThuFriSatSun');

    // 6 weeks × 7 days = 42 day cells; first day is Aug 31 (the Monday
    // before Sep 1), last is Oct 11. Sep 11 and Oct 11 both appear.
    expect(screen.getAllByText(/^\d{1,2}$/)).toHaveLength(42);
    expect(screen.getByText('31')).toBeTruthy(); // Aug 31
    expect(screen.getAllByText('11')).toHaveLength(2); // Sep 11 + Oct 11
  });

  it('shows an event chip on its day and one chip per weekly repeat instance', () => {
    renderMonth({ events: [MEETING, WEEKLY] });

    expect(screen.getByTitle('Team Meeting')).toBeTruthy();

    // The weekly event lands on all five Mondays inside the grid window.
    expect(screen.getAllByTitle('Weekly Check-in')).toHaveLength(5);
  });

  it('renders one block dot per staff block with the type color class (fallback for unknown types)', () => {
    const odd = { ...BLOCKS[0], id: 'b9', blockType: 'weekend_errand', blockDate: '2026-09-29' };
    renderMonth({ blocks: [...BLOCKS, odd] });

    // Sep 28 has two staff blocks → two dots, each tinted by its type.
    const cell = screen.getByText('28').closest('div') as HTMLElement;
    const dots = cell.querySelectorAll('.rounded-full');
    expect(dots).toHaveLength(2);
    expect((dots[0] as HTMLElement).className).toContain(
      BLOCK_COLORS.home_visit.split(' ')[0],
    );
    expect((dots[1] as HTMLElement).className).toContain(
      BLOCK_COLORS.on_leave.split(' ')[0],
    );
    expect(within(cell).getByTitle('Home visit')).toBeTruthy();
    expect(within(cell).getByTitle('On leave')).toBeTruthy();

    // The field-day block sits in its own Oct 5 cell.
    expect(screen.getByTitle('Field day')).toBeTruthy();

    // Unknown types fall back to the muted dot color.
    const fallbackCell = screen.getByText('29').closest('div') as HTMLElement;
    const fallbackDot = fallbackCell.querySelector('.rounded-full') as HTMLElement;
    expect(fallbackDot.className).toContain(BLOCK_COLOR_FALLBACK.split(' ')[0]);
  });

  it('renders the legend mapping every block type to its dot color', () => {
    renderMonth();

    for (const type of BLOCK_TYPES) {
      const label = screen.getByText(BLOCK_TYPE_LABELS[type]);
      const item = label.closest('span') as HTMLElement;
      const dot = item.querySelector('.rounded-full') as HTMLElement;
      expect(dot.className).toContain(BLOCK_COLORS[type].split(' ')[0]);
    }
    expect(screen.getAllByText(/^(In office|Home visit|Field day|On leave|Remote)$/)).toHaveLength(5);
  });

  it('mutes cells outside the current month', () => {
    renderMonth();

    // Aug 31 and Oct 11 belong to the neighboring months in the grid.
    const augCell = screen.getByText('31').closest('div') as HTMLElement;
    expect(augCell.className).toContain('bg-muted/20');
    expect((screen.getByText('31') as HTMLElement).className).toContain('text-muted-foreground');

    // A September cell is not muted.
    const sepCell = screen.getByText('28').closest('div') as HTMLElement;
    expect(sepCell.className).not.toContain('bg-muted/20');
    expect((screen.getByText('28') as HTMLElement).className).toContain('text-foreground');
  });

  it('ring-outlines exactly the today cell', () => {
    const today = new Date();
    renderMonth({ from: today });

    const ringCells = screen
      .getAllByText(/^\d{1,2}$/)
      .filter(label => {
        const cell = label.closest('div') as HTMLElement;
        return cell?.className.includes('ring-inset') && cell?.className.includes('ring-primary');
      });

    expect(ringCells).toHaveLength(1);
    expect(ringCells[0].textContent).toBe(String(today.getDate()));
  });
});