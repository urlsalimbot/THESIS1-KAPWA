import { Injectable } from '@nestjs/common';
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

  async generateTrackerId(date: Date, seqNum: number): Promise<string> {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `NORZ-TRACK-${year}-${month}${day}-${String(seqNum).padStart(3, '0')}`;
  }

  private getDayRange(date: Date): [Date, Date] {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return [start, end];
  }

  async getOrCreateTrackerId(date: Date, clientSeqNum?: number): Promise<{ trackerId: string; seqNum: number }> {
    if (clientSeqNum) {
      const [dayStart, dayEnd] = this.getDayRange(date);
      const existing = await this.trackerRepo.findOne({
        where: { transactionDate: Between(dayStart, dayEnd), dailySeqNum: clientSeqNum },
      });
      if (existing) {
        return {
          trackerId: existing.trackerId || await this.generateTrackerId(date, existing.dailySeqNum),
          seqNum: existing.dailySeqNum,
        };
      }
    }
    const seq = clientSeqNum || (await this.getNextSequence(date));
    const trackerId = await this.generateTrackerId(date, seq);
    return { trackerId, seqNum: seq };
  }

  async createEntry(data: Partial<CaseTrackerLog>) {
    let nextSeq: number;
    if (data.dailySeqNum) {
      nextSeq = data.dailySeqNum;
    } else {
      nextSeq = await this.getNextSequence(data.transactionDate || new Date());
    }
    const entry = this.trackerRepo.create({
      ...data,
      dailySeqNum: nextSeq,
    });
    const saved = await this.trackerRepo.save(entry);
    // Generate and set trackerId after save
    if (!saved.trackerId) {
      saved.trackerId = await this.generateTrackerId(
        saved.transactionDate || new Date(),
        saved.dailySeqNum,
      );
      await this.trackerRepo.save(saved);
    }
    return saved;
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
