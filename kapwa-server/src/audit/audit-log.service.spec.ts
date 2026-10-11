import { AuditLogService } from './audit-log.service';

describe('AuditLogService', () => {
  it('writes one row with the actor and JSON details', async () => {
    const dataSource = { query: jest.fn().mockResolvedValue([]) };
    const service = new AuditLogService(dataSource as any);

    await service.log('case.update', 'c-1', 'u-1', { from: 'a', to: 'b' });

    expect(dataSource.query).toHaveBeenCalledWith(
      `INSERT INTO audit_log (action, reference_id, user_id, details, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
      ['case.update', 'c-1', 'u-1', JSON.stringify({ from: 'a', to: 'b' })],
    );
  });

  it('swallows a failed insert — auditing must never break the action it logs', async () => {
    const dataSource = { query: jest.fn().mockRejectedValue(new Error('table missing')) };
    const service = new AuditLogService(dataSource as any);

    await expect(service.log('case.update', 'c-1')).resolves.toBeUndefined();
  });
});