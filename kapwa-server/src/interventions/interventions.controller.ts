import { Controller, Get, Post, Param, Body, UseGuards, Request } from '@nestjs/common';
import { InterventionsService } from './interventions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AbacGuard } from '../auth/guards/abac.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { CreateInterventionSchema } from './dto/interventions.zod';

@Controller('interventions')
@UseGuards(JwtAuthGuard, AbacGuard)
export class InterventionsController {
  constructor(private intService: InterventionsService) {}

  @Get()
  @Roles('admin', 'social_worker', 'mayor', 'auditor')
  async findAll() {
    return this.intService.findAll();
  }

  @Get(':id')
  @Roles('admin', 'social_worker', 'auditor')
  async findOne(@Param('id') id: string) {
    return this.intService.findById(id);
  }

  @Post()
  @Roles('admin', 'social_worker')
  async create(@Request() req: any, @Body(new ZodPipe(CreateInterventionSchema)) body: any) {
    return this.intService.create(body, req.user.id);
  }

  @Get('case/:caseId')
  @Roles('admin', 'social_worker')
  async findByCase(@Param('caseId') caseId: string) {
    return this.intService.findByCase(caseId);
  }
}
