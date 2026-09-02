import { AppController } from './app.controller';

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
});
