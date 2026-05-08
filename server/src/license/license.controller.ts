import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Headers,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { LicenseService } from './license.service';
import { AuthService } from '../auth/auth.service';

@Controller('api/v1/license')
export class LicenseController {
  constructor(
    private licenseService: LicenseService,
    private authService: AuthService,
  ) {}

  // GET /api/v1/license/info — returns current instance license status
  @Get('info')
  getInfo(@Headers('authorization') auth: string) {
    const token = auth?.replace('Bearer ', '');
    if (!token) throw new UnauthorizedException();
    this.authService.verifyToken(token); // throws if invalid
    return this.licenseService.getLicense();
  }

  // Admin endpoints — SUPER_ADMIN only
  @Get('admin/list')
  async adminList(@Headers('authorization') auth: string) {
    this.requireSuperAdmin(auth);
    return this.licenseService.adminListLicenses();
  }

  @Post('admin/create')
  async adminCreate(
    @Headers('authorization') auth: string,
    @Body()
    body: { email: string; name?: string; tier: string; expires_at?: string },
  ) {
    this.requireSuperAdmin(auth);
    return this.licenseService.adminCreateLicense(body);
  }

  @Patch('admin/revoke')
  async adminRevoke(
    @Headers('authorization') auth: string,
    @Body() body: { key: string },
  ) {
    this.requireSuperAdmin(auth);
    return this.licenseService.adminRevokeLicense(body.key);
  }

  private requireSuperAdmin(auth: string) {
    const token = auth?.replace('Bearer ', '');
    if (!token) throw new UnauthorizedException();
    const payload = this.authService.verifyToken(token);
    if (payload.role !== 'SUPER_ADMIN')
      throw new ForbiddenException('Super admin only');
  }
}
