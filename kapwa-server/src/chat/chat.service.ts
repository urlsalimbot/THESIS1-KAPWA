import { DEFAULT_MESSAGE_LIMIT } from './constants';
import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ChatMessage } from './chat.entity';
import { User } from '../auth/user.entity';
import { Beneficiary } from '../beneficiaries/beneficiary.entity';
import { Case } from '../cases/case.entity';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatMessage)
    private readonly chatRepo: Repository<ChatMessage>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Beneficiary)
    private readonly beneficiaryRepo: Repository<Beneficiary>,
    @InjectRepository(Case)
    private readonly caseRepo: Repository<Case>,
  ) {}

  private async getAssignedWorkerIds(claimantId: string): Promise<string[]> {
    const beneficiary = await this.beneficiaryRepo.findOne({ where: { userId: claimantId } });
    if (!beneficiary) return [];
    const cases = await this.caseRepo.find({
      where: { beneficiaryId: beneficiary.id },
      select: ['assignedWorkerId'],
    });
    return [...new Set(cases.map(c => c.assignedWorkerId).filter(Boolean))] as string[];
  }

  async sendMessage(senderId: string, senderName: string, recipientId: string, content: string, role?: string) {
    if (role === 'claimant') {
      const allowed = await this.getAssignedWorkerIds(senderId);
      if (!allowed.includes(recipientId)) {
        throw new ForbiddenException('You can only message workers assigned to your case');
      }
    }
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

  async getConversation(userId1: string, userId2: string, limit = DEFAULT_MESSAGE_LIMIT, role?: string) {
    if (role === 'claimant') {
      const allowed = await this.getAssignedWorkerIds(userId1);
      if (!allowed.includes(userId2)) {
        throw new ForbiddenException('You can only view conversations with workers assigned to your case');
      }
    }
    return this.chatRepo.find({
      where: [
        { senderId: userId1, recipientId: userId2 },
        { senderId: userId2, recipientId: userId1 },
      ],
      order: { createdAt: 'ASC' },
      take: limit,
    });
  }

  async getConversations(userId: string, role?: string) {
    const messages = await this.chatRepo.find({
      where: [
        { senderId: userId },
        { recipientId: userId },
      ],
      order: { createdAt: 'DESC' },
    });

    let allowedUserIds: Set<string> | null = null;
    if (role === 'claimant') {
      const workerIds = await this.getAssignedWorkerIds(userId);
      allowedUserIds = new Set(workerIds);
    }

    const seen = new Set<string>();
    const result: Array<{ userId: string; name: string; role: string; lastMessage: string; lastTime: Date; unread: number }> = [];

    for (const msg of messages) {
      const otherId = msg.senderId === userId ? msg.recipientId : msg.senderId;
      if (allowedUserIds && !allowedUserIds.has(otherId)) continue;

      const convId = [msg.senderId, msg.recipientId].sort().join('_');
      if (seen.has(convId)) continue;
      seen.add(convId);

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

  async markConversationAsRead(userId: string, otherUserId: string, role?: string) {
    if (role === 'claimant') {
      const allowed = await this.getAssignedWorkerIds(userId);
      if (!allowed.includes(otherUserId)) {
        throw new ForbiddenException('You can only read conversations with workers assigned to your case');
      }
    }
    await this.chatRepo.update(
      { senderId: otherUserId, recipientId: userId, isRead: false },
      { isRead: true },
    );
  }

  async getUnreadCount(userId: string) {
    return this.chatRepo.count({
      where: { recipientId: userId, isRead: false },
    });
  }

  async getChatUsers(currentUserId: string, role?: string) {
    if (role === 'claimant') {
      const workerIds = await this.getAssignedWorkerIds(currentUserId);
      if (workerIds.length === 0) return [];
      const users = await this.userRepo.find({
        where: { id: In(workerIds) },
        select: ['id', 'fullName', 'role'],
      });
      return users.map(u => ({
        id: u.id,
        fullName: u.fullName,
        role: u.role,
      }));
    }
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
