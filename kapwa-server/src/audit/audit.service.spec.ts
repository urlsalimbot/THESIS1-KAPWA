import * as crypto from 'crypto';
import { AuditService } from './audit.service';

const link = (id: string, hash: string | null) =>
  crypto.createHash('sha256').update(JSON.stringify({ id, hash })).digest('hex');

describe('AuditService.verifyHashChain', () => {
  const service = () => new AuditService({} as any, {} as any, {} as any, {} as any);

  it('orders by timestamp and id — the same total order the DB trigger writes', async () => {
    const genesis = crypto.createHash('sha256').update('genesis').digest('hex');
    const rows = [
      { id: 'a', hash: genesis },
      { id: 'b', hash: link('a', genesis) },
    ];
    const repo = { find: jest.fn().mockResolvedValue(rows) };

    const result = await service().verifyHashChain(repo as any, 'createdAt');

    // Without the id tiebreaker the seeded rows that share one timestamp were
    // verified in an arbitrary order and the chain looked broken.
    expect(repo.find).toHaveBeenCalledWith({ order: { createdAt: 'ASC', id: 'ASC' } });
    expect(result).toEqual({ valid: true });
  });

  it('accepts a chain whose rows share a timestamp when the id order links them', async () => {
    const genesis = crypto.createHash('sha256').update('genesis').digest('hex');
    const ts = new Date('2026-10-20T07:07:32.000Z');
    const a = { id: 'a', createdAt: ts, hash: genesis };
    const b = { id: 'b', createdAt: ts, hash: link(a.id, a.hash) };
    const c = { id: 'c', createdAt: ts, hash: link(b.id, b.hash) };
    const repo = { find: jest.fn().mockResolvedValue([a, b, c]) };

    await expect(service().verifyHashChain(repo as any)).resolves.toEqual({ valid: true });
  });

  it('reports the first row whose hash does not link to its predecessor', async () => {
    const genesis = crypto.createHash('sha256').update('genesis').digest('hex');
    const rows = [
      { id: 'a', hash: genesis },
      { id: 'b', hash: 'tampered' },
    ];
    const repo = { find: jest.fn().mockResolvedValue(rows) };

    await expect(service().verifyHashChain(repo as any)).resolves.toEqual({
      valid: false,
      brokenAt: 'b',
    });
  });

  it('skips rows without a hash instead of treating them as breaks', async () => {
    const genesis = crypto.createHash('sha256').update('genesis').digest('hex');
    const rows = [
      { id: 'a', hash: genesis },
      { id: 'legacy', hash: null },
      { id: 'c', hash: link('legacy', null) },
    ];
    const repo = { find: jest.fn().mockResolvedValue(rows) };

    await expect(service().verifyHashChain(repo as any)).resolves.toEqual({ valid: true });
  });
});
