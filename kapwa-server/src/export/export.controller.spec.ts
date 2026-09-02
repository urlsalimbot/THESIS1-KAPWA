import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';

describe('ExportController month validation', () => {
  let controller: ExportController;
  let service: { monthlyFundUtilization: jest.Mock };

  beforeEach(async () => {
    service = {
      monthlyFundUtilization: jest.fn().mockResolvedValue({
        buffer: Buffer.from('xlsx'),
        filename: 'fund-utilization.xlsx',
      }),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExportController],
      providers: [{ provide: ExportService, useValue: service }],
    }).compile();
    controller = module.get<ExportController>(ExportController);
  });

  function mockRes() {
    return {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      set: jest.fn(),
      send: jest.fn(),
    } as any;
  }

  it('rejects a missing month and range with 400', async () => {
    const res = mockRes();
    await controller.exportMonthlyFunds('', undefined, undefined, res);
    expect(res.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(service.monthlyFundUtilization).not.toHaveBeenCalled();
  });

  it('rejects malformed months like 2026-13/2026-1 with 400', async () => {
    for (const m of ['2026-13', '2026-1']) {
      const res = mockRes();
      await controller.exportMonthlyFunds(m, undefined, undefined, res);
      expect(res.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(service.monthlyFundUtilization).not.toHaveBeenCalled();
    }
  });

  it('accepts a valid month like 2026-08', async () => {
    const res = mockRes();
    await controller.exportMonthlyFunds('2026-08', undefined, undefined, res);
    expect(service.monthlyFundUtilization).toHaveBeenCalledWith('2026-08', undefined, undefined);
    expect(res.status).not.toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(res.set).toHaveBeenCalled();
    expect(res.send).toHaveBeenCalled();
  });

  it('accepts December 2026-12', async () => {
    const res = mockRes();
    await controller.exportMonthlyFunds('2026-12', undefined, undefined, res);
    expect(service.monthlyFundUtilization).toHaveBeenCalledWith('2026-12', undefined, undefined);
  });

  it('accepts an explicit date range without a month', async () => {
    const res = mockRes();
    await controller.exportMonthlyFunds('', '2026-01-01', '2026-12-31', res);
    expect(service.monthlyFundUtilization).toHaveBeenCalledWith('', '2026-01-01', '2026-12-31');
    expect(res.status).not.toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
  });

  it('rejects malformed range dates with 400', async () => {
    const res = mockRes();
    await controller.exportMonthlyFunds('', '2026-13-01', undefined, res);
    expect(res.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(service.monthlyFundUtilization).not.toHaveBeenCalled();
  });
});
