import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { User, UserRole } from '../auth/user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  async findAll(search?: string, role?: string, page = 1, limit = 50) {
    const where: any = {};
    if (search) where.email = ILike(`%${search}%`);
    if (role) where.role = role;
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
