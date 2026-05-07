import { Controller, Get, Query, Headers, UnauthorizedException } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AuthService, JwtPayload } from '../auth/auth.service';

@Controller('api/v1/analytics')
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly authService: AuthService,
  ) {}

  @Get('dashboard')
  async getDashboard(
    @Headers('authorization') authHeader: string,
    @Query('projectId') projectId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('timezone') timezone?: string,
  ) {
    const caller = this.extractUser(authHeader);
    return this.analyticsService.getDashboardMetrics(caller, { projectId, startDate, endDate, timezone });
  }

  @Get('revenue-over-time')
  async getRevenueOverTime(
    @Headers('authorization') authHeader: string,
    @Query('projectId') projectId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('timezone') timezone?: string,
  ) {
    const caller = this.extractUser(authHeader);
    return this.analyticsService.getRevenueOverTime(caller, { projectId, startDate, endDate, timezone });
  }

  private extractUser(authHeader: string): JwtPayload {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token não fornecido');
    }
    return this.authService.verifyToken(authHeader.replace('Bearer ', ''));
  }
}
