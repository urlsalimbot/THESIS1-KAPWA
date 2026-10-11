import { AppController } from './app.controller';
import { ServiceUnavailableException } from '@nestjs/common';

describe('AppController health', () => {
  it('reports degraded when the database is unreachable', async () => {
    const dataSource = { query: jest.fn().mockRejectedValue(new Error('down')) };
    const controller = new AppController(dataSource as any);
    await expect(controller.health()).rejects.toThrow();
  });

  it('reports ok when the database responds', async () => {
    const dataSource = { query: jest.fn().mockResolvedValue([{ '?column?': 1 }]) };
    const controller = new AppController(dataSource as any);
    const res = await controller.health();
    expect(res.status).toBe('ok');
    expect(res.db).toBe('connected');
  });

  it('degrades when a table approaches the 1600-column DDL ceiling', async () => {
    const dataSource = {
      query: jest
        .fn()
        .mockResolvedValueOnce([{ '?column?': 1 }])
        .mockResolvedValueOnce([{ table_name: 'users', columns: '1595' }]),
    };
    const controller = new AppController(dataSource as any);
    await expect(controller.health()).rejects.toThrow(ServiceUnavailableException);
  });

  it('stays ok while the widest table is well under the ceiling', async () => {
    const dataSource = {
      query: jest
        .fn()
        .mockResolvedValueOnce([{ '?column?': 1 }])
        .mockResolvedValueOnce([{ table_name: 'users', columns: '64' }]),
    };
    const controller = new AppController(dataSource as any);
    const res = await controller.health();
    expect(res.status).toBe('ok');
  });
});
