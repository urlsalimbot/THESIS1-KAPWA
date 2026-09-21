import { CsrController } from './csr.controller';
import { CsrService } from './csr.service';
import { exportFileName } from '../common/constants';

describe('CsrController', () => {
  const svc = { generatePdf: jest.fn() } as unknown as CsrService;
  const controller = new CsrController(svc);

  beforeEach(() => {
    (svc.generatePdf as jest.Mock).mockReset();
  });

  it('uses the shared export filename convention', async () => {
    (svc.generatePdf as jest.Mock).mockResolvedValue(Buffer.from('%PDF-1.3'));
    const res = { set: jest.fn(), end: jest.fn() };
    await controller.downloadPdf('CSR-2026-0001', res as never);
    expect(res.set).toHaveBeenCalledWith(expect.objectContaining({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${exportFileName('CSR', 'CSR-2026-0001')}"`,
    }));
    expect(res.end).toHaveBeenCalledWith(expect.any(Buffer));
  });
});
