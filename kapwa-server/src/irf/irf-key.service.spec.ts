import { IrfKeyService } from './irf-key.service';

describe('IrfKeyService', () => {
  let irfRepo: any;

  beforeEach(() => {
    irfRepo = {
      query: jest.fn().mockResolvedValue([{ key_hex: 'a'.repeat(64) }]),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      findOne: jest.fn().mockResolvedValue(null),
    };
    // A fixed, valid 32-byte master key — tests must never invent one, or the
    // wrap/unwrap round-trip proves nothing.
    process.env.IRF_ENCRYPTION_KEY = '11'.repeat(32);
  });

  afterEach(() => {
    delete process.env.IRF_ENCRYPTION_KEY;
  });

  it('wraps and unwraps a record key with the master key', async () => {
    const service = new IrfKeyService(irfRepo as any);
    const recordKey = 'ff'.repeat(32);

    const wrapped = await service.wrapKey(recordKey);
    // AES-CBC: 16-byte IV + ciphertext; two different wraps must differ (random IV).
    const again = await service.wrapKey(recordKey);
    expect(wrapped).not.toBe(again);

    await expect(service.unwrapKey(wrapped)).resolves.toBe(recordKey);
  });

  it('refuses a wrapped key that was never produced by the master key', async () => {
    const service = new IrfKeyService(irfRepo as any);
    const tampered = Buffer.from(('00'.repeat(16)) + ('aa'.repeat(16))).toString('base64');
    await expect(service.unwrapKey(tampered)).rejects.toThrow();
  });

  it('getRecordKey throws NotFound when the IRF has no master wrap', async () => {
    irfRepo.findOne.mockResolvedValue({ id: 'irf-1', keyWraps: [] });
    const service = new IrfKeyService(irfRepo as any);
    await expect(service.getRecordKey('irf-1')).rejects.toThrow(/no key wraps/i);
  });
});