import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WeekView } from './WeekView';
import { BLOCK_COLORS, BLOCK_COLOR_FALLBACK } from './team-utils';
import type { TeamBlock, TeamEvent, TeamStaffAchievement } from '../../lib/team-api';

const STAFF: TeamStaffAchievement[] = [
  { userId: 'u1', name: 'Ana Admin', cases: 2, interventions: 1, referrals: 0, docs: 1, trackerDays: 2 },
  { userId: 'u2', name: 'Ben Social', cases: 0, interventions: 3, referrals: 1, docs: 0, trackerDays: 1 },
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
};

const TIMED_BLOCK: TeamBlock = {
  id: 'b2',
  userId: 'u1',
  blockDate: '2026-09-28',
  blockType: 'in_office',
  startTime: '09:00',
  endTime: '12:00',
  note: 'Intake',
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
});