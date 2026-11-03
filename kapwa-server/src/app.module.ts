import { esmDirname } from './common/esm-path.js';
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module.js';
import { SyncModule } from './sync/sync.module.js';
import { CasesModule } from './cases/cases.module.js';
import { ProgramsModule } from './programs/programs.module.js';
import { BeneficiariesModule } from './beneficiaries/beneficiaries.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { IrfModule } from './irf/irf.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { ChatModule } from './chat/chat.module.js';

import { CsrModule } from './csr/csr.module.js';
import { AuditModule } from './audit/audit.module.js';
import { ExportModule } from './export/export.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { FilingModule } from './filing/filing.module.js';
import { DedupModule } from './dedup/dedup.module.js';
import { UsersModule } from './users/users.module.js';
import { AccessCardsModule } from './access-cards/access-cards.module.js';
import { CaseInterventionsModule } from './case-interventions/case-interventions.module.js';
import { CaseEnrollmentsModule } from './case-enrollments/case-enrollments.module.js';
import { LcrModule } from './lcr/lcr.module.js';
import { SlaModule } from './sla/sla.module.js';
import { OtpModule } from './otp/otp.module.js';
import { MinioModule } from './minio/minio.module.js';
import { IntakeModule } from './intake/intake.module.js';
import { GisModule } from './gis/gis.module.js';
import { ReferralsModule } from './referrals/referrals.module.js';
import { AnnouncementsModule } from './announcements/announcements.module.js';
import { AgenciesModule } from './agencies/agencies.module.js';
import { InterAgencyReferralsModule } from './inter-agency-referrals/inter-agency-referrals.module.js';
import { PendingIntakesModule } from './pending-intakes/pending-intakes.module.js';
import { WalkInLogsModule } from './walk-in-logs/walk-in-logs.module.js';
import { ContactMessagesModule } from './contact-messages/contact-messages.module.js';
import { AnalyticsModule } from './analytics/analytics.module.js';
import { FourPsModule } from './fourps/fourps.module.js';
import { TeamModule } from './team/team.module.js';
import { CaseEventsModule } from './case-events/case-events.module.js';
import { SnakeNamingStrategy } from './database/snake-naming.strategy.js';
import { AllExceptionsFilter } from './common/filters/http-exception.filter.js';
import { CsrfGuard } from './common/csrf.guard.js';
import { PiiMaskingInterceptor } from './beneficiaries/pii.interceptor.js';
import { CommonModule } from './common/common.module.js';
import { AppController } from './app.controller.js';

@Module({
  imports: [
    CommonModule,
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: Number(process.env.THROTTLE_TTL_MS ?? 60000), limit: Number(process.env.THROTTLE_LIMIT ?? 60) }]),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get('DB_USER', 'kapwa'),
        password: config.get('DB_PASSWORD', 'kapwa'),
        database: config.get('DB_NAME', 'kapwa'),
        // RDS enforces TLS (rds.force_ssl=1); self-hosted Postgres stays
        // plaintext unless DB_SSL is explicitly enabled.
        ssl: config.get('DB_SSL') === 'true' ? { rejectUnauthorized: false } : false,
        entities: [esmDirname(import.meta.url) + '/**/*.entity{.ts,.js}'],
        migrations: [esmDirname(import.meta.url) + '/database/migrations/*{.ts,.js}'],
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
    ReportsModule,
    FilingModule,
    DedupModule,
    UsersModule,
    AccessCardsModule,
    CaseInterventionsModule,
    CaseEnrollmentsModule,
    LcrModule,
    SlaModule,
    OtpModule,
    MinioModule,
    IntakeModule,
    GisModule,
    ReferralsModule,
    AnnouncementsModule,
    AgenciesModule,
    InterAgencyReferralsModule,
    PendingIntakesModule,
    WalkInLogsModule,
    ContactMessagesModule,
    AnalyticsModule,
    FourPsModule,
    TeamModule,
    CaseEventsModule,
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
