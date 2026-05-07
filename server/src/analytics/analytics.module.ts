import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ClickHouseModule } from '../clickhouse/clickhouse.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, ClickHouseModule, AuthModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
