import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { SyncService } from './sync.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AbacGuard } from '../auth/guards/abac.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SyncRequestSchema, SyncRequestInput, ResolveConflictSchema } from './dto/sync.zod';
import { PullRequestInput } from './dto/pull.zod';
import { PullRequestSchema } from './dto/pull.zod';
import { ZodPipe } from '../common/pipes/zod.pipe';

@Controller('sync')
@UseGuards(JwtAuthGuard, RolesGuard, AbacGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('v1')
  @Roles('admin', 'coordinator', 'social_worker')
  async processDelta(
    @Body(new ZodPipe(SyncRequestSchema)) body: any,
  ) {
    return this.syncService.processDelta(body);
  }

  @Post('pull')
  @Roles('admin', 'coordinator', 'social_worker')
  async pullFromServer(@Body(new ZodPipe(PullRequestSchema)) body: PullRequestInput) {
    return this.syncService.pullFromServer(body.deviceId, body.versionVectors);
  }

  @Get('conflicts/:deviceId')
  @Roles('admin', 'coordinator')
  async getConflicts(@Param('deviceId') deviceId: string) {
    return this.syncService.getConflicts(deviceId);
  }

  @Post('conflicts/:id/resolve')
  @Roles('admin', 'coordinator')
  async resolveConflict(
    @Param('id') id: string,
    @Body(new ZodPipe(ResolveConflictSchema)) body: any,
  ) {
    return this.syncService.resolveConflict(id, body.resolution);
  }
}
