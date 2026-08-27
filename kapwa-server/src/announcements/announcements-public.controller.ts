import { Controller, Get, Param, NotFoundException, Res, StreamableFile } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { AnnouncementsService } from './announcements.service';
import { FilingService } from '../filing/filing.service';

@ApiTags('Announcements (Public)')
@Controller('announcements/public')
export class AnnouncementsPublicController {
  constructor(
    private readonly svc: AnnouncementsService,
    private readonly filingService: FilingService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List published announcements (public)' })
  async list() {
    const announcements = await this.svc.findPublished(20);
    return announcements.map((a) => ({
      id: a.id,
      slug: a.slug,
      title: a.title,
      excerpt: a.excerpt,
      pinned: a.pinned,
      publishedAt: a.publishedAt,
      photoCount: a.photoCount,
      coverPhotoId: a.coverPhotoId,
    }));
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get published announcement by slug (public)' })
  async bySlug(@Param('slug') slug: string) {
    const announcement = await this.svc.findBySlug(slug);
    if (!announcement) throw new NotFoundException('Announcement not found');
    return {
      id: announcement.id,
      slug: announcement.slug,
      title: announcement.title,
      excerpt: announcement.excerpt,
      bodyHtml: announcement.bodyHtml,
      pinned: announcement.pinned,
      publishedAt: announcement.publishedAt,
    };
  }

  @Get(':slug/photos')
  @ApiOperation({ summary: 'List photos for a published announcement (public)' })
  async photos(@Param('slug') slug: string) {
    const announcement = await this.svc.findBySlug(slug);
    if (!announcement) throw new NotFoundException('Announcement not found');
    const rows = await this.filingService.findPhotosByAnnouncement(announcement.id);
    return rows.map((d) => ({ id: d.id, originalName: d.originalName, mimeType: d.mimeType, fileSize: d.fileSize }));
  }

  @Get('photo/:id')
  @ApiOperation({ summary: 'Stream an announcement photo (public, category-gated)' })
  async photo(@Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const doc = await this.filingService.findOneByCategory(id, 'announcement_photo');
    const filePath = path.resolve(process.cwd(), 'uploads', doc.fileName);
    if (!fs.existsSync(filePath)) throw new NotFoundException('File not found on disk');
    const stream = fs.createReadStream(filePath);
    res.set({ 'Content-Type': doc.mimeType || 'application/octet-stream', 'Cache-Control': 'public, max-age=86400' });
    return new StreamableFile(stream);
  }
}
