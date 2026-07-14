import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InterventionTypeEntity } from './intervention-type.entity';
import { CreateInterventionTypeInput, UpdateInterventionTypeInput } from './dto/intervention-types.zod';

@Injectable()
export class InterventionTypesService {
  constructor(
    @InjectRepository(InterventionTypeEntity)
    private repo: Repository<InterventionTypeEntity>,
  ) {}

  async findAll(includeInactive = false): Promise<InterventionTypeEntity[]> {
    if (includeInactive) {
      return this.repo.find({ order: { code: 'ASC' } });
    }
    return this.repo.find({ where: { isActive: true }, order: { code: 'ASC' } });
  }

  async findById(id: string): Promise<InterventionTypeEntity> {
    const type = await this.repo.findOne({ where: { id } });
    if (!type) throw new NotFoundException('Intervention type not found');
    return type;
  }

  async findByCode(code: string): Promise<InterventionTypeEntity | null> {
    return this.repo.findOne({ where: { code, isActive: true } });
  }

  async validateCode(code: string): Promise<void> {
    const exists = await this.repo.findOne({ where: { code, isActive: true } });
    if (!exists) {
      throw new NotFoundException(`Intervention type '${code}' not found or is inactive`);
    }
  }

  async create(data: CreateInterventionTypeInput): Promise<InterventionTypeEntity> {
    const existing = await this.repo.findOne({ where: { code: data.code } });
    if (existing) {
      throw new ConflictException(`Intervention type with code '${data.code}' already exists`);
    }
    const entity = this.repo.create({
      code: data.code,
      name: data.name,
      description: data.description,
      isActive: data.isActive ?? true,
    });
    return this.repo.save(entity);
  }

  async update(id: string, data: UpdateInterventionTypeInput): Promise<InterventionTypeEntity> {
    const type = await this.findById(id);
    Object.assign(type, data);
    return this.repo.save(type);
  }

  async deactivate(id: string): Promise<void> {
    const type = await this.findById(id);
    type.isActive = false;
    await this.repo.save(type);
  }
}
