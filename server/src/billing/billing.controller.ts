import {
  Controller, Get, Post, Put, Body, Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { RawBodyRequest } from '@nestjs/common';
import { Req } from '@nestjs/common';
import type { Request } from 'express';
import { BillingService } from './billing.service';
import { AuthService } from '../auth/auth.service';
import { CreateCheckoutDto } from './dto/billing.dto';

@Controller()
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly authService: AuthService,
  ) {}

  // ─── Public ───────────────────────────────────────────────────────────────

  /** Returns sanitized config (no keys) for use by the frontend */
  @Get('api/v1/billing/config')
  getPublicConfig() {
    return this.billingService.getPublicConfig();
  }

  // ─── User endpoints (auth required) ──────────────────────────────────────

  @Post('api/v1/billing/create-checkout')
  async createCheckout(
    @Headers('authorization') authHeader: string,
    @Body() dto: CreateCheckoutDto,
  ) {
    const { userId, email } = this.extractUser(authHeader);
    return this.billingService.createCheckout(userId, email, dto.planId, dto.interval);
  }

  // ─── Admin endpoints ──────────────────────────────────────────────────────

  @Get('api/v1/admin/billing/config')
  async getAdminConfig(@Headers('authorization') authHeader: string) {
    this.requireAdmin(authHeader);
    return this.billingService.getConfig();
  }

  @Put('api/v1/admin/billing/config')
  async saveAdminConfig(
    @Headers('authorization') authHeader: string,
    @Body() body: any,
  ) {
    this.requireAdmin(authHeader);
    return this.billingService.saveConfig(body);
  }

  // ─── Stripe webhook ───────────────────────────────────────────────────────

  @Post('webhooks/stripe/billing')
  async stripeWebhook(@Req() req: any) {
    const sig = req.headers['stripe-signature'] as string;
    const rawBody = req.rawBody as Buffer | undefined;
    if (!rawBody) throw new UnauthorizedException('Missing raw body');
    await this.billingService.handleStripeWebhook(rawBody, sig);
    return { received: true };
  }

  // ─── Hotmart webhook ──────────────────────────────────────────────────────

  @Post('webhooks/hotmart/billing')
  async hotmartWebhook(
    @Body() body: any,
    @Headers('x-hotmart-hottok') hottok: string,
  ) {
    await this.billingService.handleHotmartWebhook(body, hottok);
    return { received: true };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private extractUser(authHeader: string): { userId: string; email: string } {
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token não fornecido');
    }
    const payload = this.authService.verifyToken(authHeader.replace('Bearer ', ''));
    return { userId: payload.userId, email: payload.email };
  }

  private requireAdmin(authHeader: string) {
    if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedException('Token não fornecido');
    const payload = this.authService.verifyToken(authHeader.replace('Bearer ', ''));
    if (payload.role !== 'SUPER_ADMIN') throw new UnauthorizedException('Acesso negado');
  }
}
