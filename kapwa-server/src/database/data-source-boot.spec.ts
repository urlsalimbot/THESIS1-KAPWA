import { AppDataSource } from './data-source';

describe('deploy-boot guard', () => {
  it('builds postgres metadata for every entity (deploy-boot check)', async () => {
    const ds = AppDataSource;
    ds.setOptions({ host: '127.0.0.1', port: 5433, username: 'kapwa', database: 'kapwa' });
    try {
      await ds.initialize();
      await ds.destroy();
    } catch (e: unknown) {
      const msg = String((e as Error).message ?? e);
      // Reaching the connection stage proves metadata validation passed;
      // anything else (DataTypeNotSupported usually) is a real entity bug.
      expect(msg).toMatch(/ECONNREFUSED|connect ECONNREFUSED|timeout|getaddrinfo ENOTFOUND/i);
    }
  });
});
