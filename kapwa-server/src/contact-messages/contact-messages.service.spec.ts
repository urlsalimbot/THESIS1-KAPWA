import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ContactMessagesService } from './contact-messages.service';
import { ContactMessage, ContactMessageReply } from './contact-message.entity';
import { User } from '../auth/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { MailerService } from '../common/mailer.service';

describe('ContactMessagesService', () => {
  let svc: ContactMessagesService;
  const repo = { save: jest.fn(), create: jest.fn(), find: jest.fn(), findOne: jest.fn(), count: jest.fn() };
  const replyRepo = { save: jest.fn(), create: jest.fn(), find: jest.fn(), findOne: jest.fn() };
  const userRepo = { find: jest.fn() };
  const notifications = { createMany: jest.fn() };
  const mailer = { sendMail: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ContactMessagesService,
        { provide: getRepositoryToken(ContactMessage), useValue: repo },
        { provide: getRepositoryToken(ContactMessageReply), useValue: replyRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: NotificationsService, useValue: notifications },
        { provide: MailerService, useValue: mailer },
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
    replyRepo.find.mockResolvedValue([]);
    repo.count.mockResolvedValue(3);
    await expect(svc.findAll()).resolves.toEqual([{ id: 'a', replies: [] }]);
    await expect(svc.unreadCount()).resolves.toBe(3);
  });

  describe('reply', () => {
    const message = {
      id: 'msg-1',
      name: 'Juan Dela Cruz',
      email: 'juan@example.com',
      subject: 'Assistance request',
      message: 'I would like to request assistance.',
      status: 'new' as const,
    };

    it('emails the reply, records it against the message, and marks it read', async () => {
      repo.findOne.mockResolvedValue({ ...message });
      repo.save.mockImplementation((d) => Promise.resolve(d));
      replyRepo.create.mockImplementation((d) => d);
      replyRepo.save.mockImplementation((d) => Promise.resolve(d));
      mailer.sendMail.mockResolvedValue(true);

      const out = await svc.reply('msg-1', 'We can help with that.', 'u-staff');

      expect(mailer.sendMail).toHaveBeenCalledWith(
        'juan@example.com',
        'Re: Assistance request',
        'We can help with that.',
      );
      // The reply is stored under the message so the inbox shows the thread.
      expect(replyRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ messageId: 'msg-1', content: 'We can help with that.', repliedBy: 'u-staff' }),
      );
      expect(out.status).toBe('read');
      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'read' }));
    });

    it('uses a fallback subject when the inquiry had none', async () => {
      repo.findOne.mockResolvedValue({ ...message, subject: null });
      repo.save.mockImplementation((d) => Promise.resolve(d));
      mailer.sendMail.mockResolvedValue(true);

      await svc.reply('msg-1', 'Reply body');

      expect(mailer.sendMail).toHaveBeenCalledWith(
        'juan@example.com',
        'Re: Your inquiry to MSWDO Norzagaray',
        'Reply body',
      );
    });

    it('throws NotFoundException for an unknown message', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(svc.reply('missing', 'body')).rejects.toThrow('Contact message not found');
      expect(mailer.sendMail).not.toHaveBeenCalled();
    });

    it('surfaces a delivery failure and records nothing — not the reply, not read', async () => {
      repo.findOne.mockResolvedValue({ ...message });
      mailer.sendMail.mockResolvedValue(false);

      await expect(svc.reply('msg-1', 'body')).rejects.toThrow('Could not send the reply email');
      expect(replyRepo.save).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  it('returns each message with its stored replies, oldest first, staff named', async () => {
    repo.find.mockResolvedValue([
      { id: 'msg-1', name: 'A', email: 'a@x.com', message: 'x', status: 'new' },
      { id: 'msg-2', name: 'B', email: 'b@x.com', message: 'y', status: 'new' },
    ]);
    replyRepo.find.mockResolvedValue([
      { id: 'r1', messageId: 'msg-1', content: 'First, short reply', repliedBy: 'u1', createdAt: new Date('2026-10-02T01:00:00Z') },
      { id: 'r2', messageId: 'msg-1', content: 'Second reply', repliedBy: null, createdAt: new Date('2026-10-03T01:00:00Z') },
    ]);
    userRepo.find.mockResolvedValue([{ id: 'u1', firstName: 'Ana', middleName: '', lastName: 'Cruz' }]);

    const out = await svc.findAll();

    expect(out[0].replies).toHaveLength(2);
    expect(out[0].replies[0]).toMatchObject({ content: 'First, short reply', repliedByName: 'Ana Cruz' });
    expect(out[0].replies[1].repliedByName).toBeNull();
    expect(out[1].replies).toEqual([]);
  });
});