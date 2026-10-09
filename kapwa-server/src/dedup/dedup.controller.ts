import { Controller, Get, Post, Param, Body, Query, UseGuards, UseInterceptors, UploadedFile, Request, Res, NotFoundException, BadRequestException, StreamableFile, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { MAX_FILE_SIZE } from '../common/constants';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { AuthenticatedRequest } from '../auth/types';
import { DedupService } from './dedup.service';
import { CreateDedupOperationSchema, CreateDedupOperationInput, DedupDecisionSchema, DedupDecisionInput, EligibilityDecisionSchema, EligibilityDecisionInput } from './dto/dedup.zod';

@ApiTags('Client Deduplication')
@Controller('client-dedup')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin', 'social_worker')
@ApiBearerAuth()
export class DedupController {
  constructor(private readonly dedup: DedupService) {}

  @Post('operations')
  @ApiOperation({ summary: 'Create a deduplication operation with its column map' })
  async create(@Body(new ZodPipe(CreateDedupOperationSchema)) body: CreateDedupOperationInput, @Request() req: AuthenticatedRequest) {
    return this.dedup.create(body, req.user?.id);
  }

  @Post('operations/:id/upload')
  @ApiOperation({ summary: 'Upload the client list (xlsx/csv) — parses and matches' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE } }))
  async upload(@Param('id') id: string, @UploadedFile() file: any, @Request() req: AuthenticatedRequest) {
    if (!file) throw new BadRequestException('A file is required');
    return this.dedup.upload(id, file.buffer, file.originalname, req.user?.id);
  }

  @Get('operations')
  @ApiOperation({ summary: 'List operations' })
  async list(@Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number, @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number, @Query('status') status?: string) {
    return this.dedup.list(page, limit, status);
  }

  @Get('operations/:id')
  @ApiOperation({ summary: 'Operation detail with review counts' })
  async detail(@Param('id') id: string) {
    return this.dedup.detail(id);
  }

  @Get('operations/:id/rows')
  @ApiOperation({ summary: 'Review rows (paginated, filterable)' })
  async rows(@Param('id') id: string, @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number, @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number, @Query('status') status?: string, @Query('search') search?: string, @Query('filter') filter?: string) {
    return this.dedup.rows(id, page, limit, status, search, filter);
  }

  @Get('operations/:id/rows/:rowId/matches')
  @ApiOperation({ summary: 'Candidate matches for a row, enriched for the review cards' })
  async rowMatches(@Param('id') id: string, @Param('rowId') rowId: string, @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number, @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number) {
    return this.dedup.rowMatches(id, rowId, page, limit);
  }

  @Post('operations/:id/matches/:matchId/decision')
  @ApiOperation({ summary: 'Record the retain/dedupe decision for a candidate' })
  async decide(@Param('id') id: string, @Param('matchId') matchId: string, @Body(new ZodPipe(DedupDecisionSchema)) body: DedupDecisionInput, @Request() req: AuthenticatedRequest) {
    return this.dedup.decide(id, matchId, body, req.user?.id);
  }

  @Post('operations/:id/rows/:rowId/eligibility')
  @ApiOperation({ summary: 'Operator review of a disqualified row: waive or confirm' })
  async decideEligibility(
    @Param('id') id: string,
    @Param('rowId') rowId: string,
    @Body(new ZodPipe(EligibilityDecisionSchema)) body: EligibilityDecisionInput,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.dedup.decideEligibility(id, rowId, body.decision, req.user?.id, body.matchId);
  }

  @Post('operations/:id/matches/:matchId/revert')
  @ApiOperation({ summary: 'Revert a decision back to pending' })
  async revert(@Param('id') id: string, @Param('matchId') matchId: string) {
    return this.dedup.revert(id, matchId);
  }

  @Post('operations/:id/finalize')
  @ApiOperation({ summary: 'Finalize — blocked while any match is pending' })
  async finalize(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.dedup.finalize(id, req.user?.id);
  }

  @Get('operations/:id/output')
  @ApiOperation({ summary: 'Download the stored priority-list Excel' })
  async output(@Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const op: any = await this.dedup.detail(id);
    if (!op.outputFile) throw new NotFoundException('This operation has not been finalized yet');
    const file = path.resolve(process.cwd(), op.outputFile);
    if (!fs.existsSync(file)) throw new NotFoundException('The output file is missing on disk');
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${path.basename(file)}"`,
    });
    return new StreamableFile(fs.createReadStream(file));
  }
}
