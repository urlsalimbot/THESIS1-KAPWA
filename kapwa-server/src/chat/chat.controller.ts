import { Controller, Get, Post, Param, Body, UseGuards, Request, Query } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('chat')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('send')
  @Roles('admin', 'social_worker', 'coordinator')
  async sendMessage(
    @Request() req: any,
    @Body() body: { recipientId: string; content: string; senderName?: string },
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
    @Request() req: any,
    @Param('otherUserId') otherUserId: string,
    @Query('limit') limit?: string,
  ) {
    return this.chatService.getConversation(
      req.user.id,
      otherUserId,
      limit ? parseInt(limit) : 50,
    );
  }

  @Get('conversations')
  @Roles('admin', 'social_worker', 'coordinator')
  async getConversations(@Request() req: any) {
    return this.chatService.getConversations(req.user.id);
  }

  @Post('conversation/:otherUserId/read')
  @Roles('admin', 'social_worker', 'coordinator')
  async markConversationRead(
    @Request() req: any,
    @Param('otherUserId') otherUserId: string,
  ) {
    await this.chatService.markConversationAsRead(req.user.id, otherUserId);
    return { status: 'read' };
  }

  @Get('unread')
  @Roles('admin', 'social_worker', 'coordinator')
  async getUnreadCount(@Request() req: any) {
    const count = await this.chatService.getUnreadCount(req.user.id);
    return { count };
  }
}
