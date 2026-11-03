import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service.js';
import { UsersController } from './users.controller.js';
import { User } from '../auth/user.entity.js';
import { UserToken } from '../auth/user-token.entity.js';
import { UserBarangayAssignment } from '../auth/user-barangay-assignment.entity.js';
import { AccountsModule } from '../accounts/accounts.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserToken, UserBarangayAssignment]), AccountsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
