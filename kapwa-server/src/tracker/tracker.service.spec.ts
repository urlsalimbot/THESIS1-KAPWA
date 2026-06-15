import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { TrackerService } from './tracker.service';
import { CaseTrackerLog } from './tracker.entity';

describe('TrackerService', () => {
  let service: TrackerService;
  let repoMock: any;

  beforeEach(async () => {
    repoMock = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockReturnValue({}),
      save: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(0),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrackerService,
        { provide: getRepositoryToken(CaseTrackerLog), useValue: repoMock },
      ],
    }).compile();

    service = module.get<TrackerService>(TrackerService);
  });

  it('returns daily log for today', async () => {
    const mockEntries = [
      { id: '1', dailySeqNum: 1, surname: 'Doe', firstName: 'John', transactionDate: new Date() },
    ];
    repoMock.find.mockResolvedValue(mockEntries);
    const result = await service.getDailyLog();
    expect(result).toHaveLength(1);
    expect(result[0].surname).toBe('Doe');
  });

  it('returns date range entries', async () => {
    repoMock.find.mockResolvedValue([{ id: '1', dailySeqNum: 1, surname: 'Smith' }]);
    const result = await service.getDateRange('2026-06-01', '2026-06-15');
    expect(result).toHaveLength(1);
  });

  it('creates entry with next sequence number', async () => {
    const now = new Date();
    repoMock.findOne.mockResolvedValue({ dailySeqNum: 5 });
    const entry = { surname: 'Test', transactionDate: now };
    await service.createEntry(entry);
    expect(repoMock.create).toHaveBeenCalledWith(expect.objectContaining({ dailySeqNum: 6 }));
  });

  it('starts sequence at 1 when no prior entries', async () => {
    repoMock.findOne.mockResolvedValue(null);
    await service.createEntry({ surname: 'First', transactionDate: new Date() });
    expect(repoMock.create).toHaveBeenCalledWith(expect.objectContaining({ dailySeqNum: 1 }));
  });

  it('returns stats', async () => {
    repoMock.count.mockResolvedValueOnce(42).mockResolvedValueOnce(3);
    const stats = await service.getStats();
    expect(stats.totalCasesLogged).toBe(42);
    expect(stats.todayEntries).toBe(3);
  });

  it('returns next sequence number', async () => {
    repoMock.findOne.mockResolvedValue({ dailySeqNum: 7 });
    const seq = await service.getNextSequence(new Date());
    expect(seq).toBe(8);
  });
});
