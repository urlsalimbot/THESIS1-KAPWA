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
        full_name: 'New Worker',
        phone: '09170000000',
      };

      mockRepo.findOne.mockResolvedValue(null);
      const savedUser = {
        ...mockUser,
        email: dto.email,
        fullName: dto.full_name,
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
  });

  describe('findAll', () => {
    it('should return paginated list of users without passwords', async () => {
      const users = [
        { ...mockUser, id: '1', email: 'user1@test.com' },
        { ...mockUser, id: '2', email: 'user2@test.com' },
      ];
      mockRepo.findAndCount.mockResolvedValue([users, 2]);

      const result = await service.findAll(undefined, undefined, 1, 10);

      expect(mockRepo.findAndCount).toHaveBeenCalled();
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.data[0]).not.toHaveProperty('password');
      expect(result.data[1]).not.toHaveProperty('password');
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
});
