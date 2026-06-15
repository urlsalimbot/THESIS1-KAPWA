import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';
import { SyncQueue } from './sync-queue.entity';
import { VersionVector } from './version-vector.entity';
import { ConflictResolver } from './conflict-resolver';

@Module({
  imports: [TypeOrmModule.forFeature([SyncQueue, VersionVector])],
  controllers: [SyncController],
  providers: [SyncService, ConflictResolver],
  exports: [SyncService],
})
export class SyncModule {}
