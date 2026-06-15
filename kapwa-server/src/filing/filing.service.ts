import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
    const fileName = `${Date.now()}-${file.originalname}`;
    const filePath = path.join(UPLOAD_DIR, fileName);
    fs.writeFileSync(filePath, file.buffer);

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
    const where: any = {};
    if (caseId) where.caseId = caseId;
    if (beneficiaryId) where.beneficiaryId = beneficiaryId;
    return this.docRepo.find({ where, order: { createdAt: 'DESC' } });
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
}
