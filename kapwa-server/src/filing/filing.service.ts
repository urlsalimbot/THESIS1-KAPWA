import { MAX_FILE_SIZE, DEFAULT_DOC_LIMIT } from './constants';
import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, LessThan, Not, In } from 'typeorm';
import { DocumentVault } from './filing.entity';
import { Case } from '../cases/case.entity';
import * as fs from 'fs';
import * as path from 'path';

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

@Injectable()
export class FilingService {
  constructor(
    @InjectRepository(DocumentVault)
    private docRepo: Repository<DocumentVault>,
    @InjectRepository(Case)
    private caseRepo: Repository<Case>,
  ) {
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  async upload(file: { originalname: string; mimetype: string; size: number; buffer: Buffer }, metadata: { caseId?: string; beneficiaryId?: string; irfId?: string; announcementId?: string; category?: string; notes?: string; requirementKey?: string; uploadedBy?: string; userId?: string; personId?: string; userRole?: string }) {
    const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Allowed: PDF, JPEG, PNG, GIF, DOC');
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('File too large. Max 10MB');
    }

    if (metadata.userRole === 'claimant' && metadata.caseId) {
      const c = await this.caseRepo.findOne({ where: { id: metadata.caseId }, relations: ['beneficiary'] });
      if (!c) throw new NotFoundException('Case not found');
      if (!metadata.personId || c.beneficiary?.personId !== metadata.personId) {
        throw new ForbiddenException('You can only upload to your own case');
      }
    }

    // Photos are role-restricted per category: IRF evidence photos are uploaded by
    // MSWDO staff only; announcement photos by the announcement manage roles. This
    // prevents e.g. claimants tagging arbitrary public announcements or IRFs.
    const callerRole = metadata.userRole ?? '';
    if (metadata.category === 'irf_photo' && !['admin', 'social_worker'].includes(callerRole)) {
      throw new ForbiddenException('Only MSWDO staff can attach IRF photos');
    }
    if (metadata.category === 'announcement_photo' && !['admin', 'social_worker', 'coordinator'].includes(callerRole)) {
      throw new ForbiddenException('Only announcement managers can attach photos');
    }

    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.\./g, '');
    const fileName = `${Date.now()}-${safeName}`;
    const filePath = path.join(UPLOAD_DIR, fileName);
    await fs.promises.writeFile(filePath, file.buffer);

    const doc = this.docRepo.create({
      fileName,
      originalName: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      caseId: metadata.caseId,
      beneficiaryId: metadata.beneficiaryId,
      irfId: metadata.irfId,
      announcementId: metadata.announcementId,
      category: metadata.category,
      notes: metadata.notes,
      requirementKey: metadata.requirementKey,
      uploadedBy: metadata.uploadedBy,
    });
    return this.docRepo.save(doc);
  }

  async findByCaseAndRequirement(caseId: string, requirementKey?: string) {
    const where: FindOptionsWhere<DocumentVault> = { caseId };
    if (requirementKey) where.requirementKey = requirementKey;
    return this.docRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async findAll(caseId?: string, beneficiaryId?: string, role?: string) {
    const where: FindOptionsWhere<DocumentVault> = {};
    if (caseId) where.caseId = caseId;
    if (beneficiaryId) where.beneficiaryId = beneficiaryId;
    if (!caseId && !beneficiaryId && role !== 'admin') {
      // Unfiltered listing is a general documents query; keep evidence/announcement
      // photo rows out of it for non-admins (they have dedicated endpoints).
      where.category = Not(In(['irf_photo', 'announcement_photo']));
    }
    return this.docRepo.find({ where, order: { createdAt: 'DESC' }, take: DEFAULT_DOC_LIMIT });
  }

  // IRF photos are evidence and only MSWDO admins may view them; announcement
  // photos are managed by the announcement roles; other docs stay admin-delete.
  isPhotoAccessAllowed(role: string | undefined, category?: string | null, action: 'view' | 'delete' = 'view'): boolean {
    if (role === 'admin') return true;
    if (category === 'irf_photo') return false;
    if (category === 'announcement_photo') {
      return ['admin', 'social_worker', 'coordinator'].includes(role ?? '');
    }
    return action === 'delete' ? false : ['admin', 'social_worker', 'coordinator', 'claimant'].includes(role ?? '');
  }

  async findOne(id: string) {
    const doc = await this.docRepo.findOne({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  async findPhotosByIrf(irfId: string) {
    return this.docRepo.find({ where: { category: 'irf_photo', irfId }, order: { createdAt: 'ASC' } });
  }

  async findPhotosByAnnouncement(announcementId: string) {
    return this.docRepo.find({ where: { category: 'announcement_photo', announcementId }, order: { createdAt: 'ASC' } });
  }

  async findOneByCategory(id: string, category: string) {
    const doc = await this.findOne(id);
    if (!doc || doc.category !== category) throw new NotFoundException('File not found');
    return doc;
  }

  async delete(id: string) {
    const doc = await this.findOne(id);
    const filePath = path.join(UPLOAD_DIR, doc.fileName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return this.docRepo.delete(id);
  }

  async cleanupOlderThan(days: number) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const docs = await this.docRepo.find({ where: { createdAt: LessThan(cutoff) } });
    for (const doc of docs) {
      const filePath = path.join(UPLOAD_DIR, doc.fileName);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    const result = await this.docRepo.delete({ createdAt: LessThan(cutoff) });
    return { deleted: result.affected || 0 };
  }
}
