import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RowDecisionCard, type DedupCandidate, type DedupRow } from './RowDecisionCard';

const row: DedupRow = {
  id: 'r2', rowIndex: 2, lastName: 'Reyes', firstName: 'Pedro', middleName: 'P.',
  dob: '1988-03-21', barangay: 'Bigte', status: 'pending',
};

const personCandidate: DedupCandidate = {
  id: 'm1', targetType: 'db_person', score: 0.91, status: 'pending', signals: {},
  person: { id: 'p1', lastName: 'Reyes', firstName: 'Pedro', middleName: 'P.', dob: '1988-03-21', barangay: 'Bigte' },
  interventions: 2,
  cases: [{ controlNo: 'C-2026-001', status: 'active' }, { controlNo: 'C-2026-002', status: 'closed' }],
  remarks: [
    { kind: 'decision', remark: 'Same person.', source: 'Batch 1.xlsx', authorName: 'Juan Dela Cruz', createdAt: '2026-10-01T02:30:00Z' },
    { kind: 'import', remark: 'AICS food pack request', source: 'Batch 1.xlsx', authorName: null, createdAt: '2026-10-01T01:00:00Z' },
  ],
};

describe('RowDecisionCard', () => {
  it('renders a person candidate with its control numbers and intervention count', () => {
    render(<RowDecisionCard row={row} candidates={[personCandidate]} onDecide={vi.fn()} onRevert={vi.fn()} />);
    expect(screen.getByText(/C-2026-001/)).toBeTruthy();
    expect(screen.getByText(/C-2026-002/)).toBeTruthy();
    expect(screen.getByText(/2 interventions/i)).toBeTruthy();
  });

  it('shows the existing record’s recent remark history while deciding', () => {
    render(<RowDecisionCard row={row} candidates={[personCandidate]} onDecide={vi.fn()} onRevert={vi.fn()} />);
    expect(screen.getByText(/recent remarks/i)).toBeTruthy();
    expect(screen.getByText(/Same person\./)).toBeTruthy();
    expect(screen.getByText('Decision')).toBeTruthy();
    expect(screen.getByText('Batch 1.xlsx · Juan Dela Cruz')).toBeTruthy();
  });

  it('shows the household-served badge and each member with their interventions', () => {
    const household: DedupCandidate = {
      id: 'm2', targetType: 'household', score: 0.88, status: 'pending', signals: { householdServed: true },
      household: {
        id: 'h1', memberPersonIds: ['p9'],
        members: [
          { personId: 'p9', lastName: 'Reyes', firstName: 'Maria', interventions: 1, cases: [{ controlNo: 'C-2026-009', status: 'active' }] },
        ],
      },
    };
    render(<RowDecisionCard row={row} candidates={[household]} onDecide={vi.fn()} onRevert={vi.fn()} />);
    expect(screen.getByText(/household already served/i)).toBeTruthy();
    expect(screen.getByText(/Maria/)).toBeTruthy();
    expect(screen.getByText(/C-2026-009/)).toBeTruthy();
    expect(screen.getByText(/1 intervention/i)).toBeTruthy();
    expect(screen.queryByText(/recent remarks/i)).toBeNull();
  });

  it('opens a dialog for the deprioritizing choice and requires a remark before saving', async () => {
    const onDecide = vi.fn().mockResolvedValue(undefined);
    render(<RowDecisionCard row={row} candidates={[personCandidate]} onDecide={onDecide} onRevert={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /keep existing record/i }));
    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('heading', { name: /keep the existing record/i })).toBeTruthy();

    const save = screen.getByRole('button', { name: /save decision/i }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);

    await userEvent.type(screen.getByPlaceholderText(/why is this a duplicate/i), 'Same person — same control number.');
    expect(save.disabled).toBe(false);
    await userEvent.click(save);
    expect(onDecide).toHaveBeenCalledWith('m1', 'existing_record', 'Same person — same control number.');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('cancelling the dialog posts nothing', async () => {
    const onDecide = vi.fn().mockResolvedValue(undefined);
    render(<RowDecisionCard row={row} candidates={[personCandidate]} onDecide={onDecide} onRevert={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /keep existing record/i }));
    await userEvent.click(await screen.findByRole('button', { name: /^cancel$/i }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onDecide).not.toHaveBeenCalled();
  });

  it('offers the intra-import A/B choice; keeping B deprioritizes this row', async () => {
    const onDecide = vi.fn().mockResolvedValue(undefined);
    const pair: DedupCandidate = {
      id: 'm3', targetType: 'import_row', score: 0.82, status: 'pending', signals: {},
      pairedRow: { id: 'r1', rowIndex: 1, lastName: 'Reyes', firstName: 'Pedro' },
    };
    render(<RowDecisionCard row={row} candidates={[pair]} onDecide={onDecide} onRevert={vi.fn()} />);

    expect(screen.getByRole('button', { name: /keep this row \(a\)/i })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /keep import row 1 \(b\)/i }));
    const save = await screen.findByRole('button', { name: /save decision/i }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    await userEvent.type(screen.getByPlaceholderText(/why is this a duplicate/i), 'Row 1 is the original list entry.');
    await userEvent.click(save);
    expect(onDecide).toHaveBeenCalledWith('m3', 'other_import_row', 'Row 1 is the original list entry.');
  });

  it('lets a kept row be saved without a remark', async () => {
    const onDecide = vi.fn().mockResolvedValue(undefined);
    render(<RowDecisionCard row={row} candidates={[personCandidate]} onDecide={onDecide} onRevert={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /retain this row/i }));
    const save = await screen.findByRole('button', { name: /save decision/i }) as HTMLButtonElement;
    expect(save.disabled).toBe(false);
    await userEvent.click(save);
    expect(onDecide).toHaveBeenCalledWith('m1', 'import_row', undefined);
  });

  it('reverts a decided candidate', async () => {
    const onRevert = vi.fn().mockResolvedValue(undefined);
    const decided: DedupCandidate = { ...personCandidate, status: 'deprioritized', remark: 'Same person.' };
    render(<RowDecisionCard row={row} candidates={[decided]} onDecide={vi.fn()} onRevert={onRevert} />);
    expect(screen.getByText(/deprioritized/i)).toBeTruthy();
    expect(screen.getByText('Same person.')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /revert decision/i }));
    expect(onRevert).toHaveBeenCalledWith('m1');
  });

  it('says so when a row has no candidate matches', () => {
    render(<RowDecisionCard row={row} candidates={[]} onDecide={vi.fn()} onRevert={vi.fn()} />);
    expect(screen.getByText(/no candidate matches/i)).toBeTruthy();
  });
});