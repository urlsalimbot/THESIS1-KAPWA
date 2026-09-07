import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ChatService } from './chat.service';
import { ChatMessage } from './chat.entity';
import { User } from '../auth/user.entity';
import { Beneficiary } from '../beneficiaries/beneficiary.entity';
import { Case } from '../cases/case.entity';

describe('ChatService', () => {
  let service: ChatService;
  let repoMock: any;
  let userRepoMock: any;
  let beneficiaryRepoMock: any;
  let caseRepoMock: any;

  beforeEach(async () => {
    repoMock = {
      create: jest.fn().mockReturnValue({}),
      save: jest.fn().mockResolvedValue({}),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      count: jest.fn().mockResolvedValue(0),
    };
    userRepoMock = { findOne: jest.fn().mockResolvedValue(null), find: jest.fn().mockResolvedValue([]) };
    beneficiaryRepoMock = { findOne: jest.fn().mockResolvedValue(null), find: jest.fn().mockResolvedValue([]) };
    caseRepoMock = { findOne: jest.fn().mockResolvedValue(null), find: jest.fn().mockResolvedValue([]) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: getRepositoryToken(ChatMessage), useValue: repoMock },
        { provide: getRepositoryToken(User), useValue: userRepoMock },
        { provide: getRepositoryToken(Beneficiary), useValue: beneficiaryRepoMock },
        { provide: getRepositoryToken(Case), useValue: caseRepoMock },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  it('sends a message', async () => {
    await service.sendMessage('u1', 'Alice', 'u2', 'Hello');
    expect(repoMock.create).toHaveBeenCalledWith(expect.objectContaining({
      senderId: 'u1',
      recipientId: 'u2',
      content: 'Hello',
    }));
  });

  it('gets conversation between two users', async () => {
    repoMock.find.mockResolvedValue([{ id: 'm1', content: 'Hi', senderId: 'u1', recipientId: 'u2' }]);
    const result = await service.getConversation('u1', 'u2');
    expect(result).toHaveLength(1);
  });

  it('gets conversations list for user', async () => {
    repoMock.find.mockResolvedValue([
      { senderId: 'u1', recipientId: 'u2', senderName: 'Alice', content: 'Hello', createdAt: new Date(), isRead: true, conversationId: 'u1_u2' },
    ]);
    const result = await service.getConversations('u1');
    expect(result).toBeDefined();
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty('userId', 'u2');
  });

  it('marks message as read', async () => {
    await service.markAsRead('m1');
    expect(repoMock.update).toHaveBeenCalledWith('m1', { isRead: true });
  });

  it('marks conversation as read', async () => {
    await service.markConversationAsRead('u1', 'u2');
    expect(repoMock.update).toHaveBeenCalled();
  });

  it('gets unread count', async () => {
    repoMock.count.mockResolvedValue(2);
    const count = await service.getUnreadCount('u1');
    expect(count).toBe(2);
  });

  it('batches user lookups in getConversations instead of per-conversation findOne', async () => {
    repoMock.find.mockResolvedValue([
      { senderId: 'u1', recipientId: 'u2', content: 'Hello', createdAt: new Date(), isRead: true, conversationId: 'u1_u2' },
      { senderId: 'u1', recipientId: 'u3', content: 'Hi', createdAt: new Date(), isRead: true, conversationId: 'u1_u3' },
    ]);
    userRepoMock.find.mockResolvedValue([
      { id: 'u2', firstName: 'Bob', lastName: 'B', nameExtension: null, role: 'social_worker', fullName: 'Bob B' },
      { id: 'u3', firstName: 'Carol', lastName: 'C', nameExtension: null, role: 'social_worker', fullName: 'Carol C' },
    ]);
    const result = await service.getConversations('u1');
    expect(result).toHaveLength(2);
    expect(userRepoMock.findOne).not.toHaveBeenCalled();
    expect(userRepoMock.find).toHaveBeenCalledTimes(1);
    expect(userRepoMock.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: expect.objectContaining({ _value: expect.arrayContaining(['u2', 'u3']) }) }) }),
    );
    expect(result.map(r => r.name).sort()).toEqual(['Bob B', 'Carol C']);
  });
});
