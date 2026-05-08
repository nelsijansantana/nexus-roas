import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from './redis/redis.module';
import { ClickHouseModule } from './clickhouse/clickhouse.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { ProjectsModule } from './projects/projects.module';
import { AuthModule } from './auth/auth.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AdminModule } from './admin/admin.module';
import { TeamsModule } from './teams/teams.module';
import { BillingModule } from './billing/billing.module';
import { PixelEventsModule } from './pixel-events/pixel-events.module';
import { IngestModule } from './ingest/ingest.module';
import { AccountWebhooksModule } from './account-webhooks/account-webhooks.module';
import { GoogleAdsModule } from './google-ads/google-ads.module';
import { LicenseModule } from './license/license.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    RedisModule, // @Global — provides RedisService (used by AnalyticsService)
    PrismaModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    ClickHouseModule,
    AnalyticsModule,
    AdminModule,
    TeamsModule,
    BillingModule,
    PixelEventsModule,
    IngestModule,
    AccountWebhooksModule,
    GoogleAdsModule,
    LicenseModule,
  ],
})
export class AppModule {}
