import { DEFAULT_MESSAGE_LIMIT } from './constants';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatMessage } from './chat.entity';
import { User } from '../auth/user.entity';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatMessage)
    private readonly chatRepo: Repository<ChatMessage>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async sendMessage(senderId: string, senderName: string, recipientId: string, content: string) {
    const conversationId = [senderId, recipientId].sort().join('_');
    const msg = this.chatRepo.create({
      senderId,
      senderName,
      recipientId,
      content,
      conversationId,
    });
    return this.chatRepo.save(msg);
  }

  async getConversation(userId1: string, userId2: string, limit = DEFAULT_MESSAGE_LIMIT) {
    const conversationId = [userId1, userId2].sort().join('_');
    return this.chatRepo.find({
      where: { conversationId },
      order: { createdAt: 'ASC' },
      take: limit,
    });
  }

  async getConversations(userId: string) {
    const messages = await this.chatRepo.find({
      where: [
        { senderId: userId },
        { recipientId: userId },
      ],
      order: { createdAt: 'DESC' },
    });

    const seen = new Set<string>();
    const result: Array<{ userId: string; name: string; role: string; lastMessage: string; lastTime: Date; unread: number }> = [];

    for (const msg of messages) {
      const convId = [msg.senderId, msg.recipientId].sort().join('_');
      if (seen.has(convId)) continue;
      seen.add(convId);

      const otherId = msg.senderId === userId ? msg.recipientId : msg.senderId;
      const user = await this.userRepo.findOne({ where: { id: otherId } });
      result.push({
        userId: otherId,
        name: user?.fullName || otherId.slice(0, 8),
        role: user?.role || '',
        lastMessage: msg.content,
        lastTime: msg.createdAt,
        unread: (!msg.isRead && msg.recipientId === userId) ? 1 : 0,
      });
    }

    return result;
  }

  async markAsRead(messageId: string) {
    await this.chatRepo.update(messageId, { isRead: true });
  }

  async markConversationAsRead(userId: string, otherUserId: string) {
    const conversationId = [userId, otherUserId].sort().join('_');
    await this.chatRepo.update(
      { conversationId, recipientId: userId, isRead: false },
      { isRead: true },
    );
  }

  async getUnreadCount(userId: string) {
    return this.chatRepo.count({
      where: { recipientId: userId, isRead: false },
    });
  }

  async getChatUsers(currentUserId: string) {
    const users = await this.userRepo.find({
      where: { isActive: true },
      select: ['id', 'fullName', 'role'],
    });
    return users.filter(u => u.id !== currentUserId).map(u => ({
      id: u.id,
      fullName: u.fullName,
      role: u.role,
    }));
  }
}
