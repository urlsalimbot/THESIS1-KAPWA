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
  @Roles('admin', 'social_worker', 'coordinator')
  async sendMessage(
    @Request() req: AuthenticatedRequest,
    @Body(new ZodPipe(SendMessageSchema)) body: SendMessageInput,
  ) {
    return this.chatService.sendMessage(
      req.user.id,
      body.senderName || req.user.fullName || 'Unknown',
      body.recipientId,
      body.content,
    );
  }

  @Get('conversation/:otherUserId')
  @Roles('admin', 'social_worker', 'coordinator')
  async getConversation(
    @Request() req: AuthenticatedRequest,
    @Param('otherUserId') otherUserId: string,
    @Query('limit') limit?: string,
  ) {
    return this.chatService.getConversation(
      req.user.id,
      otherUserId,
      limit ? parseInt(limit) : DEFAULT_MESSAGE_LIMIT,
    );
  }

  @Get('conversations')
  @Roles('admin', 'social_worker', 'coordinator')
  async getConversations(@Request() req: AuthenticatedRequest) {
    return this.chatService.getConversations(req.user.id);
  }

  @Post('conversation/:otherUserId/read')
  @Roles('admin', 'social_worker', 'coordinator')
  async markConversationRead(
    @Request() req: AuthenticatedRequest,
    @Param('otherUserId') otherUserId: string,
  ) {
    await this.chatService.markConversationAsRead(req.user.id, otherUserId);
    return { status: 'read' };
  }

  @Get('users')
  @Roles('admin', 'social_worker', 'coordinator')
  async getChatUsers(@Request() req: AuthenticatedRequest) {
    return this.chatService.getChatUsers(req.user.id);
  }

  @Get('unread')
  @Roles('admin', 'social_worker', 'coordinator')
  async getUnreadCount(@Request() req: AuthenticatedRequest) {
    const count = await this.chatService.getUnreadCount(req.user.id);
    return { count };
  }
}
