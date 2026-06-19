import { DEFAULT_PAGE_SIZE } from './constants';
import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, FindOptionsWhere } from 'typeorm';
import { User, UserRole } from '../auth/user.entity';
import * as bcrypt from 'bcrypt';

export interface CreateUserInput {
  email: string;
  password: string;
  role: string;
  full_name?: string;
  phone?: string;
  assigned_barangay?: string;
  permitted_barangays?: string[];
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  async findAll(search?: string, role?: string, page = 1, limit = DEFAULT_PAGE_SIZE) {
    const where: FindOptionsWhere<User> = {};
    if (search) where.email = ILike(`%${search}%`);
    if (role) where.role = role as UserRole;
    const [data, total] = await this.userRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data: data.map(({ password, ...u }) => u), total, page, limit };
  }

  async findOne(id: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    const { password, ...safe } = user;
    return safe;
  }

  async createUser(dto: CreateUserInput) {
    const validRoles = Object.values(UserRole) as string[];
    if (!validRoles.includes(dto.role)) {
      throw new BadRequestException(`Invalid role: ${dto.role}. Must be one of: ${validRoles.join(', ')}`);
    }

    const existing = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(dto.password, salt);

    const user = this.userRepo.create({
      email: dto.email,
      password: hashedPassword,
      role: dto.role as UserRole,
      fullName: dto.full_name,
      phone: dto.phone,
      assignedBarangay: dto.assigned_barangay,
      permittedBarangays: dto.permitted_barangays || [],
    });

    const saved = await this.userRepo.save(user);
    const { password, ...safe } = saved;
    return safe;
  }

  async deactivateUser(id: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    user.isActive = false;
    const saved = await this.userRepo.save(user);
    const { password, ...safe } = saved;
    return safe;
  }

  async update(id: string, data: { fullName?: string; role?: string; isActive?: boolean; assignedBarangay?: string; permittedBarangays?: string[] }) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (data.role) user.role = data.role as UserRole;
    if (data.fullName !== undefined) user.fullName = data.fullName;
    if (data.isActive !== undefined) user.isActive = data.isActive;
    if (data.assignedBarangay !== undefined) user.assignedBarangay = data.assignedBarangay;
    if (data.permittedBarangays !== undefined) user.permittedBarangays = data.permittedBarangays;
    await this.userRepo.save(user);
    const { password, ...safe } = user;
    return safe;
  }

  async remove(id: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    await this.userRepo.delete(id);
    return { deleted: true };
  }
}
