import { Body, Controller, Get, Post, UseGuards, UseInterceptors, SerializeOptions } from '@nestjs/common';
import { ClassSerializerInterceptor } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodPipe } from '../common/pipes/zod.pipe.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { AgenciesService } from './agencies.service.js';
import { CreateAgencySchema } from './dto/agencies.zod.js';

@ApiTags('Agencies')
@Controller('agencies')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(ClassSerializerInterceptor)
@SerializeOptions({ strategy: 'exposeAll' })
@ApiBearerAuth()
export class AgenciesController {
  constructor(private readonly svc: AgenciesService) {}

  @Get()
  @Roles('admin', 'social_worker', 'coordinator')
  @ApiOperation({ summary: 'List active agencies' })
  async findAll() {
    return this.svc.findAll();
  }

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Create an agency' })
  async create(@Body(new ZodPipe(CreateAgencySchema)) dto: any) {
    return this.svc.create(dto);
  }
}
