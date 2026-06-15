import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { CaseTrackerLog } from './tracker.entity';

@Injectable()
export class TrackerService {
  constructor(
    @InjectRepository(CaseTrackerLog)
    private readonly trackerRepo: Repository<CaseTrackerLog>,
  ) {}

  async getDailyLog(date?: string) {
    const targetDate = date ? new Date(date) : new Date();
    const start = new Date(targetDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(targetDate);
    end.setHours(23, 59, 59, 999);

    return this.trackerRepo.find({
      where: {
        transactionDate: Between(start, end),
      },
      order: { dailySeqNum: 'ASC' },
    });
  }

  async getDateRange(startDate: string, endDate: string) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    return this.trackerRepo.find({
      where: {
        transactionDate: Between(start, end),
      },
      order: { transactionDate: 'ASC', dailySeqNum: 'ASC' },
    });
  }

  async createEntry(data: Partial<CaseTrackerLog>) {
    const nextSeq = await this.getNextSequence(data.transactionDate || new Date());
    const entry = this.trackerRepo.create({
      ...data,
      dailySeqNum: nextSeq,
    });
    return this.trackerRepo.save(entry);
  }

  async getNextSequence(date: Date): Promise<number> {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const lastEntry = await this.trackerRepo.findOne({
      where: { transactionDate: Between(start, end) },
      order: { dailySeqNum: 'DESC' },
    });

    return lastEntry ? lastEntry.dailySeqNum + 1 : 1;
  }

  async getStats() {
    const total = await this.trackerRepo.count();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayCount = await this.trackerRepo.count({
      where: { transactionDate: Between(today, new Date()) },
    });

    return { totalCasesLogged: total, todayEntries: todayCount };
  }
}
