import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from './user.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async register(data: { email: string; password: string; role?: string; fullName?: string }) {
    const existing = await this.userRepo.findOne({ where: { email: data.email } });
    if (existing) throw new ConflictException('Email already registered');

    const hashed = await bcrypt.hash(data.password, 12);
    const user = this.userRepo.create({
      email: data.email,
      password: hashed,
      role: UserRole.SW,
      fullName: data.fullName,
      isActive: true,
    });
    await this.userRepo.save(user);
    return { id: user.id, email: user.email, role: user.role, fullName: user.fullName };
  }

  async validateUser(email: string, pass: string): Promise<User | null> {
    const user = await this.userRepo.findOne({ where: { email } });
    if (user && (await bcrypt.compare(pass, user.password))) return user;
    return null;
  }

  async login(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: this.jwtService.sign(payload, { expiresIn: '7d' }),
      user: { id: user.id, email: user.email, role: user.role, fullName: user.fullName }
    };
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken);
      const user = await this.findById(payload.sub);
      if (!user) throw new UnauthorizedException();
      return this.login(user);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
