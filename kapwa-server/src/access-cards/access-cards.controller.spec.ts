import { Test } from '@nestjs/testing';
import { AccessCardsController } from './access-cards.controller';
import { AccessCardsService } from './access-cards.service';
import { AbacGuard } from '../auth/guards/abac.guard';
import { exportFileName } from '../common/constants';

describe('AccessCardsController', () => {
  let controller: AccessCardsController;
  const svc = {
    generateAccessCardPdf: jest.fn(),
    accessCardCodeFor: jest.fn(),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AccessCardsController],
      providers: [{ provide: AccessCardsService, useValue: svc }],
    })
      .overrideGuard(AbacGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(AccessCardsController);
    svc.generateAccessCardPdf.mockReset();
    svc.accessCardCodeFor.mockReset();
  });

  it('streams the access card PDF with attachment headers', async () => {
    svc.generateAccessCardPdf.mockResolvedValue(Buffer.from('%PDF-1.3'));
    svc.accessCardCodeFor.mockResolvedValue('NORZ-AC-2026-0001');
    const res = {
      set: jest.fn(),
      end: jest.fn(),
    };
    await controller.downloadAccessCardPdf('b1', res);
    expect(res.set).toHaveBeenCalledWith(expect.objectContaining({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${exportFileName('ACCESS CARD', 'NORZ-AC-2026-0001')}"`,
    }));
    expect(res.end).toHaveBeenCalledWith(expect.any(Buffer));
  });
});
