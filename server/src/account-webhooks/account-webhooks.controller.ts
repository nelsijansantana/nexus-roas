import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Headers, UnauthorizedException,
} from '@nestjs/common';
import { AccountWebhooksService } from './account-webhooks.service';
import { CreateAccountWebhookDto, UpdateAccountWebhookDto } from './dto/account-webhook.dto';
import { AuthService } from '../auth/auth.service';

@Controller('api/v1/account-webhooks')
export class AccountWebhooksController {
  constructor(
    private readonly service: AccountWebhooksService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  findAll(@Headers('authorization') auth: string) {
    return this.service.findAll(this.extractUser(auth));
  }

  @Post()
  create(
    @Headers('authorization') auth: string,
    @Body() dto: CreateAccountWebhookDto,
  ) {
    return this.service.create(dto, this.extractUser(auth));
  }

  @Patch(':id')
  update(
    @Headers('authorization') auth: string,
    @Param('id') id: string,
    @Body() dto: UpdateAccountWebhookDto,
  ) {
    return this.service.update(id, dto, this.extractUser(auth));
  }

  @Delete(':id')
  remove(@Headers('authorization') auth: string, @Param('id') id: string) {
    return this.service.remove(id, this.extractUser(auth));
  }

  private extractUser(authHeader: string) {
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token não fornecido');
    }
    return this.authService.verifyToken(authHeader.replace('Bearer ', ''));
  }
}
