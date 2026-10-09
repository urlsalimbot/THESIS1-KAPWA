import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RowDecisionCard, type DedupCandidate, type DedupRow } from './RowDecisionCard';

const row: DedupRow = {
  id: 'r2', rowIndex: 2, lastName: 'Reyes', firstName: 'Pedro', middleName: 'P.',
  dob: '1988-03-21', barangay: 'Bigte', status: 'deprioritized',
  eligibility: 'disqualified',
  eligibilityReason: 'Received food_pack on 2026-09-25 — within the last 30 days',
};

const personCandidate: DedupCandidate = {
  id: 'm1', targetType: 'db_person', score: 0.91, status: 'primary', signals: {},
  person: { id: 'p1', lastName: 'Reyes', firstName: 'Pedro', middleName: 'P.', dob: '1988-03-21', barangay: 'Bigte' },
  interventions: 2,
  cases: [{ controlNo: 'C-2026-001', status: 'active' }, { controlNo: 'C-2026-002', status: 'closed' }],
  remarks: [
    { kind: 'decision', remark: 'Same person.', source: 'Batch 1.xlsx', authorName: 'Juan Dela Cruz', createdAt: '2026-10-01T02:30:00Z' },
    { kind: 'import', remark: 'AICS food pack request', source: 'Batch 1.xlsx', authorName: null, createdAt: '2026-10-01T01:00:00Z' },
  ],
};

describe('RowDecisionCard', () => {
  it('renders the matched candidate as evidence with cases, interventions and recent remarks', () => {
    render(<RowDecisionCard row={row} candidates={[personCandidate]} onEligibility={vi.fn()} />);
    expect(screen.getByText(/C-2026-001/)).toBeTruthy();
    expect(screen.getByText(/2 interventions/i)).toBeTruthy();
    expect(screen.getByText(/recent remarks/i)).toBeTruthy();
    expect(screen.getByText(/Same person\./)).toBeTruthy();
    expect(screen.getByText('Decision')).toBeTruthy();
    expect(screen.getByText('Batch 1.xlsx · Juan Dela Cruz')).toBeTruthy();
    expect(screen.getByText('Matched')).toBeTruthy();
  });

  it('shows the household-served badge and each member; no remarks section', () => {
    const household: DedupCandidate = {
      id: 'm2', targetType: 'household', score: 0.88, status: 'primary', signals: { householdServed: true },
      household: {
        id: 'h1', memberPersonIds: ['p9'],
        members: [
          { personId: 'p9', lastName: 'Reyes', firstName: 'Maria', interventions: 1, cases: [{ controlNo: 'C-2026-009', status: 'active' }] },
        ],
      },
    };
    render(<RowDecisionCard row={row} candidates={[household]} onEligibility={vi.fn()} />);
    expect(screen.getByText(/household already served/i)).toBeTruthy();
    expect(screen.getByText(/Maria/)).toBeTruthy();
    expect(screen.getByText(/C-2026-009/)).toBeTruthy();
    expect(screen.getByText(/1 intervention/i)).toBeTruthy();
    expect(screen.queryByText(/recent remarks/i)).toBeNull();
  });

  it('shows the disqualification with its reason and offers waive/confirm while undecided', async () => {
    const onEligibility = vi.fn().mockResolvedValue(undefined);
    render(
      <RowDecisionCard
        row={{ ...row, eligibilityDecision: undefined }}
        candidates={[personCandidate]}
        onEligibility={onEligibility}
      />,
    );
    expect(screen.getByText(/Disqualified — review needed/i)).toBeTruthy();
    expect(screen.getByText(/within the last 30 days/)).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: /waive — serve anyway/i }));
    expect(onEligibility).toHaveBeenCalledWith('waive');

    await userEvent.click(screen.getByRole('button', { name: /confirm disqualified/i }));
    expect(onEligibility).toHaveBeenCalledWith('confirm');
  });

  it('offers no buttons once the disqualification is decided', () => {
    render(
      <RowDecisionCard
        row={{ ...row, eligibilityDecision: 'confirm' }}
        candidates={[personCandidate]}
        onEligibility={vi.fn()}
      />,
    );
    expect(screen.getByText(/confirmed, not served/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /waive/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /confirm disqualified/i })).toBeNull();

    render(
      <RowDecisionCard
        row={{ ...row, eligibilityDecision: 'waive', status: 'retained' }}
        candidates={[personCandidate]}
        onEligibility={vi.fn()}
      />,
    );
    expect(screen.getByText(/waived, served after review/i)).toBeTruthy();
  });

  it('requires a decision on every pending match of a disqualified row', async () => {
    const onMatchEligibility = vi.fn().mockResolvedValue(undefined);
    const pending: DedupCandidate = { ...personCandidate, status: 'pending' };
    render(
      <RowDecisionCard
        row={{ ...row, eligibilityDecision: undefined }}
        candidates={[pending]}
        onEligibility={vi.fn()}
        onMatchEligibility={onMatchEligibility}
      />,
    );
    expect(screen.getByText('Review needed')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /^waive$/i }));
    expect(onMatchEligibility).toHaveBeenCalledWith('m1', 'waive');
    await userEvent.click(screen.getByRole('button', { name: /^confirm$/i }));
    expect(onMatchEligibility).toHaveBeenCalledWith('m1', 'confirm');
  });

  it('shows no disqualification panel for allowed rows', () => {
    render(
      <RowDecisionCard
        row={{ ...row, eligibility: 'allowed', eligibilityReason: undefined, status: 'retained' }}
        candidates={[personCandidate]}
        onEligibility={vi.fn()}
      />,
    );
    expect(screen.queryByText(/review needed/i)).toBeNull();
    expect(screen.queryByText(/Disqualified/i)).toBeNull();
  });

  it('says so when a row has no candidate matches', () => {
    render(<RowDecisionCard row={row} candidates={[]} onEligibility={vi.fn()} />);
    expect(screen.getByText(/no candidate matches/i)).toBeTruthy();
  });
});