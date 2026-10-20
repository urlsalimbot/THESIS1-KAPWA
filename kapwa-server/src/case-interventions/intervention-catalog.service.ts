import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { INTERVENTION_TYPES } from '../common/case-catalog';
import { InterventionCatalogEntry } from './intervention-catalog.entity';
import { CreateServiceTypeInput, UpdateServiceTypeInput } from './dto/intervention-catalog.zod';

/** The code stored on rows and sent by the client, derived once from the label. */
export function serviceTypeCode(label: string): string {
  return label
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}

@Injectable()
export class InterventionCatalogService {
  constructor(
    @InjectRepository(InterventionCatalogEntry)
    private readonly repo: Repository<InterventionCatalogEntry>,
  ) {}

  /** Every custom entry — the admin list shows inactive ones too. */
  list(): Promise<InterventionCatalogEntry[]> {
    return this.repo.find({ order: { label: 'ASC' } });
  }

  async create(input: CreateServiceTypeInput, actorId?: string): Promise<InterventionCatalogEntry> {
    const code = serviceTypeCode(input.label);
    if (!code) throw new BadRequestException('The service name needs letters or digits');

    // A custom entry may not shadow a built-in service: the built-ins carry
    // labels, financial rules and parity checks this table cannot override.
    if (INTERVENTION_TYPES.includes(code)) {
      throw new ConflictException(`"${input.label}" is already a built-in service`);
    }
    const existing = await this.repo.findOne({ where: { code } });
    if (existing) throw new ConflictException(`"${existing.label}" already uses that name`);

    return this.repo.save(this.repo.create({
      code,
      label: input.label.trim(),
      isFinancial: input.isFinancial ?? false,
      createdBy: actorId ?? null,
    }));
  }

  async update(code: string, input: UpdateServiceTypeInput): Promise<InterventionCatalogEntry> {
    const entry = await this.repo.findOne({ where: { code } });
    if (!entry) throw new NotFoundException('Service not found');
    // The code is the reference old rows carry, so a rename changes only the
    // label; deactivating is how an entry is retired.
    if (input.label !== undefined) entry.label = input.label.trim();
    if (input.isActive !== undefined) entry.isActive = input.isActive;
    return this.repo.save(entry);
  }
}
