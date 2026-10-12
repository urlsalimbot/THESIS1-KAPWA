import { Reflector } from '@nestjs/core';
import { UsersController } from './users.controller';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';

describe('UsersController — no delete, disable/enable only', () => {
  const reflector = new Reflector();
  const proto = UsersController.prototype as any;

  it('exposes no delete handler (accounts are never hard-deleted)', () => {
    expect(proto.remove).toBeUndefined();
    expect(proto.delete).toBeUndefined();
  });

  it('allows admin and social workers to disable/enable', () => {
    expect(reflector.get<string[]>(ROLES_KEY, proto.disable)).toEqual(['admin', 'social_worker']);
    expect(reflector.get<string[]>(ROLES_KEY, proto.enable)).toEqual(['admin', 'social_worker']);
  });

  it('delegates disable/enable to setActive with the acting admin', async () => {
    const svc = { setActive: jest.fn().mockResolvedValue({ id: 'u1', isActive: false }) };
    const c = new UsersController(svc as any);
    await c.disable('u1', { user: { id: 'admin-1' } } as any);
    expect(svc.setActive).toHaveBeenCalledWith('u1', false, 'admin-1');
    await c.enable('u1', { user: { id: 'admin-1' } } as any);
    expect(svc.setActive).toHaveBeenCalledWith('u1', true, 'admin-1');
  });

  it('allows a social worker to disable a claimant account', async () => {
    const svc = { setActive: jest.fn().mockResolvedValue({}), findOne: jest.fn().mockResolvedValue({ id: 'c1', role: 'claimant' }) };
    const c = new UsersController(svc as any);
    await c.disable('c1', { user: { id: 'sw-1', role: 'social_worker' } } as any);
    expect(svc.setActive).toHaveBeenCalledWith('c1', false, 'sw-1');
  });

  it('refuses a social worker disabling a staff account', async () => {
    const svc = { findOne: jest.fn().mockResolvedValue({ id: 's1', role: 'social_worker' }) };
    const c = new UsersController(svc as any);
    await expect(c.disable('s1', { user: { id: 'sw-1', role: 'social_worker' } } as any)).rejects.toThrow(
      'Social workers can only manage claimant accounts',
    );
  });

  describe('claimant-scoped list for social workers', () => {
    function controllerWith(svc: any) {
      const c = new UsersController(svc as any);
      return (req: any, query: Record<string, string | undefined>) => c.findAll(
        query.search, query.role, query.status, query.exclude, query.page, query.limit, req,
      );
    }

    it('coerces the list to claimant-only for a social worker', async () => {
      const svc = { findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }) };
      const call = controllerWith(svc);
      await call(
        { user: { id: 'sw-1', role: 'social_worker' } },
        { search: undefined, role: undefined, status: 'active', exclude: undefined, page: undefined, limit: undefined },
      );
      expect(svc.findAll).toHaveBeenCalledWith(undefined, 'claimant', true, 1, 50, undefined);
    });

    it('passes the requested filters through for an admin', async () => {
      const svc = { findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }) };
      const call = controllerWith(svc);
      await call(
        { user: { id: 'a1', role: 'admin' } },
        { search: 'juan', role: 'coordinator', status: 'inactive', exclude: 'claimant', page: '2', limit: '25' },
      );
      expect(svc.findAll).toHaveBeenCalledWith('juan', 'coordinator', false, 2, 25, 'claimant');
    });
  });
});