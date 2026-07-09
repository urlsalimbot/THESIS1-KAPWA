import { Controller, Get, Post, Param, Body, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
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
  @Roles('admin')
  @ApiOperation({ summary: 'Generate and assign access card to beneficiary' })
  async assignCard(@Param('beneficiaryId', new ParseUUIDPipe()) beneficiaryId: string) {
    const accessCardCode = await this.svc.generateAndAssign(beneficiaryId);
    return { accessCardCode };
  }

  @Get('beneficiary/:id/card')
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'Get beneficiary card details' })
  async findBeneficiaryCard(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.svc.findBeneficiaryCard(id);
  }

  @Post('log')
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'Log a service to an access card' })
  async logService(@Body(new ZodPipe(LogServiceSchema)) body: { accessCardCode: string; serviceRendered: string; serviceDate: string; cost?: number; agency?: string; workerNameSign?: string }) {
    return this.svc.logService({ ...body, serviceDate: new Date(body.serviceDate) });
  }

  @Get(':cardCode')
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'Get services by card code' })
  async findByCard(@Param('cardCode') cardCode: string) {
    return this.svc.findByCard(cardCode);
  }

  @Get()
  @Roles('admin')
  @ApiOperation({ summary: 'List all access card services' })
  async findAll() {
    return this.svc.findAll();
  }
}
