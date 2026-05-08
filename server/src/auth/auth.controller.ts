import {
  Controller,
  Post,
  Patch,
  Get,
  Body,
  Headers,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, ChangePasswordDto } from './dto/auth.dto';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Get('me')
  async getMe(@Headers('authorization') authHeader: string) {
    const token = this.extractToken(authHeader);
    const { userId } = this.authService.verifyToken(token);
    return this.authService.getMe(userId);
  }

  @Patch('timezone')
  async updateTimezone(
    @Headers('authorization') authHeader: string,
    @Body('timezone') timezone: string,
  ) {
    if (!timezone || typeof timezone !== 'string') {
      throw new BadRequestException('timezone is required');
    }
    const token = this.extractToken(authHeader);
    const { userId } = this.authService.verifyToken(token);
    return this.authService.updateTimezone(userId, timezone);
  }

  @Patch('password')
  async changePassword(
    @Headers('authorization') authHeader: string,
    @Body() dto: ChangePasswordDto,
  ) {
    const token = this.extractToken(authHeader);
    const { userId } = this.authService.verifyToken(token);
    return this.authService.changePassword(userId, dto);
  }

  private extractToken(authHeader: string): string {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token não fornecido');
    }
    return authHeader.replace('Bearer ', '');
  }
}
