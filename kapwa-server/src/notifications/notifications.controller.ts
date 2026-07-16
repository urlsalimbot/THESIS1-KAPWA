import { Controller, Post, Get, Put, Delete, Param, Body, UseGuards, Query, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { NotificationsService } from './notifications.service';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { CreateNotificationSchema, CreateNotificationInput, UpdatePreferenceSchema, UpdatePreferenceInput, BulkUpdatePreferencesSchema, BulkUpdatePreferencesInput } from './dto/notifications.zod';
import { AuthenticatedRequest } from '../auth/types';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(private notifService: NotificationsService) {}

  @Post()
  @Roles('admin', 'social_worker')
  async create(@Body(new ZodPipe(CreateNotificationSchema)) body: CreateNotificationInput) {
    return this.notifService.create(body);
  }

  @Post(':id/send')
  @Roles('admin', 'social_worker')
  async send(@Param('id') id: string) {
    return this.notifService.send(id);
  }

  @Post(':id/send-with-consent')
  @Roles('admin', 'social_worker')
  async sendWithConsent(@Param('id') id: string) {
    return this.notifService.sendWithConsent(id);
  }

  @Get('my')
  @Roles('admin', 'social_worker', 'coordinator', 'claimant', 'auditor')
  async getMyNotifications(@Request() req: AuthenticatedRequest) {
    return this.notifService.getByUser(req.user.id);
  }

  @Get('unread')
  @Roles('admin', 'social_worker', 'coordinator', 'claimant', 'auditor')
  async getUnreadCount(@Request() req: AuthenticatedRequest) {
    const count = await this.notifService.getUnreadCount(req.user.id);
    return { count };
  }

  @Post(':id/read')
  @Roles('admin', 'social_worker', 'coordinator', 'claimant', 'auditor')
  async markAsRead(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.notifService.markAsRead(id, req.user.id);
  }

  @Post('read-all')
  @Roles('admin', 'social_worker', 'coordinator', 'claimant', 'auditor')
  async markAllAsRead(@Request() req: AuthenticatedRequest) {
    return this.notifService.markAllAsRead(req.user.id);
  }

  @Get('preferences')
  @Roles('admin', 'social_worker', 'coordinator', 'claimant', 'auditor')
  async getMyPreferences(@Request() req: AuthenticatedRequest) {
    return this.notifService.getPreferences(req.user.id);
  }

  @Put('preferences')
  @Roles('admin', 'social_worker', 'coordinator', 'claimant', 'auditor')
  async setPreference(
    @Request() req: AuthenticatedRequest,
    @Body(new ZodPipe(UpdatePreferenceSchema)) body: UpdatePreferenceInput
  ) {
    return this.notifService.setPreference(req.user.id, body);
  }

  @Put('preferences/bulk')
  @Roles('admin', 'social_worker', 'coordinator', 'claimant', 'auditor')
  async bulkSetPreferences(
    @Request() req: AuthenticatedRequest,
    @Body(new ZodPipe(BulkUpdatePreferencesSchema)) body: BulkUpdatePreferencesInput
  ) {
    return this.notifService.bulkSetPreferences(req.user.id, body);
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
