import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Announcement } from './announcement.entity.js';
import { AnnouncementsService } from './announcements.service.js';
import { AnnouncementsController } from './announcements.controller.js';
import { AnnouncementsPublicController } from './announcements-public.controller.js';
import { AuthModule } from '../auth/auth.module.js';
import { FilingModule } from '../filing/filing.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Announcement]), AuthModule, FilingModule],
  controllers: [AnnouncementsPublicController, AnnouncementsController],
  providers: [AnnouncementsService],
  exports: [AnnouncementsService],
})
export class AnnouncementsModule {}
