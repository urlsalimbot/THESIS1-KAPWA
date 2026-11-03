import { Body, Controller, Get, Put, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { AbacGuard } from '../auth/guards/abac.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { AuthenticatedRequest } from '../auth/types.js';
import { ReminderSettingsService } from './reminder-settings.service.js';
import { ReminderSettingDraft } from './dto/reminder-settings.zod.js';

// System defaults are the MSWDO Head's (admin); every staff member owns their
// own overrides. Reads are as narrow as writes: the defaults are public to
// staff so the UI can show what a worker is inheriting.
@ApiTags('Reminder Settings')
@Controller('reminder-settings')
@UseGuards(JwtAuthGuard, RolesGuard, AbacGuard)
@ApiBearerAuth()
export class ReminderSettingsController {
  constructor(private readonly svc: ReminderSettingsService) {}

  @Get('system')
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'System reminder defaults per event type' })
  systemDefaults() {
    return this.svc.systemDefaults();
  }

  @Put('system')
  @Roles('admin')
  @ApiOperation({ summary: 'Set the system reminder defaults (MSWDO Head)' })
  saveSystemDefaults(@Body() dto: ReminderSettingDraft[], @Request() req: AuthenticatedRequest) {
    return this.svc.saveSystemDefaults(dto, req.user.id);
  }

  @Get('me')
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'My reminder overrides' })
  mine(@Request() req: AuthenticatedRequest) {
    return this.svc.workerSettings(req.user.id);
  }

  @Put('me')
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'Set my reminder overrides (empty list disables)' })
  saveMine(@Body() dto: ReminderSettingDraft[], @Request() req: AuthenticatedRequest) {
    return this.svc.saveWorkerSettings(req.user.id, dto, req.user.id);
  }
}