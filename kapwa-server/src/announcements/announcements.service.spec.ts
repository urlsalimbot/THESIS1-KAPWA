import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AnnouncementsService } from './announcements.service';
import { Announcement } from './announcement.entity';

type MockRepo = {
  save: jest.Mock;
  find: jest.Mock;
  findOne: jest.Mock;
  delete: jest.Mock;
  create: jest.Mock;
  createQueryBuilder: jest.Mock;
};

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
  } as Announcement;
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
      repo.create.mockImplementation((data: any) => data);
      repo.save = mockSave;
      repo.findOne.mockResolvedValue(null);

      await service.create({ title: 'Hello World', bodyHtml: '<p>test</p>' });

      expect(mockSave).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Hello World', status: 'draft' }),
      );
    });

    it('sanitizes body_html stripping scripts', async () => {
      const mockSave = jest.fn().mockResolvedValue(createAnnouncement());
      repo.create.mockImplementation((data: any) => data);
      repo.save = mockSave;
      repo.findOne.mockResolvedValue(null);

      await service.create({ title: 'XSS Test', bodyHtml: '<p>ok</p><script>alert(1)</script>' });

      const saved = mockSave.mock.calls[0][0];
      expect(saved.bodyHtml).toContain('<p>ok</p>');
      expect(saved.bodyHtml).not.toContain('<script>');
    });

    it('generates a unique slug from title', async () => {
      const mockSave = jest.fn().mockResolvedValue(createAnnouncement());
      repo.create.mockImplementation((data: any) => data);
      repo.save = mockSave;
      repo.findOne.mockResolvedValue(null);

      await service.create({ title: 'Hello World!', bodyHtml: '<p>test</p>' });

      const saved = mockSave.mock.calls[0][0];
      expect(saved.slug).toBe('hello-world');
    });

    it('deduplicates slug when title already taken', async () => {
      const mockSave = jest.fn().mockResolvedValue(createAnnouncement());
      repo.create.mockImplementation((data: any) => data);
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
      repo.create.mockImplementation((data: any) => data);
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
