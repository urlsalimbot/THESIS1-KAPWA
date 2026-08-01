import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AnnouncementsService } from './announcements.service';

@ApiTags('Announcements (Public)')
@Controller('announcements/public')
export class AnnouncementsPublicController {
  constructor(private readonly svc: AnnouncementsService) {}

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
}
