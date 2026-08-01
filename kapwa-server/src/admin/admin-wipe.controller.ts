import { Controller, Post, Param, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AbacGuard } from '../auth/guards/abac.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminWipeService } from './admin-wipe.service';

@ApiTags('Admin')
@Controller('admin/wipe')
@UseGuards(JwtAuthGuard, RolesGuard, AbacGuard)
@ApiBearerAuth()
export class AdminWipeController {
  constructor(private svc: AdminWipeService) {}

  @Post('device/:deviceId')
  @Roles('admin')
  @ApiOperation({ summary: 'Remote wipe a specific device (invalidate session + unlink)' })
  async wipeDevice(@Param('deviceId') deviceId: string) {
    return this.svc.wipeDevice(deviceId);
  }

  @Post('user/:userId')
  @Roles('admin')
  @ApiOperation({ summary: 'Remote wipe all sessions for a user' })
  async wipeUser(@Param('userId') userId: string) {
    return this.svc.wipeUser(userId);
  }

  @Get('devices')
  @Roles('admin')
  @ApiOperation({ summary: 'List all devices bound to user accounts' })
  async listDevices() {
    return this.svc.listBoundDevices();
  }
}
