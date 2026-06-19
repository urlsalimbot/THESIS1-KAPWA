import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { IntakeService } from './intake.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AbacGuard } from '../auth/guards/abac.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { IntakeInputSchema, IntakeInput } from './dto/intake.zod';

@Controller('intake')
@UseGuards(JwtAuthGuard, AbacGuard)
export class IntakeController {
  constructor(private readonly intakeService: IntakeService) {}

  @Post()
  @Roles('admin', 'social_worker')
  async submitIntake(@Body(new ZodPipe(IntakeInputSchema)) body: IntakeInput) {
    return this.intakeService.submitIntake(body);
  }
}
