import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Headers,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { TeamsService } from './teams.service';
import { AuthService } from '../auth/auth.service';
import { CreateMemberDto, UpdateMemberDto } from './dto/team.dto';

@Controller('api/v1/team')
export class TeamsController {
  constructor(
    private readonly teams: TeamsService,
    private readonly auth: AuthService,
  ) {}

  // ─── Members ──────────────────────────────────────────────────────────────

  @Get('members')
  listMembers(@Headers('authorization') authHeader: string) {
    const { ownerId } = this.extractOwner(authHeader);
    return this.teams.listMembers(ownerId);
  }

  @Post('members')
  createMember(
    @Headers('authorization') authHeader: string,
    @Body() dto: CreateMemberDto,
  ) {
    const { ownerId } = this.extractOwner(authHeader);
    return this.teams.createMember(ownerId, dto);
  }

  @Put('members/:id')
  updateMember(
    @Headers('authorization') authHeader: string,
    @Param('id') membershipId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    const { ownerId } = this.extractOwner(authHeader);
    return this.teams.updateMember(ownerId, membershipId, dto);
  }

  @Delete('members/:id')
  removeMember(
    @Headers('authorization') authHeader: string,
    @Param('id') membershipId: string,
  ) {
    const { ownerId } = this.extractOwner(authHeader);
    return this.teams.removeMember(ownerId, membershipId);
  }

  // ─── Project access ───────────────────────────────────────────────────────

  @Get('members/:id/projects')
  getMemberProjects(
    @Headers('authorization') authHeader: string,
    @Param('id') membershipId: string,
  ) {
    const { ownerId } = this.extractOwner(authHeader);
    return this.teams.getMemberProjects(ownerId, membershipId);
  }

  @Post('members/:id/projects/:projectId')
  grantAccess(
    @Headers('authorization') authHeader: string,
    @Param('id') membershipId: string,
    @Param('projectId') projectId: string,
  ) {
    const { ownerId } = this.extractOwner(authHeader);
    return this.teams.grantProjectAccess(ownerId, membershipId, projectId);
  }

  @Delete('members/:id/projects/:projectId')
  revokeAccess(
    @Headers('authorization') authHeader: string,
    @Param('id') membershipId: string,
    @Param('projectId') projectId: string,
  ) {
    const { ownerId } = this.extractOwner(authHeader);
    return this.teams.revokeProjectAccess(ownerId, membershipId, projectId);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private extractOwner(authHeader: string): {
    userId: string;
    ownerId: string;
  } {
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token não fornecido');
    }
    const payload = this.auth.verifyToken(authHeader.replace('Bearer ', ''));

    // Only account owners (non-members) can manage team
    if (payload.ownerId) {
      throw new ForbiddenException(
        'Apenas o titular da conta pode gerenciar o time',
      );
    }

    return { userId: payload.userId, ownerId: payload.userId };
  }
}
