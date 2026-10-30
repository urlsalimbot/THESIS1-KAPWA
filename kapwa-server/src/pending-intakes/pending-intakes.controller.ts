import { Controller, Get, Param, ParseUUIDPipe, Patch, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedRequest } from '../auth/types';
import { PendingIntakesService } from './pending-intakes.service';

@ApiTags('Pending Intakes')
@Controller('pending-intakes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'social_worker')
@ApiBearerAuth()
export class PendingIntakesController {
  constructor(private readonly service: PendingIntakesService) {}

  @Get()
  @ApiOperation({ summary: 'Claimant self-registrations waiting for staff review' })
  list() {
    return this.service.listPending();
  }

  @Patch(':id/processed')
  @ApiOperation({ summary: 'Mark a pending intake as consumed by a completed intake' })
  processed(@Param('id', new ParseUUIDPipe()) id: string, @Request() req: AuthenticatedRequest) {
    return this.service.markProcessed(id, req.user?.id);
  }

  @Patch(':id/dismiss')
  @ApiOperation({ summary: 'Dismiss a pending intake without creating a case' })
  dismiss(@Param('id', new ParseUUIDPipe()) id: string, @Request() req: AuthenticatedRequest) {
    return this.service.dismiss(id, req.user?.id);
  }
}
