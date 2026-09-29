import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import i18n from '@/i18n';
import { MonthView } from './MonthView';
import {
  BLOCK_COLORS,
  BLOCK_COLOR_FALLBACK,
  BLOCK_TYPES,
  BLOCK_TYPE_LABEL_KEYS,
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
    visibleTo: 'team' as const,
  },
  {
    id: 'b2',
    userId: 'u2',
    blockDate: '2026-09-28',
    blockType: 'on_leave',
    startTime: null,
    endTime: null,
    note: null,
    visibleTo: 'team' as const,
  },
  {
    id: 'b3',
    userId: 'u1',
    blockDate: '2026-10-05',
    blockType: 'field_day',
    startTime: null,
    endTime: null,
    note: null,
    visibleTo: 'team' as const,
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

  it('dots every covered day of a multi-day block range', () => {
    const multiDay: TeamBlock = {
      id: 'b8',
      userId: 'u3',
      blockDate: '2026-09-28',
      endDate: '2026-09-30',
      blockType: 'remote',
      startTime: null,
      endTime: null,
      note: null,
      visibleTo: 'team' as const,
    };
    renderMonth({ blocks: [multiDay] });

    // One dot in each of the three covered cells (Sep 28/29/30)…
    for (const day of ['28', '29', '30']) {
      const cell = screen.getByText(day).closest('div') as HTMLElement;
      const dots = cell.querySelectorAll('.rounded-full');
      expect(dots).toHaveLength(1);
      expect((dots[0] as HTMLElement).className).toContain(
        BLOCK_COLORS.remote.split(' ')[0],
      );
    }
    // …and none on the neighboring days (Sun Sep 27, Thu Oct 1).
    const sep27Cell = screen.getByText('27').closest('div') as HTMLElement;
    expect(sep27Cell.querySelectorAll('.rounded-full')).toHaveLength(0);
    // '1' matches Sep 1 AND Oct 1 — neither neighbor day has a dot.
    for (const label of screen.getAllByText('1')) {
      const cell = label.closest('div') as HTMLElement;
      expect(cell.querySelectorAll('.rounded-full')).toHaveLength(0);
    }
  });

  it('renders the legend mapping every block type to its dot color', () => {
    renderMonth();

    for (const type of BLOCK_TYPES) {
      const labelKey = BLOCK_TYPE_LABEL_KEYS[type];
      const label = screen.getByText(i18n.t(labelKey, labelKey));
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

  // --- Placement + edit affordances (canEdit) ---

  it('renders no placement/editing affordances when canEdit is false', () => {
    const onPlaceBlock = vi.fn();
    const onBlockClick = vi.fn();
    renderMonth({
      blocks: [BLOCKS[0]], // Ana's own block, but read-only viewer
      canEdit: false,
      myUserId: 'u1',
      onPlaceBlock,
      onBlockClick,
    });

    // No "+" chips anywhere, and no editable dot buttons.
    expect(screen.queryByRole('button', { name: /^Place your block on/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Edit / })).toBeNull();

    // Clicking the day cell and the block dot fire neither callback.
    const cell = screen.getByText('28').closest('div') as HTMLElement;
    fireEvent.click(cell);
    const dot = cell.querySelector('.rounded-full') as HTMLElement;
    fireEvent.click(dot);
    expect(onPlaceBlock).not.toHaveBeenCalled();
    expect(onBlockClick).not.toHaveBeenCalled();
  });

  it('shows the "+" chip only on in-month cells when canEdit', () => {
    renderMonth({ canEdit: true, myUserId: 'u1' });

    // September 2026 has 30 in-month days → exactly 30 place buttons.
    expect(screen.getAllByRole('button', { name: /^Place your block on/ })).toHaveLength(30);

    // Out-of-month cells (Aug 31, Oct 10) get no placement affordance.
    expect(screen.queryByRole('button', { name: 'Place your block on 2026-08-31' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Place your block on 2026-10-10' })).toBeNull();
  });

  it('clicking an in-month cell body places on that exact day; out-of-month cells do nothing', () => {
    const onPlaceBlock = vi.fn();
    renderMonth({ canEdit: true, myUserId: 'u1', onPlaceBlock });

    const cell = screen.getByText('28').closest('div') as HTMLElement;
    fireEvent.click(cell);
    expect(onPlaceBlock).toHaveBeenCalledWith('2026-09-28');

    // A muted neighbor-month cell is inert — no placement from it.
    const outCell = screen.getByText('31').closest('div') as HTMLElement; // Aug 31
    fireEvent.click(outCell);
    expect(onPlaceBlock).toHaveBeenCalledTimes(1);
  });

  it('turns the OWN block dot into an edit button that opens onBlockClick (not placement)', () => {
    const onPlaceBlock = vi.fn();
    const onBlockClick = vi.fn();
    renderMonth({
      blocks: [BLOCKS[0], BLOCKS[1]], // u1 own + u2 colleague on Sep 28
      canEdit: true,
      myUserId: 'u1',
      onPlaceBlock,
      onBlockClick,
    });

    const ownBtn = screen.getByRole('button', {
      name: 'Edit Home visit on 2026-09-28',
    }) as HTMLElement;
    fireEvent.click(ownBtn);
    expect(onBlockClick).toHaveBeenCalledWith(BLOCKS[0]);
    // The dot click must not ALSO open placement for the day.
    expect(onPlaceBlock).not.toHaveBeenCalled();
  });

  it('leaves colleague block dots inert — onBlockClick never fires for them', () => {
    const onBlockClick = vi.fn();
    renderMonth({
      blocks: [BLOCKS[0], BLOCKS[1]],
      canEdit: true,
      myUserId: 'u1',
      onPlaceBlock: vi.fn(),
      onBlockClick,
    });

    // Ben's (u2) on_leave dot on Sep 28 is a plain span, not a button.
    expect(screen.queryByRole('button', { name: /^Edit On leave/ })).toBeNull();

    const cell = screen.getByText('28').closest('div') as HTMLElement;
    const dots = cell.querySelectorAll('.rounded-full');
    expect(dots).toHaveLength(2);
    fireEvent.click(dots[1]); // the colleague dot
    expect(onBlockClick).not.toHaveBeenCalled();
  });
});