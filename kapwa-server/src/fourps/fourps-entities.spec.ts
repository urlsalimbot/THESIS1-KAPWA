import { getMetadataArgsStorage } from 'typeorm';
import { CaseComplianceItem } from './fourps-compliance.entity';
import { CasePayout } from './fourps-payout.entity';
import { Household } from '../beneficiaries/household.entity';

describe('fourps entities', () => {
  const storage = getMetadataArgsStorage();

  it('maps CaseComplianceItem to case_compliance_items', () => {
    const table = storage.tables.find(t => t.target === CaseComplianceItem);
    expect(table?.name).toBe('case_compliance_items');
    const cols = storage.columns.filter(c => c.target === CaseComplianceItem).map(c => c.propertyName);
    expect(cols).toEqual(expect.arrayContaining([
      'caseId', 'householdMemberId', 'complianceType', 'dueDate', 'monthLabel', 'met', 'metAt', 'metBy',
    ]));
  });

  it('maps CasePayout to case_payouts', () => {
    const table = storage.tables.find(t => t.target === CasePayout);
    expect(table?.name).toBe('case_payouts');
    const cols = storage.columns.filter(c => c.target === CasePayout).map(c => c.propertyName);
    expect(cols).toEqual(expect.arrayContaining([
      'caseId', 'cycleNo', 'scheduledAt', 'amount', 'status', 'notifiedAt', 'notifiedBy', 'remarks',
    ]));
  });

  it('maps the household nhts_pr_id column', () => {
    const col = storage.columns.find(c => c.target === Household && c.propertyName === 'nhtsPrId');
    expect(col).toBeDefined();
    expect(col?.options.name).toBe('nhts_pr_id');
  });
});
