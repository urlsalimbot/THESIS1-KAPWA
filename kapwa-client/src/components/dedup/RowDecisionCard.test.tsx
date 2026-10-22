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
  remarks: [
    { kind: 'decision', remark: 'Same person.', source: 'Batch 1.xlsx', authorName: 'Juan Dela Cruz', createdAt: '2026-10-01T02:30:00Z' },
    { kind: 'import', remark: 'AICS food pack request', source: 'Batch 1.xlsx', authorName: null, createdAt: '2026-10-01T01:00:00Z' },
  ],
};

describe('RowDecisionCard', () => {
  it('renders the matched candidate as person evidence with interventions and recent remarks', () => {
    render(<RowDecisionCard row={row} candidates={[personCandidate]} />);
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
          { personId: 'p9', lastName: 'Reyes', firstName: 'Maria', interventions: 1 },
        ],
      },
    };
    render(<RowDecisionCard row={row} candidates={[household]} />);
    expect(screen.getByText(/household already served/i)).toBeTruthy();
    expect(screen.getByText(/Maria/)).toBeTruthy();
    expect(screen.getByText(/1 intervention/i)).toBeTruthy();
    expect(screen.queryByText(/recent remarks/i)).toBeNull();
  });

  it('shows the disqualification and points to the match decision, with no waive/confirm controls', () => {
    render(
      <RowDecisionCard
        row={{ ...row, eligibilityDecision: undefined }}
        candidates={[personCandidate]}
      />,
    );
    expect(screen.getByText(/Disqualified — review needed/i)).toBeTruthy();
    expect(screen.getByText(/within the last 30 days/)).toBeTruthy();
    expect(screen.getByText(/Decide the match below/i)).toBeTruthy();

    expect(screen.queryByRole('button', { name: /waive/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /confirm/i })).toBeNull();
  });

  it('offers no buttons once the disqualification is decided', () => {
    render(
      <RowDecisionCard
        row={{ ...row, eligibilityDecision: 'confirm' }}
        candidates={[personCandidate]}
       
      />,
    );
    expect(screen.getByText(/confirmed, not served/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /waive/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /confirm disqualified/i })).toBeNull();

    render(
      <RowDecisionCard
        row={{ ...row, eligibilityDecision: 'waive', status: 'retained' }}
        candidates={[personCandidate]}
       
      />,
    );
    expect(screen.getByText(/waived, served after review/i)).toBeTruthy();
  });

  it('lets an operator revert a decided match back to pending', async () => {
    const onRevert = vi.fn().mockResolvedValue(undefined);
    render(
      <RowDecisionCard
        row={{ ...row, eligibility: 'allowed', eligibilityReason: undefined, status: 'retained' }}
        candidates={[personCandidate]}
        onRevert={onRevert}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /revert decision/i }));
    expect(onRevert).toHaveBeenCalledWith('m1');
  });

  it('shows no disqualification panel for allowed rows', () => {
    render(
      <RowDecisionCard
        row={{ ...row, eligibility: 'allowed', eligibilityReason: undefined, status: 'retained' }}
        candidates={[personCandidate]}
       
      />,
    );
    expect(screen.queryByText(/review needed/i)).toBeNull();
    expect(screen.queryByText(/Disqualified/i)).toBeNull();
  });

  it('says so when a row has no candidate matches', () => {
    render(<RowDecisionCard row={row} candidates={[]} />);
    expect(screen.getByText(/no candidate matches/i)).toBeTruthy();
  });
});

