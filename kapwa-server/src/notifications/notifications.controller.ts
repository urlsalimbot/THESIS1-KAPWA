import { Controller, Post, Get, Delete, Param, Body, UseGuards, Query, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(private notifService: NotificationsService) {}

  @Post()
  @Roles('admin', 'social_worker')
  async create(@Body() body: any) {
    return this.notifService.create(body);
  }

  @Post(':id/send')
  @Roles('admin', 'social_worker')
  async send(@Param('id') id: string) {
    return this.notifService.send(id);
  }

  @Get('my')
  @Roles('admin', 'social_worker', 'coordinator', 'claimant', 'auditor')
  async getMyNotifications(@Request() req: any) {
    return this.notifService.getByUser(req.user.id);
  }

  @Get('unread')
  @Roles('admin', 'social_worker', 'coordinator', 'claimant', 'auditor')
  async getUnreadCount(@Request() req: any) {
    const count = await this.notifService.getUnreadCount(req.user.id);
    return { count };
  }

  @Post(':id/read')
  @Roles('admin', 'social_worker', 'coordinator', 'claimant', 'auditor')
  async markAsRead(@Param('id') id: string) {
    return this.notifService.markAsRead(id);
  }

  @Post('read-all')
  @Roles('admin', 'social_worker', 'coordinator', 'claimant', 'auditor')
  async markAllAsRead(@Request() req: any) {
    return this.notifService.markAllAsRead(req.user.id);
  }

  @Get('recipient/:recipientId')
  @Roles('admin')
  async findByRecipient(@Param('recipientId') recipientId: string) {
    return this.notifService.findByRecipient(recipientId);
  }

  @Delete(':id')
  @Roles('admin')
  async delete(@Param('id') id: string) {
    return this.notifService.delete(id);
  }
}
