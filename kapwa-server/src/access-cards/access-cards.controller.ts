import { Controller, Get, Post, Param, Body, Query, UseGuards, ParseUUIDPipe, DefaultValuePipe, ParseIntPipe, Request } from '@nestjs/common';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { LogServiceSchema } from './dto/access-cards.zod';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AbacGuard } from '../auth/guards/abac.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AccessCardsService } from './access-cards.service';
import { AuthenticatedRequest } from '../auth/types';

@ApiTags('Access Cards')
@Controller('access-cards')
@UseGuards(JwtAuthGuard, RolesGuard, AbacGuard)
@ApiBearerAuth()
export class AccessCardsController {
  constructor(private svc: AccessCardsService) {}

  @Post('assign/:beneficiaryId')
  @Roles('admin', 'social_worker', 'coordinator')
  @ApiOperation({ summary: 'Generate and assign access card to beneficiary' })
  async assignCard(@Param('beneficiaryId', new ParseUUIDPipe()) beneficiaryId: string) {
    const accessCardCode = await this.svc.generateAndAssign(beneficiaryId);
    return { accessCardCode };
  }

  @Get('beneficiary/:id/card/summary')
  @Roles('admin', 'social_worker', 'claimant', 'coordinator')
  @ApiOperation({ summary: 'Get access card summary counts' })
  async getSummary(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.svc.getSummary(id);
  }

  @Get('beneficiary/:id/card')
  @Roles('admin', 'social_worker', 'claimant', 'coordinator', 'agency_staff')
  @ApiOperation({ summary: 'Get beneficiary card details' })
  async findBeneficiaryCard(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.svc.findBeneficiaryCard(id);
  }

  @Post('log')
  @Roles('admin', 'social_worker', 'coordinator', 'agency_staff')
  @ApiOperation({ summary: 'Log a service to an access card' })
  async logService(
    @Body(new ZodPipe(LogServiceSchema)) body: { accessCardCode: string; serviceRendered: string; serviceDate: string; cost?: number; agency?: string; workerNameSign?: string; category?: string },
    @Request() req: AuthenticatedRequest,
  ) {
    return this.svc.logService({
      ...body,
      serviceDate: new Date(body.serviceDate),
      loggedBy: req.user?.id,
      sourceBarangay: req.user?.assignedBarangay,
    });
  }

  @Get(':code/summary')
  @Roles('admin', 'social_worker', 'claimant', 'coordinator', 'agency_staff')
  @ApiOperation({ summary: 'Get agency view of a card: rendered, other-agency, referrals' })
  async agencySummary(@Param('code') code: string, @Request() req: AuthenticatedRequest) {
    return this.svc.getAgencySummary(code, req.user);
  }

  @Get(':cardCode')
  @Roles('admin', 'social_worker', 'claimant', 'coordinator', 'agency_staff')
  @ApiOperation({ summary: 'Get services by card code' })
  async findByCard(@Param('cardCode') cardCode: string) {
    return this.svc.findByCard(cardCode);
  }

  @Get()
  @Roles('admin', 'social_worker', 'coordinator', 'agency_staff')
  @ApiOperation({ summary: 'List all access card services' })
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('sourceBarangay') sourceBarangay?: string,
  ) {
    return this.svc.findAll(page, limit, sourceBarangay);
  }
}
