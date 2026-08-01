import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/user.entity';

@Injectable()
export class AdminWipeService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  async wipeDevice(deviceId: string): Promise<{ deviceId: string; wiped: boolean }> {
    await this.userRepo.update({ deviceId }, { tokenVersion: () => 'token_version + 1' });
    await this.userRepo.update({ deviceId }, { deviceId: '' });
    return { deviceId, wiped: true };
  }

  async wipeUser(userId: string): Promise<{ userId: string; wiped: boolean }> {
    await this.userRepo.update(userId, { tokenVersion: () => 'token_version + 1', deviceId: '' });
    return { userId, wiped: true };
  }

  async listBoundDevices(): Promise<{ id: string; email: string; deviceId: string | null }[]> {
    const users = await this.userRepo.find({
      where: {},
      select: ['id', 'email', 'deviceId'],
    });
    return users.map(u => ({ id: u.id, email: u.email, deviceId: u.deviceId || null }));
  }
}
