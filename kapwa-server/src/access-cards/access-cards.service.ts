import { DEFAULT_LIST_LIMIT } from '../common/constants';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessCardService } from './access-card-service.entity';

const ACCESS_CARD_PAD_WIDTH = 4;
@Injectable()
export class AccessCardsService {
  constructor(
    @InjectRepository(AccessCardService)
    private repo: Repository<AccessCardService>,
  ) {}

  async generateAndAssign(beneficiaryId: string): Promise<string> {
    const year = new Date().getFullYear();
    const queryRunner = this.repo.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE');
    try {
      const result = await queryRunner.manager.query(
        `INSERT INTO access_card_seq (year, created_at) VALUES ($1, NOW()) RETURNING id`,
        [year]
      );
      const seqId = result[0]?.id || 1;
      const code = `NORZ-AC-${year}-${String(seqId).padStart(ACCESS_CARD_PAD_WIDTH, '0')}`;

      await queryRunner.manager.query(
        `UPDATE beneficiaries SET access_card_code = $1 WHERE id = $2`,
        [code, beneficiaryId]
      );

      await queryRunner.commitTransaction();
      return code;
    } catch (e) {
      await queryRunner.rollbackTransaction();
      throw e;
    } finally {
      await queryRunner.release();
    }
  }

  async findBeneficiaryCard(beneficiaryId: string) {
    const ben = await this.repo.query(
      'SELECT id, access_card_code, surname, first_name, barangay FROM beneficiaries WHERE id = $1',
      [beneficiaryId]
    );
    if (!ben?.[0]?.access_card_code) {
      throw new NotFoundException('Beneficiary has no Access Card');
    }
    const services = await this.repo.find({
      where: { accessCardCode: ben[0].access_card_code },
      order: { serviceDate: 'DESC' },
    });
    return { beneficiary: ben[0], code: ben[0].access_card_code, services };
  }

  async logService(data: { accessCardCode: string; serviceRendered: string; serviceDate: Date; cost?: number; agency?: string; workerNameSign?: string }) {
    const entry = this.repo.create({
      accessCardCode: data.accessCardCode,
      serviceRendered: data.serviceRendered,
      serviceDate: data.serviceDate,
      cost: data.cost,
      agency: data.agency,
      workerNameSign: data.workerNameSign,
    });
    return this.repo.save(entry);
  }

  async findByCard(cardCode: string) {
    return this.repo.find({ where: { accessCardCode: cardCode }, order: { serviceDate: 'DESC' } });
  }

  async findAll() {
    return this.repo.find({ order: { serviceDate: 'DESC' }, take: DEFAULT_LIST_LIMIT });
  }
}
