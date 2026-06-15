import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { CasesService } from './cases.service';
import { CaseStatus } from './case.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AbacGuard } from '../auth/guards/abac.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { CreateCaseSchema, UpdateStatusSchema } from './dto/cases.zod';

@Controller('cases')
@UseGuards(JwtAuthGuard, AbacGuard)
export class CasesController {
  constructor(private casesService: CasesService) {}

  @Get()
  @Roles('admin', 'social_worker', 'coordinator')
  async findAll(@Query('status') status?: CaseStatus) {
    return this.casesService.findAll(status);
  }

  @Get('disbursed/pending-intervention')
  @Roles('admin', 'social_worker')
  async getPendingDisbursed() {
    return this.casesService.getPendingDisbursed();
  }

  @Get(':id')
  @Roles('admin', 'social_worker', 'coordinator')
  async findOne(@Param('id') id: string) {
    return this.casesService.findById(id);
  }

  @Post()
  @Roles('admin', 'social_worker')
  async create(@Body(new ZodPipe(CreateCaseSchema)) body: any) {
    return this.casesService.create(body);
  }

  @Patch(':id/status')
  @Roles('admin')
  async updateStatus(@Param('id') id: string, @Body(new ZodPipe(UpdateStatusSchema)) body: { status: CaseStatus }) {
    return this.casesService.updateStatus(id, body.status);
  }
}
