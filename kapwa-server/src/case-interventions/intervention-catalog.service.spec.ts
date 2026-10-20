import { InterventionCatalogService } from './intervention-catalog.service';

function mockCatalog() {
  const repo = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((e: any) => e),
    save: jest.fn(async (e: any) => e),
  };
  const svc = new InterventionCatalogService(repo as any);
  return { repo, svc };
}

describe('InterventionCatalogService', () => {
  it('derives a stable code from the label and keeps the money flag', async () => {
    const { repo, svc } = mockCatalog();
    const created = await svc.create({ label: 'Barangay Medical Mission', isFinancial: true }, 'admin-1');

    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
      code: 'barangay_medical_mission',
      label: 'Barangay Medical Mission',
      isFinancial: true,
      createdBy: 'admin-1',
    }));
    expect(created.code).toBe('barangay_medical_mission');
  });

  it('refuses a name that would shadow a built-in service', async () => {
    const { repo, svc } = mockCatalog();
    await expect(svc.create({ label: 'Food Pack' })).rejects.toThrow(/built-in/i);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('refuses a duplicate custom name', async () => {
    const { repo, svc } = mockCatalog();
    repo.findOne.mockResolvedValue({ code: 'relief_goods', label: 'Relief Goods' });
    await expect(svc.create({ label: 'Relief  Goods!' })).rejects.toThrow(/already uses that name/i);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('retires an entry by deactivating it instead of deleting it', async () => {
    const { repo, svc } = mockCatalog();
    repo.findOne.mockResolvedValue({ code: 'relief_goods', label: 'Relief Goods', isFinancial: false, isActive: true });

    const saved = await svc.update('relief_goods', { isActive: false });

    expect(saved.isActive).toBe(false);
    expect(saved.code).toBe('relief_goods');
  });

  it('renames without touching the code rows already store', async () => {
    const { repo, svc } = mockCatalog();
    repo.findOne.mockResolvedValue({ code: 'relief_goods', label: 'Relief Goods', isFinancial: false, isActive: true });

    const saved = await svc.update('relief_goods', { label: 'Relief Goods (donated)' });

    expect(saved.label).toBe('Relief Goods (donated)');
    expect(saved.code).toBe('relief_goods');
  });

  it('404s on an unknown code', async () => {
    const { svc } = mockCatalog();
    await expect(svc.update('nope', { isActive: false })).rejects.toThrow(/not found/i);
  });
});
