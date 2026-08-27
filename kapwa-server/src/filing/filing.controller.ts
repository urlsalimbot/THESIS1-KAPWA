import { MAX_FILE_SIZE } from './constants';
import { Controller, Get, Post, Delete, Param, Query, UseGuards, UploadedFile, Body, Request, UseInterceptors, StreamableFile, Res, NotFoundException, ForbiddenException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { FilingService } from './filing.service';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { UploadMetadataSchema } from './dto/filing.zod';
import * as path from 'path';
import * as fs from 'fs';

@ApiTags('Filing')
@Controller('filing')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiBearerAuth()
export class FilingController {
  constructor(private filingService: FilingService) {}

  @Post('upload')
  @Roles('admin', 'social_worker', 'claimant')
  @ApiOperation({ summary: 'Upload a document' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE } }))
  async upload(
    @UploadedFile() file: any,
    @Body(new ZodPipe(UploadMetadataSchema)) metadata: { caseId?: string; beneficiaryId?: string; irfId?: string; announcementId?: string; category?: string; notes?: string; requirementKey?: string },
    @Request() req: any,
  ) {
    return this.filingService.upload(file, {
      ...metadata,
      uploadedBy: req.user?.id || req.user?.sub,
      userId: req.user?.id || req.user?.sub,
      personId: req.user?.personId,
      userRole: req.user?.role,
    });
  }

  @Get()
  @Roles('admin', 'social_worker', 'coordinator', 'claimant')
  @ApiOperation({ summary: 'List documents' })
  async findAll(@Query('caseId') caseId?: string, @Query('beneficiaryId') beneficiaryId?: string, @Query('requirementKey') requirementKey?: string) {
    if (caseId && requirementKey !== undefined) {
      return this.filingService.findByCaseAndRequirement(caseId, requirementKey || undefined);
    }
    return this.filingService.findAll(caseId, beneficiaryId);
  }

  @Get('irf/:irfId/photos')
  @Roles('admin')
  @ApiOperation({ summary: 'List IRF evidence photos (admin only)' })
  async irfPhotos(@Param('irfId') irfId: string) {
    return this.filingService.findPhotosByIrf(irfId);
  }

  @Get(':id')
  @Roles('admin', 'social_worker', 'coordinator')
  @ApiOperation({ summary: 'Get document metadata' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    const doc = await this.filingService.findOne(id);
    if (!this.filingService.isPhotoAccessAllowed(req.user?.role, doc.category)) {
      throw new ForbiddenException('You do not have access to this document');
    }
    return doc;
  }

  @Get(':id/download')
  @Roles('admin', 'social_worker', 'coordinator', 'claimant')
  @ApiOperation({ summary: 'Download document file' })
  async download(@Param('id') id: string, @Request() req: any, @Res({ passthrough: true }) res: Response) {
    const doc = await this.filingService.findOne(id);
    if (!this.filingService.isPhotoAccessAllowed(req.user?.role, doc.category)) {
      throw new ForbiddenException('You do not have access to this document');
    }
    const filePath = path.resolve(process.cwd(), 'uploads', doc.fileName);
    if (!fs.existsSync(filePath)) throw new NotFoundException('File not found on disk');
    const stream = fs.createReadStream(filePath);
    res.set({ 'Content-Type': doc.mimeType || 'application/octet-stream', 'Content-Disposition': `attachment; filename="${doc.originalName}"` });
    return new StreamableFile(stream);
  }

  @Delete(':id')
  @Roles('admin', 'social_worker', 'coordinator')
  @ApiOperation({ summary: 'Delete document' })
  async delete(@Param('id') id: string, @Request() req: any) {
    const doc = await this.filingService.findOne(id);
    if (!this.filingService.isPhotoAccessAllowed(req.user?.role, doc.category, 'delete')) {
      throw new ForbiddenException('Only admins can remove documents');
    }
    return this.filingService.delete(id);
  }

  @Delete('cleanup')
  @Roles('admin')
  @ApiOperation({ summary: 'Cleanup documents older than N days' })
  async cleanup(@Query('days') days: string) {
    return this.filingService.cleanupOlderThan(Number(days) || 90);
  }
}
