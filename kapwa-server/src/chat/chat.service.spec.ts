import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ChatService } from './chat.service';
import { ChatMessage } from './chat.entity';

describe('ChatService', () => {
  let service: ChatService;
  let repoMock: any;

  beforeEach(async () => {
    repoMock = {
      create: jest.fn().mockReturnValue({}),
      save: jest.fn().mockResolvedValue({}),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      count: jest.fn().mockResolvedValue(0),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: getRepositoryToken(ChatMessage), useValue: repoMock },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  it('sends a message', async () => {
    const result = await service.sendMessage('u1', 'Alice', 'u2', 'Hello');
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
});
