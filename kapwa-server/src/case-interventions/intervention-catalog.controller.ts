import { Controller, Get, Post, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { AuthenticatedRequest } from '../auth/types';
import { InterventionCatalogService } from './intervention-catalog.service';
import {
  CreateServiceTypeSchema, UpdateServiceTypeSchema,
  CreateServiceTypeInput, UpdateServiceTypeInput,
} from './dto/intervention-catalog.zod';

@ApiTags('Intervention Catalog')
@ApiBearerAuth()
@Controller('intervention-catalog')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InterventionCatalogController {
  constructor(private readonly catalog: InterventionCatalogService) {}

  // The case dialog reads these for labels and the money fields, so every role
  // that can record a service can read the list.
  @Get()
  @Roles('admin', 'social_worker', 'coordinator')
  @ApiOperation({ summary: 'List the custom services added to the catalog' })
  list() {
    return this.catalog.list();
  }

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Add a service to the intervention catalog' })
  create(
    @Body(new ZodPipe(CreateServiceTypeSchema)) body: CreateServiceTypeInput,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.catalog.create(body, req.user?.id);
  }

  @Patch(':code')
  @Roles('admin')
  @ApiOperation({ summary: 'Rename or deactivate a catalog service' })
  update(
    @Param('code') code: string,
    @Body(new ZodPipe(UpdateServiceTypeSchema)) body: UpdateServiceTypeInput,
  ) {
    return this.catalog.update(code, body);
  }
}
