import { Body, Controller, Get, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AgenciesService } from './agencies.service';
import { CreateAgencySchema } from './dto/agencies.zod';

@ApiTags('Agencies')
@Controller('agencies')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AgenciesController {
  constructor(private readonly svc: AgenciesService) {}

  @Get()
  @Roles('admin', 'social_worker', 'coordinator', 'agency_staff')
  @ApiOperation({ summary: 'List active agencies' })
  async findAll() {
    return this.svc.findAll();
  }

  @Get(':id')
  @Roles('admin', 'social_worker', 'coordinator', 'agency_staff')
  @ApiOperation({ summary: 'Get an agency by id' })
  async findById(@Param('id') id: string) {
    const agency = await this.svc.findById(id);
    if (!agency) throw new NotFoundException('Agency not found');
    return agency;
  }

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Create an agency' })
  async create(@Body(new ZodPipe(CreateAgencySchema)) dto: any) {
    return this.svc.create(dto);
  }
}
