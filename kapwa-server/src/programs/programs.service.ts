import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Program } from './program.entity';

@Injectable()
export class ProgramsService {
  constructor(
    @InjectRepository(Program) private progRepo: Repository<Program>
  ) {}

  async create(data: Partial<Program>) {
    const prog = this.progRepo.create(data);
    return this.progRepo.save(prog);
  }

  async findAll(activeOnly = true) {
    const where = activeOnly ? { isActive: true } : {};
    return this.progRepo.find({ where });
  }

  async findById(id: string) {
    const prog = await this.progRepo.findOne({ where: { id } });
    if (!prog) throw new NotFoundException('Program not found');
    return prog;
  }
}
