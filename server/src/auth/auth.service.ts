import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  OnApplicationBootstrap,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto, ChangePasswordDto } from './dto/auth.dto';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string; // system role: USER | SUPER_ADMIN
  ownerId?: string; // set when this user is a team member of another account
  memberRole?: string; // set when ownerId is set: 'admin' | 'analyst' | 'viewer'
}

@Injectable()
export class AuthService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AuthService.name);
  private readonly jwtSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const secret = this.config.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error(
        'JWT_SECRET environment variable is not set. Refusing to start with an insecure default.',
      );
    }
    this.jwtSecret = secret;
  }

  async onApplicationBootstrap() {
    await this.bootstrapAdmin();
  }

  private async bootstrapAdmin() {
    const adminEmail = this.config.get<string>('INITIAL_ADMIN_EMAIL');
    const adminPassword = this.config.get<string>('INITIAL_ADMIN_PASSWORD');

    if (!adminEmail || !adminPassword) {
      this.logger.warn(
        '[Bootstrap] INITIAL_ADMIN_EMAIL or INITIAL_ADMIN_PASSWORD not set — skipping Super Admin bootstrap.',
      );
      return;
    }

    try {
      const existing = await (this.prisma.users as any).findUnique({
        where: { email: adminEmail.toLowerCase().trim() },
      });

      if (!existing) {
        this.logger.log(`[Bootstrap] Creating Super Admin: ${adminEmail}`);
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(adminPassword, salt);

        await (this.prisma.users as any).create({
          data: {
            id: randomUUID(),
            email: adminEmail.toLowerCase().trim(),
            name: 'Super Admin',
            password: hashedPassword,
            role: 'SUPER_ADMIN',
            updatedAt: new Date(),
          },
        });
        this.logger.log(`[Bootstrap] Super Admin created successfully.`);
      } else if (existing.role !== 'SUPER_ADMIN') {
        this.logger.log(
          `[Bootstrap] Correcting role for ${adminEmail} to SUPER_ADMIN...`,
        );
        await (this.prisma.users as any).update({
          where: { id: existing.id },
          data: { role: 'SUPER_ADMIN' },
        });
        this.logger.log(`[Bootstrap] Role updated.`);
      } else {
        this.logger.log(`[Bootstrap] Super Admin check: OK (${adminEmail})`);
      }
    } catch (error) {
      this.logger.error(
        `[Bootstrap] Error during Admin initialization: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.users.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (!user) {
      throw new UnauthorizedException('Email ou senha inválidos');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Email ou senha inválidos');
    }

    // Check if this user is a team member of another account
    const membership = await (this.prisma.team_memberships as any).findFirst({
      where: { userId: user.id },
      select: { ownerId: true, role: true },
    });

    const token = this.generateToken(
      user,
      membership?.ownerId,
      membership?.role,
    );

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        ownerId: membership?.ownerId ?? null,
        memberRole: membership?.role ?? null,
      },
    };
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.users.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (existing) {
      throw new ConflictException('Email já está em uso');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(dto.password, salt);
    const now = new Date();

    const user = await this.prisma.users.create({
      data: {
        id: randomUUID(),
        email: dto.email.toLowerCase().trim(),
        name: dto.name.trim(),
        password: hashedPassword,
        createdAt: now,
        updatedAt: now,
        role: 'USER', // Explicitly set default role
      },
    });

    const token = this.generateToken(user);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  async getMe(userId: string) {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }

    const membership = await (this.prisma.team_memberships as any).findFirst({
      where: { userId: user.id },
      select: { ownerId: true, role: true },
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      timezone: (user as any).timezone ?? 'America/Sao_Paulo',
      ownerId: membership?.ownerId ?? null,
      memberRole: membership?.role ?? null,
    };
  }

  async updateTimezone(userId: string, timezone: string) {
    await this.prisma.users.update({
      where: { id: userId },
      data: { timezone, updatedAt: new Date() } as any,
    });
    return { timezone };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.users.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Usuário não encontrado');

    const valid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!valid) throw new UnauthorizedException('Senha atual incorreta');

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(dto.newPassword, salt);

    await this.prisma.users.update({
      where: { id: userId },
      data: { password: hashed, updatedAt: new Date() },
    });

    return { success: true };
  }

  verifyToken(token: string): JwtPayload {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as any;
      return {
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
        ownerId: payload.ownerId,
        memberRole: payload.memberRole,
      };
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado');
    }
  }

  private generateToken(
    user: any,
    ownerId?: string,
    memberRole?: string,
  ): string {
    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      ...(ownerId ? { ownerId, memberRole } : {}),
    };
    return jwt.sign(payload, this.jwtSecret, { expiresIn: '7d' });
  }
}
