import { Test } from '@nestjs/testing';
import { AccessCardsController } from './access-cards.controller';
import { AccessCardsService } from './access-cards.service';
import { AbacGuard } from '../auth/guards/abac.guard';
import { exportFileName } from '../common/constants';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';

describe('AccessCardsController', () => {
  let controller: AccessCardsController;
  const svc = {
    generateAccessCardPdf: jest.fn(),
    accessCardCodeFor: jest.fn(),
    ensureHouseholdCard: jest.fn(),
    generateAndAssign: jest.fn(),
    findCardByCode: jest.fn(),
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
    svc.ensureHouseholdCard.mockReset();
    svc.generateAndAssign.mockReset();
    svc.findCardByCode.mockReset();
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

  describe('POST /assign/:beneficiaryId', () => {
    // Access cards are minted by intake (intake.service submitIntake calls
    // ensureHouseholdCard) and only when the household has none. This endpoint
    // is the manual backfill for households enrolled before cards existed, and
    // BeneficiaryViewPage only shows its button when there is no card. So it
    // must never replace a live code — that orphans the household's service
    // history and consumes a sequence number.
    it('returns the existing card and does not mint a new one', async () => {
      svc.ensureHouseholdCard.mockResolvedValue('NORZ-AC-2026-0007');
      const res = await controller.assignCard('b1');
      expect(res).toEqual({ accessCardCode: 'NORZ-AC-2026-0007' });
      expect(svc.ensureHouseholdCard).toHaveBeenCalledWith('b1');
      expect(svc.generateAndAssign).not.toHaveBeenCalled();
    });
  });

  describe('GET /by-code/:code/card', () => {
    // The coordinator flow enters the printed card code, not a beneficiary
    // UUID — the ParseUUIDPipe on /beneficiary/:id/card 400s on that.
    it('resolves card details from the printed code, same shape as findBeneficiaryCard', async () => {
      svc.findCardByCode.mockResolvedValue({
        beneficiary: { id: 'b1', access_card_code: 'NORZ-AC-2026-0001' },
        code: 'NORZ-AC-2026-0001',
        services: [],
      });
      const out = await controller.findCardByCode('NORZ-AC-2026-0001', { user: { role: 'coordinator' } } as any);
      expect(svc.findCardByCode).toHaveBeenCalledWith('NORZ-AC-2026-0001', { role: 'coordinator' });
      expect(out.code).toBe('NORZ-AC-2026-0001');
    });

    it('is scoped to staff + agency_staff (claimant excluded)', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, AccessCardsController.prototype.findCardByCode);
      expect(roles).toEqual(['admin', 'social_worker', 'coordinator', 'agency_staff']);
    });
  });
});
