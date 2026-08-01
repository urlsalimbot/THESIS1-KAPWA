import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../auth/user.entity';
import { AuthModule } from '../auth/auth.module';
import { AdminWipeService } from './admin-wipe.service';
import { AdminWipeController } from './admin-wipe.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User]), AuthModule],
  controllers: [AdminWipeController],
  providers: [AdminWipeService],
  exports: [AdminWipeService],
})
export class AdminModule {}
