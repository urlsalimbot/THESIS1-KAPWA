import { AdminWipeService } from './admin-wipe.service';

describe('AdminWipeService', () => {
  const userRepo = {
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    find: jest.fn().mockResolvedValue([]),
  };
  let service: AdminWipeService;

  beforeEach(() => {
    userRepo.update.mockClear();
    userRepo.find.mockClear();
    service = new AdminWipeService(userRepo as any);
  });

  it('bumps tokenVersion and clears the deviceId in one pass per user', async () => {
    await service.wipeDevice('dev-9');

    expect(userRepo.update).toHaveBeenCalledWith(
      { deviceId: 'dev-9' },
      expect.objectContaining({ tokenVersion: expect.any(Function) }),
    );
    expect(userRepo.update).toHaveBeenCalledWith({ deviceId: 'dev-9' }, { deviceId: '' });
  });

  it('reports the wipe outcome', async () => {
    await expect(service.wipeDevice('dev-9')).resolves.toEqual({ deviceId: 'dev-9', wiped: true });
  });

  it('lists bound devices as id/email/deviceId with null for unbound', async () => {
    userRepo.find.mockResolvedValue([
      { id: 'u1', email: 'a@b.com', deviceId: 'dev-1' },
      { id: 'u2', email: 'c@d.com', deviceId: null },
    ]);

    const out = await service.listBoundDevices();

    expect(out).toEqual([
      { id: 'u1', email: 'a@b.com', deviceId: 'dev-1' },
      { id: 'u2', email: 'c@d.com', deviceId: null },
    ]);
  });
});