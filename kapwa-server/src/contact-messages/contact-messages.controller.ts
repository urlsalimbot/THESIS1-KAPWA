import { Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards, UseInterceptors, SerializeOptions } from '@nestjs/common';
import { ClassSerializerInterceptor } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ContactMessagesService } from './contact-messages.service';

@ApiTags('Contact Messages')
@Controller('contact-messages')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(ClassSerializerInterceptor)
@SerializeOptions({ strategy: 'exposeAll' })
@ApiBearerAuth()
export class ContactMessagesController {
  constructor(private readonly svc: ContactMessagesService) {}

  @Get()
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'List contact messages (staff)' })
  list() {
    return this.svc.findAll();
  }

  @Get('unread-count')
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'Unread contact message count (staff)' })
  unreadCount() {
    return this.svc.unreadCount();
  }

  @Patch(':id/read')
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'Mark a contact message as read (staff)' })
  markRead(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.markRead(id);
  }
}