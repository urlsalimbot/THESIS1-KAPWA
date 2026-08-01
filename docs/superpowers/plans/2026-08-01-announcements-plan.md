# Public Announcements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public announcements/news section on the KAPWA landing page, managed by MSWDO workers with a draft→publish workflow, rich text editor, and pinning.

**Architecture:** New NestJS `announcements` module (entity + service + two controllers: public read, admin CRUD) with sanitized HTML storage. New client pages: landing card section, public article detail page, management list + edit pages with TipTap editor. Routes follow existing public-layout / protected-layout patterns.

**Tech Stack:** NestJS + TypeORM (server), React + SWR + TipTap + shadcn/ui (client), PostgreSQL, Vitest, Jest.

## Global Constraints

- `sanitize-html` added as server dependency; `@tiptap/react` + `@tiptap/starter-kit` as client dependencies.
- Public endpoints use no JWT guard; admin endpoints use `@UseGuards(JwtAuthGuard, RolesGuard)` with `@Roles('admin','social_worker','coordinator')`.
- No AbacGuard on announcements (org-wide, not barangay-scoped).
- All file paths relative to workspace root `/home/typwtypw/Documents/NC/THESIS1-KAPWA`.
- Follow existing patterns: `BaseEntity` for ID, `@InjectRepository` for service, `@UseGuards` per-class on controllers, `MigrationInterface` for migrations, SWR `api.get` for client fetches.
- Test commands: server `jest --coverage`, client `vitest`.

---

### Task 1: Database migration

**Files:**
- Create: `kapwa-server/src/database/migrations/20260801000000-CreateAnnouncements.ts`

**Produces:** Running `announcements` table in PostgreSQL with all columns.

