import { Module } from '@nestjs/common';
import { IngestController } from './ingest.controller';
import { TrackingController } from './tracking.controller';
import { IngestService } from './ingest.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ClickHouseModule } from '../clickhouse/clickhouse.module';

@Module({
  imports:     [PrismaModule, ClickHouseModule],
  controllers: [IngestController, TrackingController],
  providers:   [IngestService],
})
export class IngestModule {}
