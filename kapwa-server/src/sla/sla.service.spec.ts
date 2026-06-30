import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SlaService } from './sla.service';
import { Case } from '../cases/case.entity';
import { Notification } from '../notifications/notification.entity';

describe('SlaService', () => {
  let service: SlaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlaService,
        { provide: getRepositoryToken(Case), useValue: { find: jest.fn(), query: jest.fn() } },
        { provide: getRepositoryToken(Notification), useValue: { save: jest.fn() } },
      ],
    }).compile();
    service = module.get<SlaService>(SlaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