describe('RowDecisionCard — traffic light and keep decision', () => {
  it('frames a recent-intervention row red and keeps the decision on the card', () => {
    render(
      <RowDecisionCard
        row={{ ...row, eligibilityCode: 'recent_intervention' }}
        candidates={[personCandidate]}
       
      />,
    );
    expect(screen.getByText('Served within the last 30 days')).toBeTruthy();
    expect(screen.getByTestId('candidate-m1').className).toContain('bg-destructive');
  });

  it('frames a passed-30d match yellow and walks the same-person tree to keep it', async () => {
    const onDecide = vi.fn().mockResolvedValue(undefined);
    render(
      <RowDecisionCard
        row={{ ...row, eligibility: 'allowed', eligibilityReason: undefined, status: 'retained', eligibilityCode: 'passed_30d' }}
        candidates={[{ ...personCandidate, status: 'pending', lastDeliveryDate: '2026-08-14' }]}
        onDecide={onDecide}
      />,
    );
    expect(screen.getByText(/passes the 30-day gate/)).toBeTruthy();
    expect(screen.getByText(/last served/i)).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: /yes — update the record/i }));
    await userEvent.click(screen.getByRole('button', { name: /keep — position unchanged/i }));
    expect(onDecide).toHaveBeenCalledWith('m1', { kind: 'keep_here' });
  });

  it('requires a reason before moving a same-person row to the bottom', async () => {
    const onDecide = vi.fn().mockResolvedValue(undefined);
    render(
      <RowDecisionCard
        row={{ ...row, eligibility: 'allowed', status: 'retained', eligibilityCode: 'passed_30d' }}
        candidates={[{ ...personCandidate, status: 'pending' }]}
        onDecide={onDecide}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /yes — update the record/i }));
    const bottom = screen.getByRole('button', { name: /deprioritize — move to bottom/i });
    expect(bottom).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Deprioritize reason'), 'Recent service, basic needs covered');
    expect(bottom).toBeEnabled();
    await userEvent.click(bottom);
    expect(onDecide).toHaveBeenCalledWith('m1', { kind: 'deprioritize', remark: 'Recent service, basic needs covered' });
  });

  it('declares a false positive a new client — no record update', async () => {
    const onDecide = vi.fn().mockResolvedValue(undefined);
    render(
      <RowDecisionCard
        row={{ ...row, eligibility: 'disqualified', eligibilityCode: 'recent_intervention', eligibilityDecision: undefined }}
        candidates={[{ ...personCandidate, status: 'pending' }]}
        onDecide={onDecide}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /no — import as new client/i }));
    expect(onDecide).toHaveBeenCalledWith('m1', { kind: 'new_client' });
  });

  it('collapses two records with the same identity into one decision card', async () => {
    const base = {
      targetType: 'db_person' as const, score: 0.9, status: 'pending' as const, signals: {},
      person: { id: 'p-empty', lastName: 'Reyes', firstName: 'Pedro', middleName: 'Poblete', dob: '1988-03-21', barangay: 'Bigte' },
    };
    const empty: DedupCandidate = { ...base, id: 'm-empty', interventions: 0 };
    const rich: DedupCandidate = {
      ...base, id: 'm-rich', interventions: 3,
      person: { ...base.person, id: 'p-rich' },
    };
    const onDecide = vi.fn();
    render(
      <RowDecisionCard
        row={{ ...row, eligibility: 'allowed', eligibilityReason: undefined, status: 'retained' }}
        candidates={[empty, rich]}
        onDecide={onDecide}
      />,
    );

    expect(screen.getAllByText(/Is this the same person/i)).toHaveLength(1);
    expect(screen.getByText(/3 interventions/)).toBeTruthy();
    expect(screen.queryByText(/0 interventions/)).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: /yes — update the record/i }));
    await userEvent.click(screen.getByRole('button', { name: /keep — position unchanged/i }));
    expect(onDecide).toHaveBeenCalledWith('m-rich', { kind: 'keep_here' }, ['m-empty']);
  });

  it('names the differ-only-in-barangay duplicate pair in phase 1, with keep controls', async () => {
    const dup: DedupCandidate = {
      id: 'm3', targetType: 'import_row', score: 0.8, status: 'pending',
      signals: { surnamePhoneticMatch: true, dobMatch: true, simSurname: 0.95, barangayMatch: false },
      pairedRow: { id: 'r9', rowIndex: 9, lastName: 'Reyes', firstName: 'Pedro', dob: '1988-03-21', barangay: 'Poblacion' },
    };
    const onDecide = vi.fn();
    render(
      <RowDecisionCard
        row={{ ...row, eligibility: 'disqualified', eligibilityCode: 'intra_list', eligibilityDecision: undefined }}
        candidates={[dup]}
        onDecide={onDecide}
      />,
    );
    expect(screen.getByText(/barangay differs/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /keep row 9 instead/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^waive$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^confirm$/i })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: /keep this row/i }));
    expect(onDecide).toHaveBeenCalledWith('m3', { kind: 'keep_row' });
  });
});