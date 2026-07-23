import { Controller, Get, Post, Param, Body, Query, UseGuards, ParseUUIDPipe, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { LogServiceSchema } from './dto/access-cards.zod';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AbacGuard } from '../auth/guards/abac.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AccessCardsService } from './access-cards.service';

@ApiTags('Access Cards')
@Controller('access-cards')
@UseGuards(JwtAuthGuard, RolesGuard, AbacGuard)
@ApiBearerAuth()
export class AccessCardsController {
  constructor(private svc: AccessCardsService) {}

  @Post('assign/:beneficiaryId')
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'Generate and assign access card to beneficiary' })
  async assignCard(@Param('beneficiaryId', new ParseUUIDPipe()) beneficiaryId: string) {
    const accessCardCode = await this.svc.generateAndAssign(beneficiaryId);
    return { accessCardCode };
  }

  @Get('beneficiary/:id/card/summary')
  @Roles('admin', 'social_worker', 'claimant')
  @ApiOperation({ summary: 'Get access card summary counts' })
  async getSummary(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.svc.getSummary(id);
  }

  @Get('beneficiary/:id/card')
  @Roles('admin', 'social_worker', 'claimant')
  @ApiOperation({ summary: 'Get beneficiary card details' })
  async findBeneficiaryCard(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.svc.findBeneficiaryCard(id);
  }

  @Post('log')
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'Log a service to an access card' })
  async logService(@Body(new ZodPipe(LogServiceSchema)) body: { accessCardCode: string; serviceRendered: string; serviceDate: string; cost?: number; agency?: string; workerNameSign?: string; category?: string }) {
    return this.svc.logService({ ...body, serviceDate: new Date(body.serviceDate) });
  }

  @Get(':cardCode')
  @Roles('admin', 'social_worker', 'claimant')
  @ApiOperation({ summary: 'Get services by card code' })
  async findByCard(@Param('cardCode') cardCode: string) {
    return this.svc.findByCard(cardCode);
  }

  @Get()
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'List all access card services' })
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.svc.findAll(page, limit);
  }
}
