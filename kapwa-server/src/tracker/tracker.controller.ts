import { Controller, Get, Post, Query, Body, UseGuards } from '@nestjs/common';
import { TrackerService } from './tracker.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AbacGuard } from '../auth/guards/abac.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('tracker')
@UseGuards(JwtAuthGuard, AbacGuard)
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

  @Post()
  @Roles('admin', 'social_worker')
  async createEntry(@Body() body: any) {
    return this.trackerService.createEntry(body);
  }

  @Get('sequence')
  @Roles('admin', 'social_worker')
  async getNextSequence(@Query('date') date?: string) {
    const target = date ? new Date(date) : new Date();
    return { nextSequence: await this.trackerService.getNextSequence(target) };
  }
}