- [ ] **Step 1: Write the migration file**

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAnnouncements20260801000000 implements MigrationInterface {
  name = 'CreateAnnouncements20260801000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS announcements (
        id UUID PRIMARY KEY,
        title TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        excerpt TEXT NOT NULL DEFAULT '',
        body_html TEXT NOT NULL DEFAULT '',
        body_text TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
        pinned BOOLEAN NOT NULL DEFAULT false,
        published_at TIMESTAMPTZ,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_announcements_status ON announcements(status)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_announcements_slug ON announcements(slug)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_announcements_pinned_published ON announcements(pinned, published_at)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS announcements`);
  }
}
```

- [ ] **Step 2: Start the server to verify migration runs**

Run: `cd kapwa-server && npm run start:dev`
Expected: Server starts without migration errors. Check logs for migration success.

- [ ] **Step 3: Verify table exists in the database**

Run: `docker exec kapwa-db-dev psql -U kapwa -d kapwa -c "\d announcements"`
Expected: Table schema output matches the CREATE TABLE statement.

- [ ] **Step 4: Stop the dev server**

- [ ] **Step 5: Commit**

```bash
git add kapwa-server/src/database/migrations/20260801000000-CreateAnnouncements.ts
git commit -m "feat(announcements): add database migration for announcements table"
```

---

### Task 2: Announcement entity

**Files:**
- Create: `kapwa-server/src/announcements/announcement.entity.ts`

**Produces:** TypeORM entity `Announcement` extending `BaseEntity`.

- [ ] **Step 1: Write the entity file**

```typescript
import { Entity, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';

@Entity({ name: 'announcements' })
export class Announcement extends BaseEntity {
  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'text', unique: true })
  slug!: string;

  @Column({ type: 'text', default: '' })
  excerpt!: string;

  @Column({ name: 'body_html', type: 'text', default: '' })
  bodyHtml!: string;

  @Column({ name: 'body_text', type: 'text', default: '' })
  bodyText!: string;

  @Column({ type: 'text', default: 'draft' })
  status!: 'draft' | 'published';

  @Column({ type: 'boolean', default: false })
  pinned!: boolean;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd kapwa-server && npx tsc --noEmit`
Expected: No compilation errors.

- [ ] **Step 3: Commit**

```bash
git add kapwa-server/src/announcements/announcement.entity.ts
git commit -m "feat(announcements): add Announcement entity"
```

---

### Task 3: Announcements service — basic CRUD

**Files:**
- Create: `kapwa-server/src/announcements/announcements.service.ts`

**Produces:**
- `create(dto: CreateDto): Promise<Announcement>`
- `findAll(opts?: { status?: string; limit?: number }): Promise<Announcement[]>`
- `findOne(id: string): Promise<Announcement | null>`
- `findBySlug(slug: string): Promise<Announcement | null>`
- `update(id: string, dto: UpdateDto): Promise<Announcement>`
- `delete(id: string): Promise<void>`
- `publish(id: string): Promise<Announcement>`
- `unpublish(id: string): Promise<Announcement>`
- `togglePin(id: string): Promise<Announcement>`

- [ ] **Step 1: Install sanitize-html dependency**

Run: `cd kapwa-server && npm install sanitize-html && npm install -D @types/sanitize-html`
Expected: Install succeeds.

- [ ] **Step 2: Write the service file**

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as sanitizeHtml from 'sanitize-html';
import { Announcement } from './announcement.entity';

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

  async findAll(opts?: { status?: string; limit?: number }): Promise<Announcement[]> {
    const qb = this.repo.createQueryBuilder('a').orderBy('a.pinned', 'DESC');
    if (opts?.status) {
      qb.andWhere('a.status = :status', { status: opts.status });
    }
    qb.addOrderBy('a.createdAt', 'DESC');
    if (opts?.limit) {
      qb.limit(opts.limit);
    }
    return qb.getMany();
  }

  async findPublished(limit?: number): Promise<Announcement[]> {
    return this.repo.find({
      where: { status: 'published' },
      order: { pinned: 'DESC', publishedAt: 'DESC' },
      take: limit,
    });
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
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd kapwa-server && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add kapwa-server/src/announcements/announcements.service.ts kapwa-server/package.json kapwa-server/package-lock.json
git commit -m "feat(announcements): add announcements service with CRUD, slug, sanitize, publish/pin"
```

---

### Task 4: Announcements service — unit tests

**Files:**
- Create: `kapwa-server/src/announcements/announcements.service.spec.ts`

**Produces:** Jest tests covering create, findAll, findOne, findBySlug, update, publish, unpublish, togglePin, delete, slug uniqueness, sanitize.

- [ ] **Step 1: Write the test file**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnnouncementsService } from './announcements.service';
import { Announcement } from './announcement.entity';

type MockRepo = Partial<Record<keyof Repository<Announcement>, jest.Mock>>;

function createAnnouncement(overrides: Partial<Announcement> = {}): Announcement {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    title: 'Test Title',
    slug: 'test-title',
    excerpt: 'An excerpt.',
    bodyHtml: '<p>Hello <strong>world</strong></p>',
    bodyText: 'Hello world',
    status: 'draft',
    pinned: false,
    publishedAt: null,
    createdBy: null,
    createdAt: new Date('2026-08-01T00:00:00Z'),
    updatedAt: new Date('2026-08-01T00:00:00Z'),
    ...overrides,
  };
}

describe('AnnouncementsService', () => {
  let service: AnnouncementsService;
  let repo: MockRepo;

  beforeEach(async () => {
    repo = {
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnnouncementsService,
        { provide: getRepositoryToken(Announcement), useValue: repo },
      ],
    }).compile();

    service = module.get(AnnouncementsService);
  });

  describe('create', () => {
    it('creates a draft announcement by default', async () => {
      const mockSave = jest.fn().mockResolvedValue(createAnnouncement({ status: 'draft' }));
      repo.create.mockReturnValue({ status: 'draft' });
      repo.save = mockSave;
      repo.findOne.mockResolvedValue(null);

      await service.create({ title: 'Hello World', bodyHtml: '<p>test</p>' });

      expect(mockSave).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Hello World', status: 'draft' }),
      );
    });

    it('sanitizes body_html stripping scripts', async () => {
      const mockSave = jest.fn().mockResolvedValue(createAnnouncement());
      repo.create.mockReturnValue({});
      repo.save = mockSave;
      repo.findOne.mockResolvedValue(null);

      await service.create({ title: 'XSS Test', bodyHtml: '<p>ok</p><script>alert(1)</script>' });

      const saved = mockSave.mock.calls[0][0];
      expect(saved.bodyHtml).toContain('<p>ok</p>');
      expect(saved.bodyHtml).not.toContain('<script>');
    });

    it('generates a unique slug from title', async () => {
      const mockSave = jest.fn().mockResolvedValue(createAnnouncement());
      repo.create.mockReturnValue({});
      repo.save = mockSave;
      repo.findOne.mockResolvedValue(null);

      await service.create({ title: 'Hello World!', bodyHtml: '<p>test</p>' });

      const saved = mockSave.mock.calls[0][0];
      expect(saved.slug).toBe('hello-world');
    });

    it('deduplicates slug when title already taken', async () => {
      const mockSave = jest.fn().mockResolvedValue(createAnnouncement());
      repo.create.mockReturnValue({});
      repo.save = mockSave;
      repo.findOne
        .mockResolvedValueOnce(createAnnouncement({ slug: 'hello-world' }))
        .mockResolvedValueOnce(null);

      await service.create({ title: 'Hello World', bodyHtml: '<p>test</p>' });

      const saved = mockSave.mock.calls[0][0];
      expect(saved.slug).toBe('hello-world-2');
    });

    it('sets publishedAt when creating as published', async () => {
      const mockSave = jest.fn().mockResolvedValue(createAnnouncement({ status: 'published' }));
      repo.create.mockReturnValue({});
      repo.save = mockSave;
      repo.findOne.mockResolvedValue(null);

      await service.create({ title: 'Published', bodyHtml: '<p>test</p>', status: 'published' });

      const saved = mockSave.mock.calls[0][0];
      expect(saved.status).toBe('published');
      expect(saved.publishedAt).toBeInstanceOf(Date);
    });
  });

  describe('findPublished', () => {
    it('returns published announcements ordered by pinned then publishedAt DESC', async () => {
      const mockFind = jest.fn().mockResolvedValue([createAnnouncement()]);
      repo.find = mockFind;

      const result = await service.findPublished(10);

      expect(mockFind).toHaveBeenCalledWith({
        where: { status: 'published' },
        order: { pinned: 'DESC', publishedAt: 'DESC' },
        take: 10,
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('findBySlug', () => {
    it('returns published announcement by slug', async () => {
      const announcement = createAnnouncement({ slug: 'my-post', status: 'published' });
      repo.findOne.mockResolvedValue(announcement);

      const result = await service.findBySlug('my-post');

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { slug: 'my-post', status: 'published' },
      });
      expect(result).toEqual(announcement);
    });

    it('returns null for an unpublished slug', async () => {
      repo.findOne.mockResolvedValue(null);

      const result = await service.findBySlug('draft-post');

      expect(result).toBeNull();
    });
  });

  describe('publish', () => {
    it('sets status to published and sets publishedAt', async () => {
      const draft = createAnnouncement({ status: 'draft' });
      repo.findOne.mockResolvedValue(draft);
      const mockSave = jest.fn().mockResolvedValue({ ...draft, status: 'published' });
      repo.save = mockSave;

      await service.publish(draft.id);

      const saved = mockSave.mock.calls[0][0];
      expect(saved.status).toBe('published');
      expect(saved.publishedAt).toBeInstanceOf(Date);
    });
  });

  describe('unpublish', () => {
    it('sets status to draft and clears publishedAt', async () => {
      const published = createAnnouncement({ status: 'published', publishedAt: new Date() });
      repo.findOne.mockResolvedValue(published);
      const mockSave = jest.fn().mockResolvedValue({ ...published, status: 'draft' });
      repo.save = mockSave;

      await service.unpublish(published.id);

      const saved = mockSave.mock.calls[0][0];
      expect(saved.status).toBe('draft');
      expect(saved.publishedAt).toBeNull();
    });
  });

  describe('togglePin', () => {
    it('flips pinned from false to true', async () => {
      const item = createAnnouncement({ pinned: false });
      repo.findOne.mockResolvedValue(item);
      const mockSave = jest.fn().mockResolvedValue({ ...item, pinned: true });
      repo.save = mockSave;

      const result = await service.togglePin(item.id);

      expect(result.pinned).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail (service not yet wired)**

Run: `cd kapwa-server && npx jest --testPathPattern="announcements.service"`
Expected: Some tests pass (mock-based), but verify the test file loads and runs.

- [ ] **Step 3: Commit**

```bash
git add kapwa-server/src/announcements/announcements.service.spec.ts
git commit -m "test(announcements): add unit tests for announcements service"
```

---

### Task 5: Announcements public controller

**Files:**
- Create: `kapwa-server/src/announcements/announcements-public.controller.ts`

**Produces:** `GET /api/v1/announcements/public` and `GET /api/v1/announcements/public/:slug`

- [ ] **Step 1: Write the public controller**

```typescript
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd kapwa-server && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add kapwa-server/src/announcements/announcements-public.controller.ts
git commit -m "feat(announcements): add public announcements controller"
```

---

### Task 6: Announcements admin controller

**Files:**
- Create: `kapwa-server/src/announcements/announcements.controller.ts`

**Produces:** Admin CRUD endpoints with JWT + role guards.

- [ ] **Step 1: Write the admin controller**

```typescript
import {
  Controller, Get, Post, Patch, Delete, Param, Body, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AnnouncementsService } from './announcements.service';

interface CreateAnnouncementDto {
  title: string;
  excerpt?: string;
  bodyHtml: string;
  status?: 'draft' | 'published';
}

interface UpdateAnnouncementDto {
  title?: string;
  excerpt?: string;
  bodyHtml?: string;
  status?: 'draft' | 'published';
}

@ApiTags('Announcements')
@Controller('announcements')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AnnouncementsController {
  constructor(private readonly svc: AnnouncementsService) {}

  @Get()
  @Roles('admin', 'social_worker', 'coordinator')
  @ApiOperation({ summary: 'List all announcements (admin)' })
  async findAll() {
    return this.svc.findAll();
  }

  @Get(':id')
  @Roles('admin', 'social_worker', 'coordinator')
  @ApiOperation({ summary: 'Get announcement by ID (admin)' })
  async findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Post()
  @Roles('admin', 'social_worker', 'coordinator')
  @ApiOperation({ summary: 'Create announcement' })
  async create(@Body() dto: CreateAnnouncementDto) {
    return this.svc.create(dto);
  }

  @Patch(':id')
  @Roles('admin', 'social_worker', 'coordinator')
  @ApiOperation({ summary: 'Update announcement fields' })
  async update(@Param('id') id: string, @Body() dto: UpdateAnnouncementDto) {
    return this.svc.update(id, dto);
  }

  @Patch(':id/pin')
  @Roles('admin', 'social_worker', 'coordinator')
  @ApiOperation({ summary: 'Toggle pinned status' })
  async togglePin(@Param('id') id: string) {
    return this.svc.togglePin(id);
  }

  @Delete(':id')
  @Roles('admin', 'social_worker', 'coordinator')
  @ApiOperation({ summary: 'Delete announcement' })
  async remove(@Param('id') id: string) {
    await this.svc.delete(id);
    return { success: true };
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd kapwa-server && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add kapwa-server/src/announcements/announcements.controller.ts
git commit -m "feat(announcements): add admin announcements controller"
```

---

### Task 7: Announcements module + AppModule registration

**Files:**
- Create: `kapwa-server/src/announcements/announcements.module.ts`
- Modify: `kapwa-server/src/app.module.ts`

- [ ] **Step 1: Write the module file**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Announcement } from './announcement.entity';
import { AnnouncementsService } from './announcements.service';
import { AnnouncementsController } from './announcements.controller';
import { AnnouncementsPublicController } from './announcements-public.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Announcement]), AuthModule],
  controllers: [AnnouncementsPublicController, AnnouncementsController],
  providers: [AnnouncementsService],
  exports: [AnnouncementsService],
})
export class AnnouncementsModule {}
```

- [ ] **Step 2: Register module in AppModule**

In `kapwa-server/src/app.module.ts`:

Add import after the existing imports (after `ReferralsModule`):

```typescript
import { AnnouncementsModule } from './announcements/announcements.module';
```

Add to `imports` array after `ReferralsModule`:

```typescript
AnnouncementsModule,
```

The relevant section of app.module.ts should read:

```typescript
    IntakeModule,
    ReferralsModule,
    AnnouncementsModule,
  ],
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd kapwa-server && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Start server and test public endpoint**

Start the server, then:

```bash
curl -s http://localhost:3000/api/v1/announcements/public | head
```

Expected: `[]` (empty array, no announcements yet).

- [ ] **Step 5: Test admin endpoint (requires auth — expect 401)**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/v1/announcements
```

Expected: `401`

- [ ] **Step 6: Commit**

```bash
git add kapwa-server/src/announcements/announcements.module.ts kapwa-server/src/app.module.ts
git commit -m "feat(announcements): register module in AppModule"
```

---

### Task 8: Client — query keys + nav

**Files:**
- Modify: `kapwa-client/src/lib/query-keys.ts`
- Modify: `kapwa-client/src/lib/nav-config.tsx`

- [ ] **Step 1: Add announcements query keys**

In `kapwa-client/src/lib/query-keys.ts`, add after the `tracker:` block (before the closing `} as const`):

```typescript
  announcements: {
    all: ['announcements'] as const,
    list: () => memo('announcements.list', () => ['announcements'] as const),
    public: {
      list: () => memo('announcements.public.list', () => ['announcements', 'public'] as const),
      detail: (slug: string) =>
        memo(`announcements.public.${slug}`, () => ['announcements', 'public', slug] as const),
    },
  },
```

- [ ] **Step 2: Add Announcements to sidebar nav**

In `kapwa-client/src/lib/nav-config.tsx`, add to imports (add `Megaphone` to existing lucide imports):

Change the import line to include `Megaphone`:

```tsx
import {
  FilePlus, LayoutDashboard, Users, CheckCircle,
  ClipboardList, Shield, UserCircle, Stamp, Settings, MessageSquare,
  FileWarning, IdCard, ScrollText, BarChart3, History, Send, BadgeCheck,
  Megaphone,
} from 'lucide-react';
```

Add to the Operations nav group items array (after `Approvals`):

```tsx
{ path: '/announcements/manage', label: 'Announcements', icon: <Megaphone size={20} />, roles: ['admin', 'social_worker', 'coordinator'] },
```

The Operations group should now look like:

```tsx
    label: 'Operations',
    items: [
      { path: '/tracker', label: 'Daily Tracker', icon: <ClipboardList size={20} />, roles: ['admin', 'social_worker'] },
      { path: '/irf', label: 'Incident Reports', icon: <FileWarning size={20} />, roles: ['admin', 'social_worker'] },
      { path: '/approvals', label: 'Approvals', icon: <Stamp size={20} />, roles: ['admin', 'social_worker'] },
      { path: '/announcements/manage', label: 'Announcements', icon: <Megaphone size={20} />, roles: ['admin', 'social_worker', 'coordinator'] },
    ],
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd kapwa-client && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add kapwa-client/src/lib/query-keys.ts kapwa-client/src/lib/nav-config.tsx
git commit -m "feat(announcements): add client query keys and sidebar nav"
```

---

### Task 9: Client — RichTextEditor component

**Files:**
- Create: `kapwa-client/src/components/announcements/RichTextEditor.tsx`

- [ ] **Step 1: Install TipTap dependencies**

Run: `cd kapwa-client && npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-link`
Expected: Install succeeds.

- [ ] **Step 2: Write the RichTextEditor component**

```tsx
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import LinkExtension from '@tiptap/extension-link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Bold, Italic, List, ListOrdered, Heading2, Heading3, Link as LinkIcon,
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  className?: string;
}

const ToolbarButton = ({
  active, onClick, children, title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title: string;
}) => (
  <Button
    type="button"
    variant={active ? 'secondary' : 'ghost'}
    size="sm"
    onClick={onClick}
    title={title}
    className="h-8 w-8 p-0"
  >
    {children}
  </Button>
);

export function RichTextEditor({ value, onChange, className }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      LinkExtension.configure({
        openOnClick: false,
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[200px] px-3 py-2',
      },
    },
  });

  if (!editor) return null;

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div className={cn('border rounded-md', className)}>
      <div className="flex items-center gap-1 border-b px-2 py-1 bg-muted/30">
        <ToolbarButton
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
        >
          <Bold size={16} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <Italic size={16} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="Heading 2"
        >
          <Heading2 size={16} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('heading', { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          title="Heading 3"
        >
          <Heading3 size={16} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet list"
        >
          <List size={16} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Numbered list"
        >
          <ListOrdered size={16} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('link')}
          onClick={setLink}
          title="Link"
        >
          <LinkIcon size={16} />
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd kapwa-client && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add kapwa-client/src/components/announcements/RichTextEditor.tsx kapwa-client/package.json kapwa-client/package-lock.json
git commit -m "feat(announcements): add RichTextEditor component with TipTap"
```

---

### Task 10: Client — AnnouncementsPage (management list)

**Files:**
- Create: `kapwa-client/src/components/announcements/AnnouncementsPage.tsx`

- [ ] **Step 1: Write the AnnouncementsPage**

```tsx
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Pin, PinOff, Eye } from 'lucide-react';

interface Announcement {
  id: string;
  title: string;
  slug: string;
  status: 'draft' | 'published';
  pinned: boolean;
  publishedAt: string | null;
  updatedAt: string;
}

export function AnnouncementsPage() {
  const navigate = useNavigate();
  const { data, mutate, isLoading, error } = useSWR(
    queryKeys.announcements.list(),
    (key) => api.get<Announcement[]>(key),
  );

  const announcements = data || [];

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Delete "${title}"?`)) return;
    await api.del(['announcements', id]);
    toast.success('Deleted');
    mutate();
  };

  const handlePublishToggle = async (a: Announcement) => {
    if (a.status === 'published') {
      await api.patch(['announcements', a.id], { status: 'draft' });
      toast.success('Unpublished');
    } else {
      await api.patch(['announcements', a.id], { status: 'published' });
      toast.success('Published');
    }
    mutate();
  };

  const handlePinToggle = async (a: Announcement) => {
    await api.patch(['announcements', a.id, 'pin']);
    toast.success(a.pinned ? 'Unpinned' : 'Pinned');
    mutate();
  };

  if (error) return <p className="p-4 text-destructive">Failed to load announcements.</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Announcements</h1>
        <Button onClick={() => navigate('/announcements/manage/new')}>
          <Plus size={16} className="mr-1" />
          New Announcement
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : announcements.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <p>No announcements yet.</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate('/announcements/manage/new')}>
              <Plus size={16} className="mr-1" /> Create your first announcement
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {announcements.map((a) => (
            <Card key={a.id} className={a.status === 'draft' ? 'opacity-70' : ''}>
              <div className="flex items-start justify-between p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate">{a.title}</h3>
                    {a.pinned && <Pin size={14} className="text-primary shrink-0" />}
                    <Badge variant={a.status === 'published' ? 'default' : 'secondary'}>
                      {a.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {a.publishedAt
                      ? `Published ${new Date(a.publishedAt).toLocaleDateString()}`
                      : `Updated ${new Date(a.updatedAt).toLocaleDateString()}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 ml-4 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => navigate(`/announcements/manage/${a.id}`)}>
                    <Pencil size={16} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handlePublishToggle(a)}
                    title={a.status === 'published' ? 'Unpublish' : 'Publish'}
                  >
                    <Eye size={16} />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handlePinToggle(a)}>
                    {a.pinned ? <PinOff size={16} /> : <Pin size={16} />}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(a.id, a.title)}>
                    <Trash2 size={16} className="text-destructive" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd kapwa-client && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add kapwa-client/src/components/announcements/AnnouncementsPage.tsx
git commit -m "feat(announcements): add AnnouncementsPage management list"
```

---

### Task 11: Client — AnnouncementEditPage (management form)

**Files:**
- Create: `kapwa-client/src/components/announcements/AnnouncementEditPage.tsx`

- [ ] **Step 1: Write the AnnouncementEditPage**

```tsx
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { RichTextEditor } from './RichTextEditor';

interface AnnouncementDetail {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  bodyHtml: string;
  status: 'draft' | 'published';
  pinned: boolean;
  publishedAt: string | null;
}

export function AnnouncementEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';

  const { data, isLoading } = useSWR(
    !isNew ? ['announcements', id] : null,
    (key) => api.get<AnnouncementDetail>(key),
  );

  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) {
      setTitle(data.title);
      setExcerpt(data.excerpt || '');
      setBodyHtml(data.bodyHtml || '');
    }
  }, [data]);

  const save = async (status: 'draft' | 'published') => {
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        await api.post(['announcements'], { title, excerpt, bodyHtml, status });
        toast.success(status === 'published' ? 'Published!' : 'Saved as draft');
      } else {
        await api.patch(['announcements', id!], { title, excerpt, bodyHtml, status });
        toast.success('Updated');
      }
      navigate('/announcements/manage');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate('/announcements/manage')}>
          <ArrowLeft size={16} />
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">
          {isNew ? 'New Announcement' : 'Edit Announcement'}
        </h1>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Announcement title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="excerpt">Excerpt (optional)</Label>
            <Textarea
              id="excerpt"
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="Short summary shown on cards"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Body</Label>
            <RichTextEditor value={bodyHtml} onChange={setBodyHtml} />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <Button
          onClick={() => save('draft')}
          disabled={saving}
          variant="outline"
        >
          {saving && <Loader2 size={16} className="animate-spin mr-1" />}
          Save as Draft
        </Button>
        <Button
          onClick={() => save('published')}
          disabled={saving}
        >
          {saving && <Loader2 size={16} className="animate-spin mr-1" />}
          Save & Publish
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd kapwa-client && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add kapwa-client/src/components/announcements/AnnouncementEditPage.tsx
git commit -m "feat(announcements): add AnnouncementEditPage with TipTap editor"
```

---

### Task 12: Client — LatestAnnouncements (landing card section)

**Files:**
- Create: `kapwa-client/src/components/announcements/LatestAnnouncements.tsx`

- [ ] **Step 1: Write LatestAnnouncements component**

```tsx
import { Link } from 'react-router-dom';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { Card, CardContent } from '@/components/ui/card';
import { Pin } from 'lucide-react';

interface PublicAnnouncement {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  pinned: boolean;
  publishedAt: string | null;
}

export function LatestAnnouncements() {
  const { data, isLoading } = useSWR(
    queryKeys.announcements.public.list(),
    (key) => api.get<PublicAnnouncement[]>(key),
  );

  const announcements = data || [];

  if (isLoading) return null;
  if (announcements.length === 0) return null;

  return (
    <section className="py-16 px-4 max-w-6xl mx-auto">
      <h2 className="text-3xl font-bold text-center mb-8">Latest News & Announcements</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {announcements.slice(0, 4).map((a) => (
          <Link to={`/announcements/${a.slug}`} key={a.id}>
            <Card className="h-full hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-2">
                  {a.pinned && <Pin size={14} className="text-primary shrink-0 mt-1" />}
                  <div>
                    <h3 className="font-semibold text-sm leading-snug line-clamp-2">
                      {a.title}
                    </h3>
                    {a.excerpt && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {a.excerpt}
                      </p>
                    )}
                    {a.publishedAt && (
                      <p className="text-[10px] text-muted-foreground mt-2">
                        {new Date(a.publishedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd kapwa-client && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add kapwa-client/src/components/announcements/LatestAnnouncements.tsx
git commit -m "feat(announcements): add LatestAnnouncements landing section"
```

---

### Task 13: Client — AnnouncementPage (public detail)

**Files:**
- Create: `kapwa-client/src/pages/AnnouncementPage.tsx`

- [ ] **Step 1: Write AnnouncementPage**

```tsx
import { useParams, Link } from 'react-router-dom';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { Pin, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AnnouncementDetail {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  bodyHtml: string;
  pinned: boolean;
  publishedAt: string | null;
}

export function AnnouncementPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading, error } = useSWR(
    slug ? queryKeys.announcements.public.detail(slug) : null,
    (key) => api.get<AnnouncementDetail>(key),
  );

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto py-16 px-4">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-3xl mx-auto py-16 px-4 text-center">
        <h1 className="text-2xl font-bold">Article not found</h1>
        <p className="text-muted-foreground mt-2">This announcement may have been removed or is no longer published.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/">Back to home</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft size={16} />
        Back to home
      </Link>

      <article>
        <div className="flex items-center gap-2 mb-2">
          {data.pinned && <Pin size={16} className="text-primary" />}
          {data.publishedAt && (
            <time className="text-sm text-muted-foreground">
              {new Date(data.publishedAt).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </time>
          )}
        </div>

        <h1 className="text-3xl font-bold tracking-tight mb-6">{data.title}</h1>

        <div
          className="prose prose-slate max-w-none"
          dangerouslySetInnerHTML={{ __html: data.bodyHtml }}
        />
      </article>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd kapwa-client && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add kapwa-client/src/pages/AnnouncementPage.tsx
git commit -m "feat(announcements): add public AnnouncementPage detail view"
```

---

### Task 14: Client — update LandingPage

**Files:**
- Modify: `kapwa-client/src/pages/LandingPage.tsx`

**Produces:** LandingPage shows LatestAnnouncements section after hero, before Services.

- [ ] **Step 1: Find the hero section end in LandingPage**

Check where the Hero section ends and the next section (Services) begins. The section IDs are visible in the file: look for the `id="services"` section boundary.

- [ ] **Step 2: Add the import**

Add at the top of `kapwa-client/src/pages/LandingPage.tsx`:

```tsx
import { LatestAnnouncements } from '@/components/announcements/LatestAnnouncements';
```

- [ ] **Step 3: Insert LatestAnnouncements after the hero section**

After the closing `</section>` of the Hero section and before the Services section opening tag, insert:

```tsx
      <LatestAnnouncements />
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd kapwa-client && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add kapwa-client/src/pages/LandingPage.tsx
git commit -m "feat(announcements): add LatestAnnouncements to LandingPage"
```

---

### Task 15: Client — update routes.tsx

**Files:**
- Modify: `kapwa-client/src/routes.tsx`

**Produces:** Public `/announcements/:slug` route and protected `/announcements/manage` + `/announcements/manage/new` + `/announcements/manage/:id` routes.

- [ ] **Step 1: Add the import for AnnouncementPage**

In `kapwa-client/src/routes.tsx`, add after the existing page imports:

```typescript
import { AnnouncementPage } from './pages/AnnouncementPage';
```

Note: The management pages (`AnnouncementsPage`, `AnnouncementEditPage`) are imported inline in the JSX element since they're small. But to follow the project pattern, add imports:

```typescript
import { AnnouncementsPage } from './components/announcements/AnnouncementsPage';
import { AnnouncementEditPage } from './components/announcements/AnnouncementEditPage';
```

- [ ] **Step 2: Add public route in PublicLayout children**

Inside the `PublicLayout` children block (around line 73), add after the `contact` route:

```typescript
{ path: 'announcements/:slug', element: <AnnouncementPage /> },
```

The PublicLayout children block should look like:

```typescript
  {
    element: <PublicLayout />,
    children: [
      { index: true, element: <LandingPageRedirect /> },
      { path: 'about', element: <AboutPage /> },
      { path: 'contact', element: <ContactPage /> },
      { path: 'announcements/:slug', element: <AnnouncementPage /> },
    ],
  },
```

- [ ] **Step 3: Add protected routes**

Add after the existing protected routes in the array:

```typescript
{ path: '/announcements/manage', element: <Private roles={['admin','social_worker','coordinator']}><AnnouncementsPage /></Private> },
{ path: '/announcements/manage/new', element: <Private roles={['admin','social_worker','coordinator']}><AnnouncementEditPage /></Private> },
{ path: '/announcements/manage/:id', element: <Private roles={['admin','social_worker','coordinator']}><AnnouncementEditPage /></Private> },
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd kapwa-client && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Verify the dev server starts**

Run: `cd kapwa-client && npm run dev`
Expected: Check the landing page loads, verify no JS console errors. Navigate to `/announcements/manage` (should work if logged in as admin/social_worker/coordinator).

- [ ] **Step 6: Commit**

```bash
git add kapwa-client/src/routes.tsx
git commit -m "feat(announcements): add announcements routes to client"
```

---

### Task 16: End-to-end verification

**Files:** None (verification only)

- [ ] **Step 1: Start both servers**

```bash
# Terminal 1: server
cd kapwa-server && npm run start:dev

# Terminal 2: client
cd kapwa-client && npm run dev
```

- [ ] **Step 2: Verify public endpoint returns empty list**

```bash
curl -s http://localhost:3000/api/v1/announcements/public
```

Expected: `[]`

- [ ] **Step 3: Log in as admin, create an announcement via API**

First get a token (adjust credentials):

```bash
TOKEN=$(curl -s http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@kapwa.gov.ph","password":"..."}' | jq -r '.accessToken')
```

Then create:

```bash
curl -s http://localhost:3000/api/v1/announcements \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Announcement","bodyHtml":"<p>This is a <strong>test</strong> announcement.</p>","status":"published"}'
```

Expected: Returns announcement with status `published`, auto-generated slug, sanitized body.

- [ ] **Step 4: Verify public endpoint returns the announcement**

```bash
curl -s http://localhost:3000/api/v1/announcements/public
```

Expected: Returns array with the created announcement.

- [ ] **Step 5: Verify landing page shows the announcement**

Open the client in browser (public, logged out). The landing page should show a "Latest News & Announcements" section with the card.

- [ ] **Step 6: Verify the public detail page**

Click the card or navigate to `/announcements/<slug>`. Should render the full article.

- [ ] **Step 7: Verify management UI**

Log in as admin. Navigate to `/announcements/manage`. Should list the announcement. Edit it, toggle publish/unpublish, toggle pin, delete.

- [ ] **Step 8: Verify draft is NOT visible to public**

Create a new announcement, leave as draft. Verify it does NOT appear on the public list or landing page. Verify the public detail page returns 404 for its slug.

- [ ] **Step 9: Run all tests**

```bash
cd kapwa-server && npm test
cd kapwa-client && npm test
```

Expected: All tests pass.

- [ ] **Step 10: Commit (if any changes from verification fixes)**

```bash
git add -A
git commit -m "chore(announcements): verification fixes"
```
