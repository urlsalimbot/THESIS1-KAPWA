import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { IntakeService } from './intake.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AbacGuard } from '../auth/guards/abac.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { IntakeInputSchema, IntakeInput, MatchCheckInputSchema, MatchCheckInput } from './dto/intake.zod';
import { AuthenticatedRequest } from '../auth/types';

@Controller('intake')
@UseGuards(JwtAuthGuard, RolesGuard, AbacGuard)
export class IntakeController {
  constructor(private readonly intakeService: IntakeService) {}

  @Post()
  @Roles('admin', 'social_worker')
  async submitIntake(@Body(new ZodPipe(IntakeInputSchema)) body: IntakeInput) {
    return this.intakeService.submitIntake(body);
  }

  @Post('match-check')
  @Roles('admin', 'social_worker', 'coordinator')
  async matchCheck(
    @Body(new ZodPipe(MatchCheckInputSchema)) body: MatchCheckInput,
    @Request() req: AuthenticatedRequest,
  ) {
    const permittedBarangays: string[] = req.user?.permittedBarangays || [];
    return this.intakeService.matchCheck(body, permittedBarangays);
  }
}
