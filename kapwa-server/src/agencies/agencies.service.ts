import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Agency } from './agency.entity';
import { CreateAgencyInput } from './dto/agencies.zod';

@Injectable()
export class AgenciesService {
  constructor(
    @InjectRepository(Agency)
    private repo: Repository<Agency>,
  ) {}

  findAll(): Promise<Agency[]> {
    return this.repo.find({ where: { isActive: true }, order: { code: 'ASC' } });
  }

  findById(id: string): Promise<Agency | null> {
    return this.repo.findOne({ where: { id } });
  }

  findByCode(code: string): Promise<Agency | null> {
    return this.repo.findOne({ where: { code } });
  }

  async create(dto: CreateAgencyInput): Promise<Agency> {
    const code = dto.code.toUpperCase();
    const existing = await this.repo.findOne({ where: { code } });
    if (existing) throw new BadRequestException(`Agency code already exists: ${code}`);
    return this.repo.save(
      this.repo.create({
        code,
        name: dto.name,
        type: dto.type,
        contactInfo: dto.contactInfo,
        isActive: true,
      }),
    );
  }
}
