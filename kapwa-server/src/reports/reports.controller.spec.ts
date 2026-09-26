import { BadRequestException } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { SummaryReportQuerySchema } from './dto/summary-report.query';

describe('SummaryReportQuerySchema', () => {
  it('defaults year and quarter', () => {
    const parsed = SummaryReportQuerySchema.parse({});
    expect(parsed.year).toBeGreaterThanOrEqual(2000);
    expect(parsed.quarter).toBeGreaterThanOrEqual(1);
    expect(parsed.quarter).toBeLessThanOrEqual(4);
  });
  it('rejects an out-of-range quarter', () => {
    expect(() => SummaryReportQuerySchema.parse({ quarter: '5' })).toThrow();
  });
});

describe('ReportsController.summary', () => {
  it('streams a PDF with an attachment filename', async () => {
    const service = { build: jest.fn().mockResolvedValue({ year: 2025, quarter: 2 }) } as any;
    const builder = { build: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4')) } as any;
    const controller = new ReportsController(service, builder);
    const res: any = { set: jest.fn(), send: jest.fn() };
    await controller.summary('2025', '2', res);
    expect(res.set).toHaveBeenCalledWith(expect.objectContaining({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="summary-report-2025-Q2.pdf"',
    }));
    expect(res.send).toHaveBeenCalled();
  });

  it('rejects an out-of-range quarter with BadRequestException (HTTP 400)', async () => {
    const service = { build: jest.fn() } as any;
    const builder = { build: jest.fn() } as any;
    const controller = new ReportsController(service, builder);
    const res: any = { set: jest.fn(), send: jest.fn() };
    await expect(controller.summary('2025', '5', res)).rejects.toBeInstanceOf(BadRequestException);
    expect(service.build).not.toHaveBeenCalled();
    expect(res.send).not.toHaveBeenCalled();
  });
});
