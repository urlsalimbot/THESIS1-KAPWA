import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let repoMock: Partial<Repository<User>>;
  let jwtMock: Partial<JwtService>;

  beforeEach(async () => {
    repoMock = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    jwtMock = {
      sign: jest.fn().mockReturnValue('signed-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: repoMock },
        { provide: JwtService, useValue: jwtMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should throw ConflictException if email exists', async () => {
      (repoMock.findOne as jest.Mock).mockResolvedValue({ id: '1', email: 'test@test.com' });
      await expect(service.register({ email: 'test@test.com', password: 'pass' })).rejects.toThrow('Email already registered');
    });

    it('should hash password and save user', async () => {
      (repoMock.findOne as jest.Mock).mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      const created = { email: 'test@test.com', password: 'hashed', role: 'social_worker', isActive: true };
      (repoMock.create as jest.Mock).mockReturnValue(created);
      (repoMock.save as jest.Mock).mockResolvedValue(created);
      const result = await service.register({ email: 'test@test.com', password: 'pass' });
      expect(bcrypt.hash).toHaveBeenCalledWith('pass', 12);
      expect(repoMock.create).toHaveBeenCalled();
      expect(repoMock.save).toHaveBeenCalled();
      expect(result).toHaveProperty('id');
    });
  });

  describe('validateUser', () => {
    it('should return null if user not found', async () => {
      (repoMock.findOne as jest.Mock).mockResolvedValue(null);
      const result = await service.validateUser('a@a.com', 'pass');
      expect(result).toBeNull();
    });

    it('should return user if password matches', async () => {
      const user = { id: '1', email: 'a@a.com', password: 'hashed' } as User;
      (repoMock.findOne as jest.Mock).mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      const result = await service.validateUser('a@a.com', 'pass');
      expect(result).toEqual(user);
    });

    it('should return null if password invalid', async () => {
      const user = { id: '1', email: 'a@a.com', password: 'hashed' } as User;
      (repoMock.findOne as jest.Mock).mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      const result = await service.validateUser('a@a.com', 'pass');
      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('should return tokens and user info', async () => {
      const user = { id: '1', email: 'a@a.com', role: 'social_worker', fullName: 'Test' } as User;
      const result = await service.login(user);
      expect(result.accessToken).toBe('signed-token');
      expect(result.refreshToken).toBe('signed-token');
      expect(result.user).toEqual({ id: '1', email: 'a@a.com', role: 'social_worker', fullName: 'Test' });
    });
  });
});
