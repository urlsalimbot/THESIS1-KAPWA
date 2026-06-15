import { Controller, Get, Post, Delete, Param, Query, UseGuards, UploadedFile, Body, Request, UseInterceptors, StreamableFile, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { FilingService } from './filing.service';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface UploadedFile { fieldname: string; originalname: string; encoding: string; mimetype: string; size: number; buffer: Buffer; }
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

@ApiTags('Filing')
@Controller('filing')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class FilingController {
  constructor(private filingService: FilingService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload a document' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: any,
    @Body() metadata: { caseId?: string; beneficiaryId?: string; category?: string; notes?: string },
    @Request() req: any,
  ) {
    return this.filingService.upload(file, {
      ...metadata,
      uploadedBy: req.user?.id || req.user?.sub,
    });
  }

  @Get()
  @ApiOperation({ summary: 'List documents' })
  async findAll(@Query('caseId') caseId?: string, @Query('beneficiaryId') beneficiaryId?: string) {
    return this.filingService.findAll(caseId, beneficiaryId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get document metadata' })
  async findOne(@Param('id') id: string) {
    return this.filingService.findOne(id);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download document file' })
  async download(@Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const doc = await this.filingService.findOne(id);
    const filePath = path.resolve(process.cwd(), 'uploads', doc.fileName);
    if (!fs.existsSync(filePath)) throw new Error('File not found on disk');
    const stream = fs.createReadStream(filePath);
    res.set({ 'Content-Type': doc.mimeType || 'application/octet-stream', 'Content-Disposition': `attachment; filename="${doc.originalName}"` });
    return new StreamableFile(stream);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete document' })
  async delete(@Param('id') id: string) {
    return this.filingService.delete(id);
  }
}
