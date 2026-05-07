import { Module } from '@nestjs/common';
import { AccountWebhooksService } from './account-webhooks.service';
import { AccountWebhooksController } from './account-webhooks.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AccountWebhooksController],
  providers: [AccountWebhooksService],
  exports: [AccountWebhooksService],
})
export class AccountWebhooksModule {}
