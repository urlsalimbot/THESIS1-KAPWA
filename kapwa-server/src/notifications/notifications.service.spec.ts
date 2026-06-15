import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { Notification, NotificationCategory } from './notification.entity';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let repoMock: any;

  beforeEach(async () => {
    repoMock = {
      create: jest.fn().mockReturnValue({}),
      save: jest.fn().mockResolvedValue({}),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      count: jest.fn().mockResolvedValue(0),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: getRepositoryToken(Notification), useValue: repoMock },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  it('creates a notification', async () => {
    await service.create({ recipientId: 'u1', title: 'Test', message: 'Hello' });
    expect(repoMock.create).toHaveBeenCalled();
    expect(repoMock.save).toHaveBeenCalled();
  });

  it('sends a notification', async () => {
    const result = await service.send('n1');
    expect(result.message).toBe('Notification sent');
  });

  it('finds by recipient', async () => {
    repoMock.find.mockResolvedValue([{ id: 'n1', title: 'Test' }]);
    const result = await service.findByRecipient('u1');
    expect(result).toHaveLength(1);
  });

  it('gets unread count', async () => {
    repoMock.count.mockResolvedValue(3);
    const count = await service.getUnreadCount('u1');
    expect(count).toBe(3);
  });

  it('marks as read', async () => {
    const result = await service.markAsRead('n1');
    expect(result.message).toBe('Marked as read');
  });

  it('marks all as read', async () => {
    const result = await service.markAllAsRead('u1');
    expect(result.message).toBe('All marked as read');
  });

  it('creates case update notification', async () => {
    await service.notifyCaseUpdate('u1', 'NORZ-001', 'approved');
    expect(repoMock.create).toHaveBeenCalledWith(expect.objectContaining({
      category: NotificationCategory.CASE_UPDATE,
      referenceId: 'NORZ-001',
    }));
  });

  it('creates sync conflict notification', async () => {
    await service.notifySyncConflict('u1', 'beneficiaries', 'version mismatch');
    expect(repoMock.create).toHaveBeenCalledWith(expect.objectContaining({
      category: NotificationCategory.SYNC_CONFLICT,
    }));
  });

  it('deletes a notification', async () => {
    const result = await service.delete('n1');
    expect(result.message).toBe('Notification deleted');
  });
});
