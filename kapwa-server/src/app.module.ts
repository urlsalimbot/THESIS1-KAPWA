import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { SyncModule } from './sync/sync.module';
import { CasesModule } from './cases/cases.module';
import { ProgramsModule } from './programs/programs.module';
import { BeneficiariesModule } from './beneficiaries/beneficiaries.module';
import { NotificationsModule } from './notifications/notifications.module';
import { IrfModule } from './irf/irf.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ChatModule } from './chat/chat.module';

import { CsrModule } from './csr/csr.module';
import { AuditModule } from './audit/audit.module';
import { ExportModule } from './export/export.module';
import { FilingModule } from './filing/filing.module';
import { UsersModule } from './users/users.module';
import { AccessCardsModule } from './access-cards/access-cards.module';
import { CaseInterventionsModule } from './case-interventions/case-interventions.module';
import { LcrModule } from './lcr/lcr.module';
import { SlaModule } from './sla/sla.module';
import { OtpModule } from './otp/otp.module';
import { MinioModule } from './minio/minio.module';
import { IntakeModule } from './intake/intake.module';
import { ReferralsModule } from './referrals/referrals.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { AgenciesModule } from './agencies/agencies.module';
import { InterAgencyReferralsModule } from './inter-agency-referrals/inter-agency-referrals.module';
import { AgencyPortalModule } from './agency-portal/agency-portal.module';
import { SnakeNamingStrategy } from './database/snake-naming.strategy';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { CsrfGuard } from './common/csrf.guard';
import { PiiMaskingInterceptor } from './beneficiaries/pii.interceptor';
import { CommonModule } from './common/common.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    CommonModule,
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
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
        migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
        // The TypeORM migration chain is NOT fresh-boot-safe (legacy timestamp
        // ordering + non-idempotent statements). The canonical bootstrap is
        // migrate.ts, run explicitly in main.ts before Nest boots (and via
        // deploy.sh / run-migrations.js for incremental upgrades of existing
        // DBs). Never auto-run the chain here — it breaks fresh deployments.
        migrationsRun: false,
        synchronize: false,
        namingStrategy: new SnakeNamingStrategy(),
        logging: ['error', 'warn'],
        extra: {
          max: 25,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000,
        },
      }),
    }),
    AuthModule,
    SyncModule,
    CasesModule,
    ProgramsModule,
    BeneficiariesModule,
    NotificationsModule,
    IrfModule,
    DashboardModule,
    ChatModule,
    CsrModule,
    AuditModule,
    ExportModule,
    FilingModule,
    UsersModule,
    AccessCardsModule,
    CaseInterventionsModule,
    LcrModule,
    SlaModule,
    OtpModule,
    MinioModule,
    IntakeModule,
    ReferralsModule,
    AnnouncementsModule,
    AgenciesModule,
    InterAgencyReferralsModule,
    AgencyPortalModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: PiiMaskingInterceptor },
  ],
})
export class AppModule {}
