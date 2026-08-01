import {
  Controller, Get, Post, Patch, Delete, Param, Body, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AnnouncementsService } from './announcements.service';

interface CreateAnnouncementDto {
  title: string;
  excerpt?: string;
  bodyHtml: string;
  status?: 'draft' | 'published';
}

interface UpdateAnnouncementDto {
  title?: string;
  excerpt?: string;
  bodyHtml?: string;
  status?: 'draft' | 'published';
}

@ApiTags('Announcements')
@Controller('announcements')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AnnouncementsController {
  constructor(private readonly svc: AnnouncementsService) {}

  @Get()
  @Roles('admin', 'social_worker', 'coordinator')
  @ApiOperation({ summary: 'List all announcements (admin)' })
  async findAll() {
    return this.svc.findAll();
  }

  @Get(':id')
  @Roles('admin', 'social_worker', 'coordinator')
  @ApiOperation({ summary: 'Get announcement by ID (admin)' })
  async findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Post()
  @Roles('admin', 'social_worker', 'coordinator')
  @ApiOperation({ summary: 'Create announcement' })
  async create(@Body() dto: CreateAnnouncementDto) {
    return this.svc.create(dto);
  }

  @Patch(':id')
  @Roles('admin', 'social_worker', 'coordinator')
  @ApiOperation({ summary: 'Update announcement fields' })
  async update(@Param('id') id: string, @Body() dto: UpdateAnnouncementDto) {
    return this.svc.update(id, dto);
  }

  @Patch(':id/pin')
  @Roles('admin', 'social_worker', 'coordinator')
  @ApiOperation({ summary: 'Toggle pinned status' })
  async togglePin(@Param('id') id: string) {
    return this.svc.togglePin(id);
  }

  @Delete(':id')
  @Roles('admin', 'social_worker', 'coordinator')
  @ApiOperation({ summary: 'Delete announcement' })
  async remove(@Param('id') id: string) {
    await this.svc.delete(id);
    return { success: true };
  }
}
