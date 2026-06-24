import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { Notification, NotificationCategory } from './notification.entity';
import { NotificationPreference } from './notification-preference.entity';
import { SmsGatewayService } from '../otp/sms-gateway.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let repoMock: any;
  let prefRepoMock: any;

  const smsMock = {
    sendSms: jest.fn().mockResolvedValue({ success: true, provider: 'log', messageId: 'm1' }),
    getProvider: jest.fn().mockReturnValue('console'),
  };

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

    prefRepoMock = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockReturnValue({}),
      save: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: getRepositoryToken(Notification), useValue: repoMock },
        { provide: getRepositoryToken(NotificationPreference), useValue: prefRepoMock },
        { provide: SmsGatewayService, useValue: smsMock },
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
    repoMock.findOne.mockResolvedValue({ id: 'n1', channel: 'sms', phone: '+639123456789', message: 'Test' });
    const result = await service.send('n1');
    expect(result.message).toBe('Notification sent');
    expect(smsMock.sendSms).toHaveBeenCalledWith('+639123456789', 'Test');
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

  it('sendWithConsent for system category bypasses consent check (D-07)', async () => {
    repoMock.findOne.mockResolvedValue({
      id: 'n1', recipientId: 'u1', channel: 'sms', category: NotificationCategory.SYSTEM, phone: '+639123456789', message: 'System alert'
    });
    const result = await service.sendWithConsent('n1');
    expect(result.message).toBe('Notification sent');
    expect(smsMock.sendSms).toHaveBeenCalled();
  });

  it('sendWithConsent without consent sets consentSkipped=true (D-06)', async () => {
    prefRepoMock.findOne.mockResolvedValue(null);
    repoMock.findOne.mockResolvedValue({
      id: 'n1', recipientId: 'u1', channel: 'sms', category: NotificationCategory.CASE_UPDATE, phone: '+639123456789', message: 'Test'
    });
    const result = await service.sendWithConsent('n1');
    expect(result.message).toContain('Consent not granted');
    expect(repoMock.update).toHaveBeenCalledWith('n1', { sent: false, consentSkipped: true });
  });

  it('sendWithConsent with consent delivers normally', async () => {
    prefRepoMock.findOne.mockResolvedValue({ optedIn: true });
    repoMock.findOne.mockResolvedValue({
      id: 'n1', recipientId: 'u1', channel: 'sms', category: NotificationCategory.CASE_UPDATE, phone: '+639123456789', message: 'Test'
    });
    const result = await service.sendWithConsent('n1');
    expect(result.message).toBe('Notification sent');
  });

  it('checkConsent with no preference returns false', async () => {
    prefRepoMock.findOne.mockResolvedValue(null);
    const result = await service.checkConsent('u1', 'sms', NotificationCategory.CASE_UPDATE);
    expect(result).toBe(false);
  });

  it('checkConsent with optedIn=true returns true', async () => {
    prefRepoMock.findOne.mockResolvedValue({ optedIn: true });
    const result = await service.checkConsent('u1', 'sms', NotificationCategory.CASE_UPDATE);
    expect(result).toBe(true);
  });

  it('getPreferences returns user preferences', async () => {
    prefRepoMock.find.mockResolvedValue([{ userId: 'u1', channel: 'sms', category: 'case_update', optedIn: true }]);
    const result = await service.getPreferences('u1');
    expect(result).toHaveLength(1);
  });

  it('setPreference creates new preference when none exists', async () => {
    prefRepoMock.findOne.mockResolvedValue(null);
    prefRepoMock.create.mockReturnValue({ userId: 'u1', channel: 'sms', category: 'case_update', optedIn: true });
    await service.setPreference('u1', { channel: 'sms', category: NotificationCategory.CASE_UPDATE, optedIn: true });
    expect(prefRepoMock.create).toHaveBeenCalledWith({
      userId: 'u1', channel: 'sms', category: NotificationCategory.CASE_UPDATE, optedIn: true,
    });
    expect(prefRepoMock.save).toHaveBeenCalled();
  });

  it('deletes a notification', async () => {
    const result = await service.delete('n1');
    expect(result.message).toBe('Notification deleted');
  });
});
