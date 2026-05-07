import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { GoogleAdsController } from './google-ads.controller';
import { GoogleAdsService } from './google-ads.service';

@Module({
  imports: [PrismaModule, ConfigModule, AuthModule],
  controllers: [GoogleAdsController],
  providers: [GoogleAdsService],
  exports: [GoogleAdsService],
})
export class GoogleAdsModule {}
