import { MAX_FILE_SIZE } from '../common/constants';
import { Controller, Get, Post, Patch, Delete, Param, Query, UseGuards, UploadedFile, Body, Request, UseInterceptors, StreamableFile, Res, NotFoundException, ForbiddenException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { FilingService } from './filing.service';
import { CaseStepLocksService } from '../cases/case-step-locks.service';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { UploadMetadataSchema, VerifyDocumentSchema, VerifyDocumentInput } from './dto/filing.zod';
import * as fs from 'fs';

@ApiTags('Filing')
@Controller('filing')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiBearerAuth()
export class FilingController {
  constructor(
    private filingService: FilingService,
    // Step 1's seal reads `case_requirements`. The three routes below are the
    // only filing writes that touch it, and they are the paths nobody guarded:
    // `PATCH /cases/:id/requirements` was guarded, but a staff upload writes the
    // same table through `/filing/upload`. Guarded on the route, with the same
    // `assertUnsealed(caseId, 1)` the cases routes use, so there is one rule.
    private stepLocks: CaseStepLocksService,
  ) {}

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
    // Only a requirement upload writes `case_requirements`; a photo or an
    // approval document changes no sealed data, so it is not refused.
    if (metadata.caseId && metadata.requirementKey) {
      await this.stepLocks.assertUnsealed(metadata.caseId, 1);
    }
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
  async findAll(@Request() req: any, @Query('caseId') caseId?: string, @Query('beneficiaryId') beneficiaryId?: string, @Query('requirementKey') requirementKey?: string) {
    if (caseId && requirementKey !== undefined) {
      return this.filingService.findByCaseAndRequirement(caseId, requirementKey || undefined, req.user?.role);
    }
    return this.filingService.findAll(caseId, beneficiaryId, req.user?.role, req.user?.role === 'claimant' ? req.user?.id : undefined);
  }

  @Get('irf/:irfId/photos')
  @Roles('admin')
  @ApiOperation({ summary: 'List IRF evidence photos (admin only)' })
  async irfPhotos(@Param('irfId') irfId: string) {
    return this.filingService.findPhotosByIrf(irfId);
  }

  @Get('announcements/:announcementId/photos')
  @Roles('admin', 'social_worker', 'coordinator')
  @ApiOperation({ summary: 'List announcement photos (manage roles)' })
  async announcementPhotos(@Param('announcementId') announcementId: string) {
    return this.filingService.findPhotosByAnnouncement(announcementId);
  }

  @Get('case/:caseId/id-photo')
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'Get the ID photo for a case (null when none filed)' })
  async getCaseIdPhoto(@Param('caseId') caseId: string) {
    // Returns null (200) rather than 404 when the case has no ID photo: a missing
    // photo is a normal state, and a 404 here logged a network error on every
    // case page load.
    return this.filingService.findIdPhotoByCase(caseId);
  }

  @Patch(':id/verify')
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'Confirm (or clear) on-site verification of a documentary need' })
  async verify(
    @Param('id') id: string,
    @Body(new ZodPipe(VerifyDocumentSchema)) body: VerifyDocumentInput,
    @Request() req: any,
  ) {
    // Verifying a requirement document re-derives that `case_requirements` row,
    // so a sealed step 1 refuses it. A document tied to no requirement changes
    // nothing step 1's seal reads.
    const doc = await this.filingService.findOne(id);
    if (doc.caseId && doc.requirementKey) {
      await this.stepLocks.assertUnsealed(doc.caseId, 1);
    }
    return this.filingService.setVerified(id, body.verified, req.user?.id || req.user?.sub);
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
    // Missing on disk = stale record (uploads volume cleaned/rotated). The row
    // is deleted and, for approval documents, the case's certificate/PCV URL
    // cleared so the UI can re-issue — the client distinguishes this message.
    if (!(await this.filingService.ensureFileOnDisk(doc))) {
      throw new NotFoundException('File not found on disk: the stored document was removed and its record cleaned up. Re-upload or re-issue the document.');
    }
    const filePath = this.filingService.diskPath(doc.fileName);
    const stream = fs.createReadStream(filePath);
    res.set({ 'Content-Type': doc.mimeType || 'application/octet-stream', 'Content-Disposition': `attachment; filename="${doc.originalName}"` });
    return new StreamableFile(stream);
  }

  @Delete(':id')
  @Roles('admin', 'social_worker', 'coordinator')
  @ApiOperation({ summary: 'Delete document' })
  async delete(@Param('id') id: string, @Request() req: any) {
    const doc = await this.filingService.findOne(id);
    // Access first, so an unauthorized caller cannot probe the seal state; then
    // the seal, because deleting a verified requirement document re-derives its
    // `case_requirements` row.
    if (!this.filingService.isPhotoAccessAllowed(req.user?.role, doc.category, 'delete')) {
      throw new ForbiddenException('You are not allowed to remove this document');
    }
    if (doc.caseId && doc.requirementKey) {
      await this.stepLocks.assertUnsealed(doc.caseId, 1);
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
