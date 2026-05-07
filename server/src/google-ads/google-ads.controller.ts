import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Body,
  Headers,
  Redirect,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { GoogleAdsService } from './google-ads.service';

@Controller('api/v1/integrations/google-ads')
export class GoogleAdsController {
  constructor(
    private readonly authService: AuthService,
    private readonly googleAdsService: GoogleAdsService,
  ) {}

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private extractToken(authHeader: string): string {
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }
    return authHeader.slice(7);
  }

  // ─── GET /auth?projectId=xxx ───────────────────────────────────────────────
  // Returns the Google OAuth URL. The frontend opens this in a popup or redirect.

  @Get('auth')
  getAuthUrl(
    @Headers('authorization') authHeader: string,
    @Query('projectId') projectId: string,
  ) {
    if (!projectId) throw new BadRequestException('projectId is required');
    const token = this.extractToken(authHeader);
    const { userId } = this.authService.verifyToken(token);
    const authUrl = this.googleAdsService.getAuthUrl(projectId, userId);
    return { authUrl };
  }

  // ─── GET /callback?code=xxx&state=xxx ─────────────────────────────────────
  // Google redirects here after authorization. No auth header — redirects to frontend.

  @Get('callback')
  @Redirect()
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error?: string,
  ) {
    if (error) {
      const frontendUrl = (this.googleAdsService as any).frontendUrl ?? 'http://localhost:5173';
      return { url: `${frontendUrl}/integrations/google-ads?error=${encodeURIComponent(error)}` };
    }
    if (!code || !state) throw new BadRequestException('code and state are required');
    const { redirectUrl } = await this.googleAdsService.handleCallback(code, state);
    return { url: redirectUrl };
  }

  // ─── GET /accounts?session=xxx ────────────────────────────────────────────
  // Lists accessible Google Ads accounts for the OAuth session.

  @Get('accounts')
  async listAccounts(
    @Headers('authorization') authHeader: string,
    @Query('session') sessionId: string,
  ) {
    if (!sessionId) throw new BadRequestException('session is required');
    this.extractToken(authHeader); // verify user is authenticated
    const accounts = await this.googleAdsService.listAccounts(sessionId);
    return { accounts };
  }

  // ─── GET /conversion-actions?session=xxx&customerId=xxx ───────────────────
  // Lists conversion actions for a specific customer account.

  @Get('conversion-actions')
  async listConversionActions(
    @Headers('authorization') authHeader: string,
    @Query('session') sessionId: string,
    @Query('customerId') customerId: string,
  ) {
    if (!sessionId)    throw new BadRequestException('session is required');
    if (!customerId)   throw new BadRequestException('customerId is required');
    this.extractToken(authHeader);
    const conversionActions = await this.googleAdsService.listConversionActions(sessionId, customerId);
    return { conversionActions };
  }

  // ─── GET /integration?projectId=xxx ───────────────────────────────────────
  // Returns current integration status for a project.

  @Get('integration')
  async getIntegration(
    @Headers('authorization') authHeader: string,
    @Query('projectId') projectId: string,
  ) {
    if (!projectId) throw new BadRequestException('projectId is required');
    this.extractToken(authHeader);
    return this.googleAdsService.getIntegration(projectId);
  }

  // ─── POST /connect ─────────────────────────────────────────────────────────
  // Saves the Google Ads integration for a project.

  @Post('connect')
  async connect(
    @Headers('authorization') authHeader: string,
    @Body() body: {
      sessionId: string;
      projectId: string;
      customerId: string;
      conversionId: string;
      events: Record<string, { label?: string; actionResource?: string }>;
    },
  ) {
    const { sessionId, projectId, customerId, conversionId, events } = body;
    if (!sessionId)    throw new BadRequestException('sessionId is required');
    if (!projectId)    throw new BadRequestException('projectId is required');
    if (!customerId)   throw new BadRequestException('customerId is required');
    if (!conversionId) throw new BadRequestException('conversionId is required');
    if (!events || typeof events !== 'object') throw new BadRequestException('events is required');
    this.extractToken(authHeader);
    await this.googleAdsService.connect({ sessionId, projectId, customerId, conversionId, events });
    return { success: true };
  }

  // ─── DELETE /disconnect?projectId=xxx ─────────────────────────────────────
  // Removes the Google Ads integration for a project.

  @Delete('disconnect')
  async disconnect(
    @Headers('authorization') authHeader: string,
    @Query('projectId') projectId: string,
  ) {
    if (!projectId) throw new BadRequestException('projectId is required');
    this.extractToken(authHeader);
    await this.googleAdsService.disconnect(projectId);
    return { success: true };
  }
}
