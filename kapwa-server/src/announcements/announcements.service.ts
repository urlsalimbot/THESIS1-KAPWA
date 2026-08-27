import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as sanitizeHtml from 'sanitize-html';
import { Announcement } from './announcement.entity';
import { FilingService } from '../filing/filing.service';

export interface AnnouncementWithPhotos {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  bodyHtml: string;
  bodyText: string;
  status: 'draft' | 'published';
  pinned: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  photoCount: number;
  coverPhotoId: string | null;
}

interface CreateDto {
  title: string;
  excerpt?: string;
  bodyHtml: string;
  status?: 'draft' | 'published';
}

interface UpdateDto {
  title?: string;
  excerpt?: string;
  bodyHtml?: string;
  status?: 'draft' | 'published';
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function sanitizeHtmlContent(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 's', 'u']),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ['src', 'alt', 'title'],
      a: ['href', 'target', 'rel'],
    },
  });
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

@Injectable()
export class AnnouncementsService {
  constructor(
    @InjectRepository(Announcement)
    private repo: Repository<Announcement>,
    private readonly filingService: FilingService,
  ) {}

  async create(dto: CreateDto): Promise<Announcement> {
    const sanitizedBody = sanitizeHtmlContent(dto.bodyHtml);
    const bodyText = stripTags(sanitizedBody);
    const slug = await this.generateUniqueSlug(dto.title);
    const now = new Date();
    return this.repo.save(
      this.repo.create({
        title: dto.title,
        slug,
        excerpt: (dto.excerpt || bodyText.slice(0, 200)).replace(/<[^>]*>/g, ''),
        bodyHtml: sanitizedBody,
        bodyText,
        status: dto.status || 'draft',
        publishedAt: dto.status === 'published' ? now : null,
        createdAt: now,
        updatedAt: now,
      }),
    );
  }

  async findAll(opts?: { status?: string; limit?: number }): Promise<AnnouncementWithPhotos[]> {
    const qb = this.repo.createQueryBuilder('a').orderBy('a.pinned', 'DESC');
    if (opts?.status) {
      qb.andWhere('a.status = :status', { status: opts.status });
    }
    qb.addOrderBy('a.createdAt', 'DESC');
    if (opts?.limit) {
      qb.limit(opts.limit);
    }
    return this.withPhotoSummary(await qb.getMany());
  }

  async findPublished(limit?: number): Promise<AnnouncementWithPhotos[]> {
    return this.withPhotoSummary(
      await this.repo.find({
        where: { status: 'published' },
        order: { pinned: 'DESC', publishedAt: 'DESC' },
        take: limit,
      }),
    );
  }

  private async withPhotoSummary(announcements: Announcement[]): Promise<AnnouncementWithPhotos[]> {
    return Promise.all(
      announcements.map(async (a) => {
        const photoRows = await this.filingService.findPhotosByAnnouncement(a.id);
        return {
          ...a,
          photoCount: photoRows.length,
          coverPhotoId: photoRows[0]?.id ?? null,
        };
      }),
    );
  }

  async findOne(id: string): Promise<Announcement | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findBySlug(slug: string): Promise<Announcement | null> {
    return this.repo.findOne({ where: { slug, status: 'published' } });
  }

  async update(id: string, dto: UpdateDto): Promise<Announcement> {
    const announcement = await this.repo.findOne({ where: { id } });
    if (!announcement) throw new Error('Announcement not found');

    if (dto.title !== undefined) {
      announcement.title = dto.title;
      announcement.slug = await this.generateUniqueSlug(dto.title, id);
    }
    if (dto.bodyHtml !== undefined) {
      announcement.bodyHtml = sanitizeHtmlContent(dto.bodyHtml);
      announcement.bodyText = stripTags(announcement.bodyHtml);
    }
    if (dto.excerpt !== undefined) {
      announcement.excerpt = dto.excerpt.replace(/<[^>]*>/g, '');
    }
    if (dto.status !== undefined) {
      if (dto.status === 'published' && !announcement.publishedAt) {
        announcement.publishedAt = new Date();
      }
      if (dto.status === 'draft') {
        announcement.publishedAt = null;
      }
      announcement.status = dto.status;
    }
    return this.repo.save(announcement);
  }

  async publish(id: string): Promise<Announcement> {
    const announcement = await this.repo.findOne({ where: { id } });
    if (!announcement) throw new Error('Announcement not found');
    announcement.status = 'published';
    if (!announcement.publishedAt) {
      announcement.publishedAt = new Date();
    }
    return this.repo.save(announcement);
  }

  async unpublish(id: string): Promise<Announcement> {
    const announcement = await this.repo.findOne({ where: { id } });
    if (!announcement) throw new Error('Announcement not found');
    announcement.status = 'draft';
    announcement.publishedAt = null;
    return this.repo.save(announcement);
  }

  async togglePin(id: string): Promise<Announcement> {
    const announcement = await this.repo.findOne({ where: { id } });
    if (!announcement) throw new Error('Announcement not found');
    announcement.pinned = !announcement.pinned;
    return this.repo.save(announcement);
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  private async generateUniqueSlug(title: string, excludeId?: string): Promise<string> {
    let baseSlug = slugify(title);
    if (!baseSlug) baseSlug = 'announcement';
    let slug = baseSlug;
    let suffix = 2;
    while (true) {
      const existing = await this.repo.findOne({ where: { slug } });
      if (!existing || (excludeId && existing.id === excludeId)) return slug;
      slug = `${baseSlug}-${suffix}`;
      suffix++;
    }
  }
}
