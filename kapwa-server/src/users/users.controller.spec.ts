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

  it('disables a user with admin role', () => {
    expect(reflector.get<string[]>(ROLES_KEY, proto.disable)).toEqual(['admin']);
  });

  it('enables a user with admin role', () => {
    expect(reflector.get<string[]>(ROLES_KEY, proto.enable)).toEqual(['admin']);
  });

  it('delegates disable/enable to setActive with the acting admin', async () => {
    const svc = { setActive: jest.fn().mockResolvedValue({ id: 'u1', isActive: false }) };
    const c = new UsersController(svc as any);
    await c.disable('u1', { user: { id: 'admin-1' } } as any);
    expect(svc.setActive).toHaveBeenCalledWith('u1', false, 'admin-1');
    await c.enable('u1', { user: { id: 'admin-1' } } as any);
    expect(svc.setActive).toHaveBeenCalledWith('u1', true, 'admin-1');
  });
});
