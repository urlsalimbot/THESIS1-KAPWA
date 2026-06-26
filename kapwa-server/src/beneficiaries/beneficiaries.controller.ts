import { Controller, Get, Post, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { BeneficiariesService } from './beneficiaries.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AbacGuard } from '../auth/guards/abac.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { DEFAULT_LIST_LIMIT } from '../common/constants';
import { AuthenticatedRequest } from '../auth/types';
import { CreateBeneficiarySchema, CreateBeneficiaryInput, RevokeConsentSchema } from './dto/beneficiaries.zod';

@Controller('beneficiaries')
@UseGuards(JwtAuthGuard, AbacGuard)
export class BeneficiariesController {
  constructor(private benService: BeneficiariesService) {}

  @Get()
  @Roles('admin', 'social_worker', 'coordinator', 'mayor')
  async findAll(
    @Query('barangay') barangay?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('category') category?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : DEFAULT_LIST_LIMIT;
    return this.benService.findAll(barangay, search, pageNum, limitNum, category);
  }

  @Get('dashboard')
  @Roles('claimant')
  async dashboard(@Request() req: AuthenticatedRequest) {
    return this.benService.getMyServices(req.user?.id || req.user.id);
  }

  @Get('me/services')
  @Roles('claimant')
  async getMyServices(@Request() req: AuthenticatedRequest) {
    return this.benService.getMyServices(req.user?.id || req.user.id);
  }

  @Get('me/access-card')
  @Roles('claimant')
  async getMyAccessCard(@Request() req: AuthenticatedRequest) {
    return this.benService.getAccessCard(req.user?.id || req.user.id);
  }

  @Get('me/consent')
  @Roles('claimant')
  async getMyConsent(@Request() req: AuthenticatedRequest) {
    return this.benService.getMyConsent(req.user?.id || req.user.id);
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

  @Get(':id/consent')
  @Roles('admin', 'social_worker')
  async getConsentHistory(@Param('id') id: string) {
    return this.benService.getMyConsent(id);
  }

  @Post(':id/consent/revoke')
  @Roles('admin', 'social_worker')
  async revokeConsent(
    @Param('id') id: string,
    @Body(new ZodPipe(RevokeConsentSchema)) body: { reason?: string },
  ) {
    return this.benService.revokeConsent(id, body);
  }

  @Post()
  @Roles('admin', 'social_worker')
  async create(@Body(new ZodPipe(CreateBeneficiarySchema)) body: CreateBeneficiaryInput) {
    return this.benService.createBeneficiary(body as any);
  }
}
