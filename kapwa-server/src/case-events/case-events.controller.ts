import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AbacGuard } from '../auth/guards/abac.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedRequest } from '../auth/types';
import { CaseEventsService } from './case-events.service';
import { CreateCaseEventInput, UpdateCaseEventInput } from './dto/case-events.zod';

// Court hearings + scheduled home visits on a case. Writes are
// admin + social_worker (the same matrix every case write route uses);
// coordinators may read events for the cases they can see.
@ApiTags('Case Events')
@Controller('cases/:caseId/events')
@UseGuards(JwtAuthGuard, RolesGuard, AbacGuard)
@ApiBearerAuth()
export class CaseEventsController {
  constructor(private readonly svc: CaseEventsService) {}

  @Get()
  @Roles('admin', 'social_worker', 'coordinator')
  @ApiOperation({ summary: 'List events for a case' })
  list(@Param('caseId', new ParseUUIDPipe()) caseId: string) {
    return this.svc.listForCase(caseId);
  }

  @Post()
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'Create a court hearing or scheduled home visit' })
  create(@Param('caseId', new ParseUUIDPipe()) caseId: string, @Body() dto: CreateCaseEventInput, @Request() req: AuthenticatedRequest) {
    return this.svc.create(caseId, dto, req.user);
  }

  @Patch(':eventId')
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'Update an event (incl. status planned/done/cancelled)' })
  update(@Param('caseId', new ParseUUIDPipe()) caseId: string, @Param('eventId', new ParseUUIDPipe()) eventId: string, @Body() dto: UpdateCaseEventInput, @Request() req: AuthenticatedRequest) {
    return this.svc.update(caseId, eventId, dto, req.user);
  }

  @Delete(':eventId')
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'Delete an event (removes its calendar block)' })
  remove(@Param('caseId', new ParseUUIDPipe()) caseId: string, @Param('eventId', new ParseUUIDPipe()) eventId: string, @Request() req: AuthenticatedRequest) {
    return this.svc.remove(caseId, eventId, req.user);
  }
}