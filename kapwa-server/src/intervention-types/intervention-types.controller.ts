import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { InterventionTypesService } from './intervention-types.service';
import { CreateInterventionTypeSchema, UpdateInterventionTypeSchema } from './dto/intervention-types.zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AbacGuard } from '../auth/guards/abac.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodPipe } from '../common/pipes/zod.pipe';

@Controller('intervention-types')
@UseGuards(JwtAuthGuard, RolesGuard, AbacGuard)
export class InterventionTypesController {
  constructor(private readonly service: InterventionTypesService) {}

  @Get()
  @Roles('admin', 'social_worker', 'coordinator', 'mayor', 'auditor')
  async findAll(@Query('includeInactive') includeInactive?: string) {
    return this.service.findAll(includeInactive === 'true');
  }

  @Get(':id')
  @Roles('admin', 'social_worker', 'coordinator')
  async findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Post()
  @Roles('admin')
  async create(@Body(new ZodPipe(CreateInterventionTypeSchema)) body: any) {
    return this.service.create(body);
  }

  @Patch(':id')
  @Roles('admin')
  async update(@Param('id') id: string, @Body(new ZodPipe(UpdateInterventionTypeSchema)) body: any) {
    return this.service.update(id, body);
  }

  @Patch(':id/deactivate')
  @Roles('admin')
  async deactivate(@Param('id') id: string) {
    await this.service.deactivate(id);
    return { message: 'Intervention type deactivated' };
  }
}
