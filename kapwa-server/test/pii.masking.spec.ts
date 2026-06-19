import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { of, firstValueFrom } from 'rxjs';
import { PiiMaskingInterceptor } from '../src/beneficiaries/pii.interceptor';
import { ConsentLedger } from '../src/beneficiaries/consent-ledger.entity';

describe('PiiMaskingInterceptor', () => {
  let interceptor: PiiMaskingInterceptor;
  let consentRepo: Repository<ConsentLedger>;

  const createMockCtx = () => ({
    switchToHttp: () => ({
      getRequest: () => ({}),
      getResponse: () => ({}),
    }),
    getClass: () => null,
    getHandler: () => null,
  });

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PiiMaskingInterceptor,
        {
          provide: getRepositoryToken(ConsentLedger),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    interceptor = module.get<PiiMaskingInterceptor>(PiiMaskingInterceptor);
    consentRepo = module.get<Repository<ConsentLedger>>(getRepositoryToken(ConsentLedger));
  });

  afterEach(() => jest.clearAllMocks());

  // Helper to extract data from interceptor using proper RxJS
  async function interceptData(data: any): Promise<any> {
    const mockCtx = createMockCtx();
    const mockNext = {
      handle: () => of(data), // Returns a proper RxJS Observable
    };
    const observable = interceptor.intercept(mockCtx as any, mockNext as any);
    return firstValueFrom(observable);
  }

  // Test 8: PII fields nulled when consent is revoked (single response)
  it('should null PII fields when consent is revoked for a single object', async () => {
    (consentRepo.findOne as jest.Mock).mockResolvedValue({
      id: 'cl-1',
      beneficiaryId: 'ben-1',
      status: 'revoked',
    });

    const data = {
      id: 'ben-1',
      surname: 'Cruz',
      firstName: 'Juan',
      middleName: 'Santos',
      address: '123 Street',
      phone: '09170000000',
      dob: '1990-01-01',
      philsysNumber: '1234-5678-9012',
      gender: 'Male',
    };

    const result = await interceptData(data);

    expect(result.surname).toBeNull();
    expect(result.firstName).toBeNull();
    expect(result.middleName).toBeNull();
    expect(result.address).toBeNull();
    expect(result.phone).toBeNull();
    expect(result.dob).toBeNull();
    expect(result.philsysNumber).toBeNull();
    expect(result.gender).toBe('Male'); // Non-PII field preserved
    expect(result.id).toBe('ben-1'); // ID preserved
  });

  // Test 9: PII fields NOT nulled when consent is active
  it('should NOT null PII fields when consent is active', async () => {
    (consentRepo.findOne as jest.Mock).mockResolvedValue(null);

    const data = {
      id: 'ben-1',
      surname: 'Cruz',
      firstName: 'Juan',
      address: '123 Street',
    };

    const result = await interceptData(data);

    expect(result.surname).toBe('Cruz');
    expect(result.firstName).toBe('Juan');
    expect(result.address).toBe('123 Street');
  });

  // Test 10: Array response masks PII for revoked beneficiaries only
  it('should mask PII for revoked beneficiaries in array responses', async () => {
    // Return revoked for ben-1, but not for ben-2
    (consentRepo.find as jest.Mock).mockResolvedValue([
      { beneficiaryId: 'ben-1', status: 'revoked' },
    ]);

    const data = [
      { id: 'ben-1', surname: 'Cruz', firstName: 'Juan', address: '123 St' },
      { id: 'ben-2', surname: 'Reyes', firstName: 'Maria', address: '456 Ave' },
    ];

    const result = await interceptData(data);

    expect(result[0].surname).toBeNull();
    expect(result[0].firstName).toBeNull();
    expect(result[1].surname).toBe('Reyes');
    expect(result[1].firstName).toBe('Maria');
  });
});
