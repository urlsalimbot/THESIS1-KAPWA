import { CsrController } from './csr.controller';
import { CsrService } from './csr.service';

describe('CsrController', () => {
  const svc = {
    create: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
  } as unknown as CsrService;
  const controller = new CsrController(svc);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates creation to the service with the acting user', async () => {
    (svc.create as jest.Mock).mockResolvedValue({ id: 'csr-1', controlNo: 'CSR-2026-0001' });
    const data = { caseId: 'case-uuid', socialWorkerName: 'Jane SW' };
    await controller.create(data as never, { user: { id: 'u1' } } as never);
    expect(svc.create).toHaveBeenCalledWith(data, 'u1');
  });

  it('lists CSR records', async () => {
    (svc.findAll as jest.Mock).mockResolvedValue([{ id: 'csr-1' }]);
    await expect(controller.findAll()).resolves.toEqual([{ id: 'csr-1' }]);
  });

  it('fetches a single CSR record by id', async () => {
    (svc.findById as jest.Mock).mockResolvedValue({ id: 'csr-1' });
    await expect(controller.findOne('csr-1')).resolves.toEqual({ id: 'csr-1' });
    expect(svc.findById).toHaveBeenCalledWith('csr-1');
  });
});
