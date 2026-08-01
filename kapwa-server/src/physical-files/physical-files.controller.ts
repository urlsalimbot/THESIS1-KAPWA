import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AbacGuard } from '../auth/guards/abac.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PhysicalFilesService } from './physical-files.service';

@ApiTags('Physical Files')
@Controller('physical-files')
@UseGuards(JwtAuthGuard, RolesGuard, AbacGuard)
@ApiBearerAuth()
export class PhysicalFilesController {
  constructor(private svc: PhysicalFilesService) {}

  @Get()
  @Roles('admin', 'social_worker', 'coordinator')
  @ApiOperation({ summary: 'List all physical files (read-only browse)' })
  async findAll() {
    return this.svc.findAll();
  }

  @Get('search')
  @Roles('admin', 'social_worker', 'coordinator')
  @ApiOperation({ summary: 'Search physical files by cabinet/folder/shelf' })
  async search(@Query('q') q?: string) {
    if (!q) return this.svc.findAll();
    return this.svc.search(q);
  }

  @Get('cabinets')
  @Roles('admin', 'social_worker')
  async cabinets() {
    return this.svc.findDistinctCabinets();
  }

  @Get('intervention/:interventionId')
  @Roles('admin', 'social_worker', 'coordinator')
  async findByIntervention(@Param('interventionId') interventionId: string) {
    return this.svc.findByIntervention(interventionId);
  }

  @Get(':id')
  @Roles('admin', 'social_worker', 'coordinator')
  async findById(@Param('id') id: string) {
    return this.svc.findById(id);
  }
}
