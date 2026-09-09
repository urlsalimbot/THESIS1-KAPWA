import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ContactMessagesService } from './contact-messages.service';
import { ContactMessage } from './contact-message.entity';
import { User } from '../auth/user.entity';
import { NotificationsService } from '../notifications/notifications.service';

describe('ContactMessagesService', () => {
  let svc: ContactMessagesService;
  const repo = { save: jest.fn(), create: jest.fn(), find: jest.fn(), findOne: jest.fn(), count: jest.fn() };
  const userRepo = { find: jest.fn() };
  const notifications = { createMany: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ContactMessagesService,
        { provide: getRepositoryToken(ContactMessage), useValue: repo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();
    svc = module.get(ContactMessagesService);
  });

  it('persists the message and notifies admin + social workers', async () => {
    repo.create.mockImplementation((d) => d);
    repo.save.mockImplementation((d) => Promise.resolve({ id: 'msg-1', ...d }));
    userRepo.find.mockResolvedValue([{ id: 'u-admin' }, { id: 'u-sw' }]);
    notifications.createMany.mockResolvedValue([]);

    const out = await svc.create({
      name: 'Juan Dela Cruz',
      email: 'juan@example.com',
      message: 'I would like to request assistance for my family.',
    });

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Juan Dela Cruz', email: 'juan@example.com', subject: null }),
    );
    expect(userRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        select: ['id'],
        where: expect.objectContaining({ isActive: true }),
      }),
    );
    expect(notifications.createMany).toHaveBeenCalledWith([
      expect.objectContaining({ recipientId: 'u-admin', referenceId: 'msg-1', category: 'system', channel: 'in_app' }),
      expect.objectContaining({ recipientId: 'u-sw', referenceId: 'msg-1' }),
    ]);
    expect(out.id).toBe('msg-1');
  });

  it('saves without notifying when no staff exist', async () => {
    repo.create.mockImplementation((d) => d);
    repo.save.mockImplementation((d) => Promise.resolve({ id: 'msg-2', ...d }));
    userRepo.find.mockResolvedValue([]);

    const out = await svc.create({
      name: 'Maria Santos',
      email: 'maria@example.com',
      message: 'Please contact me about the senior citizen program.',
    });

    expect(notifications.createMany).not.toHaveBeenCalled();
    expect(out.id).toBe('msg-2');
  });

  it('marks a message as read', async () => {
    const msg = { id: 'msg-1', status: 'new' };
    repo.findOne.mockResolvedValue(msg);
    repo.save.mockImplementation((d) => Promise.resolve(d));

    const out = await svc.markRead('msg-1');
    expect(out.status).toBe('read');
    expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'msg-1' } });
  });

  it('throws NotFoundException for unknown message ids', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(svc.markRead('missing')).rejects.toThrow('Contact message not found');
  });

  it('returns newest-first listing and unread count', async () => {
    repo.find.mockResolvedValue([{ id: 'a' }]);
    repo.count.mockResolvedValue(3);
    await expect(svc.findAll()).resolves.toEqual([{ id: 'a' }]);
    await expect(svc.unreadCount()).resolves.toBe(3);
  });
});