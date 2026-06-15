import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatMessage } from './chat.entity';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatMessage)
    private readonly chatRepo: Repository<ChatMessage>,
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

  async getConversation(userId1: string, userId2: string, limit = 50) {
    const conversationId = [userId1, userId2].sort().join('_');
    return this.chatRepo.find({
      where: { conversationId },
      order: { createdAt: 'ASC' },
      take: limit,
    });
  }

  async getConversations(userId: string) {
    const msgs = await this.chatRepo.find({
      where: [{ senderId: userId }, { recipientId: userId }],
      order: { createdAt: 'DESC' },
    });

    const convMap = new Map<string, { userId: string; name: string; lastMessage: string; lastTime: Date; unread: number }>();

    for (const msg of msgs) {
      const otherId = msg.senderId === userId ? msg.recipientId : msg.senderId;
      const otherName = msg.senderId === userId ? '' : msg.senderName || otherId;
      const key = msg.conversationId;

      if (!convMap.has(key)) {
        convMap.set(key, {
          userId: otherId,
          name: otherName,
          lastMessage: msg.content,
          lastTime: msg.createdAt,
          unread: (!msg.isRead && msg.recipientId === userId) ? 1 : 0,
        });
      } else {
        const existing = convMap.get(key)!;
        if (!msg.isRead && msg.recipientId === userId) existing.unread++;
      }
    }

    return Array.from(convMap.values()).sort((a, b) => b.lastTime.getTime() - a.lastTime.getTime());
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
}
