import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { AccountProvisioningService } from '../accounts/account-provisioning.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User, UserRole } from '../auth/user.entity';
import { ConflictException, BadRequestException } from '@nestjs/common';

describe('UsersService', () => {
  let service: UsersService;
  let mockRepo: any;

  const mockUser = {
    id: 'uuid-1',
    email: 'worker@test.com',
    password: '$2b$10$hashedpassword123456789',
    role: UserRole.SW,
    firstName: 'Test',
    lastName: 'Worker',
    fullName: 'Test Worker',
    phone: '09171234567',
    isActive: true,
    assignedBarangay: 'Norzagaray',
    permittedBarangays: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockRepo = {
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      findAndCount: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: mockRepo },
        { provide: AccountProvisioningService, useValue: { deliverAccountCredentials: jest.fn().mockResolvedValue({ emailDelivered: true, smsDelivered: true }) } },
      ],
    }).compile();
    service = module.get<UsersService>(UsersService);
  });

  it('creates a user with a server-generated temporary password and delivers credentials', async () => {
    mockRepo.findOne.mockResolvedValue(null);
    mockRepo.create.mockImplementation((x: any) => ({ ...x }));
    mockRepo.save.mockImplementation(async (u: any) => ({ id: 'uuid-9', fullName: 'New Person', ...u }));

    const result = await service.createUser({ email: 'new@test.com', role: 'social_worker', firstName: 'New', lastName: 'Person' });

    const saved = mockRepo.save.mock.calls[0][0];
    expect(saved.mustChangePassword).toBeUndefined();
    expect(saved.password).toMatch(/^\$2[aby]\$/);
    expect((result as any).password).toBeUndefined();
    expect((service as any).accounts.deliverAccountCredentials).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'new@test.com', role: 'social_worker' }),
    );
    expect((service as any).accounts.deliverAccountCredentials.mock.calls[0][0].tempPassword).toBeUndefined();
  });

  describe('createUser', () => {
    it('should create a user with hashed password and return without password', async () => {
      const dto = {
        email: 'new@test.com',
        password: 'securePassword123',
        role: UserRole.SW,
        first_name: 'New',
        last_name: 'Worker',
        phone: '09170000000',
      };

      mockRepo.findOne.mockResolvedValue(null);
      const savedUser = {
        ...mockUser,
        email: dto.email,
        firstName: dto.first_name,
        lastName: dto.last_name,
        phone: dto.phone,
        password: '$2b$12$differentHashedValue',
      };
      mockRepo.save.mockResolvedValue(savedUser);

      const result = await service.createUser(dto);

      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { email: dto.email } });
      expect(mockRepo.save).toHaveBeenCalled();
      expect(result).not.toHaveProperty('password');
      expect(result.email).toBe(dto.email);
      expect(result.role).toBe(UserRole.SW);
    });

    it('should throw ConflictException if email already exists', async () => {
      const dto = {
        email: 'existing@test.com',
        password: 'securePassword123',
        role: UserRole.COORDINATOR,
      };

      mockRepo.findOne.mockResolvedValue({ id: 'existing-id', email: dto.email });

      await expect(service.createUser(dto)).rejects.toThrow(ConflictException);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid role', async () => {
      const dto = {
        email: 'badrole@test.com',
        password: 'securePassword123',
        role: 'superadmin',
        full_name: 'Invalid Role User',
      };

      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.createUser(dto)).rejects.toThrow(BadRequestException);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('should persist agencyId for agency_staff role', async () => {
      const dto = {
        email: 'rhu@norzagaray.test',
        password: 'password123',
        role: UserRole.AGENCY_STAFF,
        agencyId: 'ag-rhu',
      };

      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockImplementation((dto: any) => dto);
      mockRepo.save.mockImplementation(async (dto: any) => ({ id: 'u1', ...dto, password: 'hashed' }));

      const result = await service.createUser(dto);

      expect(result.agencyId).toBe('ag-rhu');
      expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({ agencyId: 'ag-rhu', role: UserRole.AGENCY_STAFF }));
    });
  });

  describe('findAll', () => {
    it('should return paginated list of users without passwords', async () => {
      const users = [
        { ...mockUser, id: '1', email: 'user1@test.com' },
        { ...mockUser, id: '2', email: 'user2@test.com' },
      ];
      mockRepo.findAndCount.mockResolvedValue([users, 2]);

      const result = await service.findAll(undefined, undefined, undefined, 1, 10);

      expect(mockRepo.findAndCount).toHaveBeenCalled();
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.data[0]).not.toHaveProperty('password');
      expect(result.data[1]).not.toHaveProperty('password');
    });

    it('should strip sensitive tokens + mfaSecret from the list response', async () => {
      const users = [
        {
          ...mockUser,
          id: '1',
          email: 'user1@test.com',
          tokens: [{ purpose: 'email_verification', token: 'SECRET-TOKEN-VALUE', expiresAt: new Date() }],
          mfaSecret: 'MFA-SECRET-VALUE',
        },
      ];
      mockRepo.findAndCount.mockResolvedValue([users, 1]);

      const result = await service.findAll(undefined, undefined, undefined, 1, 10);

      expect(result.data[0]).not.toHaveProperty('tokens');
      expect(result.data[0]).not.toHaveProperty('mfaSecret');
      expect(result.data[0]).not.toHaveProperty('password');
    });
  });

  describe('setActive', () => {
    it('disables a user, revokes sessions and strips the password', async () => {
      const activeUser = { ...mockUser, id: 'user-1', isActive: true, tokenVersion: 3 };
      mockRepo.findOne.mockResolvedValue(activeUser);
      mockRepo.save.mockImplementation(async (u: any) => u);

      const result = await service.setActive('user-1', false, 'admin-9');

      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: 'user-1' } });
      expect(result.isActive).toBe(false);
      expect(result.tokenVersion).toBe(4);
      expect(result).not.toHaveProperty('password');
    });

    it('re-enables a disabled user', async () => {
      const disabled = { ...mockUser, id: 'user-2', isActive: false };
      mockRepo.findOne.mockResolvedValue(disabled);
      mockRepo.save.mockImplementation(async (u: any) => u);

      const result = await service.setActive('user-2', true, 'admin-9');

      expect(result.isActive).toBe(true);
      expect(result).not.toHaveProperty('password');
    });

    it('refuses an admin disabling their own account', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockUser, id: 'admin-1', role: UserRole.ADMIN, isActive: true });
      await expect(service.setActive('admin-1', false, 'admin-1')).rejects.toThrow(BadRequestException);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('refuses disabling the last active administrator', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockUser, id: 'admin-2', role: UserRole.ADMIN, isActive: true });
      mockRepo.count.mockResolvedValue(1);
      await expect(service.setActive('admin-2', false, 'admin-1')).rejects.toThrow(BadRequestException);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('allows disabling an admin when another active admin remains', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockUser, id: 'admin-3', role: UserRole.ADMIN, isActive: true });
      mockRepo.count.mockResolvedValue(2);
      mockRepo.save.mockImplementation(async (u: any) => u);
      await expect(service.setActive('admin-3', false, 'admin-1')).resolves.toMatchObject({ isActive: false });
    });

    it('throws NotFound for an unknown user', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.setActive('missing', false, 'admin-1')).rejects.toThrow('User not found');
    });
  });

  describe('update', () => {
    it('should persist agencyId', async () => {
      const user = { id: 'u1', role: UserRole.AGENCY_STAFF, agencyId: undefined, save: jest.fn() };
      mockRepo.findOne.mockResolvedValue(user);

      await service.update('u1', { agencyId: 'ag-rhu' });

      expect(user.agencyId).toBe('ag-rhu');
    });

    it('refuses assigning the claimant role from the admin panel', async () => {
      const user = { id: 'u1', role: UserRole.SW, save: jest.fn() };
      mockRepo.findOne.mockResolvedValue(user);

      await expect(service.update('u1', { role: UserRole.CLAIMANT })).rejects.toThrow(BadRequestException);
      expect(user.save).not.toHaveBeenCalled();
    });

    it("refuses changing an existing claimant's role", async () => {
      const user = { id: 'u2', role: UserRole.CLAIMANT, save: jest.fn() };
      mockRepo.findOne.mockResolvedValue(user);

      await expect(service.update('u2', { role: UserRole.ADMIN })).rejects.toThrow(BadRequestException);
      expect(user.save).not.toHaveBeenCalled();
    });
  });
});
