import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from '../auth/user.entity';
import { UserToken } from '../auth/user-token.entity';
import { UserBarangayAssignment } from '../auth/user-barangay-assignment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserToken, UserBarangayAssignment])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
