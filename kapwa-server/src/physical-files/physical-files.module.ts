import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PhysicalFilesController } from './physical-files.controller';
import { PhysicalFilesService } from './physical-files.service';
import { PhysicalFile } from './physical-file.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([PhysicalFile]), AuthModule],
  controllers: [PhysicalFilesController],
  providers: [PhysicalFilesService],
  exports: [PhysicalFilesService],
})
export class PhysicalFilesModule {}
