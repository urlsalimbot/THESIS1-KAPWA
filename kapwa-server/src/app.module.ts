import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { SyncModule } from './sync/sync.module';
import { CasesModule } from './cases/cases.module';
import { InterventionsModule } from './interventions/interventions.module';
import { ProgramsModule } from './programs/programs.module';
import { BeneficiariesModule } from './beneficiaries/beneficiaries.module';
import { NotificationsModule } from './notifications/notifications.module';
import { IrfModule } from './irf/irf.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ChatModule } from './chat/chat.module';
import { TrackerModule } from './tracker/tracker.module';
import { RolesGuard } from './auth/guards/roles.guard';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get('DB_USER', 'kapwa'),
        password: config.get('DB_PASSWORD', 'kapwa'),
        database: config.get('DB_NAME', 'kapwa'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: false,
        migrationsRun: false,
        logging: ['error', 'warn'],
      }),
    }),
    AuthModule,
    SyncModule,
    CasesModule,
    InterventionsModule,
    ProgramsModule,
    BeneficiariesModule,
    NotificationsModule,
    IrfModule,
    DashboardModule,
    ChatModule,
    TrackerModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
