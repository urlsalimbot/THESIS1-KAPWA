import { MAX_FILE_SIZE, DEFAULT_DOC_LIMIT } from './constants';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, LessThan } from 'typeorm';
import { DocumentVault } from './filing.entity';
import * as fs from 'fs';
import * as path from 'path';

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

@Injectable()
export class FilingService {
  constructor(
    @InjectRepository(DocumentVault)
    private docRepo: Repository<DocumentVault>,
  ) {
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  async upload(file: { originalname: string; mimetype: string; size: number; buffer: Buffer }, metadata: { caseId?: string; beneficiaryId?: string; category?: string; notes?: string; uploadedBy?: string }) {
    const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Allowed: PDF, JPEG, PNG, GIF, DOC');
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('File too large. Max 10MB');
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
      category: metadata.category,
      notes: metadata.notes,
      uploadedBy: metadata.uploadedBy,
    });
    return this.docRepo.save(doc);
  }

  async findAll(caseId?: string, beneficiaryId?: string) {
    const where: FindOptionsWhere<DocumentVault> = {};
    if (caseId) where.caseId = caseId;
    if (beneficiaryId) where.beneficiaryId = beneficiaryId;
    return this.docRepo.find({ where, order: { createdAt: 'DESC' }, take: DEFAULT_DOC_LIMIT });
  }

  async findOne(id: string) {
    const doc = await this.docRepo.findOne({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');
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
