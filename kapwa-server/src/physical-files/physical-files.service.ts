import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { PhysicalFile } from './physical-file.entity';

@Injectable()
export class PhysicalFilesService {
  constructor(
    @InjectRepository(PhysicalFile)
    private repo: Repository<PhysicalFile>,
  ) {}

  async findAll(): Promise<PhysicalFile[]> {
    return this.repo.find({ order: { createdAt: 'DESC' }, relations: ['intervention'] });
  }

  async findById(id: string): Promise<PhysicalFile | null> {
    return this.repo.findOne({ where: { id }, relations: ['intervention'] });
  }

  async findByIntervention(interventionId: string): Promise<PhysicalFile | null> {
    return this.repo.findOne({ where: { interventionId } });
  }

  async search(query: string): Promise<PhysicalFile[]> {
    return this.repo.find({
      where: [
        { cabinet: ILike(`%${query}%`) },
        { folder: ILike(`%${query}%`) },
        { shelf: ILike(`%${query}%`) },
      ],
      relations: ['intervention'],
      order: { createdAt: 'DESC' },
    });
  }

  async findDistinctCabinets(): Promise<string[]> {
    const result = await this.repo
      .createQueryBuilder('pf')
      .select('DISTINCT pf.cabinet', 'cabinet')
      .orderBy('pf.cabinet')
      .getRawMany();
    return result.map(r => r.cabinet);
  }
}
