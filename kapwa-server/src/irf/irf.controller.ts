import { Controller, Get, Post, Patch, Param, Body, UseGuards, Query, Request } from '@nestjs/common';
import { z } from 'zod';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AbacGuard } from '../auth/guards/abac.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { IrfService } from './irf.service';
import { ZodPipe } from '../common/pipes/zod.pipe';
import {
  CreateIrfSchema,
  DismissIrfSchema,
  DecryptNarrationSchema,
  OverrideDispositionSchema,
  CreateIrfInput,
  DismissIrfInput,
  DecryptNarrationInput,
  OverrideDispositionInput,
} from './dto/irf.zod';

const UPDATE_NARRATION_SCHEMA = z.object({
  narration: z.string().min(1, 'Narration is required'),
});

const LEGAL_BASIS_MAX_LENGTH = 50;

@ApiTags('IRF')
@Controller('irf')
@UseGuards(JwtAuthGuard, RolesGuard, AbacGuard)
@ApiBearerAuth()
export class IrfController {
  constructor(private irfService: IrfService) {}

  @Get()
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'List IRF cases (names masked)' })
  async findAll() {
    return this.irfService.findAll();
  }

  @Get(':id')
  @Roles('admin', 'social_worker', 'auditor')
  @ApiOperation({ summary: 'Get IRF case (narration masked, names masked)' })
  async findOne(@Param('id') id: string) {
    return this.irfService.findById(id);
  }

  @Post()
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'Submit IRF (narration encrypted via pgcrypto if provided)' })
  async create(@Body(new ZodPipe(CreateIrfSchema)) body: CreateIrfInput) {
    return this.irfService.create(body);
  }

  @Patch(':id/narration')
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'Update IRF narration (re-encrypted via pgcrypto)' })
  async updateNarration(
    @Param('id') id: string,
    @Body(new ZodPipe(UPDATE_NARRATION_SCHEMA)) body: { narration: string }
  ) {
    return this.irfService.updateNarration(id, body.narration);
  }

  // ---------- Dedicated FSM endpoints ----------

  @Patch(':id/refer-pnp')
  @Roles('admin')
  @ApiOperation({ summary: 'Refer IRF to PNP (from Under Investigation)' })
  async referToPnp(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.irfService.referToPnp(id, req.user?.role);
  }

  @Patch(':id/refer-wcpd')
  @Roles('admin')
  @ApiOperation({ summary: 'Refer IRF to WCPD (from Under Investigation)' })
  async referToWcpd(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.irfService.referToWcpd(id, req.user?.role);
  }

  @Patch(':id/dismiss')
  @Roles('admin')
  @ApiOperation({ summary: 'Dismiss IRF (from Under Investigation)' })
  async dismiss(
    @Param('id') id: string,
    @Body(new ZodPipe(DismissIrfSchema)) body: DismissIrfInput,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.irfService.dismiss(id, body.reason, req.user?.role);
  }

  @Patch(':id/close')
  @Roles('admin')
  @ApiOperation({ summary: 'Close IRF (from Referred/Dismissed)' })
  async close(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.irfService.close(id, req.user?.role);
  }

  @Patch(':id/override-disposition')
  @Roles('admin')
  @ApiOperation({ summary: 'Admin override of disposition (mandatory reason)' })
  async overrideDisposition(
    @Param('id') id: string,
    @Body(new ZodPipe(OverrideDispositionSchema)) body: OverrideDispositionInput,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.irfService.overrideDisposition(id, body.targetDisposition as any, body.reason, req.user?.role);
  }

  // ---------- Decrypt / Unmask ----------

  @Post(':id/decrypt')
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'Decrypt narration (requires legal basis code)' })
  async decrypt(
    @Param('id') id: string,
    @Body(new ZodPipe(DecryptNarrationSchema)) body: DecryptNarrationInput,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.irfService.getDecryptedNarr(id, body.legalBasis);
  }

  @Get(':id/unmask-names')
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'Unmask names for IRF (two-step legal basis unlock)' })
  async unmaskNames(
    @Param('id') id: string,
    @Query('legalBasis', new ZodPipe(z.string().min(1).max(LEGAL_BASIS_MAX_LENGTH))) legalBasis: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.irfService.unmaskNames(id, legalBasis, req.user?.id || 'system');
  }

  // ---------- Export ----------

  @Get(':id/export-wcpd')
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'Export IRF to WCPD/PNP format (requires legal basis)' })
  async exportWcpd(
    @Param('id') id: string,
    @Query('legalBasis', new ZodPipe(z.string().min(1).max(LEGAL_BASIS_MAX_LENGTH))) legalBasis: string
  ) {
    return this.irfService.exportWcpd(id, legalBasis);
  }
}

interface AuthenticatedRequest {
  user?: {
    id: string;
    role: string;
    email?: string;
  };
}
