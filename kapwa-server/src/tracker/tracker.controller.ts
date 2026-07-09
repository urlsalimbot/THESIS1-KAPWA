import { Controller, Get, Post, Query, Body, UseGuards } from '@nestjs/common';
import { TrackerService } from './tracker.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AbacGuard } from '../auth/guards/abac.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { CreateTrackerEntrySchema, CreateTrackerEntryInput } from './dto/tracker.zod';

@Controller('tracker')
@UseGuards(JwtAuthGuard, RolesGuard, AbacGuard)
export class TrackerController {
  constructor(private readonly trackerService: TrackerService) {}

  @Get('daily')
  @Roles('admin', 'social_worker', 'coordinator', 'mayor', 'auditor')
  async getDailyLog(@Query('date') date?: string) {
    return this.trackerService.getDailyLog(date);
  }

  @Get('range')
  @Roles('admin', 'social_worker', 'coordinator', 'mayor', 'auditor')
  async getDateRange(@Query('start') start: string, @Query('end') end: string) {
    return this.trackerService.getDateRange(start, end);
  }

  @Get('stats')
  @Roles('admin', 'social_worker', 'coordinator', 'mayor', 'auditor')
  async getStats() {
    return this.trackerService.getStats();
  }

  @Get('next-id')
  @Roles('admin', 'social_worker')
  async getNextTrackerId(@Query('date') date?: string) {
    const target = date ? new Date(date) : new Date();
    const { trackerId, seqNum } = await this.trackerService.getOrCreateTrackerId(target);
    return { trackerId, seqNum, date: target.toISOString() };
  }

  @Post()
  @Roles('admin', 'social_worker')
  async createEntry(@Body(new ZodPipe(CreateTrackerEntrySchema)) body: CreateTrackerEntryInput) {
    return this.trackerService.createEntry(body as any);
  }

  @Get('sequence')
  @Roles('admin', 'social_worker')
  async getNextSequence(@Query('date') date?: string) {
    const target = date ? new Date(date) : new Date();
    return { nextSequence: await this.trackerService.getNextSequence(target) };
  }
}
