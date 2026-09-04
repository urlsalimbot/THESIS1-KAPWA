import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
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
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: mockRepo },
      ],
    }).compile();
    service = module.get<UsersService>(UsersService);
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
        agency_id: 'ag-rhu',
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

  describe('deactivateUser', () => {
    it('should set isActive to false and return updated user without password', async () => {
      const activeUser = { ...mockUser, id: 'user-1', isActive: true };
      mockRepo.findOne.mockResolvedValue(activeUser);
      mockRepo.save.mockResolvedValue({ ...activeUser, isActive: false });

      const result = await service.deactivateUser('user-1');

      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: 'user-1' } });
      expect(mockRepo.save).toHaveBeenCalled();
      expect(result.isActive).toBe(false);
      expect(result).not.toHaveProperty('password');
    });
  });

  describe('update', () => {
    it('should persist agencyId', async () => {
      const user = { id: 'u1', role: UserRole.AGENCY_STAFF, agencyId: undefined, save: jest.fn() };
      mockRepo.findOne.mockResolvedValue(user);

      await service.update('u1', { agencyId: 'ag-rhu' });

      expect(user.agencyId).toBe('ag-rhu');
    });
  });
});
