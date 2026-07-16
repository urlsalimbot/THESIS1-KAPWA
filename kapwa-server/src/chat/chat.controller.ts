import { DEFAULT_MESSAGE_LIMIT } from './constants';
import { Controller, Get, Post, Param, Body, UseGuards, Request, Query } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { SendMessageSchema, SendMessageInput } from './dto/chat.zod';
import { AuthenticatedRequest } from '../auth/types';

@Controller('chat')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('send')
  @Roles('admin', 'social_worker', 'coordinator', 'claimant')
  async sendMessage(
    @Request() req: AuthenticatedRequest,
    @Body(new ZodPipe(SendMessageSchema)) body: SendMessageInput,
  ) {
    return this.chatService.sendMessage(
      req.user.id,
      body.senderName || req.user.fullName || 'Unknown',
      body.recipientId,
      body.content,
      req.user.role,
    );
  }

  @Get('conversation/:otherUserId')
  @Roles('admin', 'social_worker', 'coordinator', 'claimant')
  async getConversation(
    @Request() req: AuthenticatedRequest,
    @Param('otherUserId') otherUserId: string,
    @Query('limit') limit?: string,
  ) {
    return this.chatService.getConversation(
      req.user.id,
      otherUserId,
      limit ? parseInt(limit) : DEFAULT_MESSAGE_LIMIT,
      req.user.role,
    );
  }

  @Get('conversations')
  @Roles('admin', 'social_worker', 'coordinator', 'claimant')
  async getConversations(@Request() req: AuthenticatedRequest) {
    return this.chatService.getConversations(req.user.id, req.user.role);
  }

  @Post('conversation/:otherUserId/read')
  @Roles('admin', 'social_worker', 'coordinator', 'claimant')
  async markConversationRead(
    @Request() req: AuthenticatedRequest,
    @Param('otherUserId') otherUserId: string,
  ) {
    await this.chatService.markConversationAsRead(req.user.id, otherUserId, req.user.role);
    return { status: 'read' };
  }

  @Get('users')
  @Roles('admin', 'social_worker', 'coordinator', 'claimant')
  async getChatUsers(@Request() req: AuthenticatedRequest) {
    return this.chatService.getChatUsers(req.user.id, req.user.role);
  }

  @Get('unread')
  @Roles('admin', 'social_worker', 'coordinator', 'claimant')
  async getUnreadCount(@Request() req: AuthenticatedRequest) {
    const count = await this.chatService.getUnreadCount(req.user.id);
    return { count };
  }
}
