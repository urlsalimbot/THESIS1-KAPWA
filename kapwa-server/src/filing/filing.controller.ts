import { MAX_FILE_SIZE } from './constants';
import { Controller, Get, Post, Delete, Param, Query, UseGuards, UploadedFile, Body, Request, UseInterceptors, StreamableFile, Res, NotFoundException } from '@nestjs/common';
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
  @Roles('admin', 'social_worker')
  @ApiOperation({ summary: 'Upload a document' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE } }))
  async upload(
    @UploadedFile() file: any,
    @Body(new ZodPipe(UploadMetadataSchema)) metadata: { caseId?: string; beneficiaryId?: string; category?: string; notes?: string },
    @Request() req: any,
  ) {
    return this.filingService.upload(file, {
      ...metadata,
      uploadedBy: req.user?.id || req.user?.sub,
    });
  }

  @Get()
  @Roles('admin', 'social_worker', 'coordinator')
  @ApiOperation({ summary: 'List documents' })
  async findAll(@Query('caseId') caseId?: string, @Query('beneficiaryId') beneficiaryId?: string) {
    return this.filingService.findAll(caseId, beneficiaryId);
  }

  @Get(':id')
  @Roles('admin', 'social_worker', 'coordinator')
  @ApiOperation({ summary: 'Get document metadata' })
  async findOne(@Param('id') id: string) {
    return this.filingService.findOne(id);
  }

  @Get(':id/download')
  @Roles('admin', 'social_worker', 'coordinator')
  @ApiOperation({ summary: 'Download document file' })
  async download(@Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const doc = await this.filingService.findOne(id);
    const filePath = path.resolve(process.cwd(), 'uploads', doc.fileName);
    if (!fs.existsSync(filePath)) throw new NotFoundException('File not found on disk');
    const stream = fs.createReadStream(filePath);
    res.set({ 'Content-Type': doc.mimeType || 'application/octet-stream', 'Content-Disposition': `attachment; filename="${doc.originalName}"` });
    return new StreamableFile(stream);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete document' })
  async delete(@Param('id') id: string) {
    return this.filingService.delete(id);
  }

  @Delete('cleanup')
  @Roles('admin')
  @ApiOperation({ summary: 'Cleanup documents older than N days' })
  async cleanup(@Query('days') days: string) {
    return this.filingService.cleanupOlderThan(Number(days) || 90);
  }
}
