import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { BeneficiariesService } from './beneficiaries.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AbacGuard } from '../auth/guards/abac.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { CreateBeneficiarySchema, UpdateBeneficiarySchema } from './dto/beneficiaries.zod';

@Controller('beneficiaries')
@UseGuards(JwtAuthGuard, AbacGuard)
export class BeneficiariesController {
  constructor(private benService: BeneficiariesService) {}

  @Get()
  @Roles('admin', 'social_worker', 'coordinator', 'mayor')
  async findAll(@Query('barangay') barangay?: string) {
    return this.benService.findAll(barangay);
  }

  @Get(':id')
  @Roles('admin', 'social_worker', 'coordinator')
  async findOne(@Param('id') id: string) {
    return this.benService.findById(id);
  }

  @Get(':id/family-graph')
  @Roles('admin', 'social_worker')
  async getFamilyGraph(@Param('id') id: string) {
    return this.benService.getFamilyGraph(id);
  }

  @Post()
  @Roles('admin', 'social_worker')
  async create(@Body(new ZodPipe(CreateBeneficiarySchema)) body: any) {
    return this.benService.createBeneficiary(body);
  }

  @Patch(':id')
  @Roles('admin')
  async update(@Param('id') id: string, @Body(new ZodPipe(UpdateBeneficiarySchema)) body: any) {
    return this.benService.update(id, body);
  }
}
